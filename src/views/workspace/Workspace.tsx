import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronRight, Home, MessageSquarePlus, Share2 } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  root_node_id: string | null;
}

interface Node {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
}

interface WorkspaceSnapshot {
  workspace: Workspace;
  current_node: Node | null;
  ancestors: Node[];
  children: Node[];
}

export default function WorkspaceView({ workspaceId, onBack }: { workspaceId: string, onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);

  useEffect(() => {
    loadSnapshot(currentNodeId);
  }, [workspaceId, currentNodeId]);

  const loadSnapshot = async (nodeId: string | null) => {
    try {
      const data = await invoke<WorkspaceSnapshot>("get_workspace_snapshot", {
        workspaceId,
        currentNodeId: nodeId
      });
      setSnapshot(data);
    } catch (error) {
      console.error("Failed to load workspace snapshot:", error);
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
      console.error("Failed to expand node:", error);
      alert(error);
    } finally {
      setIsExpanding(false);
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
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Structure</h3>
            
            {/* Ancestors */}
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
              
              {/* Current Node */}
              {snapshot.current_node && (
                <div className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  <span className="truncate">{snapshot.current_node.title}</span>
                </div>
              )}

              {/* Children */}
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
                {snapshot.children.length === 0 && (
                  <p className="text-xs text-gray-400 pl-2 italic">No sub-nodes</p>
                )}
              </div>
            </nav>
          </div>
        </aside>

        {/* Center - Graph Canvas */}
        <main className="flex-1 relative bg-gray-50 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <p className="text-2xl font-bold text-gray-300 uppercase tracking-widest">Graph Canvas</p>
          </div>
          
          {/* Input Area */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
            <div className={`bg-white rounded-2xl shadow-xl border ${isExpanding ? 'border-blue-400' : 'border-gray-200'} p-2 flex items-end gap-2 transition-all`}>
              <textarea 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isExpanding}
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
              <button 
                onClick={handleExpand}
                disabled={!query.trim() || isExpanding}
                className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExpanding ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <MessageSquarePlus className="w-5 h-5" />
                )}
              </button>
            </div>
            {isExpanding && (
              <p className="text-center text-[10px] text-blue-500 font-bold uppercase mt-2 animate-pulse">
                Generating new knowledge node...
              </p>
            )}
          </div>
        </main>

        {/* Right Sidebar - Details */}
        <aside className="w-80 border-l border-gray-100 flex flex-col shrink-0 bg-white">
          {snapshot.current_node ? (
            <div className="flex flex-col h-full overflow-y-auto p-6">
              <div className="mb-6">
                <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-[10px] font-bold text-blue-600 uppercase mb-2">
                  {snapshot.current_node.status}
                </span>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {snapshot.current_node.title}
                </h1>
              </div>

              {snapshot.current_node.summary && (
                <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Summary</h4>
                  <p className="text-sm text-gray-600 leading-relaxed italic">
                    {snapshot.current_node.summary}
                  </p>
                </div>
              )}

              <div className="prose prose-sm prose-slate max-w-none">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Content</h4>
                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {snapshot.current_node.body || (
                    <p className="text-gray-400 italic">This node has no body content yet.</p>
                  )}
                </div>
              </div>
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
