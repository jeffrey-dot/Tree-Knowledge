import {
  type Candidate,
  type CreateRootNodeInput,
  type CreateWorkspaceInput,
  type ExpandNodeInput,
  type GenerateCandidatesInput,
  type MoveNodeInput,
  type NodeMode,
  type PathNode,
  type NodeSummary,
  type Provider,
  type RelationType,
  type SaveProviderInput,
  type SearchNodeItem,
  type SearchNodesInput,
  type UpdateNodeInput,
  type WorkspaceSnapshot,
  type WorkspaceSummary,
} from "@/app/contracts";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

type MockState = {
  workspaces: WorkspaceSummary[];
  nodes: NodeSummary[];
  hierarchy: Array<{ parent: string; child: string }>;
  edges: Array<{ from: string; to: string; relation: RelationType }>;
  candidates: Candidate[];
  providers: Provider[];
};

const seedWorkspaceId = newId();
const seedRootId = newId();
const seedChildId = newId();

const state: MockState = {
  workspaces: [
    {
      id: seedWorkspaceId,
      name: "Tree Knowledge",
      description: "用节点而不是聊天堆叠研究产品定义。",
      root_node_id: seedRootId,
      node_count: 2,
      updated_at: now(),
    },
  ],
  nodes: [
    {
      id: seedRootId,
      workspace_id: seedWorkspaceId,
      title: "Tree Knowledge",
      summary: "把线性问答沉淀成可回跳、可分叉、可关联的知识网络。",
      body: "根节点聚焦产品目标、知识结构和 MVP 边界。",
      status: "confirmed",
      created_by_type: "ai",
      source_prompt: "Tree Knowledge 是什么",
      source_answer: null,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: seedChildId,
      workspace_id: seedWorkspaceId,
      title: "为什么不是聊天记录",
      summary: "线性消息流让回跳、复用和结构修正都很痛苦。",
      body: "这个节点解释为什么节点是资产，消息只是材料。",
      status: "confirmed",
      created_by_type: "ai",
      source_prompt: "为什么不继续做聊天 UI",
      source_answer: null,
      created_at: now(),
      updated_at: now(),
    },
  ],
  hierarchy: [{ parent: seedRootId, child: seedChildId }],
  edges: [],
  candidates: [
    {
      candidate_id: newId(),
      title: "工作台为什么要围绕当前节点",
      summary: "解释当前节点如何成为图谱、详情和输入的共同中心。",
      mode: "child",
      suggested_relation_type: "related_to",
      why_this_branch: "它直接决定整个产品不会退化为聊天界面。",
      accepted: false,
    },
  ],
  providers: [],
};

function summarize(question: string) {
  return {
    title: question.split(/[？?，。,.\n]/).filter(Boolean)[0] || "新节点",
    summary: `围绕“${question.slice(0, 24)}”生成的知识节点。`,
    body: `这是一个本地 mock 节点，用于在未进入 Tauri 环境时验证启动台、工作台和 Provider 视图的交互闭环。\n\n原始问题：${question}`,
  };
}

function getWorkspace(workspaceId: string) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    throw new Error("workspace not found");
  }
  return workspace;
}

function getNode(nodeId: string) {
  const node = state.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error("node not found");
  }
  return node;
}

function getAncestors(nodeId: string) {
  const result: NodeSummary[] = [];
  let currentId = nodeId;

  while (true) {
    const link = state.hierarchy.find((item) => item.child === currentId);
    if (!link) {
      break;
    }
    const parent = getNode(link.parent);
    result.unshift(parent);
    currentId = parent.id;
  }

  return result;
}

function getChildren(nodeId: string) {
  return state.hierarchy
    .filter((item) => item.parent === nodeId)
    .map((item) => getNode(item.child));
}

function getParent(nodeId: string) {
  return state.hierarchy.find((item) => item.child === nodeId)?.parent ?? null;
}

function getDescendantIds(nodeId: string): string[] {
  const directChildren = state.hierarchy
    .filter((item) => item.parent === nodeId)
    .map((item) => item.child);
  return directChildren.flatMap((childId) => [childId, ...getDescendantIds(childId)]);
}

function getPath(nodeId: string): PathNode[] {
  return [...getAncestors(nodeId), getNode(nodeId)].map((item) => ({
    id: item.id,
    title: item.title,
  }));
}

