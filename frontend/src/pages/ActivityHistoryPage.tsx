import React, { useState, useEffect } from 'react';
import { History, Shield, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { ActionLog } from '../types';

export const ActivityHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs(100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] p-6 space-y-5 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>Activity & Automation Audit Log</span>
            <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
              {logs.length} Entries
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete transparent audit trail of assistant actions, tool invocations, and security checks
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan text-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {logs.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
            <History className="w-8 h-8 mb-2 opacity-40 text-cyan" />
            <span>No activity logs recorded yet.</span>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="glass-card rounded-xl p-3.5 flex items-center justify-between border border-slate-800/80"
            >
              <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                <div
                  className={`p-2 rounded-lg ${
                    log.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {log.status === 'success' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{log.description}</div>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono mt-0.5">
                    <span className="text-cyan/70 font-semibold">{log.action_type}</span>
                    <span>•</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="text-right pl-3 shrink-0">
                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                    log.status === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {log.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
