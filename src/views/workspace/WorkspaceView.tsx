import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  BrainCircuit,
  GitBranchPlus,
  Search,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type Candidate,
  type NodeMode,
  type RelationType,
  type SearchNodeItem,
  type WorkspaceSnapshot,
} from "@/app/contracts";

type WorkspaceViewProps = {
  snapshot: WorkspaceSnapshot;
  providerConfigured: boolean;
  loading: boolean;
  onBack: () => void;
  onOpenProviders: () => void;
  onSelectNode: (nodeId: string) => Promise<void>;
  onGenerateCandidates: (query: string) => Promise<void>;
  onAcceptCandidate: (candidate: Candidate) => Promise<void>;
  onDirectExpand: (mode: NodeMode, query: string) => Promise<void>;
  onSaveNode: (input: { title: string; summary: string; body: string }) => Promise<void>;
  onSearchNodes: (query: string) => Promise<SearchNodeItem[]>;
  onMoveNode: (newParentId: string) => Promise<void>;
  onCreateEdge: (targetNodeId: string, relationType: RelationType) => Promise<void>;
};

function getGraph(snapshot: WorkspaceSnapshot) {
  const current = snapshot.current_node;
  const currentX = 420;
  const currentY = 220;

  const nodes: Node[] = [
    {
      id: current.id,
      position: { x: currentX, y: currentY },
      data: { label: current.title },
      className: "graph-node current",
    },
    ...snapshot.ancestors.map((item, index) => ({
      id: item.id,
      position: { x: 180, y: 60 + index * 110 },
      data: { label: item.title },
      className: "graph-node ancestor",
    })),
    ...snapshot.children.map((item, index) => ({
      id: item.id,
      position: { x: 720, y: 80 + index * 120 },
      data: { label: item.title },
      className: "graph-node child",
    })),
    ...snapshot.related_nodes.map((item, index) => ({
      id: item.id,
      position: { x: 420 + (index % 2 === 0 ? -80 : 120), y: 420 + index * 88 },
      data: { label: item.title },
      className: "graph-node related",
    })),
  ];

  const hierarchyEdges: Edge[] = [
    ...snapshot.ancestors.map((ancestor, index) => {
      const nextId =
        index === snapshot.ancestors.length - 1
          ? current.id
          : snapshot.ancestors[index + 1]?.id;
      return {
        id: `${ancestor.id}-${nextId}`,
        source: ancestor.id,
        target: nextId,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        className: "graph-edge hierarchy",
      };
    }),
    ...snapshot.children.map((child) => ({
      id: `${current.id}-${child.id}`,
      source: current.id,
      target: child.id,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      className: "graph-edge hierarchy",
    })),
  ];

  const relatedEdges: Edge[] = snapshot.related_nodes.map((item) => ({
    id: `related-${current.id}-${item.id}`,
    source: current.id,
    target: item.id,
    type: "smoothstep",
    className: "graph-edge related",
    label: item.relation_type,
  }));

  return {
    nodes,
    edges: [...hierarchyEdges, ...relatedEdges],
  };
}