function updateWorkspaceMeta(workspaceId: string) {
  const workspace = getWorkspace(workspaceId);
  const nodeCount = state.nodes.filter((node) => node.workspace_id === workspaceId).length;

  Object.assign(workspace, {
    node_count: nodeCount,
    updated_at: now(),
  });
}

function buildSnapshot(nodeId: string): WorkspaceSnapshot {
  const current = getNode(nodeId);
  const ancestors = getAncestors(nodeId);
  const children = getChildren(nodeId);
  const relatedNodes = state.edges
    .filter((edge) => edge.from === nodeId || edge.to === nodeId)
    .map((edge) => {
      const target = edge.from === nodeId ? getNode(edge.to) : getNode(edge.from);
      return {
        id: target.id,
        title: target.title,
        summary: target.summary,
        relation_type: edge.relation,
      };
    });

  return {
    workspace: getWorkspace(current.workspace_id),
    current_node: current,
    ancestors,
    children,
    related_nodes: relatedNodes,
    recent_nodes: state.nodes
      .filter((item) => item.workspace_id === current.workspace_id && item.id !== nodeId)
      .slice(-5)
      .reverse()
      .map((item) => ({ id: item.id, title: item.title })),
    context_snapshot: {
      context_summary: current.summary,
      ancestor_summary: ancestors.map((item) => `${item.title}: ${item.summary}`).join(" / "),
    },
    recent_candidates: state.candidates.filter((item) => !item.accepted).slice(0, 5),
  };
}

function resolvePlacement(baseNodeId: string, mode: NodeMode) {
  if (mode === "child") {
    return baseNodeId;
  }

  const parent = state.hierarchy.find((item) => item.child === baseNodeId);
  if (mode === "branch" && parent) {
    return parent.parent;
  }

  return baseNodeId;
}

