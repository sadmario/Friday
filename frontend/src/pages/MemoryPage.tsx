import React, { useState, useEffect } from 'react';
import { Brain, Plus, Trash2, Tag } from 'lucide-react';
import { api } from '../services/api';
import { Memory } from '../types';

export const MemoryPage: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [category, setCategory] = useState('preferences');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMemories = async () => {
    try {
      const data = await api.getMemories();
      setMemories(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      await api.addMemory(category, content.trim());
      setContent('');
      await loadMemories();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      await loadMemories();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] p-6 space-y-5 overflow-hidden">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
          <span>Persistent Assistant Memory</span>
          <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
            {memories.length} Memories Saved
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Explicit user preferences and long-term context stored locally and securely synced
        </p>
      </div>

      <form onSubmit={handleAdd} className="glass-panel rounded-xl p-4 flex items-center space-x-3 border-cyan/20">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan/50 font-mono"
        >
          <option value="preferences">User Preferences</option>
          <option value="work">Work & Projects</option>
          <option value="personal">Personal Notes</option>
          <option value="system">Hardware & Setup</option>
        </select>

        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter memory (e.g. Always keep answers concise and technical)..."
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan/50"
        />

        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-semibold disabled:opacity-40 transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)]"
        >
          <Plus className="w-4 h-4" />
          <span>Save Memory</span>
        </button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {memories.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
            <Brain className="w-8 h-8 mb-2 opacity-40 text-cyan" />
            <span>No explicit memories stored yet.</span>
          </div>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              className="glass-card rounded-xl p-3.5 flex items-center justify-between border border-slate-800/80"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200">{m.content}</div>
                  <div className="text-[10px] text-cyan/70 font-mono mt-0.5">
                    Category: {m.category} • Saved: {new Date(m.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(m.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Delete memory"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
