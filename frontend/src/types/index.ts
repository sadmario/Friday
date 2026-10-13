export interface Task {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Reminder {
  id: string;
  user_id?: string;
  task_id?: string | null;
  title: string;
  message: string;
  scheduled_at: string;
  timezone: string;
  status: 'pending' | 'triggered' | 'snoozed' | 'dismissed';
  snoozed_until?: string | null;
  created_at: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at?: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
  streaming?: boolean;
}

export interface ProviderMeta {
  name: string;
  display_name: string;
  has_key: boolean;
  masked_key: string;
  selected_model: string;
  supported_models: string[];
}

export interface AIProviderConfig {
  active_provider: string;
  fallback_order: string[];
  masked_keys: Record<string, string>;
  provider_models: Record<string, string>;
  max_history_turns: number;
  timeout_seconds: number;
  providers: ProviderMeta[];
}

export interface StartupGreetingConfig {
  start_with_windows: boolean;
  launch_minimized: boolean;
  greet_after_startup: boolean;
  greeting_delay_ms: number;
  greeting_volume: number;
  do_not_greet_when_muted: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  auto_start_listening: boolean;
}


export interface SystemMetrics {
  cpu_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_percent: number;
  disk_free_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  battery_percent: number | null;
  battery_plugged: boolean;
  platform: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  ollama: {
    online: boolean;
    status: string;
    models: string[];
    selected_model: string | null;
  };
  cloud: {
    online: boolean;
    status_code?: number;
    endpoint: string;
    error?: string;
  };
  system: SystemMetrics;
  automation_enabled: boolean;
}

export interface ActionLog {
  id: string;
  action_type: string;
  description: string;
  status: string;
  details: string;
  timestamp: string;
}

export interface Memory {
  id: string;
  category: string;
  content: string;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export type AssistantVoiceState =
  | 'OFFLINE'
  | 'IDLE'
  | 'LISTENING_WAKE_WORD'
  | 'WAKE_WORD_DETECTED'
  | 'LISTENING_USER'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'ERROR';

export interface VoiceCandidate {
  id: string;
  name: string;
  personality: string;
  locale: string;
  gender: string;
  default_rate: string;
  default_pitch: string;
  recommended: boolean;
  engine: string;
  is_offline: boolean;
}

export interface VoiceSettings {
  tts_engine: string;
  voice: string;
  rate: string;
  pitch: string;
  volume: string;
  speech_rate_wpm: number;
  always_speak_replies: boolean;
  continuous_listening: boolean;
  wake_word_enabled: boolean;
  wake_phrase: string;
  silence_timeout_ms: number;
  barge_in_enabled: boolean;
  auto_resume_listening: boolean;
  text_only_mode: boolean;
}

