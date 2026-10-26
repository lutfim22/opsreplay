import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflowPath = ".github/workflows/pr7-verification.yml";
const expectedActions = [
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86",
  "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
];
const immutableAction = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?@[a-f0-9]{40}$/;

function collectUses(value: unknown, references: unknown[] = [], seen = new Set<object>()): unknown[] {
  if (!value || typeof value !== "object" || seen.has(value)) return references;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectUses(item, references, seen);
    return references;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "uses") references.push(child);
    collectUses(child, references, seen);
  }
  return references;
}

function expectReviewedActions(workflow: string) {
  const actions = collectUses(parse(workflow)).filter((action) => {
    if (typeof action !== "string") throw new Error("Action reference must be a string");
    return !action.startsWith("./");
  }) as string[];

  for (const action of actions) {
    if (!immutableAction.test(action)) throw new Error(`External action is not pinned to a full commit SHA: ${action}`);
  }
  expect(actions).toEqual(expectedActions);
}

describe("PR7 verification workflow security", () => {
  it("pins every external action to its reviewed full commit SHA", () => {
    expectReviewedActions(readFileSync(workflowPath, "utf8"));
  });

  it("rejects a job-level reusable workflow using a movable tag", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(
      "jobs:\n",
      "jobs:\n  unreviewed-reusable-workflow:\n    uses: example/action/.github/workflows/check.yml@v1\n",
    );

    expect(() => expectReviewedActions(workflow)).toThrow("External action is not pinned to a full commit SHA");
  });

  it("rejects a job-level reusable workflow in an inline flow mapping", () => {
    const workflow = readFileSync(workflowPath, "utf8").replace(
      "jobs:\n",
      "jobs:\n  unreviewed-reusable-workflow: { uses: 'example/action/.github/workflows/check.yml@v1' }\n",
    );

    expect(() => expectReviewedActions(workflow)).toThrow("External action is not pinned to a full commit SHA");
  });

  it.each([
    ["job", '  unreviewed-job:\n    "uses": example/action/.github/workflows/check.yml@v1\n'],
    ["step", '  unreviewed-job:\n    steps:\n      - name: Unreviewed\n        "uses": example/action@v1\n'],
  ])("rejects a quoted uses key in a %s", (_kind, job) => {
    const workflow = readFileSync(workflowPath, "utf8").replace("jobs:\n", `jobs:\n${job}`);

    expect(() => expectReviewedActions(workflow)).toThrow("External action is not pinned to a full commit SHA");
  });

  it.each([
    ["job", "  unreviewed-job:\n    uses : example/action/.github/workflows/check.yml@v1\n"],
    ["step", "  unreviewed-job:\n    steps:\n      - name: Unreviewed\n        uses : example/action@v1\n"],
  ])("rejects whitespace before the uses colon in a %s", (_kind, job) => {
    const workflow = readFileSync(workflowPath, "utf8").replace("jobs:\n", `jobs:\n${job}`);

    expect(() => expectReviewedActions(workflow)).toThrow("External action is not pinned to a full commit SHA");
  });
});
