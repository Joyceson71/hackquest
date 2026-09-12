/**
 * Validator — applies all validation rules from the AI extraction contract (Step 5).
 * Validates JSON structure, line bounds, confidence clamping, type checking, and sanitization.
 */

interface RawExtractedItem {
  type: string;
  rawText: string;
  suggestedOwner: string | null;
  suggestedDeadline: string | null;
  confidenceScore: number;
  confidenceReason: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
}

export interface ValidatedItem {
  type: 'TASK' | 'DECISION';
  rawText: string;
  suggestedOwner: string | null;
  suggestedDeadline: string | null;
  confidenceScore: number;
  confidenceReason: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
}

function sanitizeString(s: string, maxLength: number): string {
  if (typeof s !== 'string') return '';
  // Trim whitespace
  let result = s.trim();
  // Limit length
  if (result.length > maxLength) result = result.substring(0, maxLength);
  // Basic XSS sanitization — strip HTML tags
  result = result.replace(/<[^>]*>/g, '');
  return result;
}

export function validateExtraction(
  rawJsonString: string,
  transcriptLineCount: number
): { items: ValidatedItem[]; errors: string[] } {
  const errors: string[] = [];

  // 1. Parse JSON
  let parsed: { extractedItems?: RawExtractedItem[] };
  try {
    parsed = JSON.parse(rawJsonString);
  } catch (e) {
    return { items: [], errors: ['Response is not valid JSON'] };
  }

  // 2. Check extractedItems is an array
  if (!Array.isArray(parsed.extractedItems)) {
    return { items: [], errors: ['extractedItems is not an array — treating as empty extraction'] };
  }

  const validItems: ValidatedItem[] = [];

  for (let i = 0; i < parsed.extractedItems.length; i++) {
    const item = parsed.extractedItems[i];
    const itemLabel = `Item ${i}`;

    // 5. Type must be TASK or DECISION
    if (item.type !== 'TASK' && item.type !== 'DECISION') {
      errors.push(`${itemLabel}: invalid type "${item.type}" — skipped`);
      continue;
    }

    // 3. Line bounds check
    if (
      typeof item.evidenceLineStart !== 'number' ||
      typeof item.evidenceLineEnd !== 'number' ||
      item.evidenceLineStart < 0 ||
      item.evidenceLineEnd < 0 ||
      item.evidenceLineStart >= transcriptLineCount ||
      item.evidenceLineEnd >= transcriptLineCount
    ) {
      errors.push(`${itemLabel}: evidence line bounds out of range — skipped`);
      continue;
    }

    // 4. Clamp confidence score
    let confidence = typeof item.confidenceScore === 'number' ? item.confidenceScore : 50;
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    // 6. Sanitize strings
    validItems.push({
      type: item.type as 'TASK' | 'DECISION',
      rawText: sanitizeString(item.rawText || '', 1000),
      suggestedOwner: item.suggestedOwner ? sanitizeString(item.suggestedOwner, 100) : null,
      suggestedDeadline: item.suggestedDeadline ? sanitizeString(item.suggestedDeadline, 30) : null,
      confidenceScore: confidence,
      confidenceReason: sanitizeString(item.confidenceReason || '', 500),
      evidenceLineStart: item.evidenceLineStart,
      evidenceLineEnd: item.evidenceLineEnd,
    });
  }

  return { items: validItems, errors };
}
