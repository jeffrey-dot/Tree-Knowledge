import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  ArrowLeft, Zap, Compass, Loader2, Sparkles, 
  Maximize2, Edit3, Save, X 
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

interface FullGraphData {
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
  const [fullGraph, setFullGraph] = useState<FullGraphData | null>(null);

  // Interaction states
  const [showDetail, setShowDetail] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSnapshot(currentNodeId);
  }, [workspaceId, currentNodeId]);

  useEffect(() => {
    if (isGlobalView) {
      loadFullGraph();
    }
  }, [isGlobalView, workspaceId]);

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
      console.error(error);
    }
  };

  const loadFullGraph = async () => {
    try {
      const data = await invoke<FullGraphData>("get_full_graph", { workspaceId });
      setFullGraph(data);
    } catch (error) {
      console.error(error);
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
      setShowDetail(true);
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
      setShowDetail(true);
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
      <div className="h-full flex items-center justify-center bg-[#050505]">
        <Loader2 className="w-12 h-12 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white overflow-hidden relative selection:bg-blue-500/30">
      {/* Floating Exit Button */}
      <nav className="absolute top-8 left-8 z-30 pointer-events-none">
        <button 
          onClick={onBack} 
          className="pointer-events-auto group flex items-center gap-3 px-5 py-2.5 bg-white/5 backdrop-blur-xl border border-white/5 rounded-full hover:bg-white/10 transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 group-hover:text-white transition-colors">Orbit Exit</span>
        </button>
      </nav>

      {/* Main Experience Canvas */}
      <main className="flex-1 relative z-10">
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
              setShowDetail(true);
            }}
          />
        ) : (
          <KnowledgeGraph 
            currentNode={snapshot.current_node}
            ancestors={snapshot.ancestors}
            children={snapshot.children}
            edges={snapshot.edges}
            onNodeClick={(id) => {
              setCurrentNodeId(id);
              setShowDetail(true);
            }}
          />
        )}

        {/* Diffusing Detail Overlay */}
        <AnimatePresence>
          {showDetail && snapshot.current_node && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-40%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-45%" }}
              className="absolute top-1/2 left-1/2 w-full max-w-2xl z-40"
            >
              <div className="bg-neutral-900/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                {/* Header Actions */}
                <div className="absolute top-8 right-8 flex gap-2">
                  <button 
                    onClick={() => isEditing ? handleSaveNode() : setIsEditing(true)}
                    className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-white text-black' : 'text-gray-500 hover:text-white bg-white/5 hover:bg-white/10'}`}
                  >
                    {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setShowDetail(false)}
                    className="p-3 rounded-2xl text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col h-full max-h-[60vh] overflow-y-auto custom-scrollbar pr-4">
                  {isEditing ? (
                    <div className="space-y-6">
                      <input 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-4xl font-black text-white bg-transparent border-none focus:ring-0 outline-none p-0 w-full placeholder:text-white/10 uppercase tracking-tighter"
                      />
                      <textarea 
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full h-80 text-lg font-medium text-gray-400 leading-relaxed bg-transparent border-none p-0 resize-none focus:ring-0 placeholder:text-white/5"
                        placeholder="Crystallize your findings here..."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{snapshot.current_node.status}</span>
                      </div>
                      
                      <h1 className="text-4xl font-black text-white leading-none mb-8 tracking-tighter uppercase">
                        {snapshot.current_node.title}
                      </h1>

                      {snapshot.current_node.summary && (
                        <div className="mb-10 p-6 bg-white/5 rounded-3xl border border-white/5">
                          <p className="text-base text-gray-300 font-bold leading-relaxed italic opacity-80">
                            {snapshot.current_node.summary}
                          </p>
                        </div>
                      )}

                      <div className="text-gray-400 font-medium leading-relaxed whitespace-pre-wrap text-lg">
                        {snapshot.current_node.body || (
                          <p className="text-gray-600 italic uppercase text-xs tracking-widest">No deep context captured yet.</p>
                        )}
                      </div>

                      {/* Candidates Diffusion inside Overlay */}
                      {snapshot.recent_candidates.length > 0 && (
                        <div className="mt-12 pt-12 border-t border-white/5">
                          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                            <Sparkles className="w-3 h-3" />
                            Next Diffusion Paths
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {snapshot.recent_candidates.map((cand) => (
                              <button 
                                key={cand.id}
                                className="p-6 rounded-[2rem] bg-white/5 border border-white/5 text-left hover:bg-white/10 hover:border-blue-500/30 transition-all active:scale-95 group"
                                onClick={() => handleAcceptCandidate(cand.id)}
                              >
                                <h5 className="text-[11px] font-black text-white uppercase tracking-tight mb-2 group-hover:text-blue-400 transition-colors">
                                  {cand.title}
                                </h5>
                                <p className="text-[10px] text-gray-500 leading-normal line-clamp-2">
                                  {cand.summary}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Universal Input Bar */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
          <motion.div 
            layout
            className="bg-neutral-900/60 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_32px_100px_rgba(0,0,0,0.8)] border border-white/10 p-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                <Compass className={`w-5 h-5 text-gray-500 ${isExpanding || isProposing ? 'animate-spin-slow' : ''}`} />
              </div>
              
              <input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isExpanding || isProposing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExpand();
                }}
                placeholder={isExpanding ? "Synthesizing Thought..." : "Direct the flow of knowledge..."}
                className="flex-1 bg-transparent border-none focus:ring-0 text-white font-bold text-lg placeholder:text-white/10"
              />
              
              <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
                <button 
                  onClick={handlePropose}
                  disabled={!query.trim() || isExpanding || isProposing}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors disabled:opacity-20"
                >
                  Propose
                </button>
                <button 
                  onClick={handleExpand}
                  disabled={!query.trim() || isExpanding || isProposing}
                  className="w-10 h-10 bg-white text-black rounded-full hover:scale-110 transition-all flex items-center justify-center shrink-0 disabled:opacity-20"
                >
                  {isExpanding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 fill-current" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Sub-nav indicators (Floating) */}
      <div className="absolute top-8 right-8 z-30 flex items-center gap-4">
          <button 
            onClick={() => setIsGlobalView(!isGlobalView)}
            className={`flex items-center gap-3 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border transition-all ${
              isGlobalView ? 'bg-blue-600 text-white border-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/20 hover:text-white'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {isGlobalView ? "Focus" : "Full Orbit"}
          </button>
      </div>
    </div>
  );
}
