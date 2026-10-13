import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Square,
  Radio,
  Clock,
  CheckSquare,
  Bell,
  Cpu,
  ChevronRight,
  ChevronLeft,
  Terminal,
  ShieldAlert,
  Sliders,
  Sunrise
} from 'lucide-react';
import { AIOrb } from '../components/AIOrb';
import { api } from '../services/api';
import { voiceManager } from '../services/voiceManager';
import { ChatMessage, AssistantVoiceState } from '../types';

interface AssistantPageProps {
  onNavigateTab: (tab: string) => void;
}

export const AssistantPage: React.FC<AssistantPageProps> = ({ onNavigateTab }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [voiceState, setVoiceState] = useState<AssistantVoiceState>(voiceManager.getState());
  const [briefing, setBriefing] = useState<any>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(voiceManager.getIsMuted());
  const [continuousListening, setContinuousListening] = useState<boolean>(
    voiceManager.isContinuousListeningEnabled()
  );
  const [showContextPanel, setShowContextPanel] = useState<boolean>(true);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<any[]>([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to voiceManager state and transcripts
  useEffect(() => {
    const unsubState = voiceManager.onStateChange((newState) => {
      setVoiceState(newState);
    });

    const unsubTranscript = voiceManager.onTranscript((text, _isFinal) => {
      setInputText(text);
    });

    voiceManager.setOnUserUtterance((utterance) => {
      handleSend(utterance);
    });

    return () => {
      unsubState();
      unsubTranscript();
      voiceManager.setOnUserUtterance(() => {});
    };
  }, [messages]);

  // Sync settings and initial listening state on mount
  useEffect(() => {
    voiceManager.loadSettings().then((settings) => {
      setContinuousListening(settings.continuous_listening);
      if (settings.continuous_listening) {
        voiceManager.startListening();
      }
    });
  }, []);

  // Fetch briefing, tasks, and reminders
  useEffect(() => {
    api.getBriefing().then(setBriefing).catch(console.error);
    api.getTasks('pending').then(setPendingTasks).catch(console.error);
    api.getReminders('pending').then(setUpcomingReminders).catch(console.error);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Main message send handler
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    // Interrupt previous speech if still playing
    voiceManager.stopSpeaking(false);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    voiceManager.setState('PROCESSING');

    try {
      const response = await api.sendMessage(updatedMessages);
      if (response.success && response.content) {
        const aiMsg: ChatMessage = {
          role: 'assistant',
          content: response.content,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: response.provider,
          model: response.model,
          latency_ms: response.latency_ms,
        };
        setMessages([...updatedMessages, aiMsg]);


        // Tool execution parsing
        if (response.content.includes('"tool":')) {
          try {
            const match = response.content.match(/\{[\s\S]*"tool"[\s\S]*\}/);
            if (match) {
              const toolData = JSON.parse(match[0]);
              const toolResult = await api.executeTool(toolData.tool, toolData.parameters || {});
              setMessages((prev) => [
                ...prev,
                {
                  role: 'tool',
                  content: `Tool Result [${toolData.tool}]: ${JSON.stringify(
                    toolResult.result || toolResult.error
                  )}`,
                  created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }
          } catch (toolErr) {
            console.error('Failed to parse or run tool:', toolErr);
          }
        }

        // Automatic voice playback if enabled in settings
        const settings = voiceManager.getSettings();
        if (settings.always_speak_replies && !settings.text_only_mode) {
          voiceManager.speakText(response.content);
        } else {
          voiceManager.setState(settings.continuous_listening ? 'LISTENING_WAKE_WORD' : 'IDLE');
        }
      } else {
        const errorContent = `I encountered an issue connecting to the local AI model: ${
          response.error || 'Check that Ollama is running.'
        }`;
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: errorContent,
            created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        const settings = voiceManager.getSettings();
        if (settings.always_speak_replies && !settings.text_only_mode) {
          voiceManager.speakText('I encountered an issue connecting to the local AI model.');
        } else {
          voiceManager.setState('IDLE');
        }
      }
    } catch (err: any) {
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: `Service communication error: ${err.message}`,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      voiceManager.setState('IDLE');
    }
  };

  const handleToggleContinuousListening = () => {
    const nextState = voiceManager.toggleContinuousListening();
    setContinuousListening(nextState);
  };

  const handleToggleMute = () => {
    const muted = voiceManager.toggleMute();
    setIsMuted(muted);
  };

  const handleManualMicTrigger = () => {
    if (voiceState === 'LISTENING_USER' || voiceState === 'LISTENING_WAKE_WORD') {
      voiceManager.stopListening();
    } else {
      voiceManager.startListening();
    }
  };

  const handleStopSpeaking = () => {
    voiceManager.stopSpeaking(true);
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSpeakMessageAgain = (text: string) => {
    voiceManager.speakText(text);
  };

  return (
    <div className="flex-1 flex h-full bg-[#05070d] overflow-hidden relative">
      {/* Background Subtle Cybernetic Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(0, 240, 255, 0.08) 0%, transparent 65%), linear-gradient(rgba(14, 165, 233, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
        }}
      />

      {/* Main Assistant Column */}
      <div className="flex-1 flex flex-col h-full p-4 space-y-3 min-w-0 z-10 overflow-hidden">
        {/* Top HUD Briefing Banner */}
        {briefing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl px-4 py-2.5 flex items-center justify-between border-cyan/25 shrink-0"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan/30 text-cyan">
                <Sparkles className="w-4 h-4 animate-spin-slow" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-100 flex items-center space-x-2">
                  <span>{briefing.greeting}</span>
                  <span className="text-[10px] font-mono text-cyan/70 px-1.5 py-0.2 rounded bg-cyan/10">
                    ONLINE
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {briefing.date_str} • {pendingTasks.length} pending tasks • {upcomingReminders.length} reminders
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => voiceManager.speakText(briefing.greeting)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan/30 text-cyan text-xs font-medium transition-all"
                title="Speak daily briefing greeting"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Brief Me</span>
              </button>

              {voiceState === 'SPEAKING' && (
                <button
                  onClick={handleStopSpeaking}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse"
                  title="Immediately cancel speech playback"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop Speaking</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Central Command Workspace */}
        <div className="flex-1 flex flex-col min-h-0 glass-panel rounded-2xl border-cyan/20 p-4 overflow-hidden relative shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          {/* Central AI Holographic Core & Waveform */}
          <div className="flex flex-col items-center justify-center py-2 shrink-0 relative">
            <AIOrb state={voiceState} onClick={handleManualMicTrigger} size={190} />

            {/* Voice Status HUD Bar */}
            <div className="flex items-center space-x-3 mt-2 text-xs font-mono">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 shadow-inner">
                <span
                  className={`w-2 h-2 rounded-full ${
                    voiceState === 'SPEAKING'
                      ? 'bg-cyan-400 animate-pulse'
                      : voiceState === 'LISTENING_USER'
                      ? 'bg-emerald-400 animate-ping'
                      : voiceState === 'LISTENING_WAKE_WORD'
                      ? 'bg-sky-400 animate-pulse'
                      : voiceState === 'PROCESSING'
                      ? 'bg-purple-400 animate-spin'
                      : voiceState === 'ERROR'
                      ? 'bg-rose-500'
                      : 'bg-cyan-600'
                  }`}
                />
                <span className="text-[11px] font-semibold tracking-wide">
                  {voiceState === 'LISTENING_WAKE_WORD'
                    ? 'WAKE WORD: "FRIDAY"'
                    : voiceState === 'LISTENING_USER'
                    ? 'LISTENING TO SPEECH'
                    : voiceState === 'WAKE_WORD_DETECTED'
                    ? 'WAKE WORD DETECTED'
                    : voiceState === 'PROCESSING'
                    ? 'REASONING...'
                    : voiceState === 'SPEAKING'
                    ? 'PLAYING VOCAL RESPONSE'
                    : voiceState === 'INTERRUPTED'
                    ? 'INTERRUPTED'
                    : voiceState === 'ERROR'
                    ? 'VOICE SERVICE ERROR'
                    : 'STANDBY'}
                </span>
              </div>

              {/* Spoken Replies Always On Indicator */}
              <div
                className="px-2 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-300 text-[10px] flex items-center space-x-1"
                title="Voice replies are automatically spoken for all messages"
              >
                <Radio className="w-3 h-3 text-cyan animate-pulse" />
                <span>Auto-Voice Enabled</span>
              </div>
            </div>
          </div>

          {/* Quick Action Chips Bar */}
          <div className="flex items-center justify-center space-x-2 py-2 shrink-0 border-y border-slate-800/80 my-2 flex-wrap gap-y-1">
            <button
              onClick={() => handleSend('Give me my full daily briefing and priority tasks.')}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan/40 text-[11px] text-slate-300 hover:text-cyan transition-all"
            >
              📋 Daily Briefing
            </button>
            <button
              onClick={() => handleSend('Check system performance and hardware load.')}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan/40 text-[11px] text-slate-300 hover:text-cyan transition-all"
            >
              ⚡ System Metrics
            </button>
            <button
              onClick={() => api.executeTool('open_app', { app_name: 'calc' })}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan/40 text-[11px] text-slate-300 hover:text-cyan transition-all"
            >
              🧮 Calculator
            </button>
            <button
              onClick={() => api.executeTool('open_app', { app_name: 'notepad' })}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan/40 text-[11px] text-slate-300 hover:text-cyan transition-all"
            >
              📝 Notepad
            </button>
            <button
              onClick={() => onNavigateTab('settings')}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan/40 text-[11px] text-slate-300 hover:text-cyan transition-all flex items-center space-x-1"
            >
              <Sliders className="w-3 h-3 text-cyan" />
              <span>Voice</span>
            </button>
            <button
              onClick={() => onNavigateTab('providers')}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan/40 text-[11px] text-slate-300 hover:text-cyan transition-all flex items-center space-x-1"
            >
              <Cpu className="w-3 h-3 text-cyan" />
              <span>AI Providers</span>
            </button>
            <button
              onClick={() => onNavigateTab('startup')}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan/40 text-[11px] text-slate-300 hover:text-cyan transition-all flex items-center space-x-1"
            >
              <Sunrise className="w-3 h-3 text-cyan" />
              <span>Startup</span>
            </button>
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto space-y-3 px-3 py-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono space-y-2 text-center">
                <div className="w-12 h-12 rounded-full border border-cyan/20 flex items-center justify-center bg-cyan/5 text-cyan">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>F.R.I.D.A.Y. Multi-Engine Neural Assistant Ready</div>
                <div className="text-[11px] text-slate-600 max-w-sm">
                  Powered by Groq, OpenAI, Gemini & Ollama with sweet, soft natural English voice. Speak or type below.
                </div>
              </div>
            ) : (
              messages.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs shadow-lg group relative ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-950/40 to-cyan-900/30 border border-cyan/40 text-cyan-100'
                        : m.role === 'tool'
                        ? 'bg-purple-950/40 border border-purple-500/30 text-purple-200 font-mono'
                        : 'bg-slate-900/90 border border-slate-800/90 text-slate-200'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between space-x-4 mb-1.5 opacity-70 text-[10px] font-mono tracking-wider uppercase">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold">
                          {m.role === 'user' ? 'You' : m.role === 'tool' ? 'Tool Output' : 'F.R.I.D.A.Y.'}
                        </span>
                        {m.role === 'assistant' && (m as any).provider && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan/30 flex items-center space-x-1 font-mono normal-case">
                            <span>⚡ {(m as any).provider}</span>
                            {(m as any).latency_ms !== undefined && (
                              <span className="text-cyan-400/70">{(m as any).latency_ms}ms</span>
                            )}
                          </span>
                        )}
                        {m.role === 'assistant' && voiceState === 'SPEAKING' && idx === messages.length - 1 && (
                          <span className="flex items-center space-x-1 text-cyan-300 font-semibold lowercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-ping" />
                            <span>speaking...</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {m.created_at && <span>{m.created_at}</span>}
                        {m.role === 'assistant' && (
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleSpeakMessageAgain(m.content)}
                              className="p-1 hover:text-cyan rounded transition-colors"
                              title="Play spoken response again"
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleCopyMessage(m.content, idx)}
                              className="p-1 hover:text-cyan rounded transition-colors"
                              title="Copy text"
                            >
                              {copiedIndex === idx ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                      {m.content}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* Futuristic Command Input & Microphone Bar */}
        <div className="glass-panel rounded-2xl p-2.5 flex items-center space-x-3 border-cyan/25 shrink-0 shadow-lg">
          {/* Continuous Listening Toggle Button */}
          <button
            onClick={handleToggleContinuousListening}
            className={`p-3 rounded-xl border transition-all flex items-center justify-center relative ${
              continuousListening
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={
              continuousListening
                ? 'Continuous Conversation Mode Active (Listening for "Friday")'
                : 'Enable Continuous Conversation Mode'
            }
          >
            <Radio className={`w-4 h-4 ${continuousListening ? 'animate-pulse' : ''}`} />
            {continuousListening && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan border border-slate-950" />
            )}
          </button>

          {/* Microphone Manual / State Button */}
          <button
            onClick={handleManualMicTrigger}
            className={`p-3 rounded-xl border transition-all flex items-center justify-center ${
              voiceState === 'LISTENING_USER'
                ? 'bg-rose-500/30 border-rose-400 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                : voiceState === 'LISTENING_WAKE_WORD'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-cyan hover:border-cyan/40'
            }`}
            title={
              voiceState === 'LISTENING_USER'
                ? 'Listening to your speech (Click to cancel)'
                : voiceState === 'LISTENING_WAKE_WORD'
                ? 'Wake word "Friday" active (Click to speak immediately)'
                : 'Click to speak'
            }
          >
            {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`p-3 rounded-xl border transition-all ${
              isMuted
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={isMuted ? 'Microphone is muted (Click to unmute)' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Speech / Text Composer Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={
              voiceState === 'LISTENING_USER'
                ? 'Listening to speech... or type here...'
                : continuousListening
                ? 'Always ready. Say "Friday..." or type your instructions...'
                : 'Ask F.R.I.D.A.Y. to manage tasks, open apps, search files...'
            }
            className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />

          {/* Stop Speaking Button if audio is actively playing */}
          {voiceState === 'SPEAKING' && (
            <button
              onClick={handleStopSpeaking}
              className="p-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 transition-all flex items-center space-x-1.5 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
              title="Stop audio output"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="text-xs font-semibold">Stop</span>
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan/40 text-cyan text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] flex items-center space-x-1.5"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* Collapsible Panel Toggle */}
          <button
            onClick={() => setShowContextPanel(!showContextPanel)}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan transition-colors"
            title="Toggle Right Context Summary Drawer"
          >
            {showContextPanel ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Optional Collapsible Right-Side Context & Tasks Panel */}
      <AnimatePresence>
        {showContextPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-slate-800/80 bg-[#080c16]/95 flex flex-col h-full overflow-hidden shrink-0 z-10"
          >
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Cpu className="w-3.5 h-3.5 text-cyan" />
                <span>Command Summary</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Voice Personality Badge */}
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-1">
                <div className="text-[10px] font-mono uppercase text-cyan/70 font-bold">
                  Voice Personality
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  Mikasa-Inspired Dub
                </div>
                <div className="text-[11px] text-slate-400 leading-snug">
                  Ava Neural • Soft, gentle, composed, warm English delivery.
                </div>
              </div>

              {/* Pending Tasks Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-cyan" />
                    <span>Pending Tasks ({pendingTasks.length})</span>
                  </span>
                  <button
                    onClick={() => onNavigateTab('tasks')}
                    className="text-[10px] text-cyan hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-1.5">
                  {pendingTasks.slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs text-slate-200 truncate"
                    >
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono capitalize">
                        Priority: {t.priority}
                      </div>
                    </div>
                  ))}
                  {pendingTasks.length === 0 && (
                    <div className="text-[11px] text-slate-500 font-mono">No pending tasks.</div>
                  )}
                </div>
              </div>

              {/* Upcoming Reminders Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-sky-400" />
                    <span>Reminders ({upcomingReminders.length})</span>
                  </span>
                  <button
                    onClick={() => onNavigateTab('reminders')}
                    className="text-[10px] text-cyan hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-1.5">
                  {upcomingReminders.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs text-slate-200"
                    >
                      <div className="font-medium truncate">{r.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {r.scheduled_at?.split('T')[0] || 'Scheduled'}
                      </div>
                    </div>
                  ))}
                  {upcomingReminders.length === 0 && (
                    <div className="text-[11px] text-slate-500 font-mono">No scheduled reminders.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
