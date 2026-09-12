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
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4000,
    messages: [
      { role: "user", content: prompt }
    ]
  };

  const invokeModelCommand = new InvokeModelCommand({
    modelId: 'anthropic.claude-sonnet-4-5-20250514-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(bedrockPayload),
  });

  const bedrockResponse = await bedrockClient.send(invokeModelCommand);
  const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
  return responseBody.content[0].text;
}
