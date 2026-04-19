import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  ChevronRight, Share2, 
  Save, Edit3, Maximize2, Search, ArrowLeft, 
  Zap, Database, Compass, CheckCircle2, Loader2, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
      <div className="h-full flex items-center justify-center bg-[#050505] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white text-gray-900 selection:bg-blue-100">
      {/* Precision Header */}
      <header className="h-14 border-b border-gray-100 flex items-center px-6 justify-between shrink-0 bg-white/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="group flex items-center gap-2 text-gray-400 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest">Exit</span>
          </button>
          <div className="w-[1px] h-4 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <h2 className="text-sm font-black tracking-tight uppercase truncate max-w-[200px]">{snapshot.workspace.name}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsGlobalView(!isGlobalView)}
            className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all ${
              isGlobalView ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            {isGlobalView ? "Focus Mode" : "Global Orbit"}
          </button>
          <button className="p-2 text-gray-400 hover:text-black transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Minimalist Sidebar */}
        <aside className="w-72 border-r border-gray-100 flex flex-col shrink-0 bg-gray-50/30">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Structure</h3>
              <button 
                onClick={() => setIsSearching(!isSearching)}
                className={`p-1 rounded-md transition-all ${isSearching ? 'bg-black text-white shadow-lg' : 'text-gray-300 hover:text-black'}`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <AnimatePresence>
              {isSearching && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <input 
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search thoughts..."
                    className="w-full px-4 py-2.5 text-sm bg-white border border-gray-100 rounded-xl outline-none ring-4 ring-transparent focus:ring-blue-500/5 focus:border-blue-500/50 transition-all shadow-sm"
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {searchResults.map(node => (
                        <button
                          key={node.id}
                          onClick={() => {
                            setCurrentNodeId(node.id);
                            setIsSearching(false);
                            setSearchQuery("");
                          }}
                          className="w-full p-3 text-left hover:bg-white hover:shadow-md rounded-xl transition-all group"
                        >
                          <p className="text-xs font-black text-gray-800 truncate group-hover:text-blue-600 uppercase tracking-tight">{node.title}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <nav className="space-y-1">
              {snapshot.ancestors.map((node, i) => (
                <button
                  key={node.id}
                  onClick={() => setCurrentNodeId(node.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-400 hover:text-black transition-all group rounded-lg hover:bg-white"
                  style={{ opacity: 0.5 + (i / snapshot.ancestors.length) * 0.5 }}
                >
                  <ChevronRight className="w-3 h-3 text-gray-200 group-hover:text-blue-500 transition-colors" />
                  <span className="truncate uppercase font-bold tracking-tight">{node.title}</span>
                </button>
              ))}
              
              {snapshot.current_node && (
                <div className="flex items-center gap-3 px-3 py-3 text-xs font-black text-blue-600 bg-white shadow-sm border border-blue-50 rounded-xl my-2">
                  <Compass className="w-3.5 h-3.5 animate-spin-slow" />
                  <span className="truncate uppercase tracking-tight">{snapshot.current_node.title}</span>
                </div>
              )}

              <div className="pl-6 mt-4 space-y-1 border-l border-gray-100">
                {snapshot.children.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setCurrentNodeId(node.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-400 hover:text-black transition-all rounded-lg hover:bg-white"
                  >
                    <div className="w-1 h-1 rounded-full bg-gray-200" />
                    <span className="truncate font-bold tracking-tight uppercase">{node.title}</span>
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        {/* Immersive Canvas */}
        <main className="flex-1 relative bg-[#fcfcfc] overflow-hidden">
          <div className="absolute inset-0 z-0">
             {/* Background Subtle Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />
            
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
          </div>
          
          {/* Floating Action Command Bar */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-30">
            <motion.div 
              layout
              className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 p-2"
            >
              <div className="flex items-end gap-2">
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
                  placeholder={isExpanding ? "Synthesizing..." : "Ask your thoughts..."}
                  className="flex-1 px-5 py-4 text-sm font-medium text-gray-800 outline-none resize-none max-h-40 min-h-[52px] bg-transparent placeholder:text-gray-300"
                  rows={1}
                />
                
                <div className="flex gap-1.5 p-1 bg-gray-50 rounded-2xl border border-gray-100">
                  <button 
                    onClick={handlePropose}
                    disabled={!query.trim() || isExpanding || isProposing}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-gray-400 hover:text-black transition-colors disabled:opacity-30"
                  >
                    {isProposing ? "Thinking" : "Suggest"}
                  </button>
                  <button 
                    onClick={handleExpand}
                    disabled={!query.trim() || isExpanding || isProposing}
                    className="w-10 h-10 bg-black text-white rounded-xl hover:scale-105 transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
                  >
                    {isExpanding ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Zap className="w-5 h-5 fill-current" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </main>

        {/* Content & Intelligence Hub */}
        <aside className="w-96 border-l border-gray-100 flex flex-col shrink-0 bg-white z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
          {snapshot.current_node ? (
            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="p-8 border-b border-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {snapshot.current_node.status}
                    </span>
                  </div>
                  <button 
                    onClick={() => isEditing ? handleSaveNode() : setIsEditing(true)}
                    className={`p-2 rounded-xl transition-all ${isEditing ? 'bg-black text-white' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}
                  >
                    {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  </button>
                </div>

                {isEditing ? (
                  <div className="space-y-6">
                    <input 
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-3xl font-black text-black w-full border-none focus:ring-0 outline-none p-0 placeholder:text-gray-100"
                      placeholder="Title"
                    />
                    <textarea 
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full h-[50vh] text-base font-medium text-gray-600 leading-relaxed outline-none border-none p-0 resize-none focus:ring-0 placeholder:text-gray-100"
                      placeholder="Pour your thoughts here..."
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-black text-black leading-[1.1] mb-6 tracking-tight uppercase">
                      {snapshot.current_node.title}
                    </h1>

                    {snapshot.current_node.summary && (
                      <div className="mb-8 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                        <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Core Summary</h4>
                        <p className="text-sm text-blue-900/70 font-semibold leading-relaxed italic">
                          {snapshot.current_node.summary}
                        </p>
                      </div>
                    )}

                    <div className="prose prose-sm prose-slate max-w-none mb-12">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Deep Context</h4>
                      <div className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap text-sm">
                        {snapshot.current_node.body || (
                          <p className="text-gray-300 italic">No detailed insights captured yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* AI Path Intelligence */}
              <AnimatePresence>
                {!isEditing && snapshot.recent_candidates.length > 0 && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-8 bg-gray-50/50 flex-1"
                  >
                    <h4 className="text-[10px] font-black text-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      Suggested Expansion
                    </h4>
                    <div className="space-y-4">
                      {snapshot.recent_candidates.map((cand) => (
                        <motion.button 
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          key={cand.id}
                          className="w-full p-5 rounded-2xl bg-white border border-gray-100 text-left transition-all shadow-sm hover:shadow-xl hover:shadow-black/5 hover:border-black/10 group"
                          onClick={() => handleAcceptCandidate(cand.id)}
                        >
                          <h5 className="text-xs font-black text-gray-900 uppercase tracking-tight mb-2 group-hover:text-blue-600">
                            {cand.title}
                          </h5>
                          <p className="text-[11px] text-gray-400 font-medium leading-normal line-clamp-2 mb-4">
                            {cand.summary}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="px-2 py-0.5 rounded-md bg-gray-100 text-[8px] font-black text-gray-500 uppercase tracking-tighter">
                              {cand.relation_type}
                            </div>
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                              Initialize →
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <Compass className="w-12 h-12 text-gray-100 mb-4 animate-spin-slow" />
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Select a node to navigate</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
