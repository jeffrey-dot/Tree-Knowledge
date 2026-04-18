import { describe, expect, it } from "vitest";
import {
  expandNodeInputSchema,
  providerSchema,
  workspaceSnapshotSchema,
} from "@/app/contracts";

describe("contracts", () => {
  it("accepts a valid provider payload", () => {
    const result = providerSchema.parse({
      id: crypto.randomUUID(),
      name: "OpenAI",
      base_url: "https://api.openai.com/v1",
      default_model: "gpt-4.1-mini",
      enabled: true,
      has_api_key: true,
      last_checked_at: null,
      last_error: null,
    });

    expect(result.name).toBe("OpenAI");
  });

  it("rejects an invalid expand input", () => {
    const result = expandNodeInputSchema.safeParse({
      mode: "child",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid workspace snapshot", () => {
    const snapshot = workspaceSnapshotSchema.parse({
      workspace: {
        id: crypto.randomUUID(),
        name: "Tree",
        description: "",
        root_node_id: crypto.randomUUID(),
        node_count: 1,
        updated_at: new Date().toISOString(),
      },
      current_node: {
        id: crypto.randomUUID(),
        workspace_id: crypto.randomUUID(),
        title: "Root",
        summary: "summary",
        body: "body",
        status: "confirmed",
        created_by_type: "ai",
        source_prompt: null,
        source_answer: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ancestors: [],
      children: [],
      related_nodes: [],
      recent_nodes: [],
      context_snapshot: {
        context_summary: "summary",
        ancestor_summary: "",
      },
      recent_candidates: [],
    });

    expect(snapshot.current_node.title).toBe("Root");
  });
});
