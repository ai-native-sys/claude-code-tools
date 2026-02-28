---
description: Set up claude-code-notify — select a notification backend and configure credentials.
user-invocable: true
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# Setup claude-code-notify

Guide the user through configuring this notification plugin step by step.

## Step 1: Check existing config

Read `~/.claude/plugins/claude-code-tools/notify/config.json` to see if there's an existing configuration. If a config already exists, show the user the current settings and ask if they want to reconfigure.

## Step 2: Select backend

Ask the user which notification backend they want to use:

- **Bark** (iOS push notifications) — currently the only supported backend

Frame the question for future extensibility (Discord, Lark, Email may be added later).

## Step 3: Collect backend configuration

### For Bark

1. Tell the user they need the **Bark app** installed on iOS: <https://apps.apple.com/us/app/bark-push-notifications/id1403753865>
2. Ask for their **device key** (found in the Bark app on the home screen). This is required.
3. Ask if they want to customize:
   - **Server URL** (default: `https://api.day.app`) — for self-hosted Bark servers

## Step 4: Write config

Write the configuration to `~/.claude/plugins/claude-code-tools/notify/config.json` (create the directory if it doesn't exist):

```json
{
  "backend": "bark",
  "bark": {
    "deviceKey": "<user-provided-key>",
    "serverUrl": "https://api.day.app",
    "sound": "minuet.caf",
    "icon": "https://www.google.com/s2/favicons?domain=claude.ai&sz=128"
  }
}
```

Only include fields the user explicitly customized beyond the defaults.

## Step 5: Test the setup

Send a test notification:

```bash
echo '{"hook_event_name":"Stop","session_id":"setup-test","cwd":"/tmp/test"}' | node "${CLAUDE_PLUGIN_ROOT}/src/notify.mjs"
```

Then check the log for confirmation:

```bash
cat ~/.claude/plugins/claude-code-tools/notify/logs/notify.log
```

Ask the user if they received the notification on their device.

## Step 6: Report result

- If successful: tell the user notifications are now active and will trigger on task completion, questions, permission requests, and plan reviews.
- If failed: check the log file for errors. Common issues:
  - Invalid device key
  - Bark app not installed
  - Self-hosted server unreachable (`curl <serverUrl>/ping` should return pong)
