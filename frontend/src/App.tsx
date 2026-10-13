import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AuthModal } from './components/AuthModal';
import { AssistantPage } from './pages/AssistantPage';
import { TasksPage } from './pages/TasksPage';
import { RemindersPage } from './pages/RemindersPage';
import { FilesPage } from './pages/FilesPage';
import { MemoryPage } from './pages/MemoryPage';
import { ActivityHistoryPage } from './pages/ActivityHistoryPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AIProviderSettingsPage } from './pages/AIProviderSettingsPage';
import { StartupGreetingPage } from './pages/StartupGreetingPage';
import { api } from './services/api';
import { voiceManager } from './services/voiceManager';
import { authService } from './services/supabase';
import { HealthStatus } from './types';


export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('assistant');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const fetchHealth = async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (e) {
      console.error('Error fetching backend health:', e);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Check Supabase Auth
  useEffect(() => {
    authService.getUser().then(setUser).catch(console.error);
  }, []);

  // Listen to Tray events from Electron preload
  useEffect(() => {
    const bridge = (window as any).fridayBridge;
    if (bridge?.onTrayAction) {
      const unsubscribe = bridge.onTrayAction((action: string) => {
        if (action === 'pause_voice') {
          voiceManager.stopSpeaking(true);
        } else if (action === 'toggle_automation') {
          handleToggleAutomation(!health?.automation_enabled);
        }
      });
      return unsubscribe;
    }
  }, [health]);


  const hasGreetedRef = React.useRef(false);

  useEffect(() => {
    if (hasGreetedRef.current) return;
    hasGreetedRef.current = true;

    api.getStartupConfig().then((cfg) => {
      if (cfg?.greet_after_startup) {
        const delay = cfg.greeting_delay_ms || 2000;
        setTimeout(async () => {
          if (cfg.do_not_greet_when_muted && voiceManager.getIsMuted()) return;
          const currentHour = new Date().getHours();
          if (cfg.quiet_hours_enabled) {
            const start = cfg.quiet_hours_start ?? 22;
            const end = cfg.quiet_hours_end ?? 7;
            if (start > end && (currentHour >= start || currentHour < end)) return;
            if (start < end && currentHour >= start && currentHour < end) return;
          }
          const greetingRes = await api.getStartupGreeting();
          if (greetingRes?.greeting) {
            voiceManager.speakText(greetingRes.greeting);
          }
        }, delay);
      }
    }).catch(() => {});
  }, []);

  const handleToggleAutomation = async (enabled: boolean) => {
    try {
      await api.toggleAutomation(enabled);
      fetchHealth();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden select-none">
      {/* Top Frameless Titlebar */}
      <Header health={health} onToggleAutomation={handleToggleAutomation} />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onSignOut={handleSignOut}
          onOpenAuth={() => setIsAuthOpen(true)}
        />

        {/* Dynamic Main View Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === 'assistant' && <AssistantPage onNavigateTab={setActiveTab} />}
          {activeTab === 'providers' && <AIProviderSettingsPage />}
          {activeTab === 'startup' && <StartupGreetingPage />}
          {activeTab === 'tasks' && <TasksPage />}
          {activeTab === 'reminders' && <RemindersPage />}
          {activeTab === 'files' && <FilesPage />}
          {activeTab === 'memory' && <MemoryPage />}
          {activeTab === 'history' && <ActivityHistoryPage />}
          {activeTab === 'diagnostics' && <DiagnosticsPage />}
          {activeTab === 'settings' && (
            <SettingsPage
              health={health}
              onRefreshHealth={fetchHealth}
              onToggleAutomation={handleToggleAutomation}
            />
          )}
        </main>
      </div>

      {/* Supabase Authentication Dialog */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => setUser(u)}
      />
    </div>
  );
};

