import type { EventSourceRef, OpsEvent } from "@/lib/events/schema";
import { opsEventSchema } from "@/lib/events/schema";

/**
 * A provider of events (simulator, Shelly, GitHub...). `normalize` maps one raw
 * provider record into an OpsEvent and must preserve the source identity.
 */
export interface EventSource<TRaw> {
  readonly ref: EventSourceRef;
  /** Returns the raw records the provider has produced, in provider order. */
  readRaw(): readonly TRaw[];
  normalize(raw: TRaw): OpsEvent;
}

export interface NormalizationError {
  index: number;
  message: string;
}

export interface NormalizationResult {
  events: OpsEvent[];
  errors: NormalizationError[];
}

/** Normalizes and validates every raw record; invalid records are reported, not thrown. */
export function normalizeAll<TRaw>(source: EventSource<TRaw>, raws: readonly TRaw[] = source.readRaw()): NormalizationResult {
  const events: OpsEvent[] = [];
  const errors: NormalizationError[] = [];
  raws.forEach((raw, index) => {
    try {
      const parsed = opsEventSchema.safeParse(source.normalize(raw));
      if (!parsed.success) {
        errors.push({ index, message: parsed.error.message });
      } else if (
        parsed.data.source.provider !== source.ref.provider ||
        parsed.data.source.name !== source.ref.name ||
        parsed.data.source.simulated !== source.ref.simulated
      ) {
        errors.push({ index, message: "event source does not match the originating EventSource" });
      } else {
        events.push(parsed.data);
      }
    } catch (error) {
      errors.push({ index, message: error instanceof Error ? error.message : "normalization failed" });
    }
  });
  return { events, errors };
}
