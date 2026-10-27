import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REDIS_TARGET_SHA } from "@/scripts/redis-verification-contract";

interface Step { name?: string; uses?: string; run?: string; if?: string; env?: Record<string, string>; with?: Record<string, unknown> }
const source = readFileSync(".github/workflows/redis-verification.yml", "utf8");
const workflow = parse(source) as { on: Record<string, unknown>; permissions: Record<string, string>;
  jobs: { verify: { if: string; environment: string; "timeout-minutes": number; env: Record<string, string>; steps: Step[] } } };
const job = workflow.jobs.verify;
const steps = job.steps;
const guard = steps.find((step) => step.name === "Validate approved Redis inputs")!;

describe("isolated Redis workflow security", () => {
  it("is manual, owner-only, main-only, first-attempt-only and uses a separate protected Environment", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(Object.keys(workflow.jobs)).toEqual(["verify"]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(job.if).toBe("github.repository == 'lutfim22/opsreplay' && github.ref == 'refs/heads/main' && github.run_attempt == 1 && github.actor == 'lutfim22' && github.triggering_actor == 'lutfim22'");
    expect(job.environment).toBe("integration-redis-verification");
    expect(job["timeout-minutes"]).toBe(5);
    expect(guard.env).toEqual({
      APPROVED_TARGET_SHA: "${{ vars.INTEGRATION_REDIS_APPROVED_TARGET_SHA }}",
      APPROVED_CONTROL_SHA: "${{ vars.INTEGRATION_REDIS_APPROVED_CONTROL_SHA }}",
      APPROVED_REDIS_HOST: "${{ vars.INTEGRATION_REDIS_APPROVED_HOST }}",
      REDIS_ISOLATED_DATABASE: "${{ vars.INTEGRATION_REDIS_ISOLATED_DATABASE }}",
    });
    expect(job.env.CONTROL_SHA).toBe("${{ github.sha }}");
    expect(source).not.toMatch(/GEMINI_API_KEY|INVESTIGATE_ENABLED|secrets\.UPSTASH_REDIS|workflow_call|upload-artifact/);
  });

  it.each([
    ["exact approvals", {}, true],
    ["wrong target", { TARGET_SHA: "b".repeat(40) }, false],
    ["missing target approval", { APPROVED_TARGET_SHA: "" }, false],
    ["wrong control", { APPROVED_CONTROL_SHA: "b".repeat(40) }, false],
    ["branch as control", { CONTROL_SHA: "main", APPROVED_CONTROL_SHA: "main" }, false],
    ["missing host approval", { APPROVED_REDIS_HOST: "" }, false],
    ["unapproved host", { REDIS_DATABASE_HOST: "other.upstash.io" }, false],
    ["arbitrary endpoint", { REDIS_DATABASE_HOST: "example.com", APPROVED_REDIS_HOST: "example.com" }, false],
    ["URL as host", { REDIS_DATABASE_HOST: "https://offline.upstash.io", APPROVED_REDIS_HOST: "https://offline.upstash.io" }, false],
    ["missing isolation attestation", { REDIS_ISOLATED_DATABASE: "" }, false],
    ["invalid approval issue", { APPROVAL_ISSUE: "0" }, false],
  ])("executes the actual input guard: %s", (_name, overrides, passes) => {
    const result = spawnSync("bash", ["-c", guard.run!], { encoding: "utf8", env: {
      ...process.env, TARGET_SHA: REDIS_TARGET_SHA, APPROVED_TARGET_SHA: REDIS_TARGET_SHA,
      CONTROL_SHA: "a".repeat(40), APPROVED_CONTROL_SHA: "a".repeat(40),
      REDIS_DATABASE_HOST: "offline.upstash.io", APPROVED_REDIS_HOST: "offline.upstash.io",
      REDIS_ISOLATED_DATABASE: "1", APPROVAL_ISSUE: "14", ...overrides,
    } });
    expect(result.status, result.stderr).toBe(passes ? 0 : 1);
  });

  it("pins actions, checks reviewed source before installation and exposes only dedicated probe credentials", () => {
    expect(steps.filter((step) => step.uses).map((step) => step.uses)).toEqual([
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86",
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
    ]);
    expect(steps.find((step) => step.uses?.startsWith("actions/checkout@"))?.with)
      .toEqual({ ref: "${{ github.sha }}", "fetch-depth": 0, "persist-credentials": false });
    const secretSteps = steps.filter((step) => JSON.stringify(step).includes("secrets."));
    expect(secretSteps).toHaveLength(1);
    const probe = secretSteps[0]!;
    expect(probe.env).toMatchObject({
      REDIS_VERIFICATION_AUTHORIZED: "1",
      REDIS_VERIFICATION_REST_URL: "${{ secrets.INTEGRATION_REDIS_REST_URL }}",
      REDIS_VERIFICATION_REST_TOKEN: "${{ secrets.INTEGRATION_REDIS_REST_TOKEN }}",
    });
    expect(Object.values(job.env).some((value) => value.includes("secrets."))).toBe(false);
    const install = steps.findIndex((step) => step.name === "Install without Redis secrets or lifecycle scripts");
    expect(steps[install]?.run).toBe("pnpm install --frozen-lockfile --ignore-scripts");
    expect(steps[install]?.env).toBeUndefined();
    expect(install).toBeGreaterThan(steps.findIndex((step) => step.name === "Verify pinned Redis application parity"));
    expect(steps.indexOf(probe)).toBeGreaterThan(install);
    expect(probe.run).toContain("umask 077");
    expect(probe.run).toContain('2> "$RUNNER_TEMP/redis-probe.stderr"');
    expect(steps.find((step) => step.name === "Validate sanitized Redis summary and process status")?.run).toContain('test "$PROBE_EXIT_CODE" = 0');
    expect(steps.at(-1)?.if).toBe("always()");
    expect(steps.at(-1)?.run).toBe('rm -f "$RUNNER_TEMP/redis-probe.jsonl" "$RUNNER_TEMP/redis-probe.stderr"');
  });

  it.each([
    [".github/workflows/redis-verification.yml", true], ["scripts/verify-redis-integration.ts", true],
    ["docs/INTEGRATION_VERIFICATION.md", true], ["lib/investigation/quota.ts", false],
    ["package.json", false], ["pnpm-lock.yaml", false], ["tsconfig.json", false],
    [".github/workflows/integration-verification.yml", false], ["scripts/verify-gemini-integration.ts", false],
  ])("executes parity validation against a changed %s", (path, passes) => {
    const directory = mkdtempSync(join(tmpdir(), "redis-parity-"));
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
      const parity = steps.find((step) => step.name === "Verify pinned Redis application parity")!.run!;
      const result = spawnSync("bash", ["-c", parity], { cwd: directory, encoding: "utf8",
        env: { ...process.env, TARGET_SHA: target, CONTROL_SHA: control } });
      expect(result.status, result.stderr).toBe(passes ? 0 : 1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
