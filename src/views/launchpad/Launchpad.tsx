import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Plus, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [newName, setNewName] = useState("");
  const [initialQuestion, setInitialQuestion] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadWorkspaces();
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
    setIsProcessing(true);
    try {
      // 1. Create with temporary name
      const ws = await invoke<Workspace>("create_workspace", {
        input: { name: "Crystallizing...", description: null }
      });
      
      // 2. Generate root node (this will now also rename the workspace)
      await invoke("generate_root_node", {
        workspaceId: ws.id,
        question: initialQuestion
      });

      // 3. Reload list to see the AI-generated name
      await loadWorkspaces();
      setIsCreating(false);
      setInitialQuestion("");
    } catch (error) {
      alert(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-white overflow-hidden relative"
      onDoubleClick={(e) => {
        // Prevent triggering when clicking on buttons or modal
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'MAIN') {
          setIsCreating(true);
        }
      }}
    >
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      
      <header className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-10">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter italic">TREE KNOWLEDGE</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-1">Thought Cloud</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-full hover:scale-105 transition-transform active:scale-95 shadow-2xl shadow-black/20 group"
          >
            <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
            <span className="text-sm font-black uppercase tracking-tighter">Spark Idea</span>
          </button>
          <button 
            onClick={onOpenSettings}
            className="p-3 text-gray-300 hover:text-black transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="h-screen w-full flex items-center justify-center relative">
        <AnimatePresence>
          {workspaces.map((ws, i) => (
            <motion.button
              key={ws.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: Math.sin(i * 1.5) * (200 + (i * 10)),
                y: Math.cos(i * 1.5) * (200 + (i * 10)),
              }}
              whileHover={{ 
                scale: 1.1, 
                zIndex: 20,
              }}
              onClick={() => onEnterWorkspace(ws.id)}
              className="absolute w-36 h-32 rounded-full bg-white/80 backdrop-blur-xl border border-gray-100 flex flex-col items-center justify-center p-6 text-center cursor-pointer group shadow-sm hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mb-3 opacity-50 group-hover:opacity-100 group-hover:scale-125 transition-all" />
              <span className="text-[11px] font-black text-gray-900 leading-tight uppercase tracking-tight line-clamp-3">
                {ws.name}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>

        {workspaces.length === 0 && !isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-32 h-32 rounded-full border border-dashed border-gray-200 mx-auto mb-6 flex items-center justify-center animate-pulse">
              <Sparkles className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-gray-300 font-black uppercase tracking-[0.4em] text-[10px]">Double click to initiate</p>
          </motion.div>
        )}
      </main>

      {/* Simplified Creation Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-white/40 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white rounded-[3rem] p-12 max-w-2xl w-full shadow-[0_32px_120px_rgba(0,0,0,0.15)] relative border border-gray-50"
            >
              <h3 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">What's on your mind?</h3>
              <p className="text-gray-400 text-sm mb-10 font-medium tracking-tight">Ask a question or describe a concept to start a new knowledge tree.</p>

              <div className="space-y-6">
                <div className="relative group">
                  <textarea
                    autoFocus
                    value={initialQuestion}
                    onChange={(e) => setInitialQuestion(e.target.value)}
                    className="w-full px-8 py-8 bg-gray-50 rounded-[2rem] border-none focus:ring-4 focus:ring-blue-500/10 outline-none transition-all h-48 resize-none text-xl font-bold text-gray-800 placeholder:text-gray-300"
                    placeholder="e.g. How do large language models actually 'think'?"
                  />
                  <div className="absolute bottom-6 right-8 text-[10px] font-black text-gray-300 uppercase tracking-widest group-focus-within:text-blue-400 transition-colors">
                    The Spark
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-12">
                <button
                  onClick={() => setIsCreating(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-5 text-gray-400 rounded-full font-black uppercase text-[10px] tracking-widest hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!initialQuestion.trim() || isProcessing}
                  className="flex-[2] px-4 py-5 bg-black text-white rounded-full font-black uppercase text-[10px] tracking-widest hover:shadow-2xl hover:shadow-black/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Initiate Growth</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
