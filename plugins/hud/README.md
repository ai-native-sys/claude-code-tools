# HUD — Statusline Plugin for Claude Code

A real-time statusline that displays model info, context usage, cost tracking, token speed, session timing, billing type, quota usage, and git info directly in your Claude Code terminal.

## Segments

| Segment | Description | Line |
| ------- | ----------- | ---- |
| **model** | Model name + reasoning effort (e.g., "Opus 4.8 @ High") | 1 |
| **billing** | Subscription badge: `[API]`, `[Pro]`, `[Max]`, `[Team]` | 1 |
| **workspace** | Directory name + worktree indicator | 1 |
| **git** | Branch + diff stats (`main +12/-3`) | 1 |
| **time** | Session wall-clock time + API wait time (`time: 1h23m (api 4m12s)`) | 1 |
| **context** | Usage bar with percentage of the full context window | 2 |
| **quota** | 5h and 7d rate limit usage with reset countdown (subscribers only) | 2 |
| **speed** | Output tokens per second | 2 |
| **cost** | Estimated session cost (API users) | 2 |
| **agents** | Running background agent status | 3 |

## Example Output

**API user:**

```text
Opus 4.8 @ High [API] │ my-app │ git:(main) +12/-3 │ time: 12m (api 1m30s)
██████░░░░ 48% │ 42 tok/s │ $0.42
```

**Max subscriber with quota + reset times:**

```text
Opus 4.6 [Max] │ my-app │ git:(main) +56/-12
█████████░ 87% ⚠ compact │ ██░░░░░░░░ 14% (3h 24m / 5h) │ ████████░░ 76% (1h 24m / 7d) │ 38 tok/s
```

**At quota limit:**

```text
Sonnet 4.6 [Max] │ my-app │ git:(main) +8/-2
████░░░░░░ 38% │ 5h: 100% !! resets 23m │ ███████░░░ 61% (1h 24m / 7d) │ 55 tok/s
```

**In a worktree:**

```text
Opus 4.6 [API] │ my-app (wt:fix-auth) │ git:(main) +12/-3
██████░░░░ 48% │ 42 tok/s │ $0.42
```

**With running agents (3 lines):**

```text
Opus 4.6 [Pro] │ my-app │ git:(main) +12/-3
██████░░░░ 48% │ ███░░░░░░░ 23% (4h 12m / 5h) │ █░░░░░░░░░ 8% (6d 2h / 7d) │ 42 tok/s
Agent: Explore (searching codebase)
```

## Installation

```bash
# From the Claude Code tools marketplace
/plugin marketplace add
# Select "hud"

# Or install directly
/plugin install hud

# Run setup
/hud:setup
```

## Configuration

Config file: `~/.claude/plugins/claude-code-tools/hud/config.json`

### Options

```json
{
  "logLevel": "info",
  "segments": ["model", "billing", "workspace", "git", "time", "context", "quota", "speed", "cost", "agents"],
  "separator": " │ ",
  "context": {
    "warnThreshold": 70,
    "critThreshold": 85,
    "barWidth": 10
  },
  "cost": {
    "show": "auto"
  },
  "speed": {
    "windowMs": 2000
  },
  "git": {
    "cacheTtlMs": 5000,
    "timeoutMs": 1000
  },
  "billing": {
    "cacheTtlMs": 3600000
  },
  "quota": {
    "cacheTtlMs": 600000
  },
  "agents": {
    "show": true
  }
}
```

### Cost display modes

- `"auto"` (default) — show for API users, hide for subscribers
- `"always"` — always show estimated cost
- `"never"` — never show cost

### Environment variable overrides

| Variable | Description |
| -------- | ----------- |
| `HUD_SEGMENTS` | Comma-separated segment list |
| `HUD_LOG_LEVEL` | Log level (debug, info, warn, error) |
| `HUD_COST_SHOW` | Cost display mode (auto, always, never) |
| `HUD_QUOTA_CACHE_TTL` | Quota cache TTL in milliseconds |

## How It Works

Claude Code invokes the statusline command every ~300ms, piping session JSON to stdin. The HUD reads this JSON, computes each segment, and writes the formatted output to stdout.

The `statusLine` config is set in `~/.claude/settings.json`:

```json
{
  "statusLine": "node /path/to/plugins/hud/src/hud.mjs"
}
```

## Standalone Test

```bash
echo '{"model":{"id":"claude-opus-4-6","display_name":"Opus 4.6"},"context_window":{"used_percentage":48,"context_window_size":200000,"current_usage":{"input_tokens":45000,"output_tokens":5000,"cache_creation_input_tokens":10000,"cache_read_input_tokens":20000}},"cwd":"'$(pwd)'"}' | node plugins/hud/src/hud.mjs
```

## Troubleshooting

**Statusline not appearing:**

- Verify `~/.claude/settings.json` has a `statusLine` entry
- Test the command manually with the standalone test above
- Check logs: `cat ~/.claude/plugins/claude-code-tools/hud/logs/hud.log`

**Cost showing $0:**

- Cost requires token data in stdin; this may not be available in all Claude Code versions
- Check that the model is recognized (opus/sonnet/haiku)

**Quota not showing:**

- Quota only shows for Pro/Max/Team subscribers
- Requires OAuth credentials (macOS Keychain or `~/.claude/.credentials.json`)
- Check billing cache: `cat ~/.claude/plugins/claude-code-tools/hud/cache/billing.json`

**Speed showing 0 or blank:**

- Speed requires at least 2 invocations with 2s gap to compute delta
- Check cache: `cat ~/.claude/plugins/claude-code-tools/hud/cache/speed.json`

## License

Part of [claude-code-tools](https://github.com/anthropics/claude-code-tools).
