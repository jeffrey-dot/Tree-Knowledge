import type { TreeNode } from "../types";

export const nodeLayoutRootX = 80;
export const nodeLayoutTop = 60;
export const nodeDepthStep = 290;
export const nodeRowStep = 160;
export const childNodeOffsetX = nodeDepthStep;
export const childNodeOffsetY = 80;
export const childNodeVerticalStep = 140;
export const minCanvasZoom = 0.55;
export const maxCanvasZoom = 1.8;
export const canvasZoomStep = 0.05;

export function getParentChain(node: TreeNode, allNodes: TreeNode[]) {
  const byId = new Map(allNodes.map((item) => [item.id, item]));
  const chain: TreeNode[] = [];
  let cursor: TreeNode | undefined = node;

  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return chain;
}

export function layoutTreeNodes(allNodes: TreeNode[]) {
  const nodeOrder = new Map(allNodes.map((node, index) => [node.id, index]));
  const byId = new Map(allNodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string | null, TreeNode[]>();

  for (const node of allNodes) {
    const parentId = node.parentId && byId.has(node.parentId) ? node.parentId : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(
      (first, second) =>
        first.y - second.y ||
        first.x - second.x ||
        (nodeOrder.get(first.id) ?? 0) - (nodeOrder.get(second.id) ?? 0),
    );
  }

  const positionedNodes = new Map<string, Pick<TreeNode, "x" | "y">>();
  const visiting = new Set<string>();
  let nextLeafY = nodeLayoutTop;

  function placeSubtree(node: TreeNode, depth: number): number {
    if (visiting.has(node.id)) {
      const fallbackY = nextLeafY;
      nextLeafY += nodeRowStep;
      return fallbackY;
    }

    visiting.add(node.id);
    const children = childrenByParent.get(node.id) ?? [];
    const childYs = children.map((child) => placeSubtree(child, depth + 1));
    visiting.delete(node.id);

    const y =
      childYs.length > 0
        ? (childYs[0] + childYs[childYs.length - 1]) / 2
        : nextLeafY;

    if (childYs.length === 0) nextLeafY += nodeRowStep;

    positionedNodes.set(node.id, {
      x: nodeLayoutRootX + depth * nodeDepthStep,
      y,
    });

    return y;
  }

  const roots = childrenByParent.get(null) ?? [];

  for (const root of roots) {
    placeSubtree(root, 0);
  }

  return allNodes.map((node) => ({
    ...node,
    ...(positionedNodes.get(node.id) ?? { x: node.x, y: node.y }),
  }));
}
