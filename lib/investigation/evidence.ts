import type { OpsEvent } from "@/lib/events/schema";
import type { InvestigationResult } from "@/lib/investigation/schema";

export interface EvidenceProblem {
  location: string;
  eventId: string;
}

/**
 * Free-text fields can also name events. Anything shaped like a real event id (github record ids,
 * simulator ids) that was not submitted indicates an invented record.
 */
const ID_LIKE = /\b(?:github:[\w./-]+(?::[\w./-]+)+|sim-\d{4,})\b/g;

function unknownMentions(text: string, known: ReadonlySet<string>): string[] {
  const mentions = (text.match(ID_LIKE) ?? []).map((id) => id.replace(/[./-]+$/, ""));
  return mentions.filter((id) => !known.has(id));
}

/** Returns every reference to an event id that was not submitted. Empty means traceable. */
export function findEvidenceProblems(result: InvestigationResult, events: readonly OpsEvent[]): EvidenceProblem[] {
  const known = new Set(events.map((event) => event.id));
  const problems: EvidenceProblem[] = [];
  const checkIds = (ids: readonly string[], location: string) => {
    for (const eventId of ids) if (!known.has(eventId)) problems.push({ location, eventId });
  };
  const checkText = (text: string, location: string) => {
    for (const eventId of unknownMentions(text, known)) problems.push({ location, eventId });
  };

  checkText(result.summary, "summary");
  result.observedFacts.forEach((fact, i) => {
    checkIds(fact.eventIds, `observedFacts[${i}].eventIds`);
    checkText(fact.statement, `observedFacts[${i}].statement`);
  });
  result.hypotheses.forEach((h, i) => {
    checkIds(h.supportingEventIds, `hypotheses[${i}].supportingEventIds`);
    checkText(h.title, `hypotheses[${i}].title`);
    checkText(h.reasoning, `hypotheses[${i}].reasoning`);
    h.missingEvidence.forEach((text, j) => checkText(text, `hypotheses[${i}].missingEvidence[${j}]`));
  });
  result.recommendedNextChecks.forEach((text, i) => checkText(text, `recommendedNextChecks[${i}]`));
  result.limitations.forEach((text, i) => checkText(text, `limitations[${i}]`));
  return problems;
}
