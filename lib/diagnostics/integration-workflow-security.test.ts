import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { INTEGRATION_TARGET_SHA } from "@/scripts/integration-verification-contract";

const source = readFileSync(".github/workflows/integration-verification.yml", "utf8");
interface Step { name?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown>; if?: string }
const workflow = parse(source) as { on: Record<string, unknown>; permissions: Record<string, string>;
  jobs: { verify: { if: string; environment: string; steps: Step[] } } };
const steps = workflow.jobs.verify.steps;

function collectUses(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => key === "uses" ? [child] : collectUses(child));
}

function assertActions(text: string) {
  const refs = collectUses(parse(text));
  for (const ref of refs) {
    if (typeof ref !== "string" || !/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(ref)) throw new Error("Unpinned action.");
  }
  expect(refs).toEqual([
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    "pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86",
    "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
  ]);
}

describe("integration verification workflow security", () => {
  it("is manual, repository/main/first-attempt restricted and references a protected environment", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.jobs.verify.if).toBe("github.repository == 'lutfim22/opsreplay' && github.ref == 'refs/heads/main' && github.run_attempt == 1");
    expect(workflow.jobs.verify.environment).toBe("integration-live-verification");
    const guard = steps.find((step) => step.name === "Validate approved inputs")!.run!;
    expect(guard).toContain(`test "$TARGET_SHA" = ${INTEGRATION_TARGET_SHA}`);
    expect(guard).toContain('test "$APPROVED_TARGET_SHA" = "$TARGET_SHA"');
    expect(guard).toContain("10#$TIMEOUT_SECONDS <= 25");
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"))!;
    expect(checkout.with).toEqual({ ref: "${{ github.sha }}", "fetch-depth": 0, "persist-credentials": false });
  });

  it("pins every semantic action reference, including quoted and flow-mapping uses keys", () => {
    assertActions(source);
    for (const injected of [
      "  extra: { uses: 'example/unreviewed@v1' }\n",
      "  extra:\n    steps:\n      - 'uses': example/unreviewed@v1\n",
      "  extra:\n    uses : example/unreviewed@v1\n",
    ]) {
      expect(() => assertActions(source.replace("jobs:\n", `jobs:\n${injected}`))).toThrow("Unpinned action");
    }
  });

  it("isolates the provider secret after parity/install, checks exit status and always deletes private output", () => {
    const secretSteps = steps.filter((step) => JSON.stringify(step).includes("secrets.INTEGRATION_GEMINI_API_KEY"));
    expect(secretSteps).toHaveLength(1);
    const probe = secretSteps[0]!;
    expect(probe.env?.GEMINI_API_KEY).toBe("${{ secrets.INTEGRATION_GEMINI_API_KEY }}");
    expect(source).not.toContain("secrets.GEMINI_API_KEY");
    const install = steps.find((step) => step.name === "Install without provider secrets or lifecycle scripts")!;
    expect(install.run).toBe("pnpm install --frozen-lockfile --ignore-scripts");
    expect(install.env).toBeUndefined();
    expect(steps.indexOf(probe)).toBeGreaterThan(steps.indexOf(install));
    expect(steps.indexOf(install)).toBeGreaterThan(steps.findIndex((step) => step.name === "Verify control and pinned application parity"));
    expect(probe.run).toContain("umask 077");
    expect(probe.run).toContain('2> "$RUNNER_TEMP/integration-probe.stderr"');
    const checker = steps.find((step) => step.name === "Validate sanitized summary and process status")!;
    expect(checker.run).toContain('test "$PROBE_EXIT_CODE" = 0');
    const cleanup = steps.at(-1)!;
    expect(cleanup.if).toBe("always()");
    expect(cleanup.run).toContain('rm -f "$RUNNER_TEMP/integration-probe.jsonl" "$RUNNER_TEMP/integration-probe.stderr"');
    expect(source).not.toMatch(/upload-artifact|INVESTIGATE_ENABLED|UPSTASH_REDIS/);
  });

  it.each([
    ["README.md", true], ["scripts/verify-gemini-integration.ts", true],
    ["lib/investigation/schema.ts", false], ["package.json", false],
    ["tsconfig.json", false], [".github/workflows/pr7-verification.yml", false],
    ["scripts/gemini-diagnostics.ts", false],
  ])("runs the actual parity guard against a changed %s", (path, allowed) => {
    const directory = mkdtempSync(join(tmpdir(), "integration-parity-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
      if (result.status !== 0) throw new Error("Offline Git fixture failed.");
      return result.stdout.trim();
    };
    try {
      git("init", "-q", "-b", "main");
      writeFileSync(join(directory, "base.txt"), "base\n");
      git("add", ".");
      git("-c", "user.name=Offline Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Base fixture");
      const target = git("rev-parse", "HEAD");
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), "changed\n");
      git("add", ".");
      git("-c", "user.name=Offline Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Changed fixture");
      const control = git("rev-parse", "HEAD");
      const script = steps.find((step) => step.name === "Verify control and pinned application parity")!.run!;
      const result = spawnSync("bash", ["-c", script], {
        cwd: directory, env: { ...process.env, TARGET_SHA: target, CONTROL_SHA: control }, encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(allowed ? 0 : 1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
