import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Cpu, Cloud, Shield, ShieldOff } from 'lucide-react';
import { HealthStatus } from '../types';

interface HeaderProps {
  health?: HealthStatus | null;
  onToggleAutomation?: (enabled: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ health, onToggleAutomation }) => {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const bridge = (window as any).fridayBridge;

  return (
    <header className="h-11 bg-[#0a0e1a]/90 backdrop-blur-md border-b border-cyan-500/10 flex items-center justify-between px-4 select-none titlebar-drag z-50">
      {/* Brand & Assistant Identity */}
      <div className="flex items-center space-x-3 titlebar-no-drag">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan animate-pulse shadow-[0_0_8px_#00f0ff]" />
          <span className="font-mono font-bold tracking-wider text-xs text-cyan">
            F.R.I.D.A.Y.
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan/10 text-cyan/80 border border-cyan/20">
            v1.0.0
          </span>
        </div>
      </div>

      {/* Status Badges & Live Clock */}
      <div className="flex items-center space-x-3 titlebar-no-drag">
        {/* Backend Connectivity Indicator */}
        {health?.status !== 'online' ? (
          <div className="flex items-center space-x-1.5 text-xs font-mono px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300 animate-pulse" title="FastAPI local backend is offline">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Backend Offline</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300" title="Local Python backend healthy">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Backend Online</span>
          </div>
        )}

        {/* Ollama Model Status Pill */}
        <div className="flex items-center space-x-1.5 text-xs font-mono px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/60">
          <Cpu className={`w-3.5 h-3.5 ${health?.ollama?.online ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span className="text-slate-300">
            {health?.status !== 'online'
              ? 'Checking Ollama...'
              : health?.ollama?.online
              ? (health?.ollama?.selected_model ? `${health.ollama.selected_model}` : 'Ollama Ready')
              : 'Ollama Offline'}
          </span>
        </div>

        {/* Supabase Cloud Pill */}
        <div className="flex items-center space-x-1.5 text-xs font-mono px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/60">
          <Cloud className={`w-3.5 h-3.5 ${health?.cloud?.online ? 'text-sky-400' : 'text-amber-400'}`} />
          <span className="text-slate-300">
            {health?.cloud?.online ? 'Supabase Sync Ready' : 'Local SQLite'}
          </span>
        </div>

        {/* Global Automation Switch Pill */}
        <button
          onClick={() => onToggleAutomation?.(!health?.automation_enabled)}
          title="Toggle Global Windows Automation Switch"
          className={`flex items-center space-x-1 text-xs font-mono px-2 py-0.5 rounded-full border transition-all ${
            health?.automation_enabled
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/50'
          }`}
        >
          {health?.automation_enabled ? (
            <>
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>AUTO ON</span>
            </>
          ) : (
            <>
              <ShieldOff className="w-3 h-3 text-rose-400" />
              <span>AUTO OFF</span>
            </>
          )}
        </button>

        {/* Digital Clock */}
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 pl-2 border-l border-slate-800">
          <span>{date}</span>
          <span className="text-cyan font-semibold">{time}</span>
        </div>
      </div>

      {/* Windows Controls */}
      <div className="flex items-center space-x-1 titlebar-no-drag">
        <button
          onClick={() => bridge?.minimize()}
          className="w-8 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 rounded transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => bridge?.maximize()}
          className="w-8 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 rounded transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => bridge?.close()}
          className="w-8 h-7 flex items-center justify-center text-slate-400 hover:text-rose-200 hover:bg-rose-600/80 rounded transition-colors"
          title="Close to Tray"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
