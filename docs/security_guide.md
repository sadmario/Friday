# F.R.I.D.A.Y. AI — Security, Permissions & Privacy Architecture

## 1. Electron Security Best Practices
- **Restricted Preload Bridge**: No Node.js globals (`require`, `process`, `fs`) are exposed to the browser window.
- **Context Isolation**: Enabled (`contextIsolation: true`).
- **Node Integration Disabled**: `nodeIntegration: false`.
- **Sandbox**: Enabled (`sandbox: true`).
- **Internal IPC Validation**: Window control IPC channels are strictly typed and whitelisted.

---

## 2. Windows Automation & Tool Registry Boundaries
- **No Direct Shell Execution**: The language model is **never** given raw access to PowerShell, CMD, or bash.
- **Strict Executable Allowlist**: Only explicitly whitelisted applications (`notepad`, `calculator`, `explorer`, `code`, `edge`, `chrome`) can be launched.
- **Strict File Directory Allowlist**: Only approved folders (workspace directory, user `Documents`, `Downloads`, `Desktop`) can be searched or inspected. Sensitive system areas (`Windows\System32`, `.ssh`, `.aws`, credential files, browser profile paths) are completely blocked.
- **Read-Only Document Analysis**: File extraction is read-only by default. Modifications require explicit user confirmation.
- **Global Automation Killswitch**: A dedicated hardware toggle (`AUTO ON` / `AUTO OFF`) in the title bar and System Tray instantly revokes all Windows automation tools at the backend level.

---

## 3. Supabase Cloud Security & Row Level Security (RLS)
- **RLS Enabled on Every Table**:
  - `profiles`
  - `tasks`
  - `reminders`
  - `memories`
  - `notes`
  - `conversation_sessions`
  - `conversation_messages`
  - `user_settings`
- **Identity Enforcement**: Every policy enforces `auth.uid() = user_id` (or `auth.uid() = id` for `profiles`).
- **Zero Service-Role Exposure**: The application only uses the public publishable/anon client key with RLS; no privileged service role keys are bundled into binaries or committed to repositories.
- **Offline-First Storage**: All tasks, reminders, and notes are persistently stored in local SQLite (`backend/data/friday_local.db`). The application functions with 100% features even when offline.
