import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronRight, Home, MessageSquarePlus, Share2, Save, Edit3, Maximize2, Search } from "lucide-react";
import KnowledgeGraph from "../../components/workspace/KnowledgeGraph";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  root_node_id: string | null;
}

interface Node {
  id: string;
  workspace_id: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
}

interface NodeEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: string;
}

interface NodeCandidate {
  id: string;
  title: string;
  summary: string;
  relation_type: string;
  mode: string;
  why_this_branch: string;
}

interface WorkspaceSnapshot {
  workspace: Workspace;
  current_node: Node | null;
  ancestors: Node[];
  children: Node[];
  edges: NodeEdge[];
  recent_candidates: NodeCandidate[];
}

interface FullGraph {
  nodes: Node[];
  edges: NodeEdge[];
}

export default function WorkspaceView({ workspaceId, onBack }: { workspaceId: string, onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  
  // Global view state
  const [isGlobalView, setIsGlobalView] = useState(false);
  const [fullGraph, setFullGraph] = useState<FullGraph | null>(null);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Node[]>([]);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSnapshot(currentNodeId);
    if (isGlobalView) {
      loadFullGraph();
    }
  }, [workspaceId, currentNodeId, isGlobalView]);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const delayDebounceFn = setTimeout(async () => {
        try {
          const results = await invoke<Node[]>("search_nodes", { workspaceId, query: searchQuery });
          setSearchResults(results);
        } catch (error) {
          console.error(error);
        }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadSnapshot = async (nodeId: string | null) => {
    try {
      const data = await invoke<WorkspaceSnapshot>("get_workspace_snapshot", {
        workspaceId,
        currentNodeId: nodeId
      });
      setSnapshot(data);
      if (data.current_node) {
        setEditTitle(data.current_node.title);
        setEditBody(data.current_node.body || "");
      }
    } catch (error) {
      console.error("Failed to load workspace snapshot:", error);
    }
  };

  const loadFullGraph = async () => {
    try {
      const data = await invoke<FullGraph>("get_full_graph", { workspaceId });
      setFullGraph(data);
    } catch (error) {
      console.error("Failed to load full graph:", error);
    }
  };

  const handleExpand = async () => {
    if (!query.trim() || !snapshot?.current_node || isExpanding) return;
    
    setIsExpanding(true);
    try {
      const newNode = await invoke<Node>("expand_node_with_ai", {
        workspaceId,
        parentNodeId: snapshot.current_node.id,
        query
      });
      setQuery("");
      setCurrentNodeId(newNode.id);
    } catch (error) {
      alert(error);
    } finally {
      setIsExpanding(false);
    }
  };

  const handlePropose = async () => {
    if (!query.trim() || !snapshot?.current_node || isProposing) return;
    setIsProposing(true);
    try {
      await invoke("generate_candidates", {
        workspaceId,
        nodeId: snapshot.current_node.id,
        query
      });
      setQuery("");
      loadSnapshot(currentNodeId);
    } catch (error) {
      alert(error);
    } finally {
      setIsProposing(false);
    }
  };

  const handleAcceptCandidate = async (candidateId: string) => {
    setIsExpanding(true);
    try {
      const node = await invoke<Node>("accept_candidate", {
        candidateId,
        query: "Confirmed by user from suggestions."
      });
      setCurrentNodeId(node.id);
    } catch (error) {
      alert(error);
    } finally {
      setIsExpanding(false);
    }
  };

  const handleSaveNode = async () => {
    if (!snapshot?.current_node || isSaving) return;
    setIsSaving(true);
    try {
      await invoke("update_node", {
        nodeId: snapshot.current_node.id,
        input: {
          title: editTitle,
          body: editBody,
          summary: snapshot.current_node.summary,
          status: snapshot.current_node.status
        }
      });
      setIsEditing(false);
      loadSnapshot(currentNodeId);
    } catch (error) {
      alert(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!snapshot) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Header */}
      <header className="h-12 border-b border-gray-100 flex items-center px-4 justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500">
            <Home className="w-4 h-4" />
          </button>
          <span className="text-gray-300">/</span>
          <h2 className="font-semibold text-gray-800">{snapshot.workspace.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsGlobalView(!isGlobalView)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${
              isGlobalView ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {isGlobalView ? "Focus Mode" : "Global Graph"}
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Structure */}
        <aside className="w-64 border-r border-gray-100 flex flex-col shrink-0 bg-gray-50/50">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Structure</h3>
              <button 
                onClick={() => setIsSearching(!isSearching)}
                className={`p-1 rounded transition-colors ${isSearching ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:text-blue-500'}`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {isSearching && (
              <div className="mb-4">
                <input 
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes..."
                  className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-gray-100 rounded-lg shadow-sm">
                    {searchResults.map(node => (
                      <button
                        key={node.id}
                        onClick={() => {
                          setCurrentNodeId(node.id);
                          setIsSearching(false);
                          setSearchQuery("");
                        }}
                        className="w-full px-3 py-2 text-xs text-left hover:bg-blue-50 border-b border-gray-50 last:border-none"
                      >
                        <p className="font-bold text-gray-800 truncate">{node.title}</p>
                        <p className="text-[10px] text-gray-400 truncate">{node.summary}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <nav className="space-y-1">
              {snapshot.ancestors.map((node) => (
                <button
                  key={node.id}
                  onClick={() => setCurrentNodeId(node.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-md transition-all group"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <span className="truncate">{node.title}</span>
                </button>
              ))}
              
              {snapshot.current_node && (
                <div className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  <span className="truncate">{snapshot.current_node.title}</span>
                </div>
              )}

              <div className="pl-4 mt-2 space-y-1 border-l-2 border-gray-100">
                {snapshot.children.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setCurrentNodeId(node.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-all"
                  >
                    <span className="truncate">{node.title}</span>
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        {/* Center - Graph Canvas */}
        <main className="flex-1 relative bg-gray-50 overflow-hidden">
          {isGlobalView && fullGraph ? (
            <KnowledgeGraph 
              currentNode={snapshot.current_node}
              ancestors={[]} 
              children={[]}
              edges={fullGraph.edges}
              allNodes={fullGraph.nodes}
              onNodeClick={(id) => {
                setCurrentNodeId(id);
                setIsGlobalView(false);
              }}
            />
          ) : (
            <KnowledgeGraph 
              currentNode={snapshot.current_node}
              ancestors={snapshot.ancestors}
              children={snapshot.children}
              edges={snapshot.edges}
              onNodeClick={setCurrentNodeId}
            />
          )}
          
          {/* Input Area */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 pointer-events-none">
            <div className={`bg-white rounded-2xl shadow-xl border ${isExpanding || isProposing ? 'border-blue-400' : 'border-gray-200'} p-2 flex items-end gap-2 transition-all pointer-events-auto`}>
              <textarea 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isExpanding || isProposing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleExpand();
                  }
                }}
                placeholder={isExpanding ? "AI is thinking..." : `Extend from "${snapshot.current_node?.title || 'Root'}"...`}
                className="flex-1 px-4 py-3 text-gray-700 outline-none resize-none max-h-32 min-h-[44px] disabled:opacity-50"
                rows={1}
              />
              <div className="flex gap-1.5 p-1 bg-gray-50 rounded-xl border border-gray-100">
                <button 
                  onClick={handlePropose}
                  disabled={!query.trim() || isExpanding || isProposing}
                  className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-30"
                >
                  {isProposing ? "Thinking..." : "Propose"}
                </button>
                <div className="w-[1px] bg-gray-200 my-1" />
                <button 
                  onClick={handleExpand}
                  disabled={!query.trim() || isExpanding || isProposing}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExpanding ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <MessageSquarePlus className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            {(isExpanding || isProposing) && (
              <p className="text-center text-[10px] text-blue-500 font-bold uppercase mt-2 animate-pulse">
                {isExpanding ? "Generating new knowledge node..." : "Crafting exploration paths..."}
              </p>
            )}
          </div>
        </main>

        {/* Right Sidebar - Details */}
        <aside className="w-80 border-l border-gray-100 flex flex-col shrink-0 bg-white">
          {snapshot.current_node ? (
            <div className="flex flex-col h-full overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-[10px] font-bold text-blue-600 uppercase">
                  {snapshot.current_node.status}
                </span>
                <button 
                  onClick={() => isEditing ? handleSaveNode() : setIsEditing(true)}
                  className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-blue-600 transition-colors"
                >
                  {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-6">
                  <input 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-2xl font-bold text-gray-900 w-full border-b border-gray-200 focus:border-blue-500 outline-none"
                  />
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Summary</h4>
                    <p className="text-sm text-gray-600 italic leading-relaxed">
                      {snapshot.current_node.summary}
                    </p>
                  </div>
                  <textarea 
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full h-[400px] text-gray-700 leading-relaxed outline-none resize-none border border-gray-100 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-6">
                    {snapshot.current_node.title}
                  </h1>

                  {snapshot.current_node.summary && (
                    <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Summary</h4>
                      <p className="text-sm text-gray-600 leading-relaxed italic">
                        {snapshot.current_node.summary}
                      </p>
                    </div>
                  )}

                  <div className="prose prose-sm prose-slate max-w-none mb-12">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Content</h4>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {snapshot.current_node.body || (
                        <p className="text-gray-400 italic">This node has no body content yet.</p>
                      )}
                    </div>
                  </div>

                  {/* AI Suggestions / Candidates */}
                  {snapshot.recent_candidates.length > 0 && (
                    <div className="border-t border-gray-100 pt-8 mt-auto">
                      <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <MessageSquarePlus className="w-3 h-3" />
                        Exploration Paths
                      </h4>
                      <div className="space-y-3">
                        {snapshot.recent_candidates.map((cand) => (
                          <div 
                            key={cand.id}
                            className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50 transition-all cursor-pointer group"
                            onClick={() => handleAcceptCandidate(cand.id)}
                          >
                            <h5 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                              {cand.title}
                            </h5>
                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                              {cand.summary}
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                {cand.relation_type}
                              </span>
                              <span className="text-[10px] font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                Accept →
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <p className="text-gray-400 text-sm">Select a node to view its details.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
