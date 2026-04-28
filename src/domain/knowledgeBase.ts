import type { NodeDetail, TreeNode } from "../types";
import { createEntityId } from "./ids";
import { layoutTreeNodes, nodeLayoutRootX, nodeLayoutTop } from "./treeLayout";

export type KnowledgeBaseDraft = {
  title: string;
  goal: string;
};

export type KnowledgeBase = {
  id: string;
  title: string;
  goal: string;
  rootNodeId: string;
  activeNodeId: string;
  nodes: TreeNode[];
  nodeDetails: Record<string, NodeDetail>;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

function createKnowledgeBaseRootNode({ goal, title }: KnowledgeBaseDraft): TreeNode {
  const normalizedTitle = title.trim() || "未命名知识库";
  const normalizedGoal = goal.trim() || "整理这个知识库的共同背景。";

  return {
    id: createEntityId("root"),
    parentId: null,
    title: normalizedTitle,
    goal: normalizedGoal,
    summary: normalizedGoal.slice(0, 120),
    status: "active",
    kind: "root",
    x: nodeLayoutRootX,
    y: nodeLayoutTop,
    materials: 0,
    references: 0,
    webSources: 0,
    merged: 0,
  };
}

function createRootNodeDetail(node: TreeNode): NodeDetail {
  return {
    content: `## ${node.title}\n\n${node.goal}`,
  };
}

export function createKnowledgeBase(draft: KnowledgeBaseDraft): KnowledgeBase {
  const rootNode = createKnowledgeBaseRootNode(draft);
  const now = new Date().toISOString();

  return {
    id: createEntityId("kb"),
    title: rootNode.title,
    goal: rootNode.goal,
    rootNodeId: rootNode.id,
    activeNodeId: rootNode.id,
    nodes: layoutTreeNodes([rootNode]),
    nodeDetails: { [rootNode.id]: createRootNodeDetail(rootNode) },
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}

export function getKnowledgeBaseRootNode(knowledgeBase: KnowledgeBase) {
  return (
    knowledgeBase.nodes.find((node) => node.id === knowledgeBase.rootNodeId) ??
    knowledgeBase.nodes.find((node) => node.parentId === null) ??
    knowledgeBase.nodes[0] ??
    null
  );
}

export function formatKnowledgeBaseTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}
