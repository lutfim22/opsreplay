import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/pr7-verification.yml";
const expectedActions = [
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86",
  "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
];
const immutableAction = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?@[a-f0-9]{40}$/;

function expectReviewedActions(workflow: string) {
  const actions = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s+([^\s#]+)/gm)]
    .map((match) => match[1])
    .filter((action) => !action.startsWith("./"));

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
});
