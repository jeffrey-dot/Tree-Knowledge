import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Plus, BookOpen, Clock } from "lucide-react";

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
  const [newDesc, setNewDesc] = useState("");
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
    if (!newName.trim()) return;
    setIsProcessing(true);
    try {
      const ws = await invoke<Workspace>("create_workspace", {
        input: { name: newName, description: newDesc || null }
      });
      
      if (initialQuestion.trim()) {
        await invoke("generate_root_node", {
          workspaceId: ws.id,
          question: initialQuestion
        });
      }

      setWorkspaces([...workspaces, ws]);
      setIsCreating(false);
      setNewName("");
      setNewDesc("");
      setInitialQuestion("");
    } catch (error) {
      console.error("Failed to create workspace:", error);
      alert(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight italic">Tree Knowledge</h1>
            <p className="text-gray-500 font-medium">Explore and grow your knowledge network.</p>
          </div>
          <button 
            onClick={onOpenSettings}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-100"
          >
            <Settings className="w-6 h-6" />
          </button>
        </header>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Your Workspaces
            </h2>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => onEnterWorkspace(ws.id)}
                className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {ws.name}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                  {ws.description || "No description provided."}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ws.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}

            {workspaces.length === 0 && !isCreating && (
              <div className="col-span-full py-12 text-center bg-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                <p className="text-gray-500">No workspaces yet. Create your first one to get started!</p>
              </div>
            )}
          </div>
        </section>

        {isCreating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-2xl font-bold mb-6">Create New Workspace</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="e.g., Quantum Physics Research"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-20 resize-none"
                    placeholder="Briefly describe what you'll explore here..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Question (Optional)</label>
                  <textarea
                    value={initialQuestion}
                    onChange={(e) => setInitialQuestion(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-20 resize-none text-blue-600 font-medium"
                    placeholder="e.g., What are the core principles of thermodynamics?"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setIsCreating(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || isProcessing}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? "Processing..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
