import { describe, expect, it } from "vitest";
import type { OpsEvent } from "@/lib/events/schema";
import { captureInvestigationInput, isInvestigationStale } from "@/lib/investigation/stale";

const event: OpsEvent = {
  id: "sim-0001",
  source: { provider: "simulator", name: "demo", simulated: true },
  type: "power.reading",
  timestamp: "2025-01-01T00:00:00.000Z",
  severity: "info",
  payload: { title: "reading" },
};
const events = [event];

describe("investigation result freshness", () => {
  it("becomes stale when alignment changes and fresh again when restored", () => {
    const submitted = { events, demoAlignment: false };
    expect(isInvestigationStale(submitted, { events, demoAlignment: false })).toBe(false);
    expect(isInvestigationStale(submitted, { events, demoAlignment: true })).toBe(true);
    expect(isInvestigationStale(submitted, { events, demoAlignment: false })).toBe(false);
  });

  it("compares the submitted alignment when the display changes while a request is pending", async () => {
    const submitted = captureInvestigationInput(events, false);
    let finish: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    let currentAlignment = false;
    currentAlignment = true;
    finish?.();
    await pending;
    expect(isInvestigationStale(submitted, { events, demoAlignment: currentAlignment })).toBe(true);
  });

  it("still detects changed event content and ignores display order", () => {
    const submitted = { events: [event, { ...event, id: "sim-0002" }], demoAlignment: true };
    expect(isInvestigationStale(submitted, { events: [...submitted.events].reverse(), demoAlignment: true })).toBe(false);
    expect(isInvestigationStale(submitted, { events: [{ ...event, payload: { title: "changed" } }, submitted.events[1]!], demoAlignment: true })).toBe(true);
  });
});
