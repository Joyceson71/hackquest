import { DynamoDBClient, ScanCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

// Thresholds for MVP - Could be read from env or db later
const INACTIVITY_THRESHOLD_HOURS = 24; 
const OVERDUE_GRACE_PERIOD_HOURS = 1;

export async function processTeamEscalations() {
  console.log('[team-escalator] Starting team task escalation scan');
  const now = new Date();
  
  // 1. Fetch all active teams
  const { Items: teamItems } = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'SK = :sk AND begins_with(PK, :prefix)',
    ExpressionAttributeValues: { ':sk': { S: 'METADATA' }, ':prefix': { S: 'TEAM#' } }
  }));

  let totalEscalated = 0;

  for (const team of (teamItems || [])) {
    const teamData = unmarshall(team);
    const teamId = teamData.teamId || teamData.PK.replace('TEAM#', '');
    if (!teamId) continue;

    const config = teamData.config || {};
    if (config.autoReassignmentEnabled === false) continue;

    const reminderAfterHours = config.reminderAfterHours || 12;
    const leaderAlertAfterHours = config.leaderAlertAfterHours || 24;
    const autoReassignAfterHours = config.autoReassignAfterHours || 48;
    const maxActiveLimit = 10;

    // 2. Fetch all members of this team
    const { Items: memberItems } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skp)',
      ExpressionAttributeValues: { ':pk': { S: `TEAM#${teamId}` }, ':skp': { S: 'MEMBER#' } }
    }));
    
    const members = (memberItems || []).map(m => unmarshall(m));
    const activeMembers = members.filter(m => m.status === 'ACTIVE');
    if (activeMembers.length === 0) continue;

    // 3. Fetch all tasks for this team
    const { Items: taskItems } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gpk AND begins_with(GSI1SK, :gskp)',
      ExpressionAttributeValues: { ':gpk': { S: `TEAM#${teamId}` }, ':gskp': { S: 'ACTION#' } }
    }));

    const tasks = (taskItems || []).map(t => unmarshall(t));
    const openTasks = tasks.filter(t => ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'BLOCKED'].includes(t.status));

    // Calculate workloads: Pending * 2, Ack * 2, InProg * 3, Blocked * 4, Overdue * 5
    const memberWorkloads: Record<string, number> = {};
    const memberCompletionRates: Record<string, number> = {};
    
    for (const m of activeMembers) {
      if (m.userId) {
        memberWorkloads[m.userId] = 0;
        memberCompletionRates[m.userId] = 0.8; // Default baseline for missing history
      }
    }

    for (const task of openTasks) {
      const assigneeUserId = task.assigneeUserId;
      if (!assigneeUserId || memberWorkloads[assigneeUserId] === undefined) continue;

      const isOverdue = task.deadline && new Date(task.deadline) < now;
      let score = 0;
      if (isOverdue) score = 5;
      else if (task.status === 'BLOCKED') score = 4;
      else if (task.status === 'IN_PROGRESS') score = 3;
      else if (task.status === 'PENDING' || task.status === 'ACKNOWLEDGED') score = 2;

      memberWorkloads[assigneeUserId] += score;
    }

    // 4. Check for escalations (inactivity or overdue)
    for (const task of openTasks) {
      if (task.escalationStatus === 'REASSIGNED' || task.escalationStatus === 'REASSIGNMENT_PENDING') continue;

      const currentEscalationLevel = task.escalationLevel || 'NONE';
      const lastActivityStr = task.lastActivityAt || task.createdAt || now.toISOString();
      const lastActivity = new Date(lastActivityStr);
      const hoursInactive = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      
      let nextLevel = currentEscalationLevel;

      if (currentEscalationLevel === 'NONE' && hoursInactive >= reminderAfterHours) {
        nextLevel = 'REMINDER_SENT';
      } else if (currentEscalationLevel === 'REMINDER_SENT' && hoursInactive >= leaderAlertAfterHours) {
        nextLevel = 'LEADER_ALERTED';
      } else if (currentEscalationLevel === 'LEADER_ALERTED' && hoursInactive >= autoReassignAfterHours) {
        nextLevel = 'AUTO_REASSIGNED';
      }

      if (nextLevel === currentEscalationLevel) continue; // No state change needed

      const currentAssigneeUserId = task.assigneeUserId;
      let newAssigneeUserId = currentAssigneeUserId;
      let newStatus = task.status;
      let eventMsg = `Escalation level increased to ${nextLevel} due to inactivity (${Math.round(hoursInactive)}h).`;

      if (nextLevel === 'AUTO_REASSIGNED') {
        let bestCandidate = null;
        let lowestScore = Infinity;

        for (const member of activeMembers) {
          if (!member.userId) continue;
          if (member.userId === currentAssigneeUserId) continue; // Skip current
          if (memberWorkloads[member.userId] > maxActiveLimit) continue; // Capacity limit

          const workload = memberWorkloads[member.userId];
          
          if (workload < lowestScore) {
            lowestScore = workload;
            bestCandidate = member;
          } else if (workload === lowestScore && bestCandidate) {
            // Tie-breaker on completion rate
            if (memberCompletionRates[member.userId] > memberCompletionRates[bestCandidate.userId]) {
              bestCandidate = member;
            }
          }
        }

        if (bestCandidate) {
          newAssigneeUserId = bestCandidate.userId;
          newStatus = 'REASSIGNED';
          eventMsg = `Escalation AUTO_REASSIGNED triggered. Task automatically moved to user ${bestCandidate.userId} (Workload: ${lowestScore}).`;
        } else {
          newStatus = 'REASSIGNMENT_PENDING';
          eventMsg = `Escalation AUTO_REASSIGNED triggered. NO CANDIDATE available. Task locked and requires manual leader intervention.`;
        }
      }

      const timelineEvent = {
        M: {
          event: { S: eventMsg },
          actorId: { S: 'SYSTEM' },
          timestamp: { S: now.toISOString() },
          note: { S: '' }
        }
      };

      const pk = task.PK || (task.meetingId ? task.meetingId : `TASK#${task.actionId}`);
      const currentVersion = task.assignmentVersion ? String(task.assignmentVersion) : '1';

      try {
        const parts = [
          'escalationLevel = :el',
          'lastActivityAt = :now',
          '#s = :ns'
        ];
        
        const vals: any = {
          ':el': { S: nextLevel },
          ':now': { S: now.toISOString() },
          ':ns': { S: newStatus },
          ':emptyList': { L: [] },
          ':te': { L: [timelineEvent] },
          ':expectedVersion': { N: currentVersion }
        };

        if (newAssigneeUserId !== currentAssigneeUserId && newAssigneeUserId) {
          parts.push('assigneeUserId = :auid');
          vals[':auid'] = { S: newAssigneeUserId };
        }
        
        parts.push('timeline = list_append(if_not_exists(timeline, :emptyList), :te)');

        // If we reassigned, bump assignment version
        if (newStatus === 'REASSIGNED') {
          parts.push('assignmentVersion = assignmentVersion + :one');
          vals[':one'] = { N: '1' };
        }

        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: pk }, SK: { S: `ACTION#${task.actionId}` } },
          UpdateExpression: `SET ${parts.join(', ')}`,
          ConditionExpression: 'attribute_not_exists(assignmentVersion) OR assignmentVersion = :expectedVersion',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: vals
        }));
        
        console.log(`[team-escalator] Action ${task.actionId} escalated to ${nextLevel}. Status: ${newStatus}`);
        totalEscalated++;
      } catch (err: any) {
        if (err.name === 'ConditionalCheckFailedException') {
          console.log(`[team-escalator] Concurrency lock prevented escalation for task ${task.actionId}. Version changed during scan.`);
        } else {
          console.error(`[team-escalator] Failed to escalate team task ${task.actionId}`, err);
        }
      }
    }
  }

  return totalEscalated;
}
