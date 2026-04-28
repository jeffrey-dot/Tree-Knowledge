import type { GenerateNodeContentInput } from "../llm";
import type { NodeDetail, TreeNode } from "../types";
import { getParentChain } from "./treeLayout";

export function getFallbackNodeDetail(node: TreeNode): NodeDetail {
  return {
    content: node.summary || "无正文",
  };
}

export function getGenerationContextSummaries(
  node: TreeNode,
  allNodes: TreeNode[],
): NonNullable<GenerateNodeContentInput["contextSummaries"]> {
  return getParentChain(node, allNodes).map((chainNode) => ({
    summary: chainNode.summary,
    title: chainNode.title,
  }));
}

export function createSummaryFromMarkdown(markdown: string) {
  const contentLine = markdown
    .split(/\n+/)
    .filter((line) => !line.trim().startsWith("#"))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .trim(),
    )
    .find(
      (line) =>
        line &&
        !line.startsWith(">") &&
        !line.startsWith("|") &&
        !line.startsWith("```"),
    );

  return contentLine ? contentLine.slice(0, 86) : "";
}
