import {
  DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand,
  ScanCommand, DeleteItemCommand, GetItemCommand
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function ok(body: any) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}
function created(body: any) {
  return { statusCode: 201, headers: CORS, body: JSON.stringify(body) };
}
function notFound(msg = 'Not found') {
  return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: msg }) };
}
function badRequest(msg: string) {
  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: msg }) };
}

function mapActionItem(item: any) {
  const mapList = (l: any[], fn: (m: any) => any) => (l || []).map(e => fn(e.M));
  const raw = unmarshall(item);
  return {
    ...raw,
    corrections: mapList(item.corrections?.L || [], m => ({
      field: m?.field?.S, originalValue: m?.originalValue?.S, correctedValue: m?.correctedValue?.S,
      correctedBy: m?.correctedBy?.S, correctedAt: m?.correctedAt?.S, source: m?.source?.S,
    })),
    timeline: mapList(item.timeline?.L || [], m => ({
      event: m?.event?.S, actor: m?.actor?.S, timestamp: m?.timestamp?.S, note: m?.note?.S,
    })),
    ownershipHistory: mapList(item.ownershipHistory?.L || [], m => ({
      fromOwner: m?.fromOwner?.S || null, toOwner: m?.toOwner?.S,
      changedBy: m?.changedBy?.S, changedAt: m?.changedAt?.S, reason: m?.reason?.S,
    })),
    missedDeadlines: mapList(item.missedDeadlines?.L || [], m => ({
      deadline: m?.deadline?.S, detectedAt: m?.detectedAt?.S,
      ownerAtTime: m?.ownerAtTime?.S, reason: m?.reason?.S,
      gracePeriodHours: parseInt(m?.gracePeriodHours?.N || '24', 10),
    })),
    replacementRankingSnapshot: mapList(item.replacementRankingSnapshot?.L || [], m => ({
      name: m?.name?.S, openActionCount: parseInt(m?.openActionCount?.N || '0', 10),
      rank: parseInt(m?.rank?.N || '0', 10),
    })),
    // Normalise owner fields
    owner: item.currentOwner?.S || item.owner?.S || null,
    currentOwner: item.currentOwner?.S || item.owner?.S || null,
    originalOwner: item.originalOwner?.S || null,
    originalDeadline: item.originalDeadline?.S || null,
    deadline: item.deadline?.S || null,
    escalationStatus: item.escalationStatus?.S || 'NONE',
    escalationReason: item.escalationReason?.S || null,
    suggestedReplacementOwner: item.suggestedReplacementOwner?.S || null,
    evidenceLineStart: parseInt(item.evidenceLineStart?.N || '0', 10),
    evidenceLineEnd: parseInt(item.evidenceLineEnd?.N || '0', 10),
    evidenceTimestamp: item.evidenceTimestamp?.S || null,
    speakerContext: item.speakerContext?.S || null,
  };
}

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event));

  const path: string = event.path || '';
  const method: string = event.httpMethod || '';
  const meetingId: string | undefined = event.pathParameters?.id;
  const now = new Date().toISOString();

  // Handle preflight (API GW handles this via defaultCorsPreflightOptions but just in case)
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // GET /meetings
    // ──────────────────────────────────────────────────────────────────────────
    if (path === '/meetings' && method === 'GET') {
      const { Items } = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: { ':sk': { S: 'MEETING' } },
      }));
      return ok((Items || []).map(item => unmarshall(item)));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /meetings
    // ──────────────────────────────────────────────────────────────────────────
    if (path === '/meetings' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const newMeetingId = uuidv4();
      const s3Key = `${newMeetingId}.txt`;

      await docClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: newMeetingId },
          SK: { S: 'MEETING' },
          title: { S: body.title?.trim() || 'Untitled Meeting' },
          participants: { S: body.participants?.trim() || '' },
          meetingDate: { S: body.meetingDate || now.split('T')[0] },
          gracePeriodHours: { N: String(body.gracePeriodHours ?? 24) },
          status: { S: 'UPLOADING' },
          extractionStatus: { S: 'PENDING' },
          createdAt: { S: now },
          transcriptS3Key: { S: s3Key },
        }
      }));

      const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key, ContentType: 'text/plain' });
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      return ok({ meetingId: newMeetingId, uploadUrl });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /meetings/{id}
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path === `/meetings/${meetingId}` && method === 'GET') {
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: { ':pk': { S: meetingId }, ':sk': { S: 'MEETING' } }
      }));
      if (!Items || Items.length === 0) return notFound('Meeting not found');

      const item = unmarshall(Items[0]);
      if (item.transcriptS3Key) {
        const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: item.transcriptS3Key });
        item.transcriptUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });
      }
      return ok(item);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PATCH /meetings/{id} — update participants / gracePeriodHours
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path === `/meetings/${meetingId}` && method === 'PATCH') {
      const body = JSON.parse(event.body || '{}');
      const parts: string[] = [];
      const names: Record<string, string> = {};
      const vals: Record<string, any> = {};

      if (body.participants !== undefined) {
        parts.push('#p = :p'); names['#p'] = 'participants';
        vals[':p'] = { S: body.participants.trim().substring(0, 2000) };
      }
      if (body.gracePeriodHours !== undefined) {
        parts.push('gracePeriodHours = :g');
        vals[':g'] = { N: String(body.gracePeriodHours) };
      }
      if (parts.length === 0) return badRequest('No fields to update');

      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: 'MEETING' } },
        UpdateExpression: `SET ${parts.join(', ')}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: vals,
      }));
      return ok({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DELETE /meetings/{id}
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path === `/meetings/${meetingId}` && method === 'DELETE') {
      const { Items: all } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': { S: meetingId } }
      }));
      for (const item of (all || [])) {
        if (item.SK?.S) {
          await docClient.send(new DeleteItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: meetingId }, SK: { S: item.SK.S } }
          }));
        }
      }
      return ok({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /meetings/{id}/proposed-items
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path === `/meetings/${meetingId}/proposed-items` && method === 'GET') {
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': { S: meetingId }, ':skPrefix': { S: 'PROPOSED#' } }
      }));
      return ok((Items || []).map(item => unmarshall(item)));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /meetings/{id}/proposed-items/{itemId} — CONFIRM or REJECT
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path.includes('/proposed-items/') && method === 'PUT') {
      const itemId = event.pathParameters?.itemId;
      const body = JSON.parse(event.body || '{}');

      if (body.action === 'CONFIRM') {
        const actionId = uuidv4();
        const lineStart = parseInt(body.evidenceLineStart, 10) || 0;
        const lineEnd = parseInt(body.evidenceLineEnd, 10) || lineStart;
        const finalOwner = body.owner?.trim() || null;
        const finalDeadline = body.deadline || null;

        // Fetch original proposed item to store originalOwner/originalDeadline
        const { Item: proposedItem } = await docClient.send(new GetItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } }
        }));

        const originalOwner = proposedItem?.suggestedOwner?.S || finalOwner;
        const originalDeadline = proposedItem?.suggestedDeadline?.S || finalDeadline;

        const initialOwnershipEvent = {
          M: {
            fromOwner: { NULL: true },
            toOwner: finalOwner ? { S: finalOwner } : { NULL: true },
            changedBy: { S: 'user' },
            changedAt: { S: now },
            reason: { S: 'INITIAL' },
          }
        };

        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
          UpdateExpression: 'SET reviewStatus = :rs',
          ExpressionAttributeValues: { ':rs': { S: 'CONFIRMED' } }
        }));

        await docClient.send(new PutItemCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: { S: meetingId },
            SK: { S: `ACTION#${actionId}` },
            actionId: { S: actionId },
            sourceProposedItemId: { S: itemId || '' },
            task: { S: body.task || 'Untitled Task' },
            // Immutable originals
            originalOwner: originalOwner ? { S: originalOwner } : { NULL: true },
            originalDeadline: originalDeadline ? { S: originalDeadline } : { NULL: true },
            // Current mutable
            owner: finalOwner ? { S: finalOwner } : { NULL: true },
            currentOwner: finalOwner ? { S: finalOwner } : { NULL: true },
            deadline: finalDeadline ? { S: finalDeadline } : { NULL: true },
            // Evidence
            evidenceLineStart: { N: lineStart.toString() },
            evidenceLineEnd: { N: lineEnd.toString() },
            evidenceTimestamp: proposedItem?.evidenceTimestamp || { NULL: true },
            speakerContext: proposedItem?.speakerContext || { NULL: true },
            // Status
            status: { S: 'PENDING' },
            // Escalation
            escalationStatus: { S: 'NONE' },
            escalationTriggeredAt: { NULL: true },
            escalationReason: { NULL: true },
            suggestedReplacementOwner: { NULL: true },
            replacementRankingSnapshot: { L: [] },
            // History
            corrections: { L: [] },
            missedDeadlines: { L: [] },
            ownershipHistory: { L: [initialOwnershipEvent] },
            timeline: {
              L: [{
                M: {
                  event: { S: 'Action confirmed from transcript extraction' },
                  actor: { S: 'user' },
                  timestamp: { S: now },
                  note: { S: '' }
                }
              }]
            },
            confirmedAt: { S: now },
            completedAt: { NULL: true },
          }
        }));

        return ok({ success: true, actionId });
      }

      if (body.action === 'REJECT') {
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
          UpdateExpression: 'SET reviewStatus = :rs, rejectionNote = :rn',
          ExpressionAttributeValues: {
            ':rs': { S: 'REJECTED' },
            ':rn': body.rejectionNote ? { S: body.rejectionNote } : { NULL: true }
          }
        }));
        return ok({ success: true });
      }

      return badRequest('Invalid action. Use CONFIRM or REJECT.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /meetings/{id}/confirmed-actions
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path === `/meetings/${meetingId}/confirmed-actions` && method === 'GET') {
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': { S: meetingId }, ':skPrefix': { S: 'ACTION#' } }
      }));
      return ok((Items || []).map(item => mapActionItem(item)));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PUT /meetings/{id}/confirmed-actions/{actionId} — status update
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path.includes('/confirmed-actions/') && !path.includes('/escalation') && method === 'PUT') {
      const actionId = event.pathParameters?.actionId;
      const body = JSON.parse(event.body || '{}');
      const newStatus = body.status || 'PENDING';

      const timelineEntry = {
        M: {
          event: { S: `Status changed to ${newStatus}` },
          actor: { S: 'user' },
          timestamp: { S: now },
          note: { S: body.note || '' }
        }
      };

      try {
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
          UpdateExpression: 'SET #s = :s, timeline = list_append(if_not_exists(timeline, :el), :te)',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':s': { S: newStatus }, ':el': { L: [] }, ':te': { L: [timelineEntry] }
          }
        }));
      } catch {
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
          UpdateExpression: 'SET #s = :s',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':s': { S: newStatus } }
        }));
      }
      return ok({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DELETE /meetings/{id}/confirmed-actions/{actionId}
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path.includes('/confirmed-actions/') && !path.includes('/escalation') && method === 'DELETE') {
      const actionId = event.pathParameters?.actionId;
      await docClient.send(new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } }
      }));
      return ok({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /meetings/{id}/confirmed-actions/{actionId}/escalation/accept
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path.endsWith('/escalation/accept') && method === 'POST') {
      const actionId = event.pathParameters?.actionId;
      const body = JSON.parse(event.body || '{}');
      const newDeadline = body.newDeadline;

      if (!newDeadline) return badRequest('newDeadline is required');

      const { Item: actionItem } = await docClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } }
      }));
      if (!actionItem) return notFound('Action not found');

      const prevOwner = actionItem.currentOwner?.S || actionItem.owner?.S || null;
      const userName = 'user'; // Will be enriched once Cognito name claim available

      const ownershipEvent = {
        M: {
          fromOwner: prevOwner ? { S: prevOwner } : { NULL: true },
          toOwner: { S: userName },
          changedBy: { S: userName },
          changedAt: { S: now },
          reason: { S: 'ESCALATION_ACCEPTED' },
        }
      };
      const timelineEntry = {
        M: {
          event: { S: `Escalation accepted. New deadline: ${newDeadline}` },
          actor: { S: userName },
          timestamp: { S: now },
          note: { S: '' }
        }
      };

      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
        UpdateExpression: `SET currentOwner = :co, #owner = :co, deadline = :dl,
          escalationStatus = :es, replacementConfirmedAt = :rca, #s = :s,
          ownershipHistory = list_append(if_not_exists(ownershipHistory, :el), :ohe),
          #tl = list_append(if_not_exists(#tl, :el), :te)`,
        ExpressionAttributeNames: { '#s': 'status', '#tl': 'timeline', '#owner': 'owner' },
        ExpressionAttributeValues: {
          ':co': { S: userName }, ':dl': { S: newDeadline },
          ':es': { S: 'RESOLVED' }, ':rca': { S: now }, ':s': { S: 'PENDING' },
          ':el': { L: [] }, ':ohe': { L: [ownershipEvent] }, ':te': { L: [timelineEntry] }
        }
      }));
      return ok({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /meetings/{id}/confirmed-actions/{actionId}/escalation/decline
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path.endsWith('/escalation/decline') && method === 'POST') {
      const actionId = event.pathParameters?.actionId;

      const timelineEntry = {
        M: {
          event: { S: 'Escalation declined. Organizer must manually reassign.' },
          actor: { S: 'user' },
          timestamp: { S: now },
          note: { S: '' }
        }
      };

      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
        UpdateExpression: 'SET escalationStatus = :es, #tl = list_append(if_not_exists(#tl, :el), :te)',
        ExpressionAttributeNames: { '#tl': 'timeline' },
        ExpressionAttributeValues: {
          ':es': { S: 'DECLINED' }, ':el': { L: [] }, ':te': { L: [timelineEntry] }
        }
      }));
      return ok({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /meetings/{id}/escalations — pending escalations inbox
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path === `/meetings/${meetingId}/escalations` && method === 'GET') {
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'escalationStatus = :es',
        ExpressionAttributeValues: {
          ':pk': { S: meetingId },
          ':skPrefix': { S: 'ACTION#' },
          ':es': { S: 'PENDING_ACCEPTANCE' },
        },
      }));
      return ok((Items || []).map(item => mapActionItem(item)));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /meetings/{id}/participants/unavailable — mark owner unavailable → escalate
    // ──────────────────────────────────────────────────────────────────────────
    if (meetingId && path === `/meetings/${meetingId}/participants/unavailable` && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const name: string = body.name?.trim();
      if (!name) return badRequest('Participant name is required');

      // Fetch meeting for grace period
      const { Item: meeting } = await docClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: 'MEETING' } }
      }));
      if (!meeting) return notFound('Meeting not found');

      const gracePeriodHours = parseInt(meeting.gracePeriodHours?.N || '24', 10);
      const participantsStr = meeting.participants?.S || '';

      // Parse participant directory to validate name + get available participants
      const lines = participantsStr.split(/[\r\n]+/).map((l: string) => l.trim()).filter(Boolean).slice(0, 20);
      const allParticipants = lines.map((line: string) => {
        const match = line.match(/^(.+?)\s*\((.+?)\)\s*$/);
        return (match ? match[1] : line).trim();
      });

      if (!allParticipants.some(p => p.toLowerCase() === name.toLowerCase())) {
        return notFound(`Participant "${name}" not found in this meeting's participant directory`);
      }

      // Fetch all open actions owned by this participant (escalationStatus = NONE)
      const { Items: actionItems } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: '#s IN (:p, :ip) AND escalationStatus = :none',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':pk': { S: meetingId }, ':prefix': { S: 'ACTION#' },
          ':p': { S: 'PENDING' }, ':ip': { S: 'IN_PROGRESS' }, ':none': { S: 'NONE' },
        },
      }));

      const ownedActions = (actionItems || []).filter(item => {
        const owner = item.currentOwner?.S || item.owner?.S || '';
        return owner.toLowerCase() === name.toLowerCase();
      });

      if (ownedActions.length === 0) {
        return ok({ success: true, escalatedActions: 0 });
      }

      // Fetch all OPEN actions to count workload per participant (for ranking)
      const { Items: allOpenItems } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: '#s IN (:p, :ip)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':pk': { S: meetingId }, ':prefix': { S: 'ACTION#' },
          ':p': { S: 'PENDING' }, ':ip': { S: 'IN_PROGRESS' },
        },
      }));

      // Build workload count map
      const workloadMap = new Map<string, number>();
      for (const item of (allOpenItems || [])) {
        const owner = item.currentOwner?.S || item.owner?.S;
        if (owner) workloadMap.set(owner, (workloadMap.get(owner) || 0) + 1);
      }

      // Rank available replacements (everyone except the unavailable participant)
      const availableCandidates = allParticipants
        .filter(p => p.toLowerCase() !== name.toLowerCase())
        .map(p => ({ name: p, openActionCount: workloadMap.get(p) || 0 }))
        .sort((a, b) => a.openActionCount - b.openActionCount)
        .map((c, i) => ({ ...c, rank: i + 1 }));

      const suggestedReplacement = availableCandidates[0] || null;
      const rankingSnapshot = availableCandidates.map(c => ({
        M: { name: { S: c.name }, openActionCount: { N: String(c.openActionCount) }, rank: { N: String(c.rank) } }
      }));

      let escalatedCount = 0;
      for (const item of ownedActions) {
        try {
          const actionId = item.actionId?.S || '';
          const deadline = item.deadline?.S || null;

          // Determine reason — BOTH if deadline also passed, else OWNER_UNAVAILABLE
          let reason = 'OWNER_UNAVAILABLE';
          if (deadline) {
            const cutoff = new Date(new Date(deadline).getTime() + gracePeriodHours * 3600 * 1000);
            if (new Date() > cutoff) reason = 'BOTH';
          }

          const missedEntry = {
            M: {
              deadline: deadline ? { S: deadline } : { NULL: true },
              detectedAt: { S: now },
              ownerAtTime: { S: name },
              reason: { S: reason },
              gracePeriodHours: { N: String(gracePeriodHours) },
            }
          };
          const timelineEntry = {
            M: {
              event: { S: `Escalated: ${reason}. Suggested replacement: ${suggestedReplacement?.name || 'none'}` },
              actor: { S: 'SYSTEM' },
              timestamp: { S: now },
              note: { S: '' }
            }
          };

          await docClient.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
            UpdateExpression: `SET #s = :s, escalationStatus = :es, escalationTriggeredAt = :eta,
              escalationReason = :er, suggestedReplacementOwner = :sro, replacementRankingSnapshot = :rrs,
              missedDeadlines = list_append(if_not_exists(missedDeadlines, :el), :md),
              #tl = list_append(if_not_exists(#tl, :el), :te)`,
            ConditionExpression: 'escalationStatus = :none OR attribute_not_exists(escalationStatus)',
            ExpressionAttributeNames: { '#s': 'status', '#tl': 'timeline' },
            ExpressionAttributeValues: {
              ':s': { S: 'ESCALATED' }, ':es': { S: 'PENDING_ACCEPTANCE' },
              ':eta': { S: now }, ':er': { S: reason },
              ':sro': suggestedReplacement ? { S: suggestedReplacement.name } : { NULL: true },
              ':rrs': { L: rankingSnapshot },
              ':none': { S: 'NONE' }, ':el': { L: [] },
              ':md': { L: [missedEntry] }, ':te': { L: [timelineEntry] }
            }
          }));

          escalatedCount++;
        } catch (err: any) {
          if (err?.name !== 'ConditionalCheckFailedException') {
            console.error('Escalation write error:', err);
          }
        }
      }

      return ok({ success: true, escalatedActions: escalatedCount });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 404 fallthrough
    // ──────────────────────────────────────────────────────────────────────────
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: `Route not found: ${method} ${path}` }) };

  } catch (error: any) {
    console.error('API Error:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
};
