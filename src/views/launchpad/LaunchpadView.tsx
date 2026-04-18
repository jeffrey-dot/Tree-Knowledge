import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Orbit, Plus, Search, Settings2 } from "lucide-react";
import { useState } from "react";
import { type Provider, type WorkspaceSummary } from "@/app/contracts";

type LaunchpadViewProps = {
  workspaces: WorkspaceSummary[];
  providers: Provider[];
  loading: boolean;
  onCreateWorkspace: (input: {
    name: string;
    description: string;
    initial_question: string;
  }) => Promise<void>;
  onOpenWorkspace: (workspace: WorkspaceSummary) => void;
  onOpenProviders: () => void;
};

export function LaunchpadView({
  workspaces,
  providers,
  loading,
  onCreateWorkspace,
  onOpenWorkspace,
  onOpenProviders,
}: LaunchpadViewProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    initial_question: "",
  });
  const providerReady = providers.some((item) => item.enabled && item.has_api_key);

  const totalNodes = workspaces.reduce((sum, item) => sum + item.node_count, 0);

  async function handleSubmit() {
    await onCreateWorkspace(form);
    setForm({
      name: "",
      description: "",
      initial_question: "",
    });
    setOpen(false);
  }

  return (
    <div className="launchpad-shell">
      <header className="launchpad-nav panel">
        <div className="brand-lockup">
          <div className="brand-badge">
            <Orbit size={18} />
          </div>
          <div>
            <p className="eyebrow">Knowledge OS</p>
            <h1>Tree Knowledge</h1>
          </div>
        </div>

        <div className="nav-actions">
          <button className="ghost-action" type="button">
            <Search size={16} />
            搜索
          </button>
          <button className="ghost-action" type="button" onClick={onOpenProviders}>
            <BrainCircuit size={16} />
            Providers
          </button>
          <button className="primary-action" type="button" onClick={() => setOpen(true)}>
            <Plus size={16} />
            新建知识库
          </button>
          <button className="icon-action" type="button" aria-label="settings">
            <Settings2 size={16} />
          </button>
        </div>
      </header>

      <section className="hero-grid">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="eyebrow">从问题长成知识网络</p>
          <h2>把一次次提问，沉淀成可回跳、可分叉、可关联的节点结构。</h2>
          <p className="hero-subtitle">
            当前实现先打通桌面启动台、工作台骨架、本地数据层和 Provider 配置。界面围绕当前节点而不是聊天记录组织。
          </p>

          <div className="hero-cta-row">
            <button className="primary-action large" type="button" onClick={() => setOpen(true)}>
              <Plus size={16} />
              开始一个新问题
            </button>
            <button
              className="ghost-action large"
              type="button"
              disabled={workspaces.length === 0}
              onClick={() => workspaces[0] && onOpenWorkspace(workspaces[0])}
            >
              <ArrowRight size={16} />
              继续最近探索
            </button>
          </div>

          <div className="stat-row">
            <article className="stat-card panel">
              <span>知识库</span>
              <strong>{workspaces.length}</strong>
            </article>
            <article className="stat-card panel">
              <span>节点总数</span>
              <strong>{totalNodes}</strong>
            </article>
            <article className="stat-card panel">
              <span>默认 Provider</span>
              <strong>{providerReady ? "已就绪" : "待配置"}</strong>
            </article>
            <article className="stat-card panel">
              <span>当前阶段</span>
              <strong>Phase 1-3</strong>
            </article>
          </div>
        </motion.div>

        <motion.div
          className="universe-panel panel"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
        >
          <div className="universe-header">
            <span className="eyebrow">Knowledge Universe</span>
            <p>知识宇宙总览</p>
          </div>
          <div className="universe-map">
            {workspaces.map((workspace, index) => (
              <button
                key={workspace.id}
                className="cluster"
                style={{
                  left: `${14 + ((index * 23) % 58)}%`,
                  top: `${18 + ((index * 29) % 46)}%`,
                  width: `${96 + Math.min(workspace.node_count, 8) * 10}px`,
                  height: `${96 + Math.min(workspace.node_count, 8) * 10}px`,
                }}
                type="button"
                onClick={() => onOpenWorkspace(workspace)}
              >
                <span>{workspace.name}</span>
                <small>{workspace.node_count} 节点</small>
              </button>
            ))}
            {workspaces.length === 0 && (
              <div className="universe-empty">
                <p>先创建第一个知识库，星图才会开始生长。</p>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      <section className="continue-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Continue</p>
            <h3>等待继续</h3>
          </div>
          <span>{providerReady ? "Provider 已连接" : "请先配置 Provider"}</span>
        </div>

        <div className="workspace-grid">
          {workspaces.map((workspace) => (
            <motion.button
              key={workspace.id}
              className="workspace-card panel"
              type="button"
              onClick={() => onOpenWorkspace(workspace)}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="workspace-card-top">
                <span className="workspace-pill">{workspace.node_count} 节点</span>
                <ArrowRight size={16} />
              </div>
              <h4>{workspace.name}</h4>
              <p>{workspace.description || "还没有补充知识库说明。"}</p>
              <div className="workspace-card-footer">
                <span>{new Date(workspace.updated_at).toLocaleString()}</span>
                <span>{workspace.root_node_id ? "已有根节点" : "待生成根节点"}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="provider-strip panel">
        <div>
          <p className="eyebrow">Provider</p>
          <h3>{providerReady ? providers.find((item) => item.enabled)?.name : "未配置"}</h3>
        </div>
        <p>
          {providerReady
            ? "已接入 OpenAI-compatible Provider，可创建根节点并继续扩展。"
            : "当前没有可用 Provider，创建知识库后会停在空壳状态。"}
        </p>
        <button className="ghost-action" type="button" onClick={onOpenProviders}>
          <BrainCircuit size={16} />
          管理 Provider
        </button>
      </section>

      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="create-panel panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="create-panel-header">
                <div>
                  <p className="eyebrow">Create Workspace</p>
                  <h3>开始一个新的知识空间</h3>
                </div>
                <button className="icon-action" type="button" onClick={() => setOpen(false)}>
                  ×
                </button>
              </div>

              <label>
                <span>名称</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="例如：Tree Knowledge 产品设计"
                />
              </label>

              <label>
                <span>简介</span>
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="一句话定义这个知识库的目标"
                />
              </label>

              <label>
                <span>起始问题</span>
                <textarea
                  value={form.initial_question}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, initial_question: event.target.value }))
                  }
                  placeholder="你现在最想探索什么？"
                  rows={5}
                />
              </label>

              <div className="create-panel-footer">
                <p>{providerReady ? "会立即调用 Provider 生成根节点。" : "建议先配置 Provider。"}</p>
                <button
                  className="primary-action"
                  type="button"
                  disabled={
                    loading ||
                    !form.name.trim() ||
                    !form.initial_question.trim()
                  }
                  onClick={handleSubmit}
                >
                  {loading ? "创建中..." : "创建并进入工作台"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
