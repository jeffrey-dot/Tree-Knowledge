import {
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  Eye,
  FileText,
  GitBranch,
  Merge,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import {
  defaultLlmMode,
  generateNodeContentStream,
  type GenerateNodeContentInput,
} from "./llm";
import { nodeDetails, nodes } from "./mockData";
import type { NodeDetailMock, SourceScope, TreeNode } from "./types";

const scopeLabel: Record<SourceScope, string> = {
  current: "当前",
  parent: "父链",
  global: "全局",
  web: "网页",
  excluded: "排除",
};

const statusLabel: Record<TreeNode["status"], string> = {
  active: "进行中",
  done: "已完成",
  archived: "已归档",
};

const kindLabel: Record<TreeNode["kind"], string> = {
  root: "根节点",
  main: "主线",
  temporary: "临时",
  research: "研究",
  decision: "决策",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const clayShadow =
  "shadow-[rgba(0,0,0,0.1)_0_1px_1px,rgba(0,0,0,0.04)_0_-1px_1px_inset,rgba(0,0,0,0.05)_0_-0.5px_1px]";
const hardShadow = "shadow-[rgb(0,0,0)_-4px_4px_0]";
const hardShadowHover = "hover:shadow-[rgb(0,0,0)_-4px_4px_0]";
const eyebrowClass =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[#9f9b93]";
const iconButtonClass = cx(
  "inline-grid h-[34px] w-[34px] place-items-center rounded-lg border border-[#dad4c8] bg-white text-black",
  "transition-[transform,box-shadow] duration-[120ms] ease-[ease] hover:-translate-y-px hover:-rotate-1",
  hardShadowHover,
);
const workspaceButtonClass = cx(
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#dad4c8] bg-white px-2.5 text-[13px] font-bold text-black",
  "transition-[transform,box-shadow,background-color] duration-[120ms] ease-[ease] hover:-translate-y-px hover:-rotate-1",
  hardShadowHover,
);
const nodeBadgeClass =
  "inline-flex items-center gap-[3px] rounded-full border border-[#eee9df] bg-[#faf9f7] px-1.5 py-[3px] text-[11px] font-bold text-[#55534e]";
const smallPillClass =
  "inline-flex w-fit items-center rounded-full px-[7px] py-[3px] text-[10px] font-extrabold uppercase leading-none";

function getScopeBadgeClass(scope: SourceScope) {
  return cx(
    smallPillClass,
    scope === "current" && "bg-[#84e7a5]",
    scope === "parent" && "bg-[#f8cc65]",
    scope === "global" && "bg-[#01418d] text-white",
    scope === "web" && "bg-[#43089f] text-white",
    scope === "excluded" && "bg-[#eee9df] text-[#55534e]",
  );
}

function getSuggestedNodeClass(kind: TreeNode["kind"]) {
  return cx(
    "block w-full rounded-lg border border-dashed border-[#dad4c8] bg-[#fff8e5] p-[9px] text-left text-black",
    "transition-[transform,box-shadow] duration-[120ms] ease-[ease] hover:-translate-y-px",
    hardShadowHover,
    kind === "temporary" && "border-[#0089ad] bg-[#f0fbff]",
    kind === "research" && "border-[#c1b0ff] bg-[#f6f1ff]",
    kind === "decision" && "border-[#fc7981] bg-[#fff5f5]",
  );
}

type SuggestedNode = {
  title: string;
  goal: string;
  kind: TreeNode["kind"];
};

const nodeCardWidth = 220;
const nodeCardHeight = 120;
const nodeLayoutRootX = 80;
const nodeLayoutTop = 60;
const nodeDepthStep = 290;
const nodeRowStep = 160;
const childNodeOffsetX = nodeDepthStep;
const childNodeOffsetY = 80;
const childNodeVerticalStep = 140;
const minCanvasZoom = 0.55;
const maxCanvasZoom = 1.8;
const canvasZoomStep = 0.05;

function getParentChain(node: TreeNode, allNodes: TreeNode[]) {
  const byId = new Map(allNodes.map((item) => [item.id, item]));
  const chain: TreeNode[] = [];
  let cursor: TreeNode | undefined = node;

  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return chain;
}

function getSuggestedNodes(node: TreeNode): SuggestedNode[] {
  if (node.id === "ui") {
    return [
      {
        title: "交互弹窗规范",
        goal: "把节点详情、摘要和检索都收敛到点击后的弹窗中。",
        kind: "main",
      },
      {
        title: "悬浮展开交互",
        goal: "悬浮节点时展示可继续拆分的推荐主题。",
        kind: "temporary",
      },
    ];
  }

  if (node.id === "context") {
    return [
      {
        title: "父链裁剪策略",
        goal: "定义长父链下摘要如何分层压缩。",
        kind: "research",
      },
      {
        title: "跨分支引用确认",
        goal: "设计其他分支内容进入当前上下文前的确认流程。",
        kind: "decision",
      },
    ];
  }

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

function getAvailableSuggestedNodes(node: TreeNode, allNodes: TreeNode[]) {
  const existingChildTitles = new Set(
    allNodes
      .filter((candidate) => candidate.parentId === node.id)
      .map((candidate) => candidate.title),
  );

  return getSuggestedNodes(node).filter(
    (suggestion) => !existingChildTitles.has(suggestion.title),
  );
}

function createSuggestedTreeNode(
  parent: TreeNode,
  suggestion: SuggestedNode,
  siblingCount: number,
): TreeNode {
  const id = `suggested-${parent.id}-${Date.now()}`;

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

function layoutTreeNodes(allNodes: TreeNode[]) {
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

function createCustomSuggestedNode(input: string): SuggestedNode | null {
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

function getFallbackNodeDetail(node: TreeNode): NodeDetailMock {
  return {
    content: `${node.summary}\n\n这个节点还没有更完整的正文 mock。真实版本会在创建节点时保存生成内容，并在这里直接展示主题正文。`,
  };
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-3 mt-0 text-2xl font-semibold leading-tight text-black">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold leading-tight text-black first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold leading-snug text-black">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 text-sm leading-[1.65] text-black">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-bold text-black">{children}</strong>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-sm leading-[1.6] text-black">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-black">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 border-l-4 border-[#fbbd41] bg-[#fff8e5] py-2 pl-3 pr-2 text-sm text-[#55534e]">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-[#eee9df] px-1 py-0.5 font-mono text-[13px] text-black">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="my-3 overflow-auto rounded-lg border border-[#dad4c8] bg-[#faf9f7] p-3 font-mono text-[13px] leading-relaxed text-black">
      {children}
    </pre>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-auto rounded-lg border border-[#dad4c8]">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-[#dad4c8] bg-[#fff8e5] px-3 py-2 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-[#eee9df] px-3 py-2">{children}</td>
  ),
};

function App() {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>(() =>
    layoutTreeNodes(nodes),
  );
  const [nodeDetailMap, setNodeDetailMap] =
    useState<Record<string, NodeDetailMock>>(nodeDetails);
  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeNodeId, setActiveNodeId] = useState("ui");
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const generationRunIds = useRef<Record<string, number>>({});

  const activeNode = treeNodes.find((node) => node.id === activeNodeId) ?? treeNodes[0];
  const detailNode = detailNodeId
    ? treeNodes.find((node) => node.id === detailNodeId)
    : null;
  const parentChain = useMemo(
    () => getParentChain(activeNode, treeNodes),
    [activeNode, treeNodes],
  );
  const parentChainIds = new Set(parentChain.map((node) => node.id));

  function handleSelectNode(nodeId: string) {
    setActiveNodeId(nodeId);
    setDetailNodeId(nodeId);
  }

  function streamGeneratedNodeContent(
    nodeId: string,
    input: GenerateNodeContentInput,
  ) {
    const runId = (generationRunIds.current[nodeId] ?? 0) + 1;
    generationRunIds.current[nodeId] = runId;

    setGeneratingNodeIds((currentIds) => new Set(currentIds).add(nodeId));
    setNodeDetailMap((currentDetails) => ({
      ...currentDetails,
      [nodeId]: { content: "" },
    }));

    void (async () => {
      try {
        for await (const chunk of generateNodeContentStream(input)) {
          if (generationRunIds.current[nodeId] !== runId) return;

          setNodeDetailMap((currentDetails) => ({
            ...currentDetails,
            [nodeId]: {
              content: `${currentDetails[nodeId]?.content ?? ""}${chunk}`,
            },
          }));
        }
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
    const parent = treeNodes.find((node) => node.id === parentId);
    if (!parent) return;

    const siblingCount = treeNodes.filter((node) => node.parentId === parent.id).length;
    const nextNode = createSuggestedTreeNode(parent, suggestion, siblingCount);
    setTreeNodes((currentNodes) => layoutTreeNodes([...currentNodes, nextNode]));
    setActiveNodeId(nextNode.id);
    setDetailNodeId(nextNode.id);
    streamGeneratedNodeContent(nextNode.id, {
      title: suggestion.title,
      goal: suggestion.goal,
      parentTitle: parent.title,
    });
  }

  function handleRegenerateNodeContent(node: TreeNode) {
    const parent = node.parentId
      ? treeNodes.find((candidate) => candidate.id === node.parentId)
      : null;

    streamGeneratedNodeContent(node.id, {
      title: node.title,
      goal: node.goal,
      parentTitle: parent?.title,
    });
  }

  return (
    <div className="grid h-screen min-h-0 grid-rows-[56px_1fr] overflow-hidden max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:overflow-visible">
      <header className="grid grid-cols-[minmax(270px,360px)_minmax(260px,1fr)_auto] items-center gap-[18px] border-b border-[#dad4c8] bg-[#faf9f7]/[0.92] px-3.5 py-2 backdrop-blur-[12px] max-[760px]:h-auto max-[760px]:grid-cols-1">
        <div className="flex items-center gap-2.5">
          <div
            className={cx(
              "grid h-9 w-9 place-items-center rounded-lg border border-[#dad4c8] bg-[#fbbd41]",
              clayShadow,
            )}
          >
            <GitBranch size={18} aria-hidden="true" />
          </div>
          <div>
            <div className={eyebrowClass}>本地模拟工作台</div>
            <h1 className="m-0 text-2xl leading-[1.2] tracking-[0]">树形知识库</h1>
          </div>
        </div>

        <label
          className={cx(
            "flex h-[38px] items-center gap-2 rounded-full border border-[#dad4c8] bg-white px-3",
            clayShadow,
          )}
          aria-label="搜索知识库"
        >
          <Search size={16} aria-hidden="true" />
          <input className="w-full border-0 bg-transparent text-black outline-0" defaultValue="上下文边界" />
        </label>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dad4c8] bg-white px-2.5 py-[7px] text-xs font-semibold text-[#55534e]">
            <Sparkles size={14} aria-hidden="true" />
            LLM 默认{defaultLlmMode === "stream" ? "流式" : "同步"}输出
          </span>
          <button className={iconButtonClass} aria-label="设置">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <main className="relative block min-h-0 overflow-hidden max-[760px]:min-h-[1200px]">
        <section
          className="relative h-full min-w-0 overflow-hidden max-[760px]:overflow-visible"
          aria-label="知识树画布"
        >
          <CanvasToolbar
            parentChain={parentChain}
            onToggleContext={() => setShowContext((value) => !value)}
          />
          <TreeCanvas
            nodes={treeNodes}
            activeNodeId={activeNode.id}
            parentChainIds={parentChainIds}
            onCreateSuggestedNode={handleCreateSuggestedNode}
            onSelectNode={handleSelectNode}
          />
          {showContext ? (
            <ContextPreview activeNode={activeNode} parentChain={parentChain} />
          ) : null}
          {detailNode ? (
            <NodeDetailDialog
              detailMap={nodeDetailMap}
              isGenerating={generatingNodeIds.has(detailNode.id)}
              node={detailNode}
              onClose={() => setDetailNodeId(null)}
              onRegenerate={handleRegenerateNodeContent}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function CanvasToolbar({
  parentChain,
  onToggleContext,
}: {
  parentChain: TreeNode[];
  onToggleContext: () => void;
}) {
  return (
    <div
      className={cx(
        "absolute left-4 right-4 top-3.5 z-[5] flex items-center justify-between gap-4 rounded-xl border border-[#dad4c8] bg-white/[0.88] p-3 backdrop-blur-[10px]",
        "max-[760px]:static max-[760px]:m-3 max-[760px]:w-auto",
        clayShadow,
      )}
    >
      <div>
        <div className={eyebrowClass}>当前父链</div>
        <div className="mt-[3px] text-sm font-bold text-black">
          {parentChain.map((node, index) => (
            <span key={node.id}>
              {index > 0 ? " / " : ""}
              {node.title}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className={workspaceButtonClass} type="button" onClick={onToggleContext}>
          <Eye size={15} />
          上下文
        </button>
      </div>
    </div>
  );
}

function TreeCanvas({
  nodes,
  activeNodeId,
  parentChainIds,
  onCreateSuggestedNode,
  onSelectNode,
}: {
  nodes: TreeNode[];
  activeNodeId: string;
  parentChainIds: Set<string>;
  onCreateSuggestedNode: (parentId: string, suggestion: SuggestedNode) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [customSuggestion, setCustomSuggestion] = useState("");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panGesture = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const hoveredNode = hoveredNodeId
    ? nodes.find((node) => node.id === hoveredNodeId)
    : null;
  const renderedPan = {
    x: Math.round(pan.x),
    y: Math.round(pan.y),
  };
  const stageSize = useMemo(
    () =>
      nodes.reduce(
        (size, node) => ({
          width: Math.max(size.width, node.x + 560),
          height: Math.max(size.height, node.y + 320),
        }),
        { width: 1500, height: 900 },
      ),
    [nodes],
  );

  function isInteractivePanTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;

    return Boolean(
      target.closest("button, input, textarea, a, [data-pan-lock]"),
    );
  }

  function isWheelLockedTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;

    return Boolean(target.closest("input, textarea, [data-wheel-lock]"));
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isInteractivePanTarget(event.target)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panGesture.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startX: pan.x,
      startY: pan.y,
    };
    setHoveredNodeId(null);
    setIsPanning(true);
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = panGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    setPan({
      x: gesture.startX + event.clientX - gesture.originX,
      y: gesture.startY + event.clientY - gesture.originY,
    });
  }

  function endCanvasPan(event: PointerEvent<HTMLDivElement>) {
    const gesture = panGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    panGesture.current = null;
    setIsPanning(false);
  }

  function handleCanvasWheel(event: WheelEvent<HTMLDivElement>) {
    if (isWheelLockedTarget(event.target)) return;

    event.preventDefault();

    if (event.ctrlKey) {
      const rawNextZoom = clamp(
        zoom * Math.exp(-event.deltaY * 0.0015),
        minCanvasZoom,
        maxCanvasZoom,
      );
      const nextZoom = clamp(
        Math.round(rawNextZoom / canvasZoomStep) * canvasZoomStep,
        minCanvasZoom,
        maxCanvasZoom,
      );

      if (nextZoom === zoom) return;

      const bounds = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      const worldX = (pointerX - pan.x) / zoom;
      const worldY = (pointerY - pan.y) / zoom;

      setZoom(nextZoom);
      setPan({
        x: Math.round(pointerX - worldX * nextZoom),
        y: Math.round(pointerY - worldY * nextZoom),
      });
      return;
    }

    setPan((currentPan) => ({
      x: currentPan.x - event.deltaX,
      y: currentPan.y - event.deltaY,
    }));
  }

  function handleCreateSuggestion(nodeId: string, suggestion: SuggestedNode) {
    setHoveredNodeId(null);
    setCustomSuggestion("");
    onCreateSuggestedNode(nodeId, suggestion);
  }

  function handleCreateCustomSuggestion(nodeId: string, input = customSuggestion) {
    const suggestion = createCustomSuggestedNode(input);
    if (!suggestion) return;

    setHoveredNodeId(null);
    setCustomSuggestion("");
    onCreateSuggestedNode(nodeId, suggestion);
  }

  return (
    <div
      className={cx(
        "absolute inset-0 cursor-grab overflow-hidden touch-none max-[760px]:relative max-[760px]:h-[720px] max-[760px]:overflow-auto",
        isPanning && "cursor-grabbing select-none [&_*]:cursor-grabbing [&_*]:select-none",
      )}
      onMouseLeave={() => setHoveredNodeId(null)}
      onPointerCancel={endCanvasPan}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={endCanvasPan}
      onWheel={handleCanvasWheel}
    >
      <div
        className="absolute origin-top-left"
        style={{
          left: renderedPan.x,
          top: renderedPan.y,
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: stageSize.width,
            height: stageSize.height,
            zoom,
          }}
        >
          <svg
            className="pointer-events-none absolute left-7 top-[86px]"
            viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
            aria-hidden="true"
            style={{ width: stageSize.width, height: stageSize.height }}
          >
            {nodes
              .filter((node) => node.parentId)
              .map((node) => {
                const parent = byId.get(node.parentId!);
                if (!parent) return null;

                const isActiveEdge =
                  parentChainIds.has(node.id) && parentChainIds.has(parent.id);
                const isTemporary = node.kind === "temporary";
                const startX = parent.x + 220;
                const startY = parent.y + 52;
                const endX = node.x;
                const endY = node.y + 52;
                const midX = startX + (endX - startX) / 2;

                return (
                  <path
                    key={`${parent.id}-${node.id}`}
                    className={cx(
                      "fill-none stroke-[#dad4c8] stroke-[1.5]",
                      isActiveEdge && "stroke-[#fbbd41] stroke-[3]",
                      isTemporary && "[stroke-dasharray:8_7] stroke-[#0089ad]",
                    )}
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  />
                );
              })}
          </svg>

          {nodes.map((node) => (
            <button
              className={cx(
                "absolute min-h-[108px] w-[220px] rounded-lg border border-[#dad4c8] bg-white/[0.92] p-3 text-left text-black",
                "transition-[left,top,transform,box-shadow,border-color,opacity] duration-[180ms] ease-[ease] hover:-translate-y-0.5",
                hardShadowHover,
                node.id === activeNodeId && "border-2 border-black bg-white",
                parentChainIds.has(node.id) &&
                  node.id !== activeNodeId &&
                  "border-[#fbbd41] bg-[#fff8e5]",
                node.kind === "temporary" && "border-dashed",
                node.status === "archived" && "opacity-[0.45]",
                clayShadow,
              )}
              key={node.id}
              style={{ left: node.x, top: node.y }}
              type="button"
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onFocus={() => setHoveredNodeId(node.id)}
              onClick={() => onSelectNode(node.id)}
            >
              <div className="mb-2 flex justify-between gap-2">
                <span className={cx(smallPillClass, "bg-[#eee9df] text-[#55534e]")}>
                  {kindLabel[node.kind]}
                </span>
                <span
                  className={cx(
                    smallPillClass,
                    "border border-[#dad4c8] bg-white",
                    node.status === "done" && "bg-[#84e7a5]",
                  )}
                >
                  {statusLabel[node.status]}
                </span>
              </div>
              <strong className="block text-sm leading-[1.25]">{node.title}</strong>
              <p className="mb-2.5 mt-[7px] overflow-hidden text-xs leading-[1.35] text-[#55534e] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                {node.summary}
              </p>
              <div className="flex flex-wrap gap-[5px]">
                <span className={nodeBadgeClass}>
                  <Sparkles size={11} />
                  {node.materials}
                </span>
                <span className={nodeBadgeClass}>
                  <FileText size={11} />
                  {node.references}
                </span>
                {node.webSources > 0 ? (
                  <span className={nodeBadgeClass}>
                    <FileText size={11} />
                    {node.webSources}
                  </span>
                ) : null}
                {node.merged > 0 ? (
                  <span className={nodeBadgeClass}>
                    <Merge size={11} />
                    {node.merged}
                  </span>
                ) : null}
              </div>
            </button>
          ))}

          {hoveredNode ? (
            <SuggestedNodesPopover
              node={hoveredNode}
              suggestions={getAvailableSuggestedNodes(hoveredNode, nodes)}
              customValue={customSuggestion}
              onCreate={(suggestion) => handleCreateSuggestion(hoveredNode.id, suggestion)}
              onCreateCustom={(input) =>
                handleCreateCustomSuggestion(hoveredNode.id, input)
              }
              onCustomChange={setCustomSuggestion}
              onMouseEnter={() => setHoveredNodeId(hoveredNode.id)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SuggestedNodesPopover({
  customValue,
  node,
  onCreate,
  onCreateCustom,
  onCustomChange,
  onMouseEnter,
  suggestions,
}: {
  customValue: string;
  node: TreeNode;
  onCreate: (suggestion: SuggestedNode) => void;
  onCreateCustom: (input?: string) => void;
  onCustomChange: (value: string) => void;
  onMouseEnter: () => void;
  suggestions: SuggestedNode[];
}) {
  const customInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pointerActivationRef = useRef(false);
  const customInputId = `custom-suggestion-${node.id}`;

  function runPointerAction(action: () => void) {
    pointerActivationRef.current = true;
    action();
    window.setTimeout(() => {
      pointerActivationRef.current = false;
    }, 0);
  }

  function runClickAction(action: () => void) {
    if (pointerActivationRef.current) {
      pointerActivationRef.current = false;
      return;
    }

    action();
  }

  function getCustomInputValue() {
    const domInput = document.getElementById(customInputId);

    if (domInput instanceof HTMLTextAreaElement) {
      return domInput.value;
    }

    return customInputRef.current?.value ?? customValue;
  }

  return (
    <aside
      className={cx(
        "pointer-events-auto absolute z-[4] w-[260px] rounded-[10px] border border-[#dad4c8] bg-white/[0.94] p-2.5 max-[1180px]:w-[240px]",
        clayShadow,
      )}
      data-pan-lock
      data-wheel-lock
      style={{ left: node.x + 238, top: node.y - 4 }}
      aria-label={`${node.title} 的展开面板`}
      onMouseEnter={onMouseEnter}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#55534e]">
        <Sparkles size={14} aria-hidden="true" />
        展开节点
      </div>
      <div className="grid gap-[7px]">
        {suggestions.map((suggestion) => (
          <button
            className={getSuggestedNodeClass(suggestion.kind)}
            key={suggestion.title}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              runPointerAction(() => onCreate(suggestion));
            }}
            onClick={() => {
              runClickAction(() => onCreate(suggestion));
            }}
          >
            <span className="text-[10px] font-extrabold text-[#9f9b93]">
              {kindLabel[suggestion.kind]}
            </span>
            <strong className="my-1 block text-[13px] leading-[1.25]">
              {suggestion.title}
            </strong>
            <p className="m-0 text-xs leading-[1.4] text-[#55534e]">
              {suggestion.goal}
            </p>
          </button>
        ))}
        {suggestions.length === 0 ? (
          <div className="text-xs leading-[1.4] text-[#55534e]">
            当前没有新的系统推荐方向。
          </div>
        ) : null}
        <div className="grid gap-[7px] rounded-lg border border-dashed border-[#dad4c8] bg-[#fffdf9] p-[9px]">
          <label className="text-xs font-extrabold text-[#55534e]" htmlFor={customInputId}>
            提出新问题
          </label>
          <textarea
            className="min-h-[62px] w-full resize-none rounded-lg border border-[#dad4c8] bg-white p-2 text-xs leading-[1.4] text-black"
            id={customInputId}
            ref={customInputRef}
            placeholder="输入你想继续展开的问题..."
            value={customValue}
            onChange={(event) => onCustomChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                onCreateCustom(event.currentTarget.value);
              }
            }}
          />
          <button
            className="inline-flex min-h-7 items-center justify-center gap-[5px] rounded-lg border border-black bg-[#fbbd41] text-xs font-extrabold text-black"
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              runPointerAction(() => onCreateCustom(getCustomInputValue()));
            }}
            onClick={() => {
              runClickAction(() => onCreateCustom(getCustomInputValue()));
            }}
          >
            <Plus size={13} />
            生成节点
          </button>
        </div>
      </div>
    </aside>
  );
}

function ContextPreview({
  activeNode,
  parentChain,
}: {
  activeNode: TreeNode;
  parentChain: TreeNode[];
}) {
  const ancestors = parentChain.slice(0, -1);

  return (
    <div
      className={cx(
        "absolute bottom-[18px] right-[18px] z-[6] max-h-[min(360px,calc(100%_-_110px))] w-[min(720px,calc(100%_-_390px))] overflow-auto rounded-xl border border-black bg-white/[0.94] p-3.5",
        "max-[1180px]:w-[min(680px,calc(100%_-_40px))] max-[760px]:static max-[760px]:m-3 max-[760px]:w-auto",
        hardShadow,
      )}
      data-pan-lock
      data-wheel-lock
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className={eyebrowClass}>提示词上下文预览</div>
          <h2 className="m-0 text-lg leading-[1.2] tracking-[0]">
            LLM 将看到的内容
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dad4c8] bg-white px-2.5 py-[7px] text-xs font-semibold text-[#55534e]">
          约 4.8k token
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
        <ContextGroup
          scope="parent"
          title="根节点 + 父链摘要"
          items={ancestors.map((node) => node.summary)}
        />
        <ContextGroup
          scope="current"
          title="当前节点"
          items={[
            activeNode.summary,
            "最近的当前节点素材和当前节点检索结果。",
          ]}
        />
        <ContextGroup
          scope="web"
          title="已选择的外部来源"
          items={["1 个已确认网页来源可进入上下文；待确认网页来源被排除。"]}
        />
        <ContextGroup
          scope="excluded"
          title="按规则排除"
          items={[
            "兄弟分支在画布中可见，但不会自动进入上下文。",
            "已归档的团队同步节点不会进入自动上下文。",
          ]}
        />
      </div>
    </div>
  );
}

function ContextGroup({
  scope,
  title,
  items,
}: {
  scope: SourceScope;
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-lg border border-[#dad4c8] bg-white p-2.5">
      <span className={getScopeBadgeClass(scope)}>{scopeLabel[scope]}</span>
      <h3 className="mb-[5px] mt-[7px] text-[13px] leading-[1.25]">{title}</h3>
      <ul className="m-0 pl-4 [&>li+li]:mt-[5px]">
        {items.map((item) => (
          <li className="m-0 text-[13px] leading-[1.45] text-[#55534e]" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function NodeDetailDialog({
  detailMap,
  isGenerating,
  node,
  onClose,
  onRegenerate,
}: {
  detailMap: Record<string, NodeDetailMock>;
  isGenerating: boolean;
  node: TreeNode;
  onClose: () => void;
  onRegenerate: (node: TreeNode) => void;
}) {
  const detail = detailMap[node.id] ?? getFallbackNodeDetail(node);

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-[#faf9f7]/[0.28] px-7 pb-[150px] pt-[72px] backdrop-blur-[2px] max-[760px]:fixed max-[760px]:px-3 max-[760px]:py-6"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={cx(
          "max-h-[min(620px,100%)] w-[min(760px,100%)] overflow-auto rounded-xl border border-black bg-white/[0.97] p-4",
          hardShadow,
        )}
        data-pan-lock
        data-wheel-lock
        role="dialog"
        aria-modal="true"
        aria-label="节点详情"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <span
              className={getScopeBadgeClass(
                node.kind === "temporary" ? "web" : "current",
              )}
            >
              {kindLabel[node.kind]}
            </span>
            <h2 className="mb-1.5 mt-2 text-2xl leading-[1.2] tracking-[0]">
              {node.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isGenerating ? (
              <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-[#dad4c8] bg-[#fff8e5] px-2.5 text-xs font-extrabold text-black">
                <Sparkles size={13} aria-hidden="true" />
                流式生成中
              </span>
            ) : null}
            <button
              className={cx(
                "inline-grid h-[30px] w-[30px] place-items-center rounded-lg border border-[#dad4c8] bg-white text-black",
                "transition-[transform,box-shadow,opacity] duration-[120ms] ease-[ease] hover:-translate-y-px",
                hardShadowHover,
                isGenerating && "cursor-not-allowed opacity-55 hover:translate-y-0",
              )}
              type="button"
              aria-label="重新生成节点内容"
              title="重新生成节点内容"
              disabled={isGenerating}
              onClick={() => onRegenerate(node)}
            >
              <RefreshCw
                className={isGenerating ? "animate-spin" : undefined}
                size={13}
                aria-hidden="true"
              />
            </button>
            <button
              className={cx(iconButtonClass, "h-[30px] w-[30px]")}
              aria-label="关闭详情"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <article className="px-0.5 pb-0.5 pt-1" aria-live="polite">
          {detail.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={markdownComponents}
            >
              {detail.content}
            </ReactMarkdown>
          ) : (
            <div className="rounded-lg border border-dashed border-[#dad4c8] bg-[#fffdf9] p-3 text-sm font-semibold text-[#55534e]">
              正在把新问题总结成主题正文...
            </div>
          )}
          {isGenerating && detail.content ? (
            <span className="mt-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-[#fbbd41]" />
          ) : null}
        </article>
      </section>
    </div>
  );
}

export default App;
