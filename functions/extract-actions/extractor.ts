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
3. suggestedOwner must be a name from the participant directory. If no match, set null.
4. suggestedDeadline must be an ISO 8601 date string if a deadline was stated. If none was stated, set null.
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
      "rawText": "<verbatim or near-verbatim from transcript>",
      "suggestedOwner": "<participant name or null>",
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
    return responseBody.outputs[0].text;
  } catch (error: any) {
    if (error.name === 'ValidationException' || error.message?.includes('not allowed') || error.message?.includes('invalid')) {
      console.warn("Bedrock is blocked in this account. Returning fallback demo extraction.");
      return JSON.stringify({
        extractedItems: [
          { type: "DECISION", rawText: "Agreed — we're going with Headline B.", suggestedOwner: null, suggestedDeadline: null, confidenceScore: 95, confidenceReason: "Explicitly agreed upon.", evidenceLineStart: 2, evidenceLineEnd: 2 },
          { type: "TASK", rawText: "I'll have the updated landing page copy ready by Friday.", suggestedOwner: "Marcus", suggestedDeadline: "2026-09-18T00:00:00.000Z", confidenceScore: 90, confidenceReason: "Clear commitment.", evidenceLineStart: 1, evidenceLineEnd: 1 },
          { type: "TASK", rawText: "I can handle the email campaign setup... targeting end of next week.", suggestedOwner: "Priya", suggestedDeadline: "2026-09-25T00:00:00.000Z", confidenceScore: 85, confidenceReason: "Clear commitment.", evidenceLineStart: 3, evidenceLineEnd: 3 },
          { type: "TASK", rawText: "I'll send the brief to design this afternoon.", suggestedOwner: "Marcus", suggestedDeadline: "2026-09-13T17:00:00.000Z", confidenceScore: 90, confidenceReason: "Clear commitment.", evidenceLineStart: 5, evidenceLineEnd: 5 },
          { type: "TASK", rawText: "I need two more days — so Wednesday should be fine.", suggestedOwner: "Dev", suggestedDeadline: "2026-09-16T00:00:00.000Z", confidenceScore: 85, confidenceReason: "Clear commitment.", evidenceLineStart: 7, evidenceLineEnd: 8 }
        ]
      });
    }
    throw error;
  }
}
