---
description: Set up the HUD statusline — configure segments and register with Claude Code.
user-invocable: true
allowed-tools: Read, Write, Bash
---

# Setup claude-code-tools HUD

Guide the user through configuring the HUD statusline plugin step by step.

## Step 1: Check existing config

Read `~/.claude/plugins/claude-code-tools/hud/config.json` to see if there's an existing configuration. If a config already exists, show the user the current settings and ask if they want to reconfigure.

## Step 2: Detect runtime

Check if `bun` is available (run `which bun`), otherwise fall back to `node`. Store the runtime choice for the command.

## Step 3: Register the statusline

The HUD plugin works by configuring the `statusLine` field in `~/.claude/settings.json`. Claude Code invokes this command every ~300ms, piping session JSON to stdin, and renders stdout as the statusline.

**IMPORTANT — auto-update safe path resolution:**

The plugin source code is cached at `~/.claude/plugins/cache/claude-code-tools/hud/<version>/`. When the plugin updates, a **new version directory** is created. A hardcoded path would break on update. The statusLine command MUST dynamically resolve to the latest version.

Use this command pattern (replace `node` with `bun` if detected):

```bash
bash -c '"node" "$(ls -td ~/.claude/plugins/cache/claude-code-tools/hud/*/src/hud.mjs 2>/dev/null | head -1)"'
```

This finds the most recently modified version directory at runtime, so plugin updates work automatically without re-running setup.

**Steps:**

1. Read existing `~/.claude/settings.json` (create if it doesn't exist).
2. Set the `statusLine` field to the dynamic command string. Preserve all other existing settings.
3. Write back the updated `~/.claude/settings.json`.

Example settings.json entry:

```json
{
  "statusLine": "bash -c '\"node\" \"$(ls -td ~/.claude/plugins/cache/claude-code-tools/hud/*/src/hud.mjs 2>/dev/null | head -1)\"'"
}
```

## Step 4: Configure segments

Ask the user which segments they want to enable. Default is all segments:

- **model** — Model name (e.g., "Opus 4.6")
- **billing** — Subscription type badge ([API], [Pro], [Max])
- **workspace** — Current directory name + worktree indicator
- **git** — Branch name + diff stats (+insertions/-deletions)
- **context** — Context window usage bar with percentage
- **quota** — 5-hour and 7-day rate limit usage (Pro/Max only), with reset countdown
- **speed** — Output tokens per second
- **cost** — Estimated session cost (API users)
- **agents** — Running background agent status

If the user wants all segments, use the default. Otherwise, write their selection to the config file.

## Step 4b: Choose bar style

Ask the user which progress bar style they prefer:

1. `■■■■■■■□□□` — filled/empty squares (default)
2. `▰▰▰▰▰▰▰▱▱▱` — filled/empty triangles
3. `●●●●●●●○○○` — filled/empty circles
4. `━━━━━━━╌╌╌` — thick/dashed lines
5. `▮▮▮▮▮▮▮▯▯▯` — filled/empty rectangles
6. `█████████░` — block/shade

If the user picks a non-default style, set `bar.filled` and `bar.empty` in the config. The mapping:

| Style | `filled` | `empty` |
| ----- | -------- | ------- |
| 1 (default) | `■` | `□` |
| 2 | `▰` | `▱` |
| 3 | `●` | `○` |
| 4 | `━` | `╌` |
| 5 | `▮` | `▯` |
| 6 | `█` | `░` |

## Step 5: Write config

Write configuration to `~/.claude/plugins/claude-code-tools/hud/config.json` (create directory if needed).

Only include fields the user explicitly customized beyond the defaults. A minimal config for all defaults is just `{}`.

Example with customized segments:

```json
{
  "segments": ["model", "billing", "context", "speed"]
}
```

## Step 6: Test the statusline

Run a quick test to verify the statusline works. Use the dynamic command from Step 3:

```bash
echo '{"model":{"id":"claude-opus-4-6","display_name":"Opus 4.6"},"context_window":{"used_percentage":48,"context_window_size":200000,"current_usage":{"input_tokens":45000,"output_tokens":5000,"cache_creation_input_tokens":10000,"cache_read_input_tokens":20000}},"cwd":"'$(pwd)'"}' | bash -c '"node" "$(ls -td ~/.claude/plugins/cache/claude-code-tools/hud/*/src/hud.mjs 2>/dev/null | head -1)"'
```

The output should show a formatted statusline with the model name and context bar.

If it fails, check the log file:

```bash
cat ~/.claude/plugins/claude-code-tools/hud/logs/hud.log
```

## Step 7: Report result

- If successful: tell the user the HUD statusline is now active. It will appear at the bottom of their Claude Code terminal showing model, context usage, and other enabled segments. Mention that they can customize segments anytime by editing `~/.claude/plugins/claude-code-tools/hud/config.json`.
- If failed: check the log file for errors. Common issues:
  - **Node.js not found**: ensure `node` is in the PATH
  - **Permission denied**: check file permissions on the plugin directory
  - **No output**: verify `~/.claude/settings.json` has the correct `statusLine` path
  - **Segments missing**: check that the segment names in config match the available list