export function WorkspaceView({
  snapshot,
  providerConfigured,
  loading,
  onBack,
  onOpenProviders,
  onSelectNode,
  onGenerateCandidates,
  onAcceptCandidate,
  onDirectExpand,
  onSaveNode,
  onSearchNodes,
  onMoveNode,
  onCreateEdge,
}: WorkspaceViewProps) {
  const [editor, setEditor] = useState({
    title: snapshot.current_node.title,
    summary: snapshot.current_node.summary,
    body: snapshot.current_node.body,
  });
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<NodeMode>("child");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchNodeItem[]>([]);
  const [relationType, setRelationType] = useState<RelationType>("related_to");

  const graph = useMemo(() => getGraph(snapshot), [snapshot]);

  const suggestions = snapshot.recent_candidates.filter((item) => !item.accepted);
  const currentParent =
    snapshot.ancestors.length > 0 ? snapshot.ancestors[snapshot.ancestors.length - 1] : null;
  const isRootNode = currentParent === null;

  useEffect(() => {
    setEditor({
      title: snapshot.current_node.title,
      summary: snapshot.current_node.summary,
      body: snapshot.current_node.body,
    });
    setSearchResults([]);
    setSearchQuery("");
  }, [snapshot.current_node.id, snapshot.current_node.title, snapshot.current_node.summary, snapshot.current_node.body]);

  async function runSearch(value: string) {
    setSearchQuery(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    const results = await onSearchNodes(trimmed);
    setSearchResults(results.filter((item) => item.id !== snapshot.current_node.id));
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-topbar panel">
        <button className="ghost-action" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回启动台
        </button>

        <div className="workspace-title">
          <p className="eyebrow">Workspace</p>
          <h2>{snapshot.workspace.name}</h2>
        </div>

        <div className="workspace-topbar-actions">
          <button className="ghost-action" type="button" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
            搜索节点
          </button>
          <div className={`provider-chip ${providerConfigured ? "ready" : "missing"}`}>
            <BrainCircuit size={16} />
            {providerConfigured ? "Provider Ready" : "Provider Missing"}
          </div>
        </div>
      </header>

      <div className="workspace-grid-layout">
        <aside className="panel left-rail">
          <section>
            <p className="eyebrow">Ancestors</p>
            <div className="nav-list">
              {snapshot.ancestors.map((node) => (
                <button key={node.id} type="button" onClick={() => onSelectNode(node.id)}>
                  {node.title}
                </button>
              ))}
              <button className="active" type="button">
                {snapshot.current_node.title}
              </button>
            </div>
          </section>

          <section>
            <p className="eyebrow">Children</p>
            <div className="nav-list">
              {snapshot.children.length === 0 && <p className="muted-text">当前节点还没有子节点。</p>}
              {snapshot.children.map((node) => (
                <button key={node.id} type="button" onClick={() => onSelectNode(node.id)}>
                  {node.title}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="eyebrow">Recent</p>
            <div className="nav-list">
              {snapshot.recent_nodes.length === 0 && <p className="muted-text">暂无最近访问节点。</p>}
              {snapshot.recent_nodes.map((node) => (
                <button key={node.id} type="button" onClick={() => onSelectNode(node.id)}>
                  {node.title}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="panel graph-panel">
          <div className="graph-panel-header">
            <div>
              <p className="eyebrow">Graph Canvas</p>
              <h3>当前节点为中心的有限半径图谱</h3>
            </div>
            <div className="graph-legend">
              <span>
                <GitBranchPlus size={14} />
                层级
              </span>
              <span>
                <Waypoints size={14} />
                关系边
              </span>
            </div>
          </div>

          <div className="graph-surface">
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              onNodeClick={(_, node) => void onSelectNode(node.id)}
            >
              <Background gap={22} size={1.2} color="rgba(36, 74, 63, 0.08)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </main>

        <aside className="panel detail-rail">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Current Node</p>
              <h3>{snapshot.current_node.title}</h3>
            </div>
            <button className="ghost-action" type="button" onClick={onOpenProviders}>
              <BrainCircuit size={16} />
              Providers
            </button>
          </div>

          <label>
            <span>标题</span>
            <input
              value={editor.title}
              onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>

          <label>
            <span>摘要</span>
            <textarea
              value={editor.summary}
              onChange={(event) => setEditor((prev) => ({ ...prev, summary: event.target.value }))}
              rows={4}
            />
          </label>

          <label>
            <span>正文</span>
            <textarea
              value={editor.body}
              onChange={(event) => setEditor((prev) => ({ ...prev, body: event.target.value }))}
              rows={10}
            />
          </label>

          <div className="detail-block">
            <p className="eyebrow">Context Snapshot</p>
            <p>{snapshot.context_snapshot.context_summary}</p>
            <small>{snapshot.context_snapshot.ancestor_summary || "当前是根节点，没有祖先背景。"}</small>
          </div>

          <div className="detail-block">
            <p className="eyebrow">Related Nodes</p>
            {snapshot.related_nodes.length === 0 && <p className="muted-text">暂无关系边。</p>}
            {snapshot.related_nodes.map((node) => (
              <button
                key={node.id}
                className="relation-pill"
                type="button"
                onClick={() => onSelectNode(node.id)}
              >
                {node.title}
                <span>{node.relation_type}</span>
              </button>
            ))}
          </div>

          <div className="detail-block">
            <p className="eyebrow">Structure Edit</p>
            <p>
              主父节点：{currentParent ? currentParent.title : "当前是根节点，不能移动主父节点"}
            </p>
            <small>通过搜索层定位节点后，可以跳转、建立关系边，或把当前节点挂到新的主父节点下。</small>
            <div className="structure-actions">
              <button className="ghost-action" type="button" onClick={() => setSearchOpen(true)}>
                <Search size={16} />
                打开搜索层
              </button>
              <select
                className="relation-select"
                value={relationType}
                onChange={(event) => setRelationType(event.target.value as RelationType)}
              >
                <option value="related_to">related_to</option>
                <option value="supports">supports</option>
                <option value="contrasts">contrasts</option>
                <option value="example_of">example_of</option>
                <option value="depends_on">depends_on</option>
              </select>
            </div>
          </div>

          <button
            className="primary-action"
            type="button"
            disabled={loading}
            onClick={() => onSaveNode(editor)}
          >
            保存当前节点
          </button>
        </aside>
      </div>

      <section className="panel candidate-strip">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AI Suggestions</p>
            <h3>候选节点确认层</h3>
          </div>
        </div>

        {suggestions.length === 0 && (
          <div className="empty-block">
            <p>还没有候选节点。可以先请求 AI 生成候选方向。</p>
          </div>
        )}

        <div className="candidate-list">
          {suggestions.map((candidate) => (
            <article key={candidate.candidate_id} className="candidate-card">
              <div>
                <span className="workspace-pill">{candidate.mode}</span>
                <h4>{candidate.title}</h4>
              </div>
              <p>{candidate.summary}</p>
              <small>{candidate.why_this_branch}</small>
              <button className="ghost-action" type="button" onClick={() => onAcceptCandidate(candidate)}>
                采纳候选
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="input-dock panel">
        <div className="mode-row">
          {(["child", "branch", "related"] as NodeMode[]).map((item) => (
            <button
              key={item}
              className={item === mode ? "mode-pill active" : "mode-pill"}
              type="button"
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          placeholder={
            providerConfigured
              ? "围绕当前节点继续提问，或请求 AI 生成候选方向"
              : "先配置 Provider，才能生成根节点和扩展节点"
          }
        />

        <div className="input-dock-footer">
          <p>
            默认以当前节点为上下文起点，围绕祖先摘要和当前摘要组装上下文。
          </p>
          <div className="input-actions">
            <button
              className="ghost-action"
              type="button"
              disabled={!providerConfigured || loading || !query.trim()}
              onClick={() => onGenerateCandidates(query)}
            >
              <Sparkles size={16} />
              生成候选
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={!providerConfigured || loading || !query.trim()}
              onClick={() => onDirectExpand(mode, query)}
            >
              直接扩展
            </button>
          </div>
        </div>
      </section>

      {searchOpen && (
        <div className="modal-backdrop">
          <div className="search-panel panel">
            <div className="create-panel-header">
              <div>
                <p className="eyebrow">Search Layer</p>
                <h3>搜索并编辑节点结构</h3>
              </div>
              <button className="icon-action" type="button" onClick={() => setSearchOpen(false)}>
                ×
              </button>
            </div>

            <label>
              <span>搜索当前知识库节点</span>
              <input
                value={searchQuery}
                onChange={(event) => void runSearch(event.target.value)}
                placeholder="输入标题或摘要关键词"
              />
            </label>

            <div className="search-results">
              {searchQuery.trim().length === 0 && (
                <div className="empty-block">
                  <p>输入关键词后，可以跳转节点、建立关系边或修改主父节点。</p>
                </div>
              )}

              {searchQuery.trim().length > 0 && searchResults.length === 0 && (
                <div className="empty-block">
                  <p>没有匹配节点。</p>
                </div>
              )}

              {searchResults.map((item) => (
                <article key={item.id} className="search-result-card">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.summary}</p>
                    <small>{item.path.map((node) => node.title).join(" / ")}</small>
                  </div>
                  <div className="search-result-actions">
                    <button
                      className="ghost-action"
                      type="button"
                      onClick={() => {
                        void onSelectNode(item.id);
                        setSearchOpen(false);
                      }}
                    >
                      打开节点
                    </button>
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={isRootNode}
                      onClick={() => {
                        void onMoveNode(item.id);
                        setSearchOpen(false);
                      }}
                    >
                      设为主父节点
                    </button>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => {
                        void onCreateEdge(item.id, relationType);
                        setSearchOpen(false);
                      }}
                    >
                      建立关系边
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
