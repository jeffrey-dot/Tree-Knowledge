import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Shield, Globe, Cpu, Save, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface LlmProvider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  default_model: string;
  is_enabled: boolean;
}

export default function ProviderSettings({ onBack }: { onBack: () => void }) {
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [name, setName] = useState("OpenAI Compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const list = await invoke<LlmProvider[]>("list_providers");
      setProviders(list);
    } catch (error) {
      console.error("Failed to load providers:", error);
    }
  };

  const handleSave = async () => {
    if (!name || !baseUrl || !apiKey || !model) return;
    setIsSaving(true);
    try {
      await invoke("create_provider", {
        input: {
          name,
          base_url: baseUrl,
          api_key: apiKey,
          default_model: model
        }
      });
      loadProviders();
      setApiKey(""); // Clear sensitive field
    } catch (error) {
      alert(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col relative overflow-hidden">
      <header className="h-20 bg-white/5 backdrop-blur-xl border-b border-white/5 flex items-center px-8 justify-between shrink-0 z-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="group flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Return</span>
          </button>
          <div className="w-[1px] h-4 bg-white/10" />
          <h1 className="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-3">
            <Settings className="w-4 h-4 text-blue-500" />
            Protocol Settings
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-12 z-10 custom-scrollbar">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left: Configuration Form */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neutral-900/40 backdrop-blur-2xl rounded-[2.5rem] p-12 border border-white/5 shadow-2xl"
            >
              <h2 className="text-xl font-black mb-10 flex items-center gap-3 uppercase tracking-tight">
                <Shield className="w-5 h-5 text-blue-500" />
                Initialize Provider
              </h2>
              
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Identity</label>
                    <input 
                      value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all font-bold text-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Primary Model</label>
                    <input 
                      value={model} onChange={(e) => setModel(e.target.value)}
                      className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all font-bold text-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Endpoint (OpenAI Compatible)</label>
                  <div className="relative group">
                    <Globe className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all font-bold text-gray-200"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Access Token</label>
                  <input 
                    type="password"
                    value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all font-bold text-gray-200"
                    placeholder="••••••••••••••••"
                  />
                  <p className="mt-4 text-[10px] text-gray-500 font-medium flex items-center gap-2 italic">
                    <AlertCircle className="w-3 h-3" />
                    Encrypted and stored in your local SQLite database.
                  </p>
                </div>
              </div>

              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="mt-12 w-full py-5 bg-white text-black rounded-full font-black uppercase text-xs tracking-widest hover:bg-blue-400 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Synchronizing..." : "Authorize Provider"}
              </button>
            </motion.div>
          </div>

          {/* Right: Active Nodes */}
          <div className="space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 shadow-xl"
            >
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">Established Links</h2>
              <div className="space-y-4">
                {providers.map(p => (
                  <div key={p.id} className="p-6 rounded-3xl border border-white/5 bg-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                    <div>
                      <div className="flex items-center gap-3">
                        <Cpu className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-black uppercase tracking-tight text-gray-200">{p.name}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-tighter opacity-60">{p.default_model}</p>
                    </div>
                    {p.is_enabled && (
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[8px] font-black text-blue-400 uppercase tracking-widest">Active</span>
                      </div>
                    )}
                  </div>
                ))}
                {providers.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-widest italic">No active links</p>
                  </div>
                )}
              </div>
            </motion.div>

            <div className="p-8 rounded-[2rem] bg-blue-500/5 border border-blue-500/10">
              <p className="text-[11px] text-blue-400 font-bold leading-relaxed uppercase tracking-tight italic opacity-80">
                Synthesis requires models optimized for structural JSON output. We recommend gpt-4o or claude-3-5-sonnet for maximum coherence.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
