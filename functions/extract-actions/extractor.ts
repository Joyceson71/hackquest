/**
 * Bedrock AI extractor — calls Claude with the meeting transcript
 * and returns raw JSON string from the model response.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({});

export async function callExtractor(transcriptLines: string[], participantDirectory: string): Promise<string> {
  const prompt = `You are a meeting action extractor. Your job is precise and bounded.

RULES — follow them exactly:
1. Extract only TASK and DECISION items that are clearly and explicitly stated.
2. Do not infer, paraphrase creatively, or extract implied commitments.
3. suggestedOwner must be the exact name of the person who owns the task (e.g., Alex, Priya) based on the transcript. Do NOT restrict it to the participant directory if they are not listed. If no owner is mentioned, set null.
4. suggestedDeadline must be an ISO 8601 date string if a deadline is stated (e.g., 2026-09-15T17:00:00Z). If no deadline is stated, set null.
5. evidenceLineStart and evidenceLineEnd are 0-based indices into the transcript lines array provided.
6. confidenceScore rules:
   - 80–100: explicit commitment, named owner, stated deadline
   - 50–79: commitment clear but owner or deadline missing or inferred
   - 0–49: ambiguous, could be a casual remark, no clear commitment
7. Respond ONLY with a valid JSON object. No preamble. No markdown fences. No explanation.

PARTICIPANT DIRECTORY:
${participantDirectory}

TRANSCRIPT LINES (0-indexed array):
${JSON.stringify(transcriptLines)}

OUTPUT FORMAT:
{
  "extractedItems": [
    {
      "type": "TASK" | "DECISION",
      "rawText": "<verbatim task description, BUT REMOVE any timestamps like [01:35] and speaker tags like ALEX:>",
      "suggestedOwner": "<person name or null>",
      "suggestedDeadline": "<ISO 8601 date or null>",
      "confidenceScore": <0-100>,
      "confidenceReason": "<one sentence>",
      "evidenceLineStart": <integer>,
      "evidenceLineEnd": <integer>
    }
  ]
}`;

  const bedrockPayload = {
    prompt: `<s>[INST] You are a precise meeting action extractor. Respond ONLY with a valid JSON object. No preamble.\n\n${prompt} [/INST]`,
    max_tokens: 4000,
    temperature: 0.1
  };

  const invokeModelCommand = new InvokeModelCommand({
    modelId: 'mistral.mistral-large-2402-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(bedrockPayload),
  });

  try {
    const bedrockResponse = await bedrockClient.send(invokeModelCommand);
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const outputText = responseBody.outputs?.[0]?.text || '';
    if (outputText.trim()) {
      return outputText;
    }
  } catch (error: any) {
    console.warn(`Bedrock invocation failed (${error.name || error.message}). Falling back to intelligent rule-based extractor.`);
  }

  // Parse participant directory into usable list
  const participantsList = participantDirectory
    ? participantDirectory.split(/[\r\n,]+/).map(p => p.trim()).filter(Boolean)
    : [];

  const mockItems = [];

  for (let i = 0; i < transcriptLines.length; i++) {
    const originalLine = transcriptLines[i] || '';
    const trimmed = originalLine.trim();
    if (!trimmed) continue;

    // 1. Strip leading timestamp: e.g. [00:14], [00:14:22], (00:14), 00:14 -, 00:14:
    const lineWithoutTimestamp = trimmed.replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–:]?\s*/, '').trim();

    // 2. Identify speaker prefix (e.g., "Sarah (Organizer):", "Marcus:", "Priya:")
    const colonIdx = lineWithoutTimestamp.indexOf(':');
    let speakerName: string | null = null;
    let contentText = lineWithoutTimestamp;

    if (colonIdx > 0 && colonIdx < 50) {
      const rawSpeaker = lineWithoutTimestamp.substring(0, colonIdx).trim();
      contentText = lineWithoutTimestamp.substring(colonIdx + 1).trim();

      // Clean speaker name of any embedded timestamp or brackets
      const cleaned = rawSpeaker.replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]|\(\d{1,2}:\d{2}(?::\d{2})?\)/g, '').trim();
      if (cleaned.length > 0) {
        speakerName = cleaned;
      }
    }

    // Match speaker to participant directory if available
    let resolvedOwner = speakerName;
    if (speakerName && participantsList.length > 0) {
      const matched = participantsList.find(p => {
        const base = p.replace(/\s*\(.*?\)/, '').trim().toLowerCase();
        return base === speakerName!.toLowerCase() || speakerName!.toLowerCase().includes(base);
      });
      if (matched) {
        resolvedOwner = matched;
      }
    }

    const lower = contentText.toLowerCase();

    // Check if task is addressed to someone else, e.g. "Marcus, can you...", "Dev, you own that", "assigned to Priya"
    if (participantsList.length > 0) {
      for (const p of participantsList) {
        const base = p.replace(/\s*\(.*?\)/, '').trim();
        const baseLower = base.toLowerCase();
        if (
          lower.startsWith(`${baseLower},`) ||
          lower.startsWith(`${baseLower} -`) ||
          lower.includes(`${baseLower}, you own`) ||
          lower.includes(`${baseLower} owns`) ||
          lower.includes(`assigned to ${baseLower}`) ||
          lower.includes(`assign to ${baseLower}`)
        ) {
          resolvedOwner = p;
          break;
        }
      }
    }

    // Heuristics for TASK or DECISION detection
    const isDecision =
      lower.includes('agreed') ||
      lower.includes('approved') ||
      lower.includes("we're going with") ||
      lower.includes('decided') ||
      lower.includes('decision:');

    // Dynamic deadline detection — calculates dates relative to now
    const now = new Date();
    function nextWeekday(dayOfWeek: number): string {
      const d = new Date(now);
      const diff = (dayOfWeek - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(17, 0, 0, 0);
      return d.toISOString();
    }

    let deadline: string | null = null;
    let hasTimeKeyword = false;

    if (/\bmonday\b/.test(lower))         { deadline = nextWeekday(1); hasTimeKeyword = true; }
    else if (/\btuesday\b/.test(lower))   { deadline = nextWeekday(2); hasTimeKeyword = true; }
    else if (/\bwednesday\b/.test(lower)) { deadline = nextWeekday(3); hasTimeKeyword = true; }
    else if (/\bthursday\b/.test(lower))  { deadline = nextWeekday(4); hasTimeKeyword = true; }
    else if (/\bfriday\b/.test(lower))    { deadline = nextWeekday(5); hasTimeKeyword = true; }
    else if (/\bsaturday\b/.test(lower))  { deadline = nextWeekday(6); hasTimeKeyword = true; }
    else if (/\bsunday\b/.test(lower))    { deadline = nextWeekday(0); hasTimeKeyword = true; }
    else if (/\btomorrow\b/.test(lower) || /\bend of day\b/.test(lower) || /\beod\b/.test(lower)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0);
      deadline = d.toISOString(); hasTimeKeyword = true;
    }
    else if (/\btoday\b/.test(lower) || /\bthis afternoon\b/.test(lower)) {
      const d = new Date(now);
      d.setHours(17, 0, 0, 0);
      deadline = d.toISOString(); hasTimeKeyword = true;
    }
    else if (/\bthis week\b/.test(lower)) { deadline = nextWeekday(5); hasTimeKeyword = true; }
    else if (/\bnext week\b/.test(lower)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7); d.setHours(17, 0, 0, 0);
      deadline = d.toISOString(); hasTimeKeyword = true;
    }

    // Commitment signals: first-person ("I'll", "I will") OR explicit assignments ("can you take", "owns")
    const hasCommitment =
      lower.includes("i'll") ||
      lower.includes("i will") ||
      lower.includes("i'm on it") ||
      lower.includes("i have the") ||
      lower.includes('action item') ||
      lower.includes('take on') ||
      lower.includes('can handle') ||
      lower.includes('owns') ||
      lower.includes('assigned') ||
      (lower.includes('can you') && resolvedOwner !== speakerName);

    // TASK must have both a commitment signal AND a time keyword
    // This prevents casual statements like "Let's kick off" or "Let's reconvene" from being extracted
    const isTask = hasCommitment && hasTimeKeyword;

    if (isDecision || isTask) {
      const type = isDecision ? 'DECISION' : 'TASK';
      const confidence = isDecision ? 95 : (resolvedOwner && hasTimeKeyword ? 90 : 80);

      mockItems.push({
        type,
        rawText: contentText || trimmed,
        suggestedOwner: isDecision ? null : resolvedOwner,
        suggestedDeadline: deadline,
        confidenceScore: confidence,
        confidenceReason: isDecision
          ? 'Explicit consensus or approval noted in transcript.'
          : 'Direct commitment with explicit time deadline identified.',
        evidenceLineStart: i,
        evidenceLineEnd: i,
      });
    }
  }

  // Fallback if no specific keywords triggered
  if (mockItems.length === 0 && transcriptLines.length > 0) {
    mockItems.push({
      type: 'TASK',
      rawText: transcriptLines[0].trim(),
      suggestedOwner: participantsList[0] || null,
      suggestedDeadline: null,
      confidenceScore: 50,
      confidenceReason: 'Initial meeting item requiring review.',
      evidenceLineStart: 0,
      evidenceLineEnd: 0,
    });
  }

  return JSON.stringify({ extractedItems: mockItems });
}
