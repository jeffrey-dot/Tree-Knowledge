import { Eye, GitBranch } from "lucide-react";
import type { TreeNode } from "../types";
import { cx } from "../utils";
import { clayShadow, iconButtonClass } from "../ui/styleTokens";

type CanvasToolbarProps = {
  parentChain: TreeNode[];
  onToggleContext: () => void;
};

export function CanvasToolbar({
  parentChain,
  onToggleContext,
}: CanvasToolbarProps) {
  const hasActiveNode = parentChain.length > 0;

  return (
    <div
      className={cx(
        "absolute left-4 right-4 top-3.5 z-[5] flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#dad4c8] bg-white/[0.88] p-3 backdrop-blur-[10px]",
        "max-[980px]:left-3 max-[980px]:right-3 max-[980px]:top-3 max-[980px]:gap-2 max-[980px]:p-2.5 max-[760px]:static max-[760px]:m-3 max-[760px]:w-auto",
        clayShadow,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold leading-[1.35] text-black">
          <GitBranch
            className="shrink-0 text-[#9f9b93]"
            size={15}
            aria-label="当前父链"
          />
          {hasActiveNode
            ? parentChain.map((node, index) => (
                <span key={node.id}>
                  {index > 0 ? " / " : ""}
                  {node.title}
                </span>
              ))
            : "未创建知识库"}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          className={cx(
            iconButtonClass,
            !hasActiveNode && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:rotate-0 hover:shadow-none",
          )}
          aria-label="查看上下文"
          disabled={!hasActiveNode}
          title="上下文"
          type="button"
          onClick={onToggleContext}
        >
          <Eye size={16} />
        </button>
      </div>
    </div>
  );
}
