import type {
  CompiledContextPreview,
  ContextPreviewSource,
  NodeDetailMock,
  RetrievalHit,
  TreeNode,
} from "./types";

type BuildContextPreviewInput = {
  activeNode: TreeNode;
  allNodes: TreeNode[];
  detailMap: Record<string, NodeDetailMock>;
  parentChain: TreeNode[];
  retrievalHits: RetrievalHit[];
};

function estimateTokens(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;

  return Math.ceil(normalized.length / 1.8);
}

function createSummaryItem(node: TreeNode, isCurrent: boolean): ContextPreviewSource {
  return {
    id: `summary-${node.id}`,
    type: "summary",
    scope: isCurrent ? "current" : "parent",
    title: `${isCurrent ? "当前节点摘要" : node.parentId ? "父链摘要" : "根节点摘要"} · ${node.title}`,
    content: node.summary,
    reason: isCurrent
      ? "当前节点摘要默认进入上下文。"
      : "根节点和父链摘要默认进入上下文。",
    nodeId: node.id,
  };
}

function createCurrentContentItem(
  node: TreeNode,
  detail?: NodeDetailMock,
): ContextPreviewSource | null {
  const content = detail?.content.trim();
  if (!content) return null;

  return {
    id: `content-${node.id}`,
    type: "content",
    scope: "current",
    title: `当前节点正文 · ${node.title}`,
    content,
    reason: "当前节点正文属于正在继续的语义上下文。",
    nodeId: node.id,
  };
}

function createRetrievalItem(hit: RetrievalHit, reason: string): ContextPreviewSource {
  return {
    id: `retrieval-${hit.id}`,
    type: "retrieval-hit",
    scope: hit.scope,
    title: hit.title,
    content: hit.excerpt,
    reason,
    nodeId: hit.nodeId,
  };
}

function describeExcludedNode(
  node: TreeNode,
  activeNode: TreeNode,
  includedNodeIds: Set<string>,
) {
  if (node.status === "archived") return "已归档节点默认排除。";
  if (node.parentId === activeNode.id) return "当前节点的子分支不会自动回流。";
  if (node.parentId && includedNodeIds.has(node.parentId)) {
    return "父链上的其他分支默认排除。";
  }

  return "无关分支默认排除。";
}

function createExcludedNodeItem(
  node: TreeNode,
  activeNode: TreeNode,
  includedNodeIds: Set<string>,
): ContextPreviewSource {
  return {
    id: `excluded-node-${node.id}`,
    type: "excluded-branch",
    scope: "excluded",
    title: `排除分支 · ${node.title}`,
    content: node.summary,
    reason: describeExcludedNode(node, activeNode, includedNodeIds),
    nodeId: node.id,
  };
}

export function buildContextPreview({
  activeNode,
  allNodes,
  detailMap,
  parentChain,
  retrievalHits,
}: BuildContextPreviewInput): CompiledContextPreview {
  const includedNodeIds = new Set(parentChain.map((node) => node.id));
  const ancestorIds = new Set(parentChain.slice(0, -1).map((node) => node.id));
  const includedItems: ContextPreviewSource[] = [];
  const excludedItems: ContextPreviewSource[] = [];

  for (const node of parentChain.slice(0, -1)) {
    includedItems.push(createSummaryItem(node, false));
  }

  includedItems.push(createSummaryItem(activeNode, true));

  const currentContent = createCurrentContentItem(
    activeNode,
    detailMap[activeNode.id],
  );

  if (currentContent) {
    includedItems.push(currentContent);
  }

  for (const hit of retrievalHits) {
    if (hit.scope === "current" && hit.nodeId === activeNode.id) {
      includedItems.push(
        createRetrievalItem(hit, "当前节点检索命中可以进入上下文。"),
      );
      continue;
    }

    if (hit.scope === "parent" && hit.nodeId && ancestorIds.has(hit.nodeId)) {
      includedItems.push(
        createRetrievalItem(hit, "父链检索命中可以进入上下文。"),
      );
      continue;
    }

    excludedItems.push(
      createRetrievalItem(
        hit,
        hit.scope === "global" || hit.scope === "web"
          ? "全局或网页来源需要用户显式选择。"
          : "不属于当前节点或父链，默认排除。",
      ),
    );
  }

  for (const node of allNodes) {
    if (includedNodeIds.has(node.id)) continue;
    excludedItems.push(createExcludedNodeItem(node, activeNode, includedNodeIds));
  }

  const tokenEstimate = includedItems.reduce(
    (total, item) => total + estimateTokens(`${item.title}\n${item.content}`),
    0,
  );

  return {
    nodeId: activeNode.id,
    includedItems,
    excludedItems,
    tokenEstimate,
  };
}
