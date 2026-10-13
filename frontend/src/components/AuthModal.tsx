import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { authService } from '../services/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const data = await authService.signUp(email, password, fullName);
        if (data.user) {
          onSuccess(data.user);
          onClose();
        }
      } else {
        const data = await authService.signIn(email, password);
        if (data.user) {
          onSuccess(data.user);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 border-cyan/30 shadow-2xl relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-cyan" />
            <h2 className="text-base font-bold text-slate-100">
              {isSignUp ? 'Create Supabase Cloud Account' : 'Supabase Cloud Sign In'}
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Enables end-to-end encrypted cloud sync with Row Level Security (RLS)
          </p>
        </div>

        {error && (
          <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400">Display Name</label>
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Name"
                  className="bg-transparent flex-1 text-xs text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-mono text-slate-400">Email Address</label>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-transparent flex-1 text-xs text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-mono text-slate-400">Password</label>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent flex-1 text-xs text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-semibold transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] disabled:opacity-40"
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Cloud Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-slate-400 hover:text-cyan transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
