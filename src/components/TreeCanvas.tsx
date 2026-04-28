import {
  type PointerEvent,
  type WheelEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, GitBranch, Merge, Plus, Sparkles } from "lucide-react";
import {
  canvasZoomStep,
  maxCanvasZoom,
  minCanvasZoom,
} from "../domain/treeLayout";
import {
  createCustomSuggestedNode,
  getAvailableSuggestedNodes,
  type SuggestedNode,
} from "../domain/nodeSuggestions";
import type { TreeNode } from "../types";
import { clamp, cx } from "../utils";
import {
  clayShadow,
  getSuggestedNodeClass,
  hardShadowHover,
  kindLabel,
  nodeBadgeClass,
  smallPillClass,
  statusLabel,
} from "../ui/styleTokens";

type TreeCanvasProps = {
  nodes: TreeNode[];
  activeNodeId: string | null;
  parentChainIds: Set<string>;
  onCreateSuggestedNode: (parentId: string, suggestion: SuggestedNode) => void;
  onSelectNode: (nodeId: string) => void;
};

export function TreeCanvas({
  nodes,
  activeNodeId,
  parentChainIds,
  onCreateSuggestedNode,
  onSelectNode,
}: TreeCanvasProps) {
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

  if (nodes.length === 0) {
    return <EmptyTreeCanvas />;
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

function EmptyTreeCanvas() {
  return (
    <div className="absolute inset-0 grid place-items-center px-4 pt-[88px] max-[760px]:relative max-[760px]:min-h-[620px] max-[760px]:pt-10">
      <section
        className={cx(
          "w-[min(460px,100%)] rounded-xl border border-[#dad4c8] bg-white/[0.92] p-4 text-center",
          clayShadow,
        )}
      >
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-lg border border-[#dad4c8] bg-[#fbbd41]">
          <GitBranch size={20} aria-hidden="true" />
        </div>
        <h2 className="m-0 text-xl leading-[1.2] tracking-[0]">
          根节点
        </h2>
      </section>
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
