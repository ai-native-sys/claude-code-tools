---
description: Set up claude-code-notify — select a notification backend and configure credentials.
user-invocable: true
allowed-tools: Read, Write, Bash
---

# Setup claude-code-notify

Guide the user through configuring this notification plugin step by step.

## Step 1: Check existing config

Read `~/.claude/plugins/claude-code-tools/notify/config.json` to see if there's an existing configuration. If a config already exists, show the user the current settings and ask if they want to reconfigure.

## Step 2: Select backend

Ask the user which notification backend(s) they want to use (they can select multiple):

- **Bark** (iOS push notifications)
- **Telegram** (Telegram bot messages)

Frame the question for future extensibility (Discord, Lark, Email may be added later).

## Step 3: Collect backend configuration

### For Bark

1. Tell the user they need the **Bark app** installed on iOS: <https://apps.apple.com/us/app/bark-push-notifications/id1403753865>
2. Ask for their **device key** (found in the Bark app on the home screen). This is required.
3. Ask if they want to customize:
   - **Server URL** (default: `https://api.day.app`) — for self-hosted Bark servers

### For Telegram

1. Tell the user to create a bot via **@BotFather** on Telegram: <https://t.me/BotFather>
   - Send `/newbot` to BotFather, follow the prompts, and copy the **bot token**.
2. Ask for their **bot token**. This is required.
3. Tell the user to get their **chat ID**:
   - Send any message to their new bot in Telegram.
   - Then visit `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` in a browser (replacing `<BOT_TOKEN>` with the actual token).
   - Find the `chat.id` value in the JSON response.
4. Ask for their **chat ID**. This is required.

## Step 4: Write config

Write the configuration to `~/.claude/plugins/claude-code-tools/notify/config.json` (create the directory if it doesn't exist):

The `backend` field accepts a single string or an array for multi-backend. Only include backend sections the user selected.

Bark only:

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

Telegram only:

```json
{
  "backend": "tg",
  "tg": {
    "botToken": "<user-provided-bot-token>",
    "chatId": "<user-provided-chat-id>"
  }
}
```

Both (multi-backend):

```json
{
  "backend": ["bark", "tg"],
  "bark": {
    "deviceKey": "<user-provided-key>",
    "serverUrl": "https://api.day.app",
    "sound": "minuet.caf",
    "icon": "https://www.google.com/s2/favicons?domain=claude.ai&sz=128"
  },
  "tg": {
    "botToken": "<user-provided-bot-token>",
    "chatId": "<user-provided-chat-id>"
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
  - **Bark**: Invalid device key, Bark app not installed, self-hosted server unreachable (`curl <serverUrl>/ping` should return pong)
  - **Telegram**: Invalid bot token, incorrect chat ID, bot hasn't been messaged yet (must send a message to the bot before it can reply)
