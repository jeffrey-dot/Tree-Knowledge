import { useMemo, useRef, useState } from "react";
import type { GenerateNodeContentInput, LlmSettings } from "../llm";
import { generateNodeContentStream } from "../llm";
import {
  createKnowledgeBase,
  type KnowledgeBase,
  type KnowledgeBaseDraft,
} from "../domain/knowledgeBase";
import {
  createSummaryFromMarkdown,
  getGenerationContextSummaries,
} from "../domain/nodeContent";
import {
  createSuggestedTreeNode,
  type SuggestedNode,
} from "../domain/nodeSuggestions";
import { getParentChain, layoutTreeNodes } from "../domain/treeLayout";
import type { TreeNode } from "../types";

export type AppView = "library" | "workspace";

function touchKnowledgeBase(knowledgeBase: KnowledgeBase) {
  return { ...knowledgeBase, updatedAt: new Date().toISOString() };
}

export function useKnowledgeWorkspace(llmSettings: LlmSettings) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [activeKnowledgeBaseId, setActiveKnowledgeBaseId] = useState<string | null>(
    null,
  );
  const [appView, setAppView] = useState<AppView>("library");
  const [librarySearch, setLibrarySearch] = useState("");
  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const generationRunIds = useRef<Record<string, number>>({});

  const activeKnowledgeBase = activeKnowledgeBaseId
    ? knowledgeBases.find(
        (knowledgeBase) => knowledgeBase.id === activeKnowledgeBaseId,
      ) ?? null
    : null;
  const isWorkspaceView = appView === "workspace" && Boolean(activeKnowledgeBase);
  const treeNodes = activeKnowledgeBase?.nodes ?? [];
  const nodeDetailMap = activeKnowledgeBase?.nodeDetails ?? {};
  const activeNodeId = activeKnowledgeBase?.activeNodeId ?? null;
  const activeNode = activeNodeId
    ? treeNodes.find((node) => node.id === activeNodeId) ?? null
    : treeNodes[0] ?? null;
  const detailNode = detailNodeId
    ? treeNodes.find((node) => node.id === detailNodeId)
    : null;
  const parentChain = useMemo(
    () => (activeNode ? getParentChain(activeNode, treeNodes) : []),
    [activeNode, treeNodes],
  );
  const activeRootNode = parentChain[0] ?? null;
  const parentChainIds = useMemo(
    () => new Set(parentChain.map((node) => node.id)),
    [parentChain],
  );

  function updateKnowledgeBase(
    knowledgeBaseId: string,
    updater: (knowledgeBase: KnowledgeBase) => KnowledgeBase,
    touch = true,
  ) {
    setKnowledgeBases((currentKnowledgeBases) =>
      currentKnowledgeBases.map((knowledgeBase) => {
        if (knowledgeBase.id !== knowledgeBaseId) return knowledgeBase;

        const nextKnowledgeBase = updater(knowledgeBase);
        return touch ? touchKnowledgeBase(nextKnowledgeBase) : nextKnowledgeBase;
      }),
    );
  }

  function handleSelectNode(nodeId: string) {
    if (!activeKnowledgeBase) return;

    updateKnowledgeBase(
      activeKnowledgeBase.id,
      (knowledgeBase) => ({
        ...knowledgeBase,
        activeNodeId: nodeId,
        lastOpenedAt: new Date().toISOString(),
      }),
      false,
    );
    setDetailNodeId(nodeId);
  }

  function streamGeneratedNodeContent(
    knowledgeBaseId: string,
    nodeId: string,
    input: GenerateNodeContentInput,
  ) {
    const runId = (generationRunIds.current[nodeId] ?? 0) + 1;
    generationRunIds.current[nodeId] = runId;

    setGeneratingNodeIds((currentIds) => new Set(currentIds).add(nodeId));
    updateKnowledgeBase(
      knowledgeBaseId,
      (knowledgeBase) => ({
        ...knowledgeBase,
        nodeDetails: {
          ...knowledgeBase.nodeDetails,
          [nodeId]: { content: "" },
        },
      }),
      false,
    );

    void (async () => {
      let generatedContent = "";

      try {
        for await (const chunk of generateNodeContentStream(input, llmSettings)) {
          if (generationRunIds.current[nodeId] !== runId) return;

          generatedContent += chunk;
          updateKnowledgeBase(
            knowledgeBaseId,
            (knowledgeBase) => ({
              ...knowledgeBase,
              nodeDetails: {
                ...knowledgeBase.nodeDetails,
                [nodeId]: {
                  content: `${knowledgeBase.nodeDetails[nodeId]?.content ?? ""}${chunk}`,
                },
              },
            }),
            false,
          );
        }

        const generatedSummary = createSummaryFromMarkdown(generatedContent);
        if (generatedSummary) {
          updateKnowledgeBase(knowledgeBaseId, (knowledgeBase) => ({
            ...knowledgeBase,
            nodes: knowledgeBase.nodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    materials: Math.max(node.materials, 1),
                    summary: generatedSummary,
                  }
                : node,
            ),
          }));
        } else {
          updateKnowledgeBase(knowledgeBaseId, (knowledgeBase) => ({
            ...knowledgeBase,
          }));
        }
      } catch (error) {
        if (generationRunIds.current[nodeId] !== runId) return;

        const message =
          error instanceof Error ? error.message : "LLM 生成失败，请检查模型设置。";

        updateKnowledgeBase(knowledgeBaseId, (knowledgeBase) => ({
          ...knowledgeBase,
          nodeDetails: {
            ...knowledgeBase.nodeDetails,
            [nodeId]: {
              content: `## ${input.title}\n\n> ${message}\n\n请在右上角设置中配置 OpenAI-compatible LLM，然后重新生成这个节点。`,
            },
          },
        }));
      } finally {
        if (generationRunIds.current[nodeId] !== runId) return;

        setGeneratingNodeIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(nodeId);
          return nextIds;
        });
        delete generationRunIds.current[nodeId];
      }
    })();
  }

  function handleCreateSuggestedNode(parentId: string, suggestion: SuggestedNode) {
    if (!activeKnowledgeBase) return;

    const parent = treeNodes.find((node) => node.id === parentId);
    if (!parent) return;

    const siblingCount = treeNodes.filter((node) => node.parentId === parent.id).length;
    const nextNode = createSuggestedTreeNode(parent, suggestion, siblingCount);
    updateKnowledgeBase(activeKnowledgeBase.id, (knowledgeBase) => ({
      ...knowledgeBase,
      activeNodeId: nextNode.id,
      nodes: layoutTreeNodes([...knowledgeBase.nodes, nextNode]),
    }));
    setDetailNodeId(nextNode.id);
    streamGeneratedNodeContent(activeKnowledgeBase.id, nextNode.id, {
      contextSummaries: getGenerationContextSummaries(parent, treeNodes),
      title: suggestion.title,
      goal: suggestion.goal,
      parentTitle: parent.title,
    });
  }

  function handleRegenerateNodeContent(node: TreeNode) {
    if (!activeKnowledgeBase) return;

    const parent = node.parentId
      ? treeNodes.find((candidate) => candidate.id === node.parentId)
      : null;

    streamGeneratedNodeContent(activeKnowledgeBase.id, node.id, {
      contextSummaries: parent
        ? getGenerationContextSummaries(parent, treeNodes)
        : [],
      title: node.title,
      goal: node.goal,
      parentTitle: parent?.title,
    });
  }

  function handleCreateKnowledgeBase(draft: KnowledgeBaseDraft) {
    const knowledgeBase = createKnowledgeBase(draft);

    setKnowledgeBases((currentKnowledgeBases) => [
      knowledgeBase,
      ...currentKnowledgeBases,
    ]);
    setActiveKnowledgeBaseId(knowledgeBase.id);
    setAppView("workspace");
    setDetailNodeId(null);
    setShowContext(false);
  }

  function handleOpenKnowledgeBase(knowledgeBaseId: string) {
    updateKnowledgeBase(
      knowledgeBaseId,
      (knowledgeBase) => ({
        ...knowledgeBase,
        lastOpenedAt: new Date().toISOString(),
      }),
      false,
    );
    setActiveKnowledgeBaseId(knowledgeBaseId);
    setAppView("workspace");
    setDetailNodeId(null);
    setShowContext(false);
  }

  function handleBackToLibrary() {
    setAppView("library");
    setDetailNodeId(null);
    setShowContext(false);
  }

  function handleToggleContext() {
    if (activeNode) setShowContext((value) => !value);
  }

  return {
    activeNode,
    activeRootNode,
    appView,
    detailNode,
    generatingNodeIds,
    handleBackToLibrary,
    handleCreateKnowledgeBase,
    handleCreateSuggestedNode,
    handleOpenKnowledgeBase,
    handleRegenerateNodeContent,
    handleSelectNode,
    handleToggleContext,
    isWorkspaceView,
    knowledgeBases,
    librarySearch,
    nodeDetailMap,
    parentChain,
    parentChainIds,
    setDetailNodeId,
    setLibrarySearch,
    showContext,
    treeNodes,
  };
}
