import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Zap, Key, CheckCircle, AlertCircle, RefreshCw, Clock, ShieldCheck,
  Activity, Layers, Settings2, Save, Wifi, WifiOff, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { AIProviderConfig } from '../types';

const BACKEND_BASE = 'http://127.0.0.1:8765';
const AUTH_HEADERS: Record<string, string> = { 'Content-Type': 'application/json', 'X-FRIDAY-Token': 'friday-local-secure-token-2026' };

interface TestResult { valid: boolean; latency_ms?: number; message?: string; warning?: string; error?: string; }

const safeError = (result: TestResult | undefined): string => {
  if (!result) return '';
  if (result.error) return result.error;
  if (!result.valid) return 'Validation failed with no error details from provider.';
  return '';
};

const safeSuccess = (result: TestResult): string => {
  const msg = result.message ?? result.warning ?? 'Connection verified.';
  const latency = result.latency_ms != null ? ` (${result.latency_ms}ms)` : '';
  return `${msg}${latency}`;
};

export const AIProviderSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<AIProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({ groq: '', openai: '', gemini: '' });
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [loadingOllamaModels, setLoadingOllamaModels] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => { loadConfig(); loadOllamaModels(); }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await api.getProvidersConfig();
      if (data && typeof data === 'object' && 'active_provider' in data) {
        setConfig(data);
      } else {
        setSaveError('Failed to load provider configuration from backend.');
      }
    } catch (e: any) {
      setSaveError(`Cannot reach backend: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadOllamaModels = async () => {
    setLoadingOllamaModels(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/ollama/models`, { headers: AUTH_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOllamaOnline(data.online ?? false);
      setOllamaModels(Array.isArray(data.models) && data.models.length > 0 ? data.models : []);
    } catch {
      setOllamaOnline(false);
      setOllamaModels([]);
    } finally {
      setLoadingOllamaModels(false);
    }
  };

  const hasNewKey = (p: string) => keyInputs[p].trim().length > 0;

  const handleSaveConfig = useCallback(async (overrideConfig?: Partial<AIProviderConfig>) => {
    if (!config) return;
    setSaving(true); setSaveError('');
    try {
      const payload: any = {
        active_provider: overrideConfig?.active_provider ?? config.active_provider,
        fallback_order: overrideConfig?.fallback_order ?? config.fallback_order,
        provider_models: overrideConfig?.provider_models ?? config.provider_models,
        max_history_turns: overrideConfig?.max_history_turns ?? config.max_history_turns,
        timeout_seconds: overrideConfig?.timeout_seconds ?? config.timeout_seconds,
        provider_keys: {}
      };
      for (const [p, k] of Object.entries(keyInputs)) {
        const t = k.trim();
        if (t && !t.includes('...') && !/^[*\u2022]+$/.test(t)) payload.provider_keys[p] = t;
      }
      const res = await fetch(`${BACKEND_BASE}/api/providers/config`, {
        method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify(payload)
      });
      if (!res.ok) { setSaveError(`Save failed (HTTP ${res.status})`); return; }
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setKeyInputs({ groq: '', openai: '', gemini: '' });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError('Unexpected response from server.');
      }
    } catch (e: any) {
      setSaveError(`Network error: ${e.message}`);
    } finally { setSaving(false); }
  }, [config, keyInputs]);

  const handleTestKey = async (providerName: string) => {
    setTestingProvider(providerName);
    setTestResults(prev => ({ ...prev, [providerName]: undefined as any }));
    try {
      const raw = keyInputs[providerName].trim() || undefined;
      const safeKey = raw && !raw.includes('...') ? raw : undefined;
      const model = config?.provider_models[providerName];
      const res = await fetch(`${BACKEND_BASE}/api/providers/validate`, {
        method: 'POST', headers: AUTH_HEADERS,
        body: JSON.stringify({ provider: providerName, api_key: safeKey, model })
      });
      if (!res.ok) {
        setTestResults(prev => ({ ...prev, [providerName]: { valid: false, error: `Backend HTTP ${res.status}` } }));
        return;
      }
      const result = await res.json();
      if (typeof result !== 'object' || result === null) {
        setTestResults(prev => ({ ...prev, [providerName]: { valid: false, error: 'Invalid response format from backend.' } }));
        return;
      }
      setTestResults(prev => ({ ...prev, [providerName]: result as TestResult }));
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [providerName]: { valid: false, error: `Network error: ${e.message ?? 'Unknown'}` } }));
    } finally { setTestingProvider(null); }
  };

  const handleModelChange = (pn: string, model: string) => {
    if (!config) return;
    const nm = { ...config.provider_models, [pn]: model };
    setConfig({ ...config, provider_models: nm });
    handleSaveConfig({ provider_models: nm });
  };

  const handleActiveProviderChange = (pn: string) => {
    if (!config) return;
    setConfig({ ...config, active_provider: pn });
    handleSaveConfig({ active_provider: pn });
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#05070d] text-cyan font-mono text-xs">
      <Activity className="w-5 h-5 animate-spin mr-2" /><span>Loading AI Provider Intelligence Engine...</span>
    </div>
  );

  if (!config) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#05070d] text-rose-300 font-mono text-xs space-y-3 p-8">
      <AlertCircle className="w-10 h-10 text-rose-400" />
      <div className="text-sm font-bold">Failed to load AI Provider settings</div>
      <div className="text-slate-400 text-center max-w-sm">{saveError || 'Backend offline. Run backend service and reload.'}</div>
      <button onClick={loadConfig} className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan/40 text-cyan text-xs font-mono flex items-center space-x-2">
        <RefreshCw className="w-3.5 h-3.5" /><span>Retry Connection</span>
      </button>
    </div>
  );

  const getProvider = (name: string) => config.providers?.find(p => p.name === name);

  const renderTestResult = (pn: string) => {
    const r = testResults[pn];
    if (!r) return null;
    return (
      <div className={`p-2.5 rounded-xl text-xs font-mono border flex items-start space-x-2 ${
        r.valid ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
      }`}>
        {r.valid
          ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
          : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />}
        <span className="break-all">{r.valid ? safeSuccess(r) : safeError(r)}</span>
        {r.valid && r.warning && (
          <span className="text-amber-300 flex items-center space-x-1 shrink-0">
            <AlertTriangle className="w-3 h-3" /><span>{r.warning}</span>
          </span>
        )}
      </div>
    );
  };

  const renderCloudCard = (name: string, label: string, Icon: React.ElementType, iconColor: string, placeholder: string) => {
    const pm = getProvider(name);
    const hasKey = (config.masked_keys[name] ?? '').length > 0;
    return (
      <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 font-mono">
            <Icon className={`w-4 h-4 ${iconColor}`} /><span>{label}</span>
          </div>
          {hasKey ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" /><span>Configured</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Not Configured</span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-mono block mb-1">Model:</label>
            <select
              value={config.provider_models[name] || pm?.selected_model || ''}
              onChange={(e) => handleModelChange(name, e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan/50"
            >
              {(pm?.supported_models?.length ?? 0) > 0
                ? pm!.supported_models.map(m => <option key={m} value={m}>{m}</option>)
                : <option value={config.provider_models[name] || ''}>{config.provider_models[name] || 'Loading models...'}</option>
              }
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
              <span>API Key:</span>
              {hasKey && (
                <span className="text-slate-500 text-[10px] flex items-center space-x-1">
                  <Key className="w-2.5 h-2.5" /><span>Active: {config.masked_keys[name]}</span>
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <input
                type="password"
                value={keyInputs[name] || ''}
                onChange={(e) => setKeyInputs({ ...keyInputs, [name]: e.target.value })}
                placeholder={hasKey ? 'Enter new key to replace...' : placeholder}
                autoComplete="new-password"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan/50 placeholder-slate-600"
              />
              <button
                onClick={() => handleTestKey(name)}
                disabled={testingProvider === name}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan transition-all disabled:opacity-50 flex items-center space-x-1.5 min-w-[88px] justify-center"
              >
                {testingProvider === name
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /><span>Testing</span></>
                  : <><Zap className="w-3 h-3" /><span>Test Key</span></>}
              </button>
            </div>
            {!hasKey && !hasNewKey(name) && (
              <div className="mt-1 text-[10px] text-amber-400/70 font-mono">Enter a key above, then Save to configure.</div>
            )}
            {hasNewKey(name) && (
              <div className="mt-1 text-[10px] text-cyan/70 font-mono">New key typed — save to store it securely.</div>
            )}
          </div>
          {renderTestResult(name)}
        </div>
      </div>
    );
  };

  const ollamaDisplayModels = ollamaModels.length > 0
    ? ollamaModels
    : (getProvider('ollama')?.supported_models ?? ['qwen3:4b', 'llama3.2:3b']);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#05070d] p-6 space-y-6 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2 font-mono">
            <span>Multi-Provider AI Intelligence Engine</span>
            <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/30">
              Active: {config.active_provider.toUpperCase()}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure Groq, OpenAI, Google Gemini, and local Ollama with automatic fallback & token streaming.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {saveSuccess && (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono">
              <CheckCircle className="w-3.5 h-3.5" /><span>Saved</span>
            </div>
          )}
          {saveError && (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono max-w-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{saveError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Routing Mode */}
      <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan font-mono uppercase tracking-wider">
            <Layers className="w-4 h-4 text-cyan" /><span>Routing Mode</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Fallback: {config.fallback_order.map(p => p.toUpperCase()).join(' → ')}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {[
            { id: 'auto', label: 'Auto', desc: 'Groq→OpenAI→Gemini→Ollama', icon: Zap },
            { id: 'groq', label: 'Groq', desc: 'Ultra-fast LPU (100-400ms)', icon: Zap },
            { id: 'openai', label: 'OpenAI', desc: 'GPT-4o / GPT-4o Mini', icon: Cpu },
            { id: 'gemini', label: 'Gemini', desc: 'Google Flash / Pro', icon: Cpu },
            { id: 'ollama', label: 'Ollama', desc: '100% offline inference', icon: Settings2 }
          ].map(item => {
            const isSelected = config.active_provider === item.id;
            const Icon = item.icon;
            return (
              <div key={item.id} onClick={() => handleActiveProviderChange(item.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 text-slate-100 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold font-mono">{item.label}</span>
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan' : 'text-slate-500'}`} />
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug">{item.desc}</div>
                </div>
                {isSelected && (
                  <div className="mt-2 text-[9px] font-mono text-cyan font-semibold flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" /><span>ACTIVE</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-2 gap-5">
        {renderCloudCard('groq', 'Groq Cloud (Ultra-Fast LPU)', Zap, 'text-amber-400', 'gsk_...')}
        {renderCloudCard('openai', 'OpenAI (GPT-4o)', Cpu, 'text-emerald-400', 'sk-proj-...')}
        {renderCloudCard('gemini', 'Google Gemini', Cpu, 'text-sky-400', 'Gemini API Key...')}

        {/* Ollama Card */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 font-mono">
              <Settings2 className="w-4 h-4 text-purple-400" /><span>Local Ollama (100% Offline)</span>
            </div>
            <div className="flex items-center space-x-2">
              {ollamaOnline === null
                ? <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700">Checking...</span>
                : ollamaOnline
                  ? <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1"><Wifi className="w-3 h-3" /><span>Online</span></span>
                  : <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700 flex items-center space-x-1"><WifiOff className="w-3 h-3" /><span>Offline</span></span>
              }
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">No Key</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400 font-mono">Installed Model:</label>
                <button onClick={loadOllamaModels} disabled={loadingOllamaModels}
                  className="text-[10px] text-cyan/70 font-mono hover:text-cyan flex items-center space-x-1 disabled:opacity-50">
                  <RefreshCw className={`w-2.5 h-2.5 ${loadingOllamaModels ? 'animate-spin' : ''}`} />
                  <span>{loadingOllamaModels ? 'Loading...' : 'Refresh'}</span>
                </button>
              </div>
              <select
                value={config.provider_models.ollama || 'qwen3:4b'}
                onChange={(e) => handleModelChange('ollama', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan/50"
              >
                {ollamaDisplayModels.length > 0
                  ? ollamaDisplayModels.map(m => <option key={m} value={m}>{m}{ollamaModels.includes(m) ? ' ✓' : ''}</option>)
                  : <option value="">No models installed — ollama pull qwen3:4b</option>
                }
              </select>
              {ollamaOnline && ollamaModels.length === 0 && (
                <div className="mt-1 text-[10px] text-amber-400/70 font-mono">
                  Ollama online but no models installed. Run: <code className="text-amber-300">ollama pull qwen3:4b</code>
                </div>
              )}
              {ollamaOnline === false && (
                <div className="mt-1 text-[10px] text-slate-500 font-mono">
                  Start with: <code className="text-slate-400">ollama serve</code>
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-300 font-mono">Hardware Fallback Engine</div>
              <div className="text-[11px] text-slate-400 leading-snug">
                Auto-activates when internet is unavailable or cloud providers fail. Runs entirely on local hardware.
              </div>
            </div>
            <button onClick={() => handleTestKey('ollama')} disabled={testingProvider === 'ollama'}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
              {testingProvider === 'ollama'
                ? <><RefreshCw className="w-3 h-3 animate-spin" /><span>Checking...</span></>
                : <><Activity className="w-3 h-3" /><span>Test Local Ollama Service</span></>}
            </button>
            {renderTestResult('ollama')}
          </div>
        </div>
      </div>

      {/* Optimization Controls */}
      <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
        <div className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center space-x-2">
          <Clock className="w-4 h-4 text-cyan" /><span>Inference Speed & Context Optimizations</span>
        </div>
        <div className="grid grid-cols-2 gap-5 pt-1">
          <div>
            <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
              <span>Max History Turns:</span>
              <span className="text-cyan font-semibold">{config.max_history_turns} turns</span>
            </div>
            <input type="range" min="3" max="25" step="1" value={config.max_history_turns || 10}
              onChange={(e) => setConfig({ ...config, max_history_turns: Number(e.target.value) })}
              onMouseUp={(e) => handleSaveConfig({ max_history_turns: Number((e.target as HTMLInputElement).value) })}
              className="w-full accent-cyan" />
            <div className="text-[10px] text-slate-500 font-mono mt-1">Limits context sent to LLM to prevent latency degradation.</div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
              <span>Request Timeout:</span>
              <span className="text-cyan font-semibold">{config.timeout_seconds}s</span>
            </div>
            <input type="range" min="10" max="60" step="5" value={config.timeout_seconds || 30}
              onChange={(e) => setConfig({ ...config, timeout_seconds: Number(e.target.value) })}
              onMouseUp={(e) => handleSaveConfig({ timeout_seconds: Number((e.target as HTMLInputElement).value) })}
              className="w-full accent-cyan" />
            <div className="text-[10px] text-slate-500 font-mono mt-1">Max wait before triggering fallback to next provider.</div>
          </div>
        </div>
      </div>

      {/* Save Footer */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <div className="text-[10px] text-slate-600 font-mono">
          API keys stored locally in SQLite. Never sent to third parties or bundled into the app.
        </div>
        <button onClick={() => handleSaveConfig()} disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan/40 text-cyan text-xs font-semibold font-mono transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] disabled:opacity-50 flex items-center space-x-2">
          {saving
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Saving...</span></>
            : <><Save className="w-3.5 h-3.5" /><span>Apply & Save Configuration</span></>}
        </button>
      </div>
    </div>
  );
};
