import { Activity, ArrowLeft, BrainCircuit, CheckCircle2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { type Provider } from "@/app/contracts";

type ProviderSettingsViewProps = {
  providers: Provider[];
  loading: boolean;
  onBack: () => void;
  onSaveProvider: (input: {
    id?: string;
    name: string;
    base_url: string;
    api_key: string;
    default_model: string;
    enabled: boolean;
  }) => Promise<void>;
  onTestProvider: (providerId: string) => Promise<void>;
};

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  base_url: "",
  api_key: "",
  default_model: "",
  enabled: true,
};

export function ProviderSettingsView({
  providers,
  loading,
  onBack,
  onSaveProvider,
  onTestProvider,
}: ProviderSettingsViewProps) {
  const [form, setForm] = useState(emptyForm);

  const enabledProvider = useMemo(
    () => providers.find((item) => item.enabled),
    [providers],
  );

  return (
    <div className="providers-shell">
      <header className="workspace-topbar panel">
        <button className="ghost-action" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回启动台
        </button>
        <div className="workspace-title">
          <p className="eyebrow">Provider Management</p>
          <h2>OpenAI-compatible Providers</h2>
        </div>
        <div className="provider-chip ready">
          <BrainCircuit size={16} />
          {enabledProvider ? `默认：${enabledProvider.name}` : "未配置默认 Provider"}
        </div>
      </header>

      <div className="providers-layout">
        <section className="panel providers-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">List</p>
              <h3>已保存 Provider</h3>
            </div>
          </div>

          {providers.length === 0 && (
            <div className="empty-block">
              <p>还没有 Provider。先接入一个可用的 OpenAI-compatible 服务。</p>
            </div>
          )}

          <div className="provider-cards">
            {providers.map((provider) => (
              <article key={provider.id} className="provider-card">
                <div>
                  <h4>{provider.name}</h4>
                  <p>{provider.base_url}</p>
                </div>
                <div className="provider-card-meta">
                  <span>{provider.default_model}</span>
                  <span>{provider.enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="provider-card-actions">
                  <button
                    className="ghost-action"
                    type="button"
                    onClick={() =>
                      setForm({
                        id: provider.id,
                        name: provider.name,
                        base_url: provider.base_url,
                        api_key: "",
                        default_model: provider.default_model,
                        enabled: provider.enabled,
                      })
                    }
                  >
                    编辑
                  </button>
                  <button
                    className="ghost-action"
                    type="button"
                    onClick={() => onTestProvider(provider.id)}
                  >
                    <RefreshCw size={14} />
                    测试
                  </button>
                </div>
                <div className="provider-card-status">
                  {provider.last_error ? (
                    <span className="status-bad">
                      <Activity size={14} />
                      {provider.last_error}
                    </span>
                  ) : (
                    <span className="status-good">
                      <CheckCircle2 size={14} />
                      {provider.last_checked_at ? "最近连通成功" : "尚未测试"}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel provider-form-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Form</p>
              <h3>{form.id ? "编辑 Provider" : "新增 Provider"}</h3>
            </div>
          </div>

          <label>
            <span>名称</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="例如：OpenAI / LocalRouter / Moonshot"
            />
          </label>

          <label>
            <span>Base URL</span>
            <input
              value={form.base_url}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, base_url: event.target.value }))
              }
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label>
            <span>API Key</span>
            <input
              value={form.api_key}
              onChange={(event) => setForm((prev) => ({ ...prev, api_key: event.target.value }))}
              placeholder={form.id ? "留空则保留现有密钥" : "sk-..."}
            />
          </label>

          <label>
            <span>Default Model</span>
            <input
              value={form.default_model}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, default_model: event.target.value }))
              }
              placeholder="gpt-4.1-mini"
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, enabled: event.target.checked }))
              }
            />
            <span>设为可用 Provider</span>
          </label>

          <div className="provider-form-footer">
            <button
              className="ghost-action"
              type="button"
              onClick={() => setForm(emptyForm)}
            >
              重置
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={
                loading ||
                !form.name.trim() ||
                !form.base_url.trim() ||
                !form.default_model.trim() ||
                (!form.id && !form.api_key.trim())
              }
              onClick={() => onSaveProvider(form)}
            >
              {loading ? "保存中..." : "保存 Provider"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
