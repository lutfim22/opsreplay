import { InvestigationError } from "@/lib/investigation/errors";
import { investigateRequestSchema, MAX_BODY_BYTES } from "@/lib/investigation/schema";
import type { InvestigateRequest } from "@/lib/investigation/schema";

/** Reads at most `maxBytes` of the body, aborting as soon as the limit is exceeded. */
export async function readLimitedText(request: Request, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new InvestigationError("payload_too_large");
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new InvestigationError("payload_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Same-origin only: blocks browsers on other sites from spending this server's Gemini quota. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // malformed origin is rejected below
  }
  if (!host || originHost !== host) throw new InvestigationError("forbidden");
}

export async function parseInvestigateRequest(request: Request): Promise<InvestigateRequest> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new InvestigationError("invalid_input");
  const text = await readLimitedText(request);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvestigationError("invalid_input");
  }
  const parsed = investigateRequestSchema.safeParse(json);
  if (!parsed.success) {
    // Only the first issue's location and message are surfaced; submitted values are never echoed.
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.slice(0, 3).join(".")})` : "";
    const message = `Invalid investigation request${where}: ${issue?.message ?? "invalid input"}`;
    throw new InvestigationError("invalid_input", { message: message.slice(0, 200) });
  }
  return parsed.data;
}
