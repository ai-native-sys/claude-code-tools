# claude-code-notify

Push notifications for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Get notified on your phone when Claude finishes a task, needs input, or encounters an error.

Currently supports **Bark** (iOS push notifications), with an extensible backend system for adding Discord, Lark, Email, etc.

## How It Works

This plugin hooks into 4 Claude Code events:

| Event | Trigger | Notification |
| ----- | ------- | ------------ |
| `PreToolUse` (ExitPlanMode) | Plan ready for review | "Plan Ready" |
| `PreToolUse` (AskUserQuestion) | Claude asks a question | "Needs Input" |
| `PermissionRequest` | Claude needs permission | "Needs Input" |
| `Stop` | Claude finished responding | "Task Complete" / "Review Complete" / "API Error" / "Session Limit" |

## Prerequisites

1. **Node.js 18+** (for built-in `fetch`)
2. **Bark app** (iOS): [Download from App Store](https://apps.apple.com/us/app/bark-push-notifications/id1403753865) — copy your device key from the app

## Installation

```bash
# Add the marketplace
/plugin marketplace add owner/claude-code-notify

# Install the notify plugin
/plugin install notify@claude-code-notify
```

## Quick Start

Run the setup skill to configure the plugin interactively:

```text
/claude-code-notify:setup
```

This will walk you through selecting a backend, entering your credentials, and testing the connection.

## Configuration

Config is stored at `config.json` in the plugin root directory.

Minimum config:

```json
{
  "bark": {
    "deviceKey": "your-device-key-here"
  }
}
```

Full options:

```json
{
  "backend": "bark",
  "logLevel": "info",
  "bark": {
    "serverUrl": "https://api.day.app",
    "deviceKey": "your-device-key",
    "sound": "minuet.caf",
    "icon": ""
  }
}
```

### Environment Variable Overrides

Env vars take highest priority:

```bash
export BARK_DEVICE_KEY="your-device-key"
export BARK_SERVER_URL="https://your-bark-server.com"
export NOTIFY_BACKEND="bark"
export NOTIFY_LOG_LEVEL="debug"
```

## Notification Statuses

| Status | Title | Bark Level | When |
| ------ | ----- | ---------- | ---- |
| `task_complete` | Task Complete | `active` | Claude finished and used write/edit tools |
| `review_complete` | Review Complete | `active` | Claude finished with read-only tools |
| `question` | Needs Input | `timeSensitive` | Claude is asking a question or needs permission |
| `plan_ready` | Plan Ready | `timeSensitive` | Plan is ready for review |
| `api_error` | API Error | `active` | API error detected (401, 429, 529) |
| `session_limit` | Session Limit | `active` | Session/context limit reached |

## Verification

### Standalone test

```bash
echo '{"hook_event_name":"Stop","session_id":"test","cwd":"/tmp/project"}' | \
  BARK_DEVICE_KEY=your-key node src/notify.mjs
```

### Error resilience (should always exit 0)

```bash
echo 'invalid json' | node src/notify.mjs; echo $?
# Output: 0
```

### Dedup test (second call should be suppressed)

```bash
echo '{"hook_event_name":"Stop","session_id":"dedup-test","cwd":"/tmp"}' | \
  BARK_DEVICE_KEY=your-key node src/notify.mjs && \
echo '{"hook_event_name":"Stop","session_id":"dedup-test","cwd":"/tmp"}' | \
  BARK_DEVICE_KEY=your-key node src/notify.mjs
```

## Troubleshooting

- **No notifications?** Check that `BARK_DEVICE_KEY` is set or configured in `config.json`
- **Debug logs**: Check `logs/notify.log` in the plugin directory. Set `logLevel` to `"debug"` for verbose output.
- **Bark health check**: `curl https://api.day.app/ping` should return `{"code":200,"message":"pong"}`
- **Self-hosted Bark**: Set `BARK_SERVER_URL` or `bark.serverUrl` in config to your server URL

## Adding New Backends

1. Create `src/backends/yourbackend.mjs` with a class that has an `async send(notification)` method
2. Register it in `src/backends/index.mjs`
3. Add default config in `src/config.mjs`

## License

MIT
