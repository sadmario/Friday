import React, { useState, useEffect } from 'react';
import { Plus, Bell, Clock, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Reminder } from '../types';

export const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);

  const loadReminders = async () => {
    try {
      const data = await api.getReminders();
      setReminders(data);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) return;
    setLoading(true);
    try {
      const isoTime = new Date(scheduledAt).toISOString();
      await api.createReminder(title.trim(), isoTime, message.trim());
      setTitle('');
      setMessage('');
      setScheduledAt('');
      await loadReminders();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async (id: string, minutes: number) => {
    const snoozeDate = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    try {
      await api.updateReminderStatus(id, 'snoozed', snoozeDate);
      await loadReminders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.updateReminderStatus(id, 'dismissed');
      await loadReminders();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090e] p-6 space-y-5 overflow-hidden">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
          <span>Reminders & Alerts</span>
          <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
            {reminders.filter((r) => r.status === 'pending').length} Pending
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Background Windows notifications & automatic recovery after system reboot
        </p>
      </div>

      {/* Reminder Creation Form */}
      <form onSubmit={handleCreate} className="glass-panel rounded-xl p-4 flex items-center space-x-3 border-cyan/20">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Reminder title (e.g. Join Architecture Review)..."
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan/50"
        />

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional notes or details..."
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan/50"
        />

        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
          className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan/50 font-mono"
        />

        <button
          type="submit"
          disabled={loading || !title.trim() || !scheduledAt}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-semibold disabled:opacity-40 transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)]"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule</span>
        </button>
      </form>

      {/* Reminders List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {reminders.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
            <Bell className="w-8 h-8 mb-2 opacity-40 text-cyan" />
            <span>No reminders scheduled.</span>
          </div>
        ) : (
          reminders.map((rem) => (
            <div
              key={rem.id}
              className={`glass-card rounded-xl p-3.5 flex items-center justify-between border transition-all ${
                rem.status === 'dismissed' ? 'opacity-50 border-slate-900' : 'border-slate-800/80'
              }`}
            >
              <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                <div
                  className={`p-2 rounded-lg ${
                    rem.status === 'triggered'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                      : rem.status === 'dismissed'
                      ? 'bg-slate-800/40 text-slate-500'
                      : 'bg-cyan-500/10 text-cyan border border-cyan/30'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{rem.title}</div>
                  {rem.message && <div className="text-[11px] text-slate-400 truncate">{rem.message}</div>}
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                    <Clock className="w-3 h-3 text-cyan/70" />
                    <span>Scheduled: {new Date(rem.scheduled_at).toLocaleString()}</span>
                    {rem.snoozed_until && (
                      <span className="text-amber-400">
                        (Snoozed until {new Date(rem.snoozed_until).toLocaleTimeString()})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                    rem.status === 'triggered'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : rem.status === 'pending'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {rem.status}
                </span>

                {rem.status !== 'dismissed' && (
                  <>
                    <button
                      onClick={() => handleSnooze(rem.id, 15)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 border border-slate-700 transition-colors"
                      title="Snooze 15 minutes"
                    >
                      +15m
                    </button>
                    <button
                      onClick={() => handleDismiss(rem.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Dismiss reminder"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
