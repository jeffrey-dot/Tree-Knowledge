import { useMemo } from "react";
import { FileText, GitBranch, Search, Sparkles } from "lucide-react";
import {
  formatKnowledgeBaseTime,
  getKnowledgeBaseRootNode,
  type KnowledgeBase,
} from "../domain/knowledgeBase";
import { cx } from "../utils";
import {
  hardShadowHover,
  nodeBadgeClass,
  smallPillClass,
} from "../ui/styleTokens";

type LibraryOverviewProps = {
  knowledgeBases: KnowledgeBase[];
  onOpenKnowledgeBase: (knowledgeBaseId: string) => void;
  query: string;
};

export function LibraryOverview({
  knowledgeBases,
  onOpenKnowledgeBase,
  query,
}: LibraryOverviewProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleKnowledgeBases = useMemo(
    () =>
      knowledgeBases
        .filter((knowledgeBase) => {
          if (!normalizedQuery) return true;

          return `${knowledgeBase.title} ${knowledgeBase.goal}`
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort(
          (first, second) =>
            Date.parse(second.lastOpenedAt) - Date.parse(first.lastOpenedAt),
        ),
    [knowledgeBases, normalizedQuery],
  );

  return (
    <section className="h-full px-4 py-4 max-[760px]:px-3" aria-label="知识库总览">
      <div className="mx-auto grid w-full max-w-[1180px] gap-3">
        <section className="rounded-xl border border-[#dad4c8] bg-white/[0.92] p-2.5">
          <div className="mb-2 flex items-end justify-between gap-3 px-1">
            <h2 className="m-0 flex items-center gap-2 text-lg leading-[1.25] tracking-[0]">
              <GitBranch size={17} aria-hidden="true" />
              知识库
            </h2>
            <span className="rounded-full border border-[#eee9df] bg-[#faf9f7] px-2 py-1 text-[11px] font-extrabold text-[#55534e]">
              {visibleKnowledgeBases.length}
            </span>
          </div>

          <div className="grid gap-2">
            {visibleKnowledgeBases.map((knowledgeBase) => (
              <KnowledgeBaseListItem
                key={knowledgeBase.id}
                knowledgeBase={knowledgeBase}
                onOpen={() => onOpenKnowledgeBase(knowledgeBase.id)}
              />
            ))}
            {knowledgeBases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#dad4c8] bg-[#fffdf9] px-3 py-8 text-center">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-lg border border-[#dad4c8] bg-[#fbbd41]">
                  <GitBranch size={18} aria-hidden="true" />
                </div>
                <h3 className="m-0 text-base leading-[1.25]">
                  还没有知识库
                </h3>
              </div>
            ) : null}
            {knowledgeBases.length > 0 && visibleKnowledgeBases.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-[#dad4c8] bg-[#fffdf9] px-3 py-8 text-center text-sm font-semibold text-[#55534e]">
                <Search size={18} aria-hidden="true" />
                无结果
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function KnowledgeBaseListItem({
  knowledgeBase,
  onOpen,
}: {
  knowledgeBase: KnowledgeBase;
  onOpen: () => void;
}) {
  const rootNode = getKnowledgeBaseRootNode(knowledgeBase);
  const doneNodeCount = knowledgeBase.nodes.filter(
    (node) => node.status === "done",
  ).length;

  return (
    <button
      className={cx(
        "grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-[#dad4c8] bg-white px-3 py-3 text-left text-black",
        "transition-[transform,box-shadow,border-color] duration-[120ms] ease-[ease] hover:-translate-y-px hover:-rotate-[0.4deg]",
        hardShadowHover,
      )}
      type="button"
      onClick={onOpen}
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cx(smallPillClass, "bg-[#fbbd41] text-black")}
            title="知识库"
          >
            <GitBranch size={11} aria-hidden="true" />
          </span>
          <span
            className="rounded-full border border-[#eee9df] bg-[#faf9f7] px-2 py-1 text-[11px] font-bold text-[#55534e]"
            title="最近打开"
          >
            {formatKnowledgeBaseTime(knowledgeBase.lastOpenedAt)}
          </span>
        </div>
        <h3 className="m-0 truncate text-[15px] font-semibold leading-[1.25]">
          {knowledgeBase.title}
        </h3>
        <p className="mb-0 mt-1 overflow-hidden text-xs leading-[1.45] text-[#55534e] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {rootNode?.summary || knowledgeBase.goal}
        </p>
      </div>
      <div className="flex min-w-[190px] flex-wrap justify-end gap-[6px] max-[760px]:hidden">
        <span className={nodeBadgeClass}>
          <GitBranch size={11} />
          {knowledgeBase.nodes.length}
        </span>
        <span className={nodeBadgeClass}>
          <Sparkles size={11} />
          {doneNodeCount}
        </span>
        <span className={nodeBadgeClass}>
          <FileText size={11} />
          {formatKnowledgeBaseTime(knowledgeBase.updatedAt)}
        </span>
      </div>
    </button>
  );
}
