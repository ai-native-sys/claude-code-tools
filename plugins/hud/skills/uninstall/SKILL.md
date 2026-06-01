---
description: Uninstall the HUD statusline — remove config, caches, and settings entry.
user-invocable: true
allowed-tools: Read, Write, Bash
---

# Uninstall claude-code-tools HUD

Guide the user through cleanly removing the HUD statusline plugin.

## Step 1: Confirm with user

Tell the user this will:

1. Remove the `statusLine` entry from `~/.claude/settings.json`
2. Delete HUD config, cache, and log files from `~/.claude/plugins/claude-code-tools/hud/`

Ask the user to confirm before proceeding. Also ask if they want to keep their config file in case they reinstall later.

## Step 2: Remove statusLine from settings

1. Read `~/.claude/settings.json`
2. Check if the `statusLine` field exists and contains a reference to `hud` (look for `claude-code-tools/hud` in the command string)
3. If it matches, remove the `statusLine` field entirely. **Do NOT remove it if it points to a different statusline plugin** (e.g., `claude-hud`).
4. Preserve all other settings and write back.

If the `statusLine` doesn't reference our hud plugin, inform the user and skip this step.

## Step 3: Clean up data files

Remove the HUD data directory:

```bash
rm -rf ~/.claude/plugins/claude-code-tools/hud/cache
rm -rf ~/.claude/plugins/claude-code-tools/hud/logs
```

If the user chose to keep their config, skip deleting the config file. Otherwise:

```bash
rm -f ~/.claude/plugins/claude-code-tools/hud/config.json
```

If the directory is now empty, remove it:

```bash
rmdir ~/.claude/plugins/claude-code-tools/hud 2>/dev/null
```

## Step 4: Report result

Tell the user the HUD statusline has been removed. The statusline will disappear on the next Claude Code render cycle (no restart needed).

If they want to reinstall later, they can run `/hud:setup` again.
