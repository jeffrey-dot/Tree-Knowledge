import { type ReactNode, useMemo } from "react";
import { CircleSlash, Eye, EyeOff } from "lucide-react";
import { buildContextPreview } from "../context";
import { retrievalHits } from "../domain/retrieval";
import type { ContextPreviewSource, NodeDetail, TreeNode } from "../types";
import { cx } from "../utils";
import {
  contextSourceTypeLabel,
  getScopeBadgeClass,
  hardShadow,
  scopeLabel,
} from "../ui/styleTokens";

type ContextPreviewProps = {
  activeNode: TreeNode;
  detailMap: Record<string, NodeDetail>;
  nodes: TreeNode[];
  parentChain: TreeNode[];
};

export function ContextPreview({
  activeNode,
  detailMap,
  nodes,
  parentChain,
}: ContextPreviewProps) {
  const compiledContext = useMemo(
    () =>
      buildContextPreview({
        activeNode,
        allNodes: nodes,
        detailMap,
        parentChain,
        retrievalHits,
      }),
    [activeNode, detailMap, nodes, parentChain],
  );

  return (
    <div
      className={cx(
        "absolute bottom-[18px] right-[18px] z-[6] max-h-[min(520px,calc(100%_-_110px))] w-[min(820px,calc(100%_-_390px))] overflow-auto rounded-xl border border-black bg-white/[0.94] p-3.5",
        "max-[1180px]:w-[min(680px,calc(100%_-_40px))] max-[760px]:static max-[760px]:m-3 max-[760px]:w-auto",
        hardShadow,
      )}
      data-pan-lock
      data-wheel-lock
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className="m-0 flex min-w-0 items-center gap-2 text-lg leading-[1.2] tracking-[0]"
            aria-label={`${activeNode.title} 的上下文预览`}
          >
            <Eye className="shrink-0 text-[#9f9b93]" size={17} aria-hidden="true" />
            <span className="truncate">{activeNode.title}</span>
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dad4c8] bg-white px-2.5 py-[7px] text-xs font-semibold text-[#55534e]">
          约 {compiledContext.tokenEstimate.toLocaleString("zh-CN")} token
        </span>
      </div>

      <div className="grid grid-cols-[1.08fr_0.92fr] gap-2.5 max-[760px]:grid-cols-1">
        <ContextPreviewList
          emptyText="无可纳入上下文"
          icon={<Eye size={15} aria-hidden="true" />}
          items={compiledContext.includedItems}
          title="会看到"
        />
        <ContextPreviewList
          emptyText="无排除来源"
          icon={<EyeOff size={15} aria-hidden="true" />}
          items={compiledContext.excludedItems}
          title="排除"
        />
      </div>
    </div>
  );
}

function ContextPreviewList({
  emptyText,
  icon,
  items,
  title,
}: {
  emptyText: string;
  icon: ReactNode;
  items: ContextPreviewSource[];
  title: string;
}) {
  const visibleItems = items.slice(0, 7);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <section className="min-h-0 rounded-lg border border-[#dad4c8] bg-white p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-black">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#eee9df] bg-[#faf9f7] text-[#55534e]">
            {icon}
          </span>
          <h3 className="m-0 text-[14px] leading-[1.25]">{title}</h3>
        </div>
        <span className="rounded-full border border-[#eee9df] bg-[#faf9f7] px-2 py-1 text-[11px] font-extrabold text-[#55534e]">
          {items.length}
        </span>
      </div>
      <div className="grid gap-2">
        {visibleItems.map((item) => (
          <ContextPreviewCard item={item} key={item.id} />
        ))}
        {hiddenCount > 0 ? (
          <div
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-[#dad4c8] bg-[#faf9f7] px-2.5 py-2 text-xs font-semibold text-[#55534e]"
            aria-label={`还有 ${hiddenCount} 条来源`}
            title={`还有 ${hiddenCount} 条来源`}
          >
            <EyeOff size={14} aria-hidden="true" />
            {hiddenCount}
          </div>
        ) : null}
        {items.length === 0 ? (
          <div
            className="inline-flex w-fit items-center rounded-lg border border-dashed border-[#dad4c8] bg-[#faf9f7] px-2.5 py-2 text-[#9f9b93]"
            aria-label={emptyText}
            title={emptyText}
          >
            <CircleSlash size={14} aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ContextPreviewCard({ item }: { item: ContextPreviewSource }) {
  return (
    <article
      className={cx(
        "rounded-lg border border-[#eee9df] bg-white px-2.5 py-2",
        item.scope === "excluded" && "bg-[#faf9f7]",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={getScopeBadgeClass(item.scope)}>{scopeLabel[item.scope]}</span>
        <span className="rounded-full bg-[#eee9df] px-1.5 py-[3px] text-[10px] font-extrabold leading-none text-[#55534e]">
          {contextSourceTypeLabel[item.type]}
        </span>
      </div>
      <h4 className="mb-1 mt-1.5 text-[13px] leading-[1.25]">{item.title}</h4>
      <p className="m-0 overflow-hidden text-xs leading-[1.45] text-[#55534e] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
        {item.content}
      </p>
      <p className="mb-0 mt-1.5 text-[11px] font-semibold leading-[1.35] text-[#9f9b93]">
        {item.reason}
      </p>
    </article>
  );
}
