import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Shield, Globe, Cpu, Save, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-blue-600 font-medium">
            ← Back
          </button>
          <span className="text-gray-300">|</span>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            LLM Settings
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                Add Provider
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Display Name</label>
                    <input 
                      value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Default Model</label>
                    <input 
                      value={model} onChange={(e) => setModel(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Base URL (OpenAI Compatible)</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-300" />
                    <input 
                      value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">API Key</label>
                  <input 
                    type="password"
                    value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="sk-..."
                  />
                  <p className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Stored locally in your application database.
                  </p>
                </div>
              </div>

              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="mt-8 w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>

          {/* Right: Active Status */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Current Providers</h2>
              <div className="space-y-3">
                {providers.map(p => (
                  <div key={p.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-sm font-bold text-gray-800">{p.name}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{p.default_model}</p>
                    </div>
                    {p.is_enabled && (
                      <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-[8px] font-bold text-green-600 uppercase">Active</span>
                    )}
                  </div>
                ))}
                {providers.length === 0 && (
                  <p className="text-center py-4 text-xs text-gray-400 italic">No providers configured yet.</p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-[11px] text-blue-600 leading-relaxed">
                <strong>Tree Knowledge</strong> works best with models that support JSON output mode. We recommend using <code>gpt-4o</code>, <code>claude-3-5-sonnet</code> (via proxy), or equivalent.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
