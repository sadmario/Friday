import { api } from './api';
import { AssistantVoiceState, VoiceSettings } from '../types';

export type StateListener = (state: AssistantVoiceState) => void;
export type TranscriptListener = (transcript: string, isFinal: boolean) => void;
export type ErrorListener = (error: string) => void;

const DEFAULT_SETTINGS: VoiceSettings = {
  tts_engine: 'edge_neural',
  voice: 'en-US-AvaNeural',
  rate: '-4%',
  pitch: '-2Hz',
  volume: '+0%',
  speech_rate_wpm: 170,
  always_speak_replies: true,
  continuous_listening: false,
  wake_word_enabled: true,
  wake_phrase: 'friday',
  silence_timeout_ms: 1600,
  barge_in_enabled: true,
  auto_resume_listening: true,
  text_only_mode: false,
};

class VoiceManager {
  private state: AssistantVoiceState = 'IDLE';
  private settings: VoiceSettings = { ...DEFAULT_SETTINGS };

  private stateListeners: Set<StateListener> = new Set();
  private transcriptListeners: Set<TranscriptListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();

  // Audio Playback & Analysis
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentSourceNode: MediaElementAudioSourceNode | null = null;
  private currentAudioUrl: string | null = null;
  private abortController: AbortController | null = null;

  // Speech Recognition
  private recognition: any = null;
  private recognitionActive = false;
  private isMuted = false;
  private silenceTimer: any = null;
  private capturedTranscript = '';
  private onUserUtteranceCallback: ((text: string) => void) | null = null;

  constructor() {
    this.loadSettings();
    this.initRecognition();
  }

  // --- Settings Persistence ---
  public async loadSettings(): Promise<VoiceSettings> {
    try {
      const stored = localStorage.getItem('friday_voice_settings');
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
      const backendSettings = await api.getSettings();
      if (backendSettings && backendSettings.voice_settings) {
        this.settings = { ...this.settings, ...backendSettings.voice_settings };
      }
    } catch (e) {
      console.warn('[VoiceManager] Using local default settings:', e);
    }
    return this.settings;
  }

  public async saveSettings(newSettings: Partial<VoiceSettings>): Promise<VoiceSettings> {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('friday_voice_settings', JSON.stringify(this.settings));
      await api.saveSettings({ voice_settings: this.settings });
    } catch (e) {
      console.warn('[VoiceManager] Failed to persist settings to backend:', e);
    }
    return this.settings;
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  // --- Listeners & State Management ---
  public getState(): AssistantVoiceState {
    return this.state;
  }

  public setState(newState: AssistantVoiceState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach((fn) => fn(newState));
  }

