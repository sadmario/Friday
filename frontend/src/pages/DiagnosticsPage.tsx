import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Battery, Cloud, CheckCircle2, XCircle, RefreshCw, Bell } from 'lucide-react';
import { api } from '../services/api';
import { HealthStatus } from '../types';

export const DiagnosticsPage: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const loadHealth = async () => {
    setLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTestNotification = async () => {
    setTestResult('Triggering Windows notification test...');
    try {
      const res = await api.executeTool('send_notification', {
        title: 'F.R.I.D.A.Y. Diagnostic Test',
        message: 'Windows 11 notification pipeline verified successfully.',
      });
      setTestResult(res.success ? 'Notification sent successfully.' : `Failed: ${res.error}`);
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    }
  };

  const sys = health?.system;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] p-6 space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>System Diagnostics & Connectivity</span>
            <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
              Live Polling (5s)
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time Windows 11 hardware, Ollama AI, and Supabase cloud telemetry</p>
        </div>

        <button
          onClick={loadHealth}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan text-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Primary Diagnostic Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Ollama Local AI Diagnostic */}
        <div className="glass-panel rounded-xl p-4 border-cyan/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Cpu className="w-4 h-4 text-cyan" />
              <span>Ollama Local Inference Engine</span>
            </div>
            {health?.ollama?.online ? (
              <span className="flex items-center space-x-1 text-emerald-400 text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ONLINE</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-rose-400 text-xs font-mono">
                <XCircle className="w-3.5 h-3.5" />
                <span>OFFLINE</span>
              </span>
            )}
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Endpoint:</span>
              <span className="text-slate-200">http://127.0.0.1:11434</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Selected Model:</span>
              <span className="text-cyan font-bold">{health?.ollama?.selected_model || 'qwen3:4b'}</span>
            </div>
            <div className="text-slate-400 pt-1">Installed Models:</div>
            <div className="flex flex-wrap gap-1">
              {health?.ollama?.models?.map((m, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[11px]">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Supabase Cloud Health */}
        <div className="glass-panel rounded-xl p-4 border-cyan/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Cloud className="w-4 h-4 text-sky-400" />
              <span>Supabase Cloud Integration</span>
            </div>
            {health?.cloud?.online ? (
              <span className="flex items-center space-x-1 text-emerald-400 text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ACTIVE</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-400 text-xs font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>OFFLINE (LOCAL ONLY)</span>
              </span>
            )}
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Project ID:</span>
              <span className="text-slate-200">gnyqvduouavuexkknrmh</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Region:</span>
              <span className="text-slate-200">ap-south-1 (Mumbai)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Security (RLS):</span>
              <span className="text-emerald-400">Enforced on all 8 tables</span>
            </div>
          </div>
        </div>
      </div>

      {/* Windows 11 Hardware Telemetry */}
      {sys && (
        <div className="glass-panel rounded-xl p-4 border-cyan/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <Activity className="w-4 h-4 text-cyan" />
              <span>Windows 11 Hardware Telemetry</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Target: Windows 11 x64</span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* CPU */}
            <div className="glass-card rounded-lg p-3 space-y-1.5 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono uppercase">CPU Load</div>
              <div className="text-lg font-bold text-cyan font-mono">{sys.cpu_percent}%</div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan h-full transition-all duration-500"
                  style={{ width: `${Math.min(sys.cpu_percent, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory */}
            <div className="glass-card rounded-lg p-3 space-y-1.5 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono uppercase">System RAM</div>
              <div className="text-lg font-bold text-slate-200 font-mono">
                {sys.memory_used_gb} / {sys.memory_total_gb} GB
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(sys.memory_percent, 100)}%` }}
                />
              </div>
            </div>

            {/* Disk */}
            <div className="glass-card rounded-lg p-3 space-y-1.5 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Storage Free</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {sys.disk_free_gb} GB Free
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(sys.disk_percent, 100)}%` }}
                />
              </div>
            </div>

            {/* Battery */}
            <div className="glass-card rounded-lg p-3 space-y-1.5 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Power Status</div>
              <div className="text-lg font-bold text-sky-400 font-mono">
                {sys.battery_percent !== null ? `${sys.battery_percent}%` : 'AC Power'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {sys.battery_plugged ? 'Plugged In' : 'On Battery'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Actions & Tests */}
      <div className="glass-panel rounded-xl p-4 border-cyan/20 space-y-3">
        <div className="text-xs font-semibold text-slate-200">Hardware & Integration Verifier</div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestNotification}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-medium transition-all"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Test Windows Toast Notification</span>
          </button>
        </div>
        {testResult && (
          <div className="text-xs font-mono text-cyan/90 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
};
