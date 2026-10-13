import { Task, Reminder, ChatMessage, HealthStatus, ActionLog, Memory, Note, VoiceCandidate } from '../types';

const BACKEND_BASE = 'http://127.0.0.1:8765';
const AUTH_TOKEN = 'friday-local-secure-token-2026';

const headers = {
  'Content-Type': 'application/json',
  'X-FRIDAY-Token': AUTH_TOKEN,
};

export const api = {
  async getHealth(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/health`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      return {
        status: 'offline',
        version: '1.0.0',
        ollama: {
          online: false,
          status: 'Backend service offline',
          models: [],
          selected_model: null,
        },
        cloud: {
          online: false,
          endpoint: '',
          error: 'Backend offline',
        },
        system: {
          cpu_percent: 0,
          memory_used_gb: 0,
          memory_total_gb: 0,
          memory_percent: 0,
          disk_free_gb: 0,
          disk_total_gb: 0,
          disk_percent: 0,
          battery_percent: null,
          battery_plugged: true,
          platform: 'Windows 11',
        },
        automation_enabled: false,
      };
    }
  },

  async getOllamaStatus(): Promise<any> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/ollama/status`, { headers });
      return await res.json();
    } catch (e: any) {
      return {
        online: false,
        model: 'qwen3:4b',
        model_available: false,
        status: 'Backend offline',
        installed_models: [],
      };
    }
  },

  async getBriefing(): Promise<any> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/briefing`, { headers });
      return await res.json();
    } catch {
      return null;
    }
  },

  async sendMessage(
    messages: ChatMessage[],
    model?: string,
    temperature = 0.7
  ): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    provider?: string;
    model?: string;
    latency_ms?: number;
    fallback_trail?: string[];
  }> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, model, temperature }),
      });
      if (!res.ok) {
        return { success: false, error: `Backend HTTP ${res.status}: ${res.statusText}` };
      }
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        error: `Cannot connect to F.R.I.D.A.Y. backend (http://127.0.0.1:8765). Ensure the backend service is running ('npm run backend:dev' or 'npm run dev:electron'). (${e.message})`,
      };
    }
  },

  async streamMessage(
    messages: ChatMessage[],
    model?: string,
    temperature = 0.7,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const res = await fetch(`${BACKEND_BASE}/api/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, model, temperature }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Streaming failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      if (onChunk) {
        onChunk(chunk);
      }
    }
    return fullText;
  },


  async getTasks(status?: string): Promise<Task[]> {
    const url = status ? `${BACKEND_BASE}/api/tasks?status=${encodeURIComponent(status)}` : `${BACKEND_BASE}/api/tasks`;
    const res = await fetch(url, { headers });
    return res.json();
  },

  async createTask(title: string, description = '', priority = 'medium', due_at?: string): Promise<Task> {
    const res = await fetch(`${BACKEND_BASE}/api/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, description, priority, due_at }),
    });
    return res.json();
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const res = await fetch(`${BACKEND_BASE}/api/tasks/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteTask(id: string): Promise<boolean> {
    const res = await fetch(`${BACKEND_BASE}/api/tasks/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
  },

  async getReminders(status?: string): Promise<Reminder[]> {
    const url = status ? `${BACKEND_BASE}/api/reminders?status=${encodeURIComponent(status)}` : `${BACKEND_BASE}/api/reminders`;
    const res = await fetch(url, { headers });
    return res.json();
  },

  async createReminder(title: string, scheduled_at: string, message = ''): Promise<Reminder> {
    const res = await fetch(`${BACKEND_BASE}/api/reminders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, scheduled_at, message }),
    });
    return res.json();
  },

  async updateReminderStatus(id: string, status: string, snoozed_until?: string): Promise<boolean> {
    const res = await fetch(`${BACKEND_BASE}/api/reminders/${id}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status, snoozed_until }),
    });
    return res.ok;
  },

  async searchFiles(query: string, extension?: string, directory?: string): Promise<any[]> {
    const res = await fetch(`${BACKEND_BASE}/api/files/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, extension, directory }),
    });
    return res.json();
  },

  async readDocument(path: string): Promise<any> {
    const res = await fetch(`${BACKEND_BASE}/api/files/read?path=${encodeURIComponent(path)}`, { headers });
    return res.json();
  },

  async getApprovedDirectories(): Promise<string[]> {
    const res = await fetch(`${BACKEND_BASE}/api/files/directories`, { headers });
    return res.json();
  },

  async getTools(): Promise<any[]> {
    const res = await fetch(`${BACKEND_BASE}/api/tools`, { headers });
    return res.json();
  },

  async executeTool(tool_name: string, parameters: any = {}, confirmed = false): Promise<any> {
    const res = await fetch(`${BACKEND_BASE}/api/tools/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool_name, parameters, confirmed }),
    });
    return res.json();
  },

  async toggleAutomation(enabled: boolean): Promise<any> {
    const res = await fetch(`${BACKEND_BASE}/api/automation/toggle?enabled=${enabled}`, {
      method: 'POST',
      headers,
    });
    return res.json();
  },

  async speak(text: string, rate = 180, volume = 1.0): Promise<void> {
    await fetch(`${BACKEND_BASE}/api/voice/speak`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, rate, volume }),
    });
  },

  async synthesizeVoice(
    text: string,
    voice = 'en-US-AvaNeural',
    rate = '-4%',
    pitch = '-2Hz',
    volume = '+0%',
    signal?: AbortSignal
  ): Promise<Blob> {
    const res = await fetch(`${BACKEND_BASE}/api/voice/synthesize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, voice, rate, pitch, volume }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to synthesize voice: HTTP ${res.status}`);
    }
    return await res.blob();
  },

  async getVoices(): Promise<VoiceCandidate[]> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/voice/voices`, { headers });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async stopVoice(): Promise<void> {
    await fetch(`${BACKEND_BASE}/api/voice/stop`, {
      method: 'POST',
      headers,
    });
  },

  async getSettings(): Promise<Record<string, any>> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/settings`, { headers });
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  },

  async saveSettings(settingsPayload: Record<string, any>): Promise<any> {
    const res = await fetch(`${BACKEND_BASE}/api/settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(settingsPayload),
    });
    return res.json();
  },

  async getProvidersConfig(): Promise<any> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/providers/config`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async saveProvidersConfig(config: any): Promise<any> {
    const res = await fetch(`${BACKEND_BASE}/api/providers/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async validateProviderKey(provider: string, apiKey?: string, model?: string): Promise<{ valid: boolean; latency_ms?: number; message?: string; error?: string }> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/providers/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider, api_key: apiKey, model }),
      });
      return await res.json();
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  },

  async getStartupConfig(): Promise<any> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/startup/config`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async saveStartupConfig(config: any): Promise<any> {
    const res = await fetch(`${BACKEND_BASE}/api/startup/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async getStartupGreeting(): Promise<{ greeting: string; hour: number }> {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/startup/greeting`, { headers });
      if (!res.ok) throw new Error('Failed');
      return await res.json();
    } catch {
      return { greeting: 'Good day. F.R.I.D.A.Y. is online and ready.', hour: 12 };
    }
  },



  async getMemories(): Promise<Memory[]> {
    const res = await fetch(`${BACKEND_BASE}/api/memories`, { headers });
    return res.json();
  },

  async addMemory(category: string, content: string): Promise<Memory> {
    const res = await fetch(`${BACKEND_BASE}/api/memories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ category, content }),
    });
    return res.json();
  },

  async deleteMemory(id: string): Promise<boolean> {
    const res = await fetch(`${BACKEND_BASE}/api/memories/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
  },

  async getNotes(): Promise<Note[]> {
    const res = await fetch(`${BACKEND_BASE}/api/notes`, { headers });
    return res.json();
  },

  async createNote(title: string, content: string): Promise<Note> {
    const res = await fetch(`${BACKEND_BASE}/api/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, content }),
    });
    return res.json();
  },

  async getLogs(limit = 50): Promise<ActionLog[]> {
    const res = await fetch(`${BACKEND_BASE}/api/logs?limit=${limit}`, { headers });
    return res.json();
  },

  async syncCloud(authToken?: string): Promise<any> {
    const url = authToken ? `${BACKEND_BASE}/api/sync?auth_token=${encodeURIComponent(authToken)}` : `${BACKEND_BASE}/api/sync`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
    });
    return res.json();
  },
};
