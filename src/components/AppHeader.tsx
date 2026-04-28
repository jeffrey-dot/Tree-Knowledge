import { ArrowLeft, GitBranch, Plus, Search, Settings, Sparkles } from "lucide-react";
import { defaultLlmMode, type LlmSettings } from "../llm";
import type { AppView } from "../hooks/useKnowledgeWorkspace";
import { cx } from "../utils";
import {
  clayShadow,
  iconButtonClass,
  llmStatusClass,
} from "../ui/styleTokens";

type AppHeaderProps = {
  activeRootTitle?: string;
  appView: AppView;
  isWorkspaceView: boolean;
  librarySearch: string;
  llmSettings: LlmSettings;
  onBackToLibrary: () => void;
  onOpenNewKnowledgeBase: () => void;
  onOpenSettings: () => void;
  onSearchChange: (value: string) => void;
};

export function AppHeader({
  activeRootTitle,
  appView,
  isWorkspaceView,
  librarySearch,
  llmSettings,
  onBackToLibrary,
  onOpenNewKnowledgeBase,
  onOpenSettings,
  onSearchChange,
}: AppHeaderProps) {
  return (
    <header className="grid grid-cols-[minmax(220px,0.85fr)_minmax(220px,1fr)_auto] items-center gap-3 border-b border-[#dad4c8] bg-[#faf9f7]/[0.92] px-3.5 py-2 backdrop-blur-[12px] max-[980px]:grid-cols-[minmax(0,1fr)_auto] max-[980px]:items-start max-[680px]:grid-cols-1 max-[680px]:px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {isWorkspaceView ? (
          <button
            className={cx(iconButtonClass, "shrink-0")}
            aria-label="返回所有知识库"
            title="所有知识库"
            type="button"
            onClick={onBackToLibrary}
          >
            <ArrowLeft size={16} />
          </button>
        ) : (
          <div
            className={cx(
              "grid h-9 w-9 place-items-center rounded-lg border border-[#dad4c8] bg-[#fbbd41]",
              clayShadow,
            )}
          >
            <GitBranch size={18} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="m-0 max-w-[290px] truncate text-2xl leading-[1.2] tracking-[0] max-[980px]:max-w-[calc(100vw-320px)] max-[680px]:max-w-[calc(100vw-84px)]">
            {isWorkspaceView ? activeRootTitle : "所有知识库"}
          </h1>
        </div>
      </div>

      <label
        className={cx(
          "flex h-[38px] min-w-0 items-center gap-2 rounded-full border border-[#dad4c8] bg-white px-3",
          "max-[980px]:order-3 max-[980px]:col-span-2 max-[680px]:order-2 max-[680px]:col-span-1",
          clayShadow,
        )}
        aria-label="搜索知识库"
      >
        <Search size={16} aria-hidden="true" />
        {appView === "library" ? (
          <input
            className="w-full border-0 bg-transparent text-black outline-0"
            placeholder="搜索"
            value={librarySearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        ) : (
          <input
            className="w-full border-0 bg-transparent text-black outline-0"
            placeholder="搜索"
          />
        )}
      </label>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-[680px]:order-3 max-[680px]:justify-start">
        {appView === "library" ? (
          <button
            className={iconButtonClass}
            aria-label="新建知识库"
            title="新建知识库"
            type="button"
            onClick={onOpenNewKnowledgeBase}
          >
            <Plus size={17} />
          </button>
        ) : null}
        <span
          className={llmStatusClass}
          title={`${llmSettings.apiKey ? llmSettings.model : "LLM 未配置"} · ${defaultLlmMode === "stream" ? "流式" : "同步"}`}
        >
          <Sparkles className="shrink-0" size={14} aria-hidden="true" />
          <span className="truncate">
            {llmSettings.apiKey ? llmSettings.model : "未配置"}
          </span>
        </span>
        <button
          className={iconButtonClass}
          aria-label="设置"
          title="设置"
          onClick={onOpenSettings}
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
