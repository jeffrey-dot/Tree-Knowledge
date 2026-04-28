import type { ContextPreviewSource, SourceScope, TreeNode } from "../types";
import { cx } from "../utils";

export const scopeLabel: Record<SourceScope, string> = {
  current: "当前",
  parent: "父链",
  global: "全局",
  web: "网页",
  excluded: "排除",
};

export const kindLabel: Record<TreeNode["kind"], string> = {
  root: "根节点",
  main: "主线",
  temporary: "临时",
  research: "研究",
  decision: "决策",
};

export const contextSourceTypeLabel: Record<ContextPreviewSource["type"], string> = {
  summary: "摘要",
  content: "正文",
  "retrieval-hit": "检索",
  "excluded-branch": "分支",
};

export const clayShadow =
  "shadow-[rgba(0,0,0,0.1)_0_1px_1px,rgba(0,0,0,0.04)_0_-1px_1px_inset,rgba(0,0,0,0.05)_0_-0.5px_1px]";
export const hardShadow = "shadow-[rgb(0,0,0)_-4px_4px_0]";
export const hardShadowHover = "hover:shadow-[rgb(0,0,0)_-4px_4px_0]";
export const eyebrowClass =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[#9f9b93]";
export const iconButtonClass = cx(
  "inline-grid h-[34px] w-[34px] place-items-center rounded-lg border border-[#dad4c8] bg-white text-black",
  "transition-[transform,box-shadow] duration-[120ms] ease-[ease] hover:-translate-y-px hover:-rotate-1",
  hardShadowHover,
);
export const llmStatusClass =
  "inline-flex h-[34px] max-w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#dad4c8] bg-white px-2.5 text-xs font-semibold leading-none text-[#55534e]";
export const nodeBadgeClass =
  "inline-flex items-center gap-[3px] rounded-full border border-[#eee9df] bg-[#faf9f7] px-1.5 py-[3px] text-[11px] font-bold text-[#55534e]";
export const smallPillClass =
  "inline-flex w-fit items-center rounded-full px-[7px] py-[3px] text-[10px] font-extrabold uppercase leading-none";

export function getScopeBadgeClass(scope: SourceScope) {
  return cx(
    smallPillClass,
    scope === "current" && "bg-[#84e7a5]",
    scope === "parent" && "bg-[#f8cc65]",
    scope === "global" && "bg-[#01418d] text-white",
    scope === "web" && "bg-[#43089f] text-white",
    scope === "excluded" && "bg-[#eee9df] text-[#55534e]",
  );
}

export function getSuggestedNodeClass(kind: TreeNode["kind"]) {
  return cx(
    "block w-full rounded-lg border border-dashed border-[#dad4c8] bg-[#fff8e5] p-[9px] text-left text-black",
    "transition-[transform,box-shadow] duration-[120ms] ease-[ease] hover:-translate-y-px",
    hardShadowHover,
    kind === "temporary" && "border-[#0089ad] bg-[#f0fbff]",
    kind === "research" && "border-[#c1b0ff] bg-[#f6f1ff]",
    kind === "decision" && "border-[#fc7981] bg-[#fff5f5]",
  );
}
