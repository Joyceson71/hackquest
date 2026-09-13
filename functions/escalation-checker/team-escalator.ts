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
    const openTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS' || t.status === 'BLOCKED');

    // Calculate workloads for auto-reassignment
    // workload_score = active_tasks * 3 + pending_tasks * 2 + overdue_tasks * 5
    const memberWorkloads: Record<string, number> = {};
    for (const m of activeMembers) {
      if (m.email) memberWorkloads[m.email.toLowerCase()] = 0;
    }

    for (const task of openTasks) {
      const owner = (task.currentOwner || '').toLowerCase();
      if (!owner || memberWorkloads[owner] === undefined) continue;

      const isOverdue = task.deadline && new Date(task.deadline) < now;
      let score = 0;
      if (isOverdue) score = 5;
      else if (task.status === 'IN_PROGRESS') score = 3;
      else if (task.status === 'PENDING') score = 2;

      memberWorkloads[owner] += score;
    }

    // 4. Check for escalations (inactivity or overdue)
    for (const task of openTasks) {
      if (task.escalationStatus === 'PENDING_ACCEPTANCE' || task.escalationStatus === 'ESCALATED') continue; // Already escalated

      let needsEscalation = false;
      let reason = '';

      // Check inactivity
      const lastActivityStr = task.lastActivityAt || task.createdAt || now.toISOString();
      const lastActivity = new Date(lastActivityStr);
      const hoursInactive = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      
      if (hoursInactive > INACTIVITY_THRESHOLD_HOURS) {
        needsEscalation = true;
        reason = 'INACTIVITY_TIMEOUT';
      }

      // Check deadline
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        const cutoffDate = new Date(deadlineDate.getTime() + OVERDUE_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
        if (now > cutoffDate) {
          needsEscalation = true;
          reason = reason ? 'BOTH' : 'DEADLINE_PASSED';
        }
      }

      if (!needsEscalation) continue;

      // Find replacement candidate
      const currentOwnerLower = (task.currentOwner || '').toLowerCase();
      let bestCandidate = null;
      let lowestScore = Infinity;

      for (const member of activeMembers) {
        if (!member.email) continue;
        const emailLower = member.email.toLowerCase();
        if (emailLower === currentOwnerLower) continue;

        if (memberWorkloads[emailLower] < lowestScore) {
          lowestScore = memberWorkloads[emailLower];
          bestCandidate = member;
        }
      }

      const suggestedReplacement = bestCandidate ? bestCandidate.email : null;
      
      const newStatus = suggestedReplacement ? 'REASSIGNED' : 'REASSIGNMENT_PENDING';
      const newOwner = suggestedReplacement || task.currentOwner;

      const timelineEvent = {
        M: {
          event: { S: `Escalated due to ${reason}. Auto-reassigned to ${suggestedReplacement || 'none'}` },
          actor: { S: 'SYSTEM' },
          timestamp: { S: now.toISOString() },
          note: { S: `Previous owner: ${task.currentOwner || 'None'}, Workload Score of new owner: ${lowestScore === Infinity ? 'N/A' : lowestScore}` }
        }
      };

      const ownershipEvent = {
        M: {
          fromOwner: task.currentOwner ? { S: task.currentOwner } : { NULL: true },
          toOwner: suggestedReplacement ? { S: suggestedReplacement } : { NULL: true },
          changedBy: { S: 'SYSTEM' },
          changedAt: { S: now.toISOString() },
          reason: { S: 'AUTO_REASSIGNMENT' }
        }
      };

      const pk = task.PK || (task.meetingId ? task.meetingId : `TASK#${task.actionId}`);

      try {
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: pk }, SK: { S: `ACTION#${task.actionId}` } },
          UpdateExpression: `SET #s = :s, currentOwner = :no, escalationStatus = :es, escalationReason = :er, 
            lastActivityAt = :now, timeline = list_append(if_not_exists(timeline, :el), :te), 
            ownershipHistory = list_append(if_not_exists(ownershipHistory, :el), :oe)`,
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':s': { S: newStatus },
            ':no': newOwner ? { S: newOwner } : { NULL: true },
            ':es': { S: 'ESCALATED' },
            ':er': { S: reason },
            ':now': { S: now.toISOString() },
            ':el': { L: [] },
            ':te': { L: [timelineEvent] },
            ':oe': { L: [ownershipEvent] }
          }
        }));
        console.log(`[team-escalator] Auto-reassigned task ${task.actionId} from ${task.currentOwner} to ${newOwner}`);
        totalEscalated++;
      } catch (err) {
        console.error(`[team-escalator] Failed to escalate team task ${task.actionId}`, err);
      }
    }
  }

  return totalEscalated;
}
