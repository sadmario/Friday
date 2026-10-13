import React, { useState, useEffect } from 'react';
import {
  Sunrise,
  Power,
  Volume2,
  Clock,
  CheckCircle,
  Play,
  Square,
  Shield,
  Radio,
  Sliders,
  BellOff
} from 'lucide-react';
import { api } from '../services/api';
import { voiceManager } from '../services/voiceManager';
import { StartupGreetingConfig } from '../types';

export const StartupGreetingPage: React.FC = () => {
  const [config, setConfig] = useState<StartupGreetingConfig>({
    start_with_windows: false,
    launch_minimized: false,
    greet_after_startup: true,
    greeting_delay_ms: 2000,
    greeting_volume: 1.0,
    do_not_greet_when_muted: true,
    quiet_hours_enabled: true,
    quiet_hours_start: 22,
    quiet_hours_end: 7,
    auto_start_listening: false,
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [currentGreetingText, setCurrentGreetingText] = useState('Good day. F.R.I.D.A.Y. is online and ready.');

  useEffect(() => {
    loadSettings();
    api.getStartupGreeting().then(res => {
      if (res.greeting) setCurrentGreetingText(res.greeting);
    }).catch(() => {});
  }, []);

  const loadSettings = async () => {
    try {
      const bridge = (window as any).fridayBridge;
      let startWithWindows = false;

      if (bridge?.getLoginItemSettings) {
        const loginSettings = await bridge.getLoginItemSettings();
        startWithWindows = Boolean(loginSettings?.openAtLogin);
      }

      const backendCfg = await api.getStartupConfig();
      if (backendCfg) {
        setConfig({
          ...backendCfg,
          start_with_windows: startWithWindows || backendCfg.start_with_windows,
        });
      }
    } catch (e) {
      console.error('Error loading startup config:', e);
    }
  };

  const handleUpdate = async (patch: Partial<StartupGreetingConfig>) => {
    const updated = { ...config, ...patch };
    setConfig(updated);
    setSaving(true);

    try {
      // Sync with Electron login item if in desktop
      const bridge = (window as any).fridayBridge;
      if (bridge?.setLoginItemSettings && 'start_with_windows' in patch) {
        await bridge.setLoginItemSettings({
          openAtLogin: Boolean(patch.start_with_windows),
          openAsHidden: Boolean(updated.launch_minimized),
        });
      }

      await api.saveStartupConfig(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to save startup settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewGreeting = async () => {
    setPreviewing(true);
    try {
      await voiceManager.speakText(currentGreetingText);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#05070d] p-6 space-y-6 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2 font-mono">
            <span>Windows Startup & Greeting Center</span>
            <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/30">
              System Integration
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Configure automatic launch when Windows boots, system tray minimization, and vocal welcome greetings.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Preferences Saved</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* WINDOWS AUTORUN INTEGRATION */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan font-mono uppercase tracking-wider">
            <Power className="w-4 h-4 text-cyan" />
            <span>Windows Boot Behavior</span>
          </div>

          <div className="space-y-4">
            {/* Start with Windows */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Start F.R.I.D.A.Y. when Windows starts</div>
                <div className="text-[11px] text-slate-500">
                  Registers startup entry with Windows login items
                </div>
              </div>
              <button
                onClick={() => handleUpdate({ start_with_windows: !config.start_with_windows })}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  config.start_with_windows
                    ? 'bg-cyan-500/20 text-cyan border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {config.start_with_windows ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Launch Minimized to Tray */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Launch Minimized to System Tray</div>
                <div className="text-[11px] text-slate-500">
                  Starts quietly in the background without stealing desktop focus
                </div>
              </div>
              <button
                onClick={() => handleUpdate({ launch_minimized: !config.launch_minimized })}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  config.launch_minimized
                    ? 'bg-cyan-500/20 text-cyan border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {config.launch_minimized ? 'MINIMIZED' : 'OPEN WINDOW'}
              </button>
            </div>

            {/* Auto Start Listening */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Start Microphone Listening on Boot</div>
                <div className="text-[11px] text-slate-500">
                  Automatically activates wake-word detection when app starts (Default: OFF for privacy)
                </div>
              </div>
              <button
                onClick={() => handleUpdate({ auto_start_listening: !config.auto_start_listening })}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  config.auto_start_listening
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {config.auto_start_listening ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* VOCAL GREETING LAB */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan font-mono uppercase tracking-wider">
            <Sunrise className="w-4 h-4 text-cyan" />
            <span>Vocal Startup Greeting</span>
          </div>

          <div className="space-y-4">
            {/* Greet After Startup */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Greet Me After Startup</div>
                <div className="text-[11px] text-slate-500">
                  Speaks a natural welcome phrase once systems are initialized
                </div>
              </div>
              <button
                onClick={() => handleUpdate({ greet_after_startup: !config.greet_after_startup })}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  config.greet_after_startup
                    ? 'bg-cyan-500/20 text-cyan border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {config.greet_after_startup ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Do not greet when muted */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Respect Mute State</div>
                <div className="text-[11px] text-slate-500">
                  Do not speak greeting if microphone/audio is muted or headphones disconnected
                </div>
              </div>
              <button
                onClick={() => handleUpdate({ do_not_greet_when_muted: !config.do_not_greet_when_muted })}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  config.do_not_greet_when_muted
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {config.do_not_greet_when_muted ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Greeting Delay Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
                <span>Greeting Startup Delay:</span>
                <span className="text-cyan font-semibold">{config.greeting_delay_ms / 1000}s</span>
              </div>
              <input
                type="range"
                min="500"
                max="8000"
                step="500"
                value={config.greeting_delay_ms}
                onChange={(e) => handleUpdate({ greeting_delay_ms: Number(e.target.value) })}
                className="w-full accent-cyan"
              />
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Seconds to wait after Windows boots before speaking greeting.
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Quiet Hours (22:00 – 07:00)</div>
                <div className="text-[11px] text-slate-500">
                  Suppresses vocal greetings during nighttime hours
                </div>
              </div>
              <button
                onClick={() => handleUpdate({ quiet_hours_enabled: !config.quiet_hours_enabled })}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  config.quiet_hours_enabled
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {config.quiet_hours_enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Greeting Preview Banner */}
      <div className="glass-panel rounded-2xl p-5 border-cyan/25 flex items-center justify-between shadow-xl">
        <div className="space-y-1">
          <div className="text-xs font-mono text-slate-400">Current Fixed Startup Greeting:</div>
          <div className="text-sm font-semibold text-cyan font-sans">
            "{currentGreetingText}"
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Spoken in soft Mikasa-inspired English voice (Ava Neural). Zero cloud delay.
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreviewGreeting}
            disabled={previewing}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan/40 text-cyan text-xs font-semibold transition-all shadow-[0_0_12px_rgba(0,240,255,0.15)] disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{previewing ? 'Speaking Greeting...' : 'Preview Greeting Voice'}</span>
          </button>
          {previewing && (
            <button
              onClick={() => voiceManager.stopSpeaking(true)}
              className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
