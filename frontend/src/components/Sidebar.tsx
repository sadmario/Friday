import React from 'react';
import {
  Sparkles,
  CheckSquare,
  Bell,
  FileText,
  Brain,
  History,
  Activity,
  Settings,
  User,
  LogOut,
  Cpu,
  Sunrise
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onSignOut: () => void;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onSignOut,
  onOpenAuth,
}) => {
  const navItems = [
    { id: 'assistant', label: 'Assistant', icon: Sparkles },
    { id: 'providers', label: 'AI Providers', icon: Cpu },
    { id: 'startup', label: 'Startup & Greeting', icon: Sunrise },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'files', label: 'Documents', icon: FileText },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'history', label: 'Activity Log', icon: History },
    { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];


  return (
    <aside className="w-56 bg-[#080c16]/95 border-r border-slate-800/80 flex flex-col justify-between select-none">
      {/* Navigation Links */}
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
          Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan border border-cyan/30 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan drop-shadow-[0_0_6px_#00f0ff]' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Cloud Account & User section */}
      <div className="p-3 border-t border-slate-800/60 bg-slate-950/40">
        {user ? (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 truncate">
              <div className="w-7 h-7 rounded-full bg-cyan/20 border border-cyan/40 flex items-center justify-center text-cyan text-xs font-bold">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <div className="truncate">
                <div className="text-xs font-medium text-slate-200 truncate">{user.email}</div>
                <div className="text-[10px] text-cyan/70 font-mono">Cloud Synced</div>
              </div>
            </div>
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan/20 text-cyan text-xs font-medium transition-all hover:border-cyan/50"
          >
            <User className="w-3.5 h-3.5 text-cyan" />
            <span>Supabase Cloud Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );
};
