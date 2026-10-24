import { z } from "zod";

export const eventProviderSchema = z.enum(["simulator", "shelly", "github"]);
export const eventSeveritySchema = z.enum(["info", "warning", "critical"]);

export const eventSourceRefSchema = z
  .object({
    provider: eventProviderSchema,
    name: z.string().min(1),
    simulated: z.boolean(),
  })
  .strict();

export const eventMetricsSchema = z
  .object({
    powerW: z.number().finite().nonnegative().optional(),
    voltageV: z.number().finite().nonnegative().optional(),
    currentA: z.number().finite().nonnegative().optional(),
    energyWh: z.number().finite().nonnegative().optional(),
  })
  .strict();

export const opsEventSchema = z
  .object({
    id: z.string().min(1),
    source: eventSourceRefSchema,
    type: z.string().regex(/^[a-z]+(\.[a-z_]+)+$/, "type must look like 'domain.name'"),
    timestamp: z.iso.datetime(),
    severity: eventSeveritySchema,
    deviceId: z.string().min(1).optional(),
    metrics: eventMetricsSchema.optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict()
  .refine((event) => event.source.provider !== "simulator" || event.source.simulated, {
    message: "simulator events must be flagged as simulated",
    path: ["source", "simulated"],
  });

export type OpsEvent = z.infer<typeof opsEventSchema>;
export type EventSeverity = z.infer<typeof eventSeveritySchema>;
export type EventProvider = z.infer<typeof eventProviderSchema>;
export type EventSourceRef = z.infer<typeof eventSourceRefSchema>;

export function parseOpsEvent(input: unknown): OpsEvent {
  return opsEventSchema.parse(input);
}