export const mockCommands = {
  async listWorkspaces() {
    return { workspaces: state.workspaces };
  },

  async createWorkspace(input: CreateWorkspaceInput) {
    const workspace: WorkspaceSummary = {
      id: newId(),
      name: input.name,
      description: input.description,
      root_node_id: null,
      node_count: 0,
      updated_at: now(),
    };

    state.workspaces.unshift(workspace);
    return { workspace };
  },

  async createRootNode(input: CreateRootNodeInput) {
    const draft = summarize(input.question);
    const node: NodeSummary = {
      id: newId(),
      workspace_id: input.workspace_id,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      status: "confirmed",
      created_by_type: "ai",
      source_prompt: input.question,
      source_answer: null,
      created_at: now(),
      updated_at: now(),
    };

    state.nodes.push(node);
    const workspace = getWorkspace(input.workspace_id);
    workspace.root_node_id = node.id;
    updateWorkspaceMeta(input.workspace_id);
    return { node };
  },

  async getWorkspaceSnapshot(nodeId: string) {
    return buildSnapshot(nodeId);
  },

  async generateCandidates(nodeId: string, input: GenerateCandidatesInput) {
    const base = getNode(nodeId);
    const candidates: Candidate[] = [
      {
        candidate_id: newId(),
        title: `${input.query.slice(0, 12)} · 结构分支`,
        summary: `基于 ${base.title} 的候选节点，适合从结构视角继续展开。`,
        mode: "child",
        suggested_relation_type: "related_to",
        why_this_branch: "这个方向能让当前节点形成更稳定的后续上下文。",
        accepted: false,
      },
      {
        candidate_id: newId(),
        title: `${base.title} 的反例`,
        summary: "用一个对比例子测试当前概念边界。",
        mode: "related",
        suggested_relation_type: "contrasts",
        why_this_branch: "对比节点可以增强工作台中的横向联想。",
        accepted: false,
      },
    ];

    state.candidates = candidates;

    return {
      base_node_id: nodeId,
      candidates,
    };
  },

  async expandNode(nodeId: string, input: ExpandNodeInput) {
    let mode = input.mode;
    let relation: RelationType = "related_to";
    let draft = input.query ? summarize(input.query) : summarize("新节点");

    if (input.candidate_id) {
      const candidate = state.candidates.find((item) => item.candidate_id === input.candidate_id);
      if (!candidate) {
        throw new Error("candidate not found");
      }
      candidate.accepted = true;
      mode = candidate.mode;
      relation = candidate.suggested_relation_type;
      draft = {
        title: candidate.title,
        summary: candidate.summary,
        body: `${candidate.why_this_branch}\n\n这是从候选节点确认而来的正式节点。`,
      };
    }

    const base = getNode(nodeId);
    const parentId = resolvePlacement(base.id, mode);
    const node: NodeSummary = {
      id: newId(),
      workspace_id: base.workspace_id,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      status: "confirmed",
      created_by_type: "ai",
      source_prompt: input.query ?? "候选节点采纳",
      source_answer: null,
      created_at: now(),
      updated_at: now(),
    };

    state.nodes.push(node);
    state.hierarchy.push({ parent: parentId, child: node.id });

    if (mode === "related" || relation !== "related_to") {
      state.edges.push({
        from: base.id,
        to: node.id,
        relation,
      });
    }

    updateWorkspaceMeta(base.workspace_id);

    return {
      node,
      placement: {
        mode,
        parent_node_id: parentId,
        suggested_relation_type: relation,
      },
    };
  },

  async updateNode(nodeId: string, input: UpdateNodeInput) {
    const node = getNode(nodeId);
    Object.assign(node, input, { updated_at: now() });
    updateWorkspaceMeta(node.workspace_id);
    return { node };
  },

  async moveNode(nodeId: string, input: MoveNodeInput) {
    const node = getNode(nodeId);
    const workspace = getWorkspace(node.workspace_id);
    if (workspace.root_node_id === nodeId) {
      throw new Error("root node cannot be moved");
    }
    if (nodeId === input.new_parent_id) {
      throw new Error("node cannot be moved under itself");
    }
    if (getDescendantIds(nodeId).includes(input.new_parent_id)) {
      throw new Error("moving the node here would create a cycle");
    }

    const relation = state.hierarchy.find((item) => item.child === nodeId);
    if (!relation) {
      throw new Error("node has no parent relation");
    }
    const oldParentId = relation.parent;
    relation.parent = input.new_parent_id;
    node.updated_at = now();
    updateWorkspaceMeta(node.workspace_id);
    return {
      node_id: nodeId,
      old_parent_id: oldParentId,
      new_parent_id: input.new_parent_id,
    };
  },

  async createEdge(
    nodeId: string,
    input: { target_node_id: string; relation_type: RelationType },
  ) {
    if (nodeId === input.target_node_id) {
      throw new Error("self-loop edges are not allowed");
    }

    const exists = state.edges.some(
      (edge) =>
        edge.from === nodeId &&
        edge.to === input.target_node_id &&
        edge.relation === input.relation_type,
    );

    if (!exists) {
      state.edges.push({
        from: nodeId,
        to: input.target_node_id,
        relation: input.relation_type,
      });
    }

    const node = getNode(nodeId);
    updateWorkspaceMeta(node.workspace_id);

    return {
      edge: {
        from_node_id: nodeId,
        to_node_id: input.target_node_id,
        relation_type: input.relation_type,
      },
    };
  },

  async searchNodes(input: SearchNodesInput) {
    const query = input.q.trim().toLowerCase();
    const items: SearchNodeItem[] = state.nodes
      .filter(
        (node) =>
          node.workspace_id === input.workspace_id &&
          (query.length === 0 ||
            node.title.toLowerCase().includes(query) ||
            node.summary.toLowerCase().includes(query)),
      )
      .map((node) => ({
        id: node.id,
        title: node.title,
        summary: node.summary,
        path: getPath(node.id),
      }));

    return { items };
  },

  async listProviders() {
    return { providers: state.providers };
  },

  async saveProvider(input: SaveProviderInput) {
    const provider: Provider = {
      id: input.id ?? newId(),
      name: input.name,
      base_url: input.base_url,
      default_model: input.default_model,
      enabled: input.enabled,
      has_api_key: true,
      last_checked_at: now(),
      last_error: null,
    };

    state.providers = [
      provider,
      ...state.providers.filter((item) => item.id !== provider.id),
    ];

    return { provider };
  },

  async testProviderConnection() {
    return {
      ok: true,
      checked_at: now(),
      message: "mock provider is reachable",
    };
  },
};
