import { invoke } from "@tauri-apps/api/core";
import {
  candidateSchema,
  createEdgeInputSchema,
  createRootNodeInputSchema,
  createWorkspaceInputSchema,
  expandNodeInputSchema,
  generateCandidatesInputSchema,
  moveNodeInputSchema,
  providerSchema,
  saveProviderInputSchema,
  searchNodeItemSchema,
  searchNodesInputSchema,
  updateNodeInputSchema,
  workspaceSnapshotSchema,
  workspaceSummarySchema,
  type CreateEdgeInput,
  type CreateRootNodeInput,
  type CreateWorkspaceInput,
  type ExpandNodeInput,
  type GenerateCandidatesInput,
  type MoveNodeInput,
  type SaveProviderInput,
  type SearchNodesInput,
  type UpdateNodeInput,
} from "@/app/contracts";
import { mockCommands } from "@/app/mock-data";

const isTauriRuntime = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function execute<T>(command: string, args: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    const mock = (
      mockCommands as unknown as Record<string, (...values: unknown[]) => Promise<unknown>>
    )[command];
    if (!mock) {
      throw new Error(`missing mock command: ${command}`);
    }
    return mock(...Object.values(args)) as Promise<T>;
  }

  return invoke<T>(command, args);
}

export const commandClient = {
  async listWorkspaces() {
    const result = await execute<{ workspaces: unknown[] }>("listWorkspaces", {});
    return {
      workspaces: result.workspaces.map((item) => workspaceSummarySchema.parse(item)),
    };
  },

  async createWorkspace(input: CreateWorkspaceInput) {
    createWorkspaceInputSchema.parse(input);
    const result = await execute<{ workspace: unknown }>("createWorkspace", { input });
    return {
      workspace: workspaceSummarySchema.parse(result.workspace),
    };
  },

  async createRootNode(input: CreateRootNodeInput) {
    createRootNodeInputSchema.parse(input);
    const result = await execute<{ node: unknown }>("createRootNode", { input });
    return {
      node: workspaceSnapshotSchema.shape.current_node.parse(result.node),
    };
  },

  async getWorkspaceSnapshot(nodeId: string) {
    const result = await execute<unknown>("getWorkspaceSnapshot", { nodeId });
    return workspaceSnapshotSchema.parse(result);
  },

  async generateCandidates(nodeId: string, input: GenerateCandidatesInput) {
    generateCandidatesInputSchema.parse(input);
    const result = await execute<{ base_node_id: string; candidates: unknown[] }>(
      "generateCandidates",
      { nodeId, input },
    );
    return {
      base_node_id: result.base_node_id,
      candidates: result.candidates.map((item) => candidateSchema.parse(item)),
    };
  },

  async expandNode(nodeId: string, input: ExpandNodeInput) {
    expandNodeInputSchema.parse(input);
    const result = await execute<{ node: unknown; placement: unknown }>("expandNode", {
      nodeId,
      input,
    });
    return {
      node: workspaceSnapshotSchema.shape.current_node.parse(result.node),
      placement: result.placement,
    };
  },

  async updateNode(nodeId: string, input: UpdateNodeInput) {
    updateNodeInputSchema.parse(input);
    const result = await execute<{ node: unknown }>("updateNode", { nodeId, input });
    return {
      node: workspaceSnapshotSchema.shape.current_node.parse(result.node),
    };
  },

  async moveNode(nodeId: string, input: MoveNodeInput) {
    moveNodeInputSchema.parse(input);
    return execute<{ node_id: string; old_parent_id: string | null; new_parent_id: string }>(
      "moveNode",
      { nodeId, input },
    );
  },

  async createEdge(nodeId: string, input: CreateEdgeInput) {
    createEdgeInputSchema.parse(input);
    return execute<{
      edge: {
        from_node_id: string;
        to_node_id: string;
        relation_type: string;
      };
    }>("createEdge", { nodeId, input });
  },

  async searchNodes(input: SearchNodesInput) {
    searchNodesInputSchema.parse(input);
    const result = await execute<{ items: unknown[] }>("searchNodes", { input });
    return {
      items: result.items.map((item) => searchNodeItemSchema.parse(item)),
    };
  },

  async listProviders() {
    const result = await execute<{ providers: unknown[] }>("listProviders", {});
    return {
      providers: result.providers.map((item) => providerSchema.parse(item)),
    };
  },

  async saveProvider(input: SaveProviderInput) {
    saveProviderInputSchema.parse(input);
    const result = await execute<{ provider: unknown }>("saveProvider", { input });
    return {
      provider: providerSchema.parse(result.provider),
    };
  },

  async testProviderConnection(providerId: string) {
    return execute<{ ok: boolean; checked_at: string; message: string }>("testProviderConnection", {
      providerId,
    });
  },
};
