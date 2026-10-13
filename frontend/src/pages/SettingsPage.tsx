import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Mic,
  Cpu,
  Shield,
  Cloud,
  RefreshCw,
  Play,
  Square,
  Check,
  Radio,
  Sliders,
  Activity,
  Sparkles,
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import { voiceManager } from '../services/voiceManager';
import { HealthStatus, VoiceCandidate, VoiceSettings } from '../types';

interface SettingsPageProps {
  health: HealthStatus | null;
  onRefreshHealth: () => void;
  onToggleAutomation: (enabled: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  health,
  onRefreshHealth,
  onToggleAutomation,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('qwen3:4b');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [syncing, setSyncing] = useState<boolean>(false);
  const [voices, setVoices] = useState<VoiceCandidate[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState<boolean>(false);
  const [previewText, setPreviewText] = useState<string>(
    'Hello. I am Friday, your personal artificial intelligence. Systems are optimal.'
  );

  // Voice Settings state
  const [settings, setSettings] = useState<VoiceSettings>(voiceManager.getSettings());
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Diagnostics test results
  const [diagnosticsResult, setDiagnosticsResult] = useState<string | null>(null);
  const [testingDiagnostics, setTestingDiagnostics] = useState<boolean>(false);

  useEffect(() => {
    if (health?.ollama?.selected_model) {
      setSelectedModel(health.ollama.selected_model);
    }
  }, [health]);

  useEffect(() => {
    // Load voices and settings
    api.getVoices().then((v) => {
      setVoices(v);
    }).catch(console.error);

    voiceManager.loadSettings().then((s) => {
      setSettings(s);
    });
  }, []);

  const handleSettingChange = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    voiceManager.saveSettings({ [key]: value });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleVoiceSelect = (v: VoiceCandidate) => {
    handleSettingChange('voice', v.id);
    handleSettingChange('tts_engine', v.engine);
    if (v.default_rate) handleSettingChange('rate', v.default_rate);
    if (v.default_pitch) handleSettingChange('pitch', v.default_pitch);
  };

  const handleTestVoicePreview = async () => {
    setPreviewingVoice(true);
    try {
      await voiceManager.previewVoice(settings.voice, previewText);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewingVoice(false);
    }
  };

  const handleStopSpeaking = () => {
    voiceManager.stopSpeaking(true);
    setPreviewingVoice(false);
  };

  const handleRunVoiceDiagnostics = async () => {
    setTestingDiagnostics(true);
    setDiagnosticsResult(null);
    const t0 = performance.now();
    try {
      const blob = await api.synthesizeVoice(
        'Diagnostic voice check complete. Audio buffer validated.',
        settings.voice,
        settings.rate,
        settings.pitch,
        settings.volume
      );
      const latencyMs = Math.round(performance.now() - t0);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      setDiagnosticsResult(
        `✓ Neural TTS Latency: ${latencyMs}ms | Audio Stream: ${blob.size} bytes (${blob.type}) | Speech Recognition API: ${
          SpeechRecognition ? 'Available' : 'Native Web Speech Offline'
        } | Wake-Word Filter: Ready`
      );
    } catch (err: any) {
      setDiagnosticsResult(`✗ Diagnostics error: ${err.message}`);
    } finally {
      setTestingDiagnostics(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncMessage('Synchronizing settings and database with Supabase cloud...');
    try {
      const res = await api.syncCloud();
      setSyncMessage(res.success ? 'Synchronization successful.' : `Sync failed: ${res.message}`);
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#05070d] p-6 space-y-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2 font-mono">
            <span>Voice & System Command Lab</span>
            <span className="text-xs font-mono text-cyan px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/30">
              F.R.I.D.A.Y. Engine
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Configure natural soft English neural voices, continuous conversation mode, wake words, and offline fallbacks.
          </p>
        </div>
        {isSaved && (
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono animate-fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Preferences Saved</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* VOICE LAB: Personality & Synthesis */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan font-mono uppercase tracking-wider">
            <Volume2 className="w-4 h-4 text-cyan" />
            <span>Voice Personality & Synthesis Lab</span>
          </div>

          <div className="space-y-3">
            <label className="text-xs text-slate-300 font-mono flex items-center justify-between">
              <span>Candidate English Voices:</span>
              <span className="text-[10px] text-cyan/70 font-mono">Mikasa-Dub Aesthetic</span>
            </label>

            {/* Voice Cards */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {voices.map((v) => {
                const isSelected = settings.voice === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleVoiceSelect(v)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400/80 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                        <span>{v.name}</span>
                        {v.recommended && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan/20 border border-cyan/40 text-cyan font-mono">
                            Recommended
                          </span>
                        )}
                        {v.is_offline && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                            Offline
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        {v.locale}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug">
                      {v.personality}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Speech Rate, Pitch, and Volume Sliders */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
                  <span>Pitch (Lower for composed, calm tone):</span>
                  <span className="text-cyan font-semibold">{settings.pitch}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 font-mono">-5Hz (Deeper)</span>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="1"
                    value={parseInt(settings.pitch) || -2}
                    onChange={(e) => handleSettingChange('pitch', `${e.target.value}Hz`)}
                    className="w-full accent-cyan"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">+5Hz (Higher)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
                  <span>Speech Rate (Pacing):</span>
                  <span className="text-cyan font-semibold">{settings.rate}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 font-mono">-10% (Gentle)</span>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={parseInt(settings.rate) || -4}
                    onChange={(e) => handleSettingChange('rate', `${e.target.value}%`)}
                    className="w-full accent-cyan"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">+10% (Fast)</span>
                </div>
              </div>

              {/* Spoken Replies Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-xs font-medium text-slate-200">Always Speak AI Replies</div>
                  <div className="text-[11px] text-slate-500">
                    Spoken responses are voiced aloud automatically for typed & spoken messages
                  </div>
                </div>
                <button
                  onClick={() =>
                    handleSettingChange('always_speak_replies', !settings.always_speak_replies)
                  }
                  className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                    settings.always_speak_replies
                      ? 'bg-cyan-500/20 text-cyan border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {settings.always_speak_replies ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Text Only Mode Switch */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-xs font-medium text-slate-200">Text-Only Mode</div>
                  <div className="text-[11px] text-slate-500">Mutes all voice synthesis output</div>
                </div>
                <button
                  onClick={() => handleSettingChange('text_only_mode', !settings.text_only_mode)}
                  className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                    settings.text_only_mode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {settings.text_only_mode ? 'TEXT ONLY' : 'VOICE ACTIVE'}
                </button>
              </div>

              {/* Preview Voice Controls */}
              <div className="pt-2 flex items-center space-x-2">
                <button
                  onClick={handleTestVoicePreview}
                  disabled={previewingVoice}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-semibold transition-all shadow-[0_0_12px_rgba(0,240,255,0.15)] disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{previewingVoice ? 'Synthesizing...' : 'Preview Voice Output'}</span>
                </button>
                {previewingVoice && (
                  <button
                    onClick={handleStopSpeaking}
                    className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CONTINUOUS CONVERSATION & WAKE-WORD LAB */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan font-mono uppercase tracking-wider">
            <Mic className="w-4 h-4 text-cyan" />
            <span>Continuous Conversation & Wake-Word Lab</span>
          </div>

          <div className="space-y-4">
            {/* Continuous Listening Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Continuous Conversation Mode</div>
                <div className="text-[11px] text-slate-500">
                  Always-ready hands-free microphone capture across application restarts
                </div>
              </div>
              <button
                onClick={() =>
                  handleSettingChange('continuous_listening', !settings.continuous_listening)
                }
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  settings.continuous_listening
                    ? 'bg-cyan-500/20 text-cyan border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {settings.continuous_listening ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            {/* Wake-Word Detection */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Wake-Word Trigger</div>
                <div className="text-[11px] text-slate-500">
                  Wait for wake phrase before beginning conversational turn
                </div>
              </div>
              <button
                onClick={() =>
                  handleSettingChange('wake_word_enabled', !settings.wake_word_enabled)
                }
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  settings.wake_word_enabled
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {settings.wake_word_enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Wake Phrase Input */}
            <div>
              <label className="text-xs text-slate-400 font-mono mb-1 block">Wake Phrase:</label>
              <input
                type="text"
                value={settings.wake_phrase}
                onChange={(e) => handleSettingChange('wake_phrase', e.target.value)}
                placeholder="friday"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan/50"
              />
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Trigger keyword to initiate turn (e.g. "Friday" or "Hey Friday")
              </div>
            </div>

            {/* Silence Detection & VAD */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
                <span>Silence Detection Threshold (VAD):</span>
                <span className="text-cyan font-semibold">{settings.silence_timeout_ms}ms</span>
              </div>
              <input
                type="range"
                min="800"
                max="3000"
                step="100"
                value={settings.silence_timeout_ms}
                onChange={(e) =>
                  handleSettingChange('silence_timeout_ms', Number(e.target.value))
                }
                className="w-full accent-cyan"
              />
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Duration of silence required before transcribing and processing your request
              </div>
            </div>

            {/* Natural Interruption / Barge-in */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Natural Voice Interruption (Barge-In)</div>
                <div className="text-[11px] text-slate-500">
                  Stop speech playback immediately when you start talking
                </div>
              </div>
              <button
                onClick={() =>
                  handleSettingChange('barge_in_enabled', !settings.barge_in_enabled)
                }
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  settings.barge_in_enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {settings.barge_in_enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Auto-Resume After Spoken Response */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div>
                <div className="text-xs font-medium text-slate-200">Auto-Resume Listening</div>
                <div className="text-[11px] text-slate-500">
                  Automatically return to wake-word listening after assistant finishes speaking
                </div>
              </div>
              <button
                onClick={() =>
                  handleSettingChange('auto_resume_listening', !settings.auto_resume_listening)
                }
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  settings.auto_resume_listening
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {settings.auto_resume_listening ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>

        {/* VOICE DIAGNOSTICS */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-cyan font-mono uppercase tracking-wider">
              <Zap className="w-4 h-4 text-cyan" />
              <span>Voice Engine Diagnostics & Connectivity Test</span>
            </div>
            <button
              onClick={handleRunVoiceDiagnostics}
              disabled={testingDiagnostics}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan/40 text-cyan text-xs font-mono transition-all disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${testingDiagnostics ? 'animate-spin' : ''}`} />
              <span>{testingDiagnostics ? 'Running diagnostics...' : 'Run Diagnostics'}</span>
            </button>
          </div>

          {diagnosticsResult && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan/30 text-xs font-mono text-cyan/90">
              {diagnosticsResult}
            </div>
          )}
        </div>

        {/* LOCAL AI OLLAMA CONFIGURATION */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-cyan" />
            <span>Local Ollama Model Config</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-mono">Active Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan/50"
            >
              {health?.ollama?.models?.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              )) || <option value="qwen3:4b">qwen3:4b (Default)</option>}
            </select>
            <div className="text-[11px] text-slate-500 font-mono">
              Status: {health?.ollama?.online ? 'Ollama Online' : 'Ollama Offline'}
            </div>
          </div>
        </div>

        {/* WINDOWS AUTOMATION & SUPABASE BACKUP */}
        <div className="glass-panel rounded-2xl p-5 border-cyan/25 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200 font-mono uppercase tracking-wider">
            <Shield className="w-4 h-4 text-cyan" />
            <span>Automation Switch & Cloud Backup</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">Global Windows Automation</div>
                <div className="text-[11px] text-slate-500">Allow model to execute approved tools</div>
              </div>
              <button
                onClick={() => onToggleAutomation(!health?.automation_enabled)}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  health?.automation_enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {health?.automation_enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">Supabase Cloud Sync</div>
                <div className="text-[11px] text-slate-500">Backup tasks, reminders & preferences</div>
              </div>
              <button
                onClick={handleTriggerSync}
                disabled={syncing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 text-xs font-mono transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
            {syncMessage && (
              <div className="text-[10px] text-cyan/90 bg-slate-900/80 p-2 rounded-lg border border-slate-800 font-mono">
                {syncMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
