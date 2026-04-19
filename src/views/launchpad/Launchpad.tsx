import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Settings, Sparkles, Loader2, Compass, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { isLlmStreamEvent } from "../../lib/llmStream";
import StructuredStreamPreview from "../../components/llm/StructuredStreamPreview";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  root_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function Launchpad({ 
  onEnterWorkspace, 
  onOpenSettings 
}: { 
  onEnterWorkspace: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);
  const [pendingDeleteWorkspaceId, setPendingDeleteWorkspaceId] = useState<string | null>(null);
  const [initialQuestion, setInitialQuestion] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (!pendingDeleteWorkspaceId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingDeleteWorkspaceId((current) => current === pendingDeleteWorkspaceId ? null : current);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pendingDeleteWorkspaceId]);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<unknown>("llm-stream", (event) => {
        const payload = event.payload;
        if (!isLlmStreamEvent(payload) || payload.request_id !== streamRequestIdRef.current) {
          return;
        }

        if (payload.stage === "delta" && payload.content) {
          setStreamPreview((current) => current + payload.content);
          return;
        }

        if (payload.stage === "error" && payload.error) {
          setStreamError(payload.error);
        }
      });

      if (!isMounted && unlisten) {
        unlisten();
      }
    };

    void setup();

    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const loadWorkspaces = async () => {
    try {
      const list = await invoke<Workspace[]>("list_workspaces");
      setWorkspaces(list);
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    }
  };

  const handleCreate = async () => {
    if (!initialQuestion.trim()) return;

    const requestId = crypto.randomUUID();
    streamRequestIdRef.current = requestId;
    setStreamPreview("");
    setStreamError(null);
    setIsProcessing(true);

    try {
      const ws = await invoke<Workspace>("create_workspace", {
        input: { name: "New Spark...", description: null }
      });

      await invoke("generate_root_node", {
        workspaceId: ws.id,
        question: initialQuestion,
        requestId
      });

      setIsCreating(false);
      setInitialQuestion("");
      onEnterWorkspace(ws.id);
    } catch (error) {
      alert(error);
    } finally {
      streamRequestIdRef.current = null;
      setIsProcessing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (pendingDeleteWorkspaceId !== id) {
      setPendingDeleteWorkspaceId(id);
      return;
    }

    setPendingDeleteWorkspaceId(null);
    setDeletingWorkspaceId(id);
    try {
      await invoke("delete_workspace", { id });
      setWorkspaces((current) => current.filter((workspace) => workspace.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
      alert(error);
      await loadWorkspaces();
    } finally {
      setDeletingWorkspaceId((current) => (current === id ? null : current));
    }
  };

  return (
    <div 
      className="min-h-screen bg-transparent overflow-hidden relative selection:bg-blue-500/30"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) setIsCreating(true);
      }}
    >
      {/* Glass Header */}
      <header className="fixed top-0 left-0 right-0 p-8 flex justify-between items-center z-30 pointer-events-none">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <Compass className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none text-white">TREE KNOWLEDGE</h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1">Cognitive Navigator</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex gap-2 pointer-events-auto"
        >
          <button 
            onClick={onOpenSettings}
            className="p-3 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10"
          >
            <Settings className="w-5 h-5" />
          </button>
        </motion.div>
      </header>

      {/* Theme Cloud */}
      <main className="h-screen w-full flex items-center justify-center relative perspective-1000">
        <AnimatePresence>
          {workspaces.map((ws, i) => {
            const angle = (i / workspaces.length) * Math.PI * 2;
            const radius = 240 + (i % 2 === 0 ? 40 : -40);
            return (
              <motion.div
                key={ws.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: Math.cos(angle) * radius,
                  y: Math.sin(angle) * radius,
                }}
                whileHover={{ 
                  scale: 1.1, 
                  zIndex: 20,
                }}
                className="absolute group"
              >
                <div className="relative">
                  {/* Glowing Aura */}
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <button
                    onClick={() => onEnterWorkspace(ws.id)}
                    className="w-40 h-40 rounded-full bg-neutral-900/40 backdrop-blur-2xl border border-white/10 flex flex-col items-center justify-center p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] group-hover:border-blue-500/50 transition-all duration-500 overflow-hidden"
                  >
                    <motion.div 
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                      className="w-1.5 h-1.5 rounded-full bg-blue-400 mb-4 shadow-[0_0_10px_#60a5fa]" 
                    />
                    <span className="text-[11px] font-black text-white leading-tight uppercase tracking-wide line-clamp-3 group-hover:text-blue-200 transition-colors">
                      {ws.name}
                    </span>
                  </button>

                  {/* Minimal Delete Button */}
                  <button
                    onClick={(e) => handleDelete(e, ws.id)}
                    disabled={deletingWorkspaceId === ws.id}
                    title={pendingDeleteWorkspaceId === ws.id ? "再次点击确认删除" : "删除主题"}
                    className={`absolute -top-3 -right-3 min-w-10 h-10 rounded-full border flex items-center justify-center transition-all z-30 shadow-lg disabled:opacity-100 ${
                      pendingDeleteWorkspaceId === ws.id
                        ? "px-3 bg-red-500 text-white border-red-500 opacity-100 scale-100"
                        : "w-10 bg-black/70 border-red-500/30 text-red-400 opacity-100 group-hover:bg-red-500 group-hover:text-white group-hover:border-red-500"
                    }`}
                  >
                    {deletingWorkspaceId === ws.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : pendingDeleteWorkspaceId === ws.id ? (
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Delete</span>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Central Spark Trigger */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreating(true)}
          className="z-20 w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center gap-2 shadow-[0_0_50px_rgba(255,255,255,0.15)] hover:shadow-[0_0_80px_rgba(255,255,255,0.25)] transition-all group border-8 border-black/10"
        >
          <Sparkles className="w-8 h-8 text-black group-hover:rotate-12 transition-transform" />
          <span className="text-[10px] font-black text-black uppercase tracking-widest">New Seed</span>
        </motion.button>

        {workspaces.length === 0 && !isCreating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="mt-64 text-gray-600 font-bold uppercase tracking-[0.5em] text-[10px] animate-pulse text-white">Double Click Canvas to Initiate</p>
          </div>
        )}
      </main>

      {/* Cinematic Creation Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isProcessing) {
                  setIsCreating(false);
                }
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-[#111] rounded-[3rem] p-16 max-w-2xl w-full shadow-[0_0_100px_rgba(0,0,0,1)] relative border border-white/5 overflow-hidden"
            >
              {/* Modal Background Glow */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px]" />
              
              <div className="relative z-10 text-white">
                <h3 className="text-4xl font-black text-white mb-4 tracking-tighter italic">Launch a Thought</h3>
                <p className="text-gray-500 text-sm mb-12 font-medium">Describe your inquiry. AI will crystallize the first node of your knowledge tree.</p>

                <div className="space-y-6">
                  <div className="relative group">
                    <textarea
                      autoFocus
                      value={initialQuestion}
                      onChange={(e) => setInitialQuestion(e.target.value)}
                      className="w-full px-10 py-10 bg-white/5 rounded-[2.5rem] border border-white/5 focus:border-blue-500/50 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all h-56 resize-none text-2xl font-bold text-white placeholder:text-neutral-800"
                      placeholder="e.g. What is the fundamental nature of time in general relativity?"
                    />
                    <div className="absolute top-8 left-10 text-[10px] font-black text-neutral-800 uppercase tracking-widest group-focus-within:text-blue-500/50 transition-colors">
                      Input Stream
                    </div>
                  </div>

                  {(isProcessing || streamPreview || streamError) && (
                    <div className="rounded-[2rem] border border-blue-500/20 bg-blue-500/5 p-6">
                      <div className="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">
                        <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_12px_#60a5fa]" />
                        Live Model Stream
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar rounded-[1.5rem] bg-black/30 px-5 py-4">
                        <StructuredStreamPreview
                          rawPreview={streamPreview}
                          error={streamError}
                          waitingMessage="Waiting for the first streamed tokens..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-12">
                  <button
                    onClick={() => setIsCreating(false)}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-6 text-gray-500 rounded-full font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!initialQuestion.trim() || isProcessing}
                    className="flex-[2] px-4 py-6 bg-white text-black rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-blue-400 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Initialize Growth</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
