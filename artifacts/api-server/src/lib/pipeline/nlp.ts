import type { DetectedEntity, DetectedEvent } from "./types.js";
import { extractDatesFromText } from "./extractor.js";

const PERSON_INDICATORS = [
  /\b(Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?|Sir|Lady|Lord)\s+[A-Z][a-z]+/g,
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
];

const ORG_INDICATORS = [
  /\b[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*\s+(?:Inc\.?|Corp\.?|Ltd\.?|LLC|LLP|Co\.?|Company|Organization|Association|Institute|University|College|Hospital|Bank|Group|Foundation)\b/g,
  /\b(?:the\s+)?(?:U\.S\.|US|UK|EU|UN|WHO|NATO|FBI|CIA|NSA|DoD|DoJ|DoS|DoE|HHS|CDC|FDA|EPA)\b/g,
];

const PLACE_INDICATORS = [
  /\b(?:in|at|from|to|near|outside|inside|throughout)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /\b[A-Z][a-z]+(?:shire|ville|ton|berg|burg|ford|bury|field|wood|land|port|mouth|wick|ham)?\b/g,
];

const EVENT_KEYWORDS = [
  "signed",
  "agreed",
  "announced",
  "launched",
  "filed",
  "arrested",
  "convicted",
  "dismissed",
  "appealed",
  "settled",
  "merged",
  "acquired",
  "founded",
  "established",
  "closed",
  "opened",
  "published",
  "released",
  "appointed",
  "resigned",
  "fired",
  "hired",
  "elected",
  "voted",
  "passed",
  "rejected",
  "approved",
  "denied",
  "submitted",
  "received",
  "transferred",
  "paid",
  "owed",
  "claimed",
  "disputed",
  "alleged",
  "confirmed",
  "denied",
  "investigation",
  "meeting",
  "conference",
  "hearing",
  "trial",
  "verdict",
  "judgment",
  "order",
  "ruling",
  "decision",
  "agreement",
  "contract",
  "lawsuit",
  "complaint",
];

export function detectEntities(text: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];
  const seen = new Set<string>();

  for (const pattern of PERSON_INDICATORS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const name = match[0].trim();
      if (!seen.has(name) && name.length > 2) {
        seen.add(name);
        entities.push({ text: name, type: "PERSON" });
      }
    }
  }

  for (const pattern of ORG_INDICATORS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const name = match[0].trim();
      if (!seen.has(name) && name.length > 2) {
        seen.add(name);
        entities.push({ text: name, type: "ORG" });
      }
    }
  }

  const dates = extractDatesFromText(text);
  for (const d of dates) {
    if (!seen.has(d)) {
      seen.add(d);
      entities.push({ text: d, type: "DATE" });
    }
  }

  return entities;
}

function normalizeDate(rawDate: string): string | null {
  const cleaned = rawDate.trim();

  // Already ISO-like
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // YYYY only
  if (/^\d{4}$/.test(cleaned)) return `${cleaned}-01-01`;

  // Try to parse with Date
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}

function inferDateFromContext(
  sentence: string,
  surroundingText: string
): { date: string | null; inferred: boolean; confidence: string | null } {
  // Look for dates in surrounding context (100 chars before/after)
  const contextDates = extractDatesFromText(surroundingText);
  if (contextDates.length > 0) {
    const normalized = normalizeDate(contextDates[0]);
    if (normalized) {
      return { date: normalized, inferred: true, confidence: "context" };
    }
  }
  return { date: null, inferred: false, confidence: null };
}

export function extractEvents(text: string, sourceFile: string): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!sentence || sentence.trim().length < 20) continue;

    const lower = sentence.toLowerCase();
    const hasEventKeyword = EVENT_KEYWORDS.some((kw) => lower.includes(kw));
    if (!hasEventKeyword) continue;

    // Get surrounding context for date inference
    const contextStart = Math.max(0, i - 2);
    const contextEnd = Math.min(sentences.length - 1, i + 2);
    const surroundingText = sentences.slice(contextStart, contextEnd + 1).join(" ");

    // Try to find explicit date in sentence first
    const datesInSentence = extractDatesFromText(sentence);
    let date: string | null = null;
    let dateInferred = false;
    let dateConfidence: string | null = null;

    if (datesInSentence.length > 0) {
      date = normalizeDate(datesInSentence[0]) ?? datesInSentence[0];
      dateInferred = false;
      dateConfidence = "explicit";
    } else {
      const inferred = inferDateFromContext(sentence, surroundingText);
      date = inferred.date;
      dateInferred = inferred.inferred;
      dateConfidence = inferred.confidence;
    }

    // Extract entities from this sentence
    const entities = detectEntities(sentence)
      .filter((e) => e.type !== "DATE")
      .map((e) => e.text)
      .slice(0, 10);

    // Determine event type from keywords
    let eventType: string | null = null;
    if (lower.includes("signed") || lower.includes("agreement") || lower.includes("contract"))
      eventType = "legal_agreement";
    else if (lower.includes("filed") || lower.includes("lawsuit") || lower.includes("complaint"))
      eventType = "legal_filing";
    else if (lower.includes("appointed") || lower.includes("hired") || lower.includes("elected"))
      eventType = "appointment";
    else if (lower.includes("resigned") || lower.includes("fired") || lower.includes("left"))
      eventType = "departure";
    else if (lower.includes("founded") || lower.includes("established") || lower.includes("launched"))
      eventType = "founding";
    else if (lower.includes("paid") || lower.includes("transferred") || lower.includes("owed"))
      eventType = "financial";
    else if (lower.includes("announced") || lower.includes("released") || lower.includes("published"))
      eventType = "announcement";
    else if (lower.includes("meeting") || lower.includes("conference") || lower.includes("hearing"))
      eventType = "meeting";

    events.push({
      date,
      dateInferred,
      dateConfidence,
      description: sentence.trim(),
      sourceFile,
      sourceLocation: `sentence ${i + 1}`,
      entities,
      eventType,
    });
  }

  return events;
}

export function mergeAndSortEvents(events: DetectedEvent[]): DetectedEvent[] {
  // Sort: events with explicit dates first, then inferred, then undated
  return [...events].sort((a, b) => {
    if (a.date && b.date) {
      return a.date.localeCompare(b.date);
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    // Both no date: prefer explicit over inferred
    if (!a.dateInferred && b.dateInferred) return -1;
    if (a.dateInferred && !b.dateInferred) return 1;
    return 0;
  });
}
