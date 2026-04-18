import { useEffect, useState } from "react";
import {
  type Candidate,
  type CreateWorkspaceInput,
  type RelationType,
  type Provider,
  type SearchNodeItem,
  type WorkspaceSnapshot,
  type WorkspaceSummary,
} from "@/app/contracts";
import { commandClient } from "@/app/command-client";
import { LaunchpadView } from "@/views/launchpad/LaunchpadView";
import { ProviderSettingsView } from "@/views/provider-settings/ProviderSettingsView";
import { WorkspaceView } from "@/views/workspace/WorkspaceView";

type ViewState =
  | { name: "launchpad" }
  | { name: "providers" }
  | { name: "workspace"; workspaceId: string; nodeId: string };

export function App() {
  const [view, setView] = useState<ViewState>({ name: "launchpad" });
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshWorkspaces() {
    const result = await commandClient.listWorkspaces();
    setWorkspaces(result.workspaces);
    return result.workspaces;
  }

  async function refreshProviders() {
    const result = await commandClient.listProviders();
    setProviders(result.providers);
    return result.providers;
  }

  async function loadSnapshot(nodeId: string) {
    const nextSnapshot = await commandClient.getWorkspaceSnapshot(nodeId);
    setSnapshot(nextSnapshot);
    setView({
      name: "workspace",
      workspaceId: nextSnapshot.workspace.id,
      nodeId,
    });
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await Promise.all([refreshWorkspaces(), refreshProviders()]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "初始化失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function run<T>(task: () => Promise<T>) {
    try {
      setLoading(true);
      setError(null);
      return await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
      throw cause;
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWorkspace(input: CreateWorkspaceInput) {
    await run(async () => {
      const { workspace } = await commandClient.createWorkspace(input);
      await refreshWorkspaces();

      const providerReady = providers.some((item) => item.enabled && item.has_api_key);
      if (!providerReady) {
        setView({ name: "providers" });
        return;
      }

      const { node } = await commandClient.createRootNode({
        workspace_id: workspace.id,
        question: input.initial_question,
      });
      await refreshWorkspaces();
      await loadSnapshot(node.id);
    });
  }

  async function handleOpenWorkspace(workspace: WorkspaceSummary) {
    if (!workspace.root_node_id) {
      setError("该知识库还没有根节点，请先补一个起始问题。");
      return;
    }

    await run(() => loadSnapshot(workspace.root_node_id!));
  }

  async function handleGenerateCandidates(query: string) {
    if (!snapshot) {
      return;
    }

    await run(async () => {
      await commandClient.generateCandidates(snapshot.current_node.id, { query });
      await loadSnapshot(snapshot.current_node.id);
    });
  }

  async function handleAcceptCandidate(candidate: Candidate) {
    if (!snapshot) {
      return;
    }

    await run(async () => {
      const result = await commandClient.expandNode(snapshot.current_node.id, {
        mode: candidate.mode,
        candidate_id: candidate.candidate_id,
      });
      await refreshWorkspaces();
      await loadSnapshot(result.node.id);
    });
  }

  async function handleDirectExpand(mode: "child" | "branch" | "related", query: string) {
    if (!snapshot) {
      return;
    }

    await run(async () => {
      const result = await commandClient.expandNode(snapshot.current_node.id, { mode, query });
      await refreshWorkspaces();
      await loadSnapshot(result.node.id);
    });
  }

  async function handleSaveNode(input: { title: string; summary: string; body: string }) {
    if (!snapshot) {
      return;
    }

    await run(async () => {
      await commandClient.updateNode(snapshot.current_node.id, input);
      await refreshWorkspaces();
      await loadSnapshot(snapshot.current_node.id);
    });
  }

  async function handleSearchNodes(query: string): Promise<SearchNodeItem[]> {
    if (!snapshot) {
      return [];
    }

    const result = await run(() =>
      commandClient.searchNodes({
        workspace_id: snapshot.workspace.id,
        q: query,
      }),
    );

    return result.items;
  }

  async function handleMoveNode(newParentId: string) {
    if (!snapshot) {
      return;
    }

    await run(async () => {
      await commandClient.moveNode(snapshot.current_node.id, {
        new_parent_id: newParentId,
      });
      await refreshWorkspaces();
      await loadSnapshot(snapshot.current_node.id);
    });
  }

  async function handleCreateEdge(targetNodeId: string, relationType: RelationType) {
    if (!snapshot) {
      return;
    }

    await run(async () => {
      await commandClient.createEdge(snapshot.current_node.id, {
        target_node_id: targetNodeId,
        relation_type: relationType,
      });
      await refreshWorkspaces();
      await loadSnapshot(snapshot.current_node.id);
    });
  }

  async function handleSaveProvider(input: {
    id?: string;
    name: string;
    base_url: string;
    api_key: string;
    default_model: string;
    enabled: boolean;
  }) {
    await run(async () => {
      await commandClient.saveProvider(input);
      await refreshProviders();
    });
  }

  async function handleTestProvider(providerId: string) {
    await run(async () => {
      await commandClient.testProviderConnection(providerId);
      await refreshProviders();
    });
  }

  const providerConfigured = providers.some((item) => item.enabled && item.has_api_key);

  return (
    <div className="app-shell">
      {error && (
        <div className="app-toast panel">
          <strong>操作失败</strong>
          <span>{error}</span>
        </div>
      )}

      {view.name === "launchpad" && (
        <LaunchpadView
          workspaces={workspaces}
          providers={providers}
          loading={loading}
          onCreateWorkspace={handleCreateWorkspace}
          onOpenWorkspace={(workspace) => void handleOpenWorkspace(workspace)}
          onOpenProviders={() => setView({ name: "providers" })}
        />
      )}

      {view.name === "providers" && (
        <ProviderSettingsView
          providers={providers}
          loading={loading}
          onBack={() => setView({ name: "launchpad" })}
          onSaveProvider={handleSaveProvider}
          onTestProvider={handleTestProvider}
        />
      )}

      {view.name === "workspace" && snapshot && (
        <WorkspaceView
          snapshot={snapshot}
          providerConfigured={providerConfigured}
          loading={loading}
          onBack={() => setView({ name: "launchpad" })}
          onOpenProviders={() => setView({ name: "providers" })}
          onSelectNode={(nodeId) => run(() => loadSnapshot(nodeId))}
          onGenerateCandidates={handleGenerateCandidates}
          onAcceptCandidate={handleAcceptCandidate}
          onDirectExpand={handleDirectExpand}
          onSaveNode={handleSaveNode}
          onSearchNodes={handleSearchNodes}
          onMoveNode={handleMoveNode}
          onCreateEdge={handleCreateEdge}
        />
      )}
    </div>
  );
}