  public onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public onTranscript(listener: TranscriptListener): () => void {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  public onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public setOnUserUtterance(cb: (text: string) => void) {
    this.onUserUtteranceCallback = cb;
  }

  // --- Audio Context & Analyser ---
  private ensureAudioContext(): { context: AudioContext; analyser: AnalyserNode } | null {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return null;
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.8;
      }
      return { context: this.audioContext, analyser: this.analyser };
    } catch (e) {
      console.warn('[VoiceManager] Web Audio Context initialization error:', e);
      return null;
    }
  }

  public getWaveformData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(32);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  public getAudioLevel(): number {
    if (!this.analyser || this.state !== 'SPEAKING') return 0;
    const data = this.getWaveformData();
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return Math.min(1, (sum / data.length) / 128);
  }

  // --- Speech Output & Natural Interruption ---
  public async speakText(text: string): Promise<boolean> {
    if (this.settings.text_only_mode) {
      return false;
    }

    // Stop previous audio immediately
    this.stopSpeaking(false);

    // Abort previous synthesis request if pending
    this.abortController = new AbortController();

    this.setState('SPEAKING');

    try {
      const blob = await api.synthesizeVoice(
        text,
        this.settings.voice,
        this.settings.rate,
        this.settings.pitch,
        this.settings.volume,
        this.abortController.signal
      );

      if (!blob || blob.size === 0) {
        this.setState(this.settings.continuous_listening ? 'LISTENING_WAKE_WORD' : 'IDLE');
        return false;
      }

      const audioUrl = URL.createObjectURL(blob);
      this.currentAudioUrl = audioUrl;
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      // Connect to Web Audio Analyser
      const webAudio = this.ensureAudioContext();
      if (webAudio && !this.currentSourceNode) {
        try {
          this.currentSourceNode = webAudio.context.createMediaElementSource(audio);
          this.currentSourceNode.connect(webAudio.analyser);
          webAudio.analyser.connect(webAudio.context.destination);
        } catch {
          // Cross-origin or single element reconnection quirk, fallback to direct audio
        }
      }

      return new Promise<boolean>((resolve) => {
        audio.onplay = () => {
          this.setState('SPEAKING');
        };

        audio.onended = () => {
          this.cleanupCurrentAudio();
          if (this.settings.continuous_listening && this.settings.auto_resume_listening && !this.isMuted) {
            this.setState(this.settings.wake_word_enabled ? 'LISTENING_WAKE_WORD' : 'LISTENING_USER');
            this.startListening();
          } else {
            this.setState('IDLE');
          }
          resolve(true);
        };

        audio.onerror = (e) => {
          console.warn('[VoiceManager] Audio playback error:', e);
          this.cleanupCurrentAudio();
          this.setState('IDLE');
          resolve(false);
        };

        audio.play().catch((err) => {
          console.warn('[VoiceManager] Audio play() interrupted or blocked:', err);
          this.cleanupCurrentAudio();
          this.setState('IDLE');
          resolve(false);
        });
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return false;
      }
      console.warn('[VoiceManager] Speech synthesis error:', err);
      this.setState('IDLE');
      return false;
    }
  }

  public stopSpeaking(userInitiated = true) {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.cleanupCurrentAudio();
    }
    api.stopVoice().catch(() => {});

    if (this.state === 'SPEAKING') {
      this.setState(userInitiated ? 'INTERRUPTED' : 'IDLE');
    }
  }

  private cleanupCurrentAudio() {
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    this.currentAudio = null;
  }

  public async previewVoice(voiceId: string, text = 'Hello. I am Friday, your personal artificial intelligence.') {
    this.stopSpeaking(false);
    return this.speakText(text);
  }

  // --- Speech Recognition & Continuous Mode ---
  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VoiceManager] SpeechRecognition API not supported in this runtime.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.recognitionActive = true;
      };

      this.recognition.onresult = (event: any) => {
        if (this.isMuted) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0].transcript;
          if (item.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        const fullText = (final || interim).trim();

        // Check for Natural Interruption / Barge-In while speaking
        if (this.state === 'SPEAKING' && fullText.length > 2 && this.settings.barge_in_enabled) {
          console.log('[VoiceManager] Barge-in detected during speech! Stopping playback.');
          this.stopSpeaking(true);
        }

        // If in LISTENING_WAKE_WORD mode
        if (this.state === 'LISTENING_WAKE_WORD' || (this.settings.wake_word_enabled && this.state === 'IDLE')) {
          const phrase = (this.settings.wake_phrase || 'friday').toLowerCase();
          const clean = fullText.toLowerCase();

          if (clean.includes(phrase)) {
            console.log('[VoiceManager] Wake phrase detected:', phrase);
            this.setState('WAKE_WORD_DETECTED');

            // Play short subtle acknowledgment or transition to LISTENING_USER
            setTimeout(() => {
              this.setState('LISTENING_USER');
              // Strip wake word from prompt if present
              const remainder = clean.split(phrase).slice(1).join(' ').trim();
              if (remainder) {
                this.handleUserSpeechInput(remainder, false);
              }
            }, 300);
            return;
          }
        }

        // If in LISTENING_USER mode
        if (this.state === 'LISTENING_USER') {
          this.handleUserSpeechInput(fullText, Boolean(final));
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error === 'no-speech') {
          // Normal background silence in continuous mode, ignore
          return;
        }
        console.warn('[VoiceManager] Recognition error:', e.error);
        if (e.error === 'not-allowed') {
          this.setState('ERROR');
          this.errorListeners.forEach((fn) => fn('Microphone permission denied.'));
        }
      };

      this.recognition.onend = () => {
        this.recognitionActive = false;
        // If continuous listening is enabled and not muted, automatically restart
        if (this.settings.continuous_listening && !this.isMuted && this.state !== 'SPEAKING' && this.state !== 'PROCESSING') {
          try {
            this.recognition.start();
          } catch {}
        } else if (this.state === 'LISTENING_USER' || this.state === 'LISTENING_WAKE_WORD') {
          this.setState('IDLE');
        }
      };
    } catch (e) {
      console.warn('[VoiceManager] Failed to instantiate SpeechRecognition:', e);
    }
  }

  private handleUserSpeechInput(text: string, isFinal: boolean) {
    this.capturedTranscript = text;
    this.transcriptListeners.forEach((fn) => fn(text, isFinal));

    // Reset silence timer on every speech event (VAD)
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (text.trim().length > 0) {
      const timeoutMs = this.settings.silence_timeout_ms || 1600;
      this.silenceTimer = setTimeout(() => {
        this.commitUserUtterance();
      }, isFinal ? 600 : timeoutMs);
    }
  }

  private commitUserUtterance() {
    const textToSubmit = this.capturedTranscript.trim();
    this.capturedTranscript = '';
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (textToSubmit && this.onUserUtteranceCallback) {
      this.setState('PROCESSING');
      this.onUserUtteranceCallback(textToSubmit);
    } else {
      if (this.settings.continuous_listening && !this.isMuted) {
        this.setState(this.settings.wake_word_enabled ? 'LISTENING_WAKE_WORD' : 'LISTENING_USER');
      } else {
        this.setState('IDLE');
      }
    }
  }

  public startListening() {
    if (!this.recognition) return;
    if (this.isMuted) return;

    if (this.settings.wake_word_enabled) {
      this.setState('LISTENING_WAKE_WORD');
    } else {
      this.setState('LISTENING_USER');
    }

    if (!this.recognitionActive) {
      try {
        this.recognition.start();
      } catch {}
    }
  }

  public stopListening() {
    if (this.recognition && this.recognitionActive) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.setState('IDLE');
  }

  public toggleContinuousListening(): boolean {
    const next = !this.settings.continuous_listening;
    this.saveSettings({ continuous_listening: next });

    if (next) {
      this.isMuted = false;
      this.startListening();
    } else {
      this.stopListening();
    }
    return next;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopListening();
    } else if (this.settings.continuous_listening) {
      this.startListening();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public isContinuousListeningEnabled(): boolean {
    return Boolean(this.settings.continuous_listening);
  }
}

export const voiceManager = new VoiceManager();
