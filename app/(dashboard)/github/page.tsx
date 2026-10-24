import type { Metadata } from "next";
import { GitHubActivity } from "@/components/github/github-activity";

export const metadata: Metadata = { title: "GitHub Activity" };

export default function GitHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GitHub Activity</h1>
        <p className="text-sm text-muted-foreground">
          Read-only timeline of recent commits, pull requests and workflow runs from a public repository. LIVE GITHUB DATA, fetched via the server.
        </p>
      </div>
      <GitHubActivity />
    </div>
  );
}
