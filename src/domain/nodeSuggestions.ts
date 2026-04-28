import type { TreeNode } from "../types";
import { createEntityId } from "./ids";
import {
  childNodeOffsetX,
  childNodeOffsetY,
  childNodeVerticalStep,
} from "./treeLayout";

export type SuggestedNode = {
  title: string;
  goal: string;
  kind: TreeNode["kind"];
};

export function getSuggestedNodes(node: TreeNode): SuggestedNode[] {
  if (node.status === "archived") {
    return [
      {
        title: "恢复归档评估",
        goal: "判断该归档主题是否值得重新进入当前主线。",
        kind: "decision",
      },
    ];
  }

  return [
    {
      title: `${node.title} 的下一步`,
      goal: "把当前主题拆成一个可独立推进的子问题。",
      kind: "main",
    },
    {
      title: "临时探索",
      goal: "开一个不会污染主线的旁路探索分支。",
      kind: "temporary",
    },
  ];
}

export function getAvailableSuggestedNodes(node: TreeNode, allNodes: TreeNode[]) {
  const existingChildTitles = new Set(
    allNodes
      .filter((candidate) => candidate.parentId === node.id)
      .map((candidate) => candidate.title),
  );

  return getSuggestedNodes(node).filter(
    (suggestion) => !existingChildTitles.has(suggestion.title),
  );
}

export function createSuggestedTreeNode(
  parent: TreeNode,
  suggestion: SuggestedNode,
  siblingCount: number,
): TreeNode {
  const id = createEntityId(`suggested-${parent.id}`);

  return {
    id,
    parentId: parent.id,
    title: suggestion.title,
    goal: suggestion.goal,
    summary: `围绕「${suggestion.title}」整理出的独立主题，不写回父节点。`,
    status: "active",
    kind: suggestion.kind,
    x: parent.x + childNodeOffsetX,
    y: parent.y + childNodeOffsetY + siblingCount * childNodeVerticalStep,
    materials: 0,
    references: 0,
    webSources: 0,
    merged: 0,
  };
}

export function createCustomSuggestedNode(input: string): SuggestedNode | null {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const title = normalized
    .split(/[。！？.!?\n]/)[0]
    .replace(/^(我想|帮我|请|能不能|是否|问题|主题)/, "")
    .trim()
    .slice(0, 18);

  return {
    title: title || "自定义问题",
    goal: normalized,
    kind: "temporary",
  };
}
