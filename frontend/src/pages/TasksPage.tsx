import React, { useState, useEffect } from 'react';
import { Plus, Check, Trash2, Clock, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Task } from '../types';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      await api.createTask(newTitle.trim(), '', newPriority, newDueDate || undefined);
      setNewTitle('');
      setNewDueDate('');
      await loadTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.updateTask(task.id, {
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      });
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTask(id);
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'low':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] p-6 space-y-5 overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>Task Management</span>
            <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
              {tasks.filter((t) => t.status === 'pending').length} Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Local SQLite source of truth with Supabase cloud backup</p>
        </div>

        <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {(['all', 'pending', 'completed'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                filter === mode
                  ? 'bg-cyan-500/20 text-cyan border border-cyan/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Task Creation Form */}
      <form onSubmit={handleCreate} className="glass-panel rounded-xl p-4 flex items-center space-x-3 border-cyan/20">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a new task (e.g. Complete architecture document)..."
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan/50"
        />

        <select
          value={newPriority}
          onChange={(e: any) => setNewPriority(e.target.value)}
          className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan/50 font-mono"
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent</option>
        </select>

        <input
          type="datetime-local"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan/50 font-mono"
        />

        <button
          type="submit"
          disabled={loading || !newTitle.trim()}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-semibold disabled:opacity-40 transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </button>
      </form>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredTasks.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
            <AlertCircle className="w-8 h-8 mb-2 opacity-40 text-cyan" />
            <span>No tasks found in this view.</span>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`glass-card rounded-xl p-3.5 flex items-center justify-between border transition-all ${
                task.status === 'completed' ? 'opacity-60 border-slate-800/40 bg-slate-950/40' : 'border-slate-800/80'
              }`}
            >
              <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                <button
                  onClick={() => handleToggle(task)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    task.status === 'completed'
                      ? 'bg-cyan-500/30 border-cyan text-cyan'
                      : 'border-slate-700 hover:border-cyan/50 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-medium truncate ${
                      task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'
                    }`}
                  >
                    {task.title}
                  </div>
                  {task.due_at && (
                    <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-0.5 font-mono">
                      <Clock className="w-3 h-3 text-cyan/70" />
                      <span>Due: {new Date(task.due_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${getPriorityBadge(task.priority)}`}>
                  {task.priority}
                </span>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
