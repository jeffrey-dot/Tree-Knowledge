import { useState } from "react";
import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { Plus, RefreshCw, Sparkles, X } from "lucide-react";
import type { LlmSettings } from "../llm";
import type { KnowledgeBaseDraft } from "../domain/knowledgeBase";
import { getFallbackNodeDetail } from "../domain/nodeContent";
import type { NodeDetail, TreeNode } from "../types";
import { cx } from "../utils";
import {
  eyebrowClass,
  getScopeBadgeClass,
  hardShadow,
  hardShadowHover,
  iconButtonClass,
  kindLabel,
} from "../ui/styleTokens";
import { markdownComponents } from "../ui/markdownComponents";

type NewKnowledgeBaseDialogProps = {
  onClose: () => void;
  onCreate: (draft: KnowledgeBaseDraft) => void;
};

export function NewKnowledgeBaseDialog({
  onClose,
  onCreate,
}: NewKnowledgeBaseDialogProps) {
  const [draft, setDraft] = useState<KnowledgeBaseDraft>({
    goal: "",
    title: "",
  });

  function updateDraft(field: keyof KnowledgeBaseDraft, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-[#faf9f7]/[0.34] px-7 py-[72px] backdrop-blur-[2px] max-[760px]:fixed max-[760px]:px-3 max-[760px]:py-6"
      role="presentation"
      onClick={onClose}
    >
      <form
        className={cx(
          "w-[min(560px,100%)] rounded-xl border border-black bg-white/[0.98] p-4",
          hardShadow,
        )}
        data-pan-lock
        data-wheel-lock
        role="dialog"
        aria-modal="true"
        aria-label="新建知识库"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(draft);
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="m-0 flex items-center gap-2 text-2xl leading-[1.2] tracking-[0]">
            <Plus size={20} aria-hidden="true" />
            新建知识库
          </h2>
          <button
            className={cx(iconButtonClass, "h-[30px] w-[30px]")}
            aria-label="关闭新建知识库"
            type="button"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold text-black">
            名称
            <input
              autoFocus
              className="h-10 rounded-lg border border-[#dad4c8] bg-white px-3 text-sm font-normal text-black outline-0"
              value={draft.title}
              placeholder="例如：AI 产品研究"
              onChange={(event) => updateDraft("title", event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-black">
            根节点背景
            <textarea
              className="min-h-[110px] resize-y rounded-lg border border-[#dad4c8] bg-white px-3 py-2 text-sm font-normal leading-[1.5] text-black outline-0"
              value={draft.goal}
              placeholder="共享背景..."
              onChange={(event) => updateDraft("goal", event.target.value)}
            />
          </label>
          <button
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-black bg-[#fbbd41] px-3 text-sm font-extrabold text-black"
            type="submit"
          >
            <Plus size={15} />
            创建并打开
          </button>
        </div>
      </form>
    </div>
  );
}

type LlmSettingsDialogProps = {
  initialSettings: LlmSettings;
  onClose: () => void;
  onSave: (settings: LlmSettings) => void;
};

export function LlmSettingsDialog({
  initialSettings,
  onClose,
  onSave,
}: LlmSettingsDialogProps) {
  const [draftSettings, setDraftSettings] = useState(initialSettings);

  function updateDraft(field: keyof LlmSettings, value: string) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      [field]: value,
    }));
  }

  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-[#faf9f7]/[0.34] px-7 py-[72px] backdrop-blur-[2px] max-[760px]:fixed max-[760px]:px-3 max-[760px]:py-6"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={cx(
          "w-[min(520px,100%)] rounded-xl border border-black bg-white/[0.98] p-4",
          hardShadow,
        )}
        data-pan-lock
        data-wheel-lock
        role="dialog"
        aria-modal="true"
        aria-label="LLM 设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className={eyebrowClass}>OpenAI-compatible</div>
            <h2 className="mb-1.5 mt-2 text-2xl leading-[1.2] tracking-[0]">
              LLM 设置
            </h2>
          </div>
          <button
            className={cx(iconButtonClass, "h-[30px] w-[30px]")}
            aria-label="关闭设置"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold text-black">
            Base URL
            <input
              className="h-10 rounded-lg border border-[#dad4c8] bg-white px-3 text-sm font-normal text-black outline-0"
              value={draftSettings.baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(event) => updateDraft("baseUrl", event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-black">
            Model
            <input
              className="h-10 rounded-lg border border-[#dad4c8] bg-white px-3 text-sm font-normal text-black outline-0"
              value={draftSettings.model}
              placeholder="gpt-5.2"
              onChange={(event) => updateDraft("model", event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-black">
            API Key
            <input
              className="h-10 rounded-lg border border-[#dad4c8] bg-white px-3 text-sm font-normal text-black outline-0"
              value={draftSettings.apiKey}
              placeholder="sk-..."
              type="password"
              onChange={(event) => updateDraft("apiKey", event.target.value)}
            />
          </label>
          <div className="rounded-lg border border-[#eee9df] bg-[#fff8e5] px-3 py-2 text-xs font-semibold leading-[1.45] text-[#55534e]">
            这些设置只用于节点内容生成。当前版本先存在本地浏览器存储里，后续 Tauri 版本会迁移到系统凭据存储。
          </div>
          <button
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-black bg-[#fbbd41] px-3 text-sm font-extrabold text-black"
            type="button"
            onClick={() =>
              onSave({
                apiKey: draftSettings.apiKey.trim(),
                baseUrl: draftSettings.baseUrl.trim(),
                model: draftSettings.model.trim(),
              })
            }
          >
            保存设置
          </button>
        </div>
      </section>
    </div>
  );
}

type NodeDetailDialogProps = {
  detailMap: Record<string, NodeDetail>;
  isGenerating: boolean;
  node: TreeNode;
  onClose: () => void;
  onRegenerate: (node: TreeNode) => void;
};

export function NodeDetailDialog({
  detailMap,
  isGenerating,
  node,
  onClose,
  onRegenerate,
}: NodeDetailDialogProps) {
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
