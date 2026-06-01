# statusLine input schema

The HUD is a Claude Code `statusLine` command. Claude Code spawns it and pipes
**one JSON object on stdin**; the script prints the status text. That JSON is the
entire interface — there is no other channel.

This documents everything the CLI provides, regardless of what the HUD currently
consumes.

- **Claude Code version:** 2.1.159
- **Captured:** 2026-06-01
- **Source:** <https://code.claude.com/docs/en/statusline>

## Full JSON shape

```json
{
  "cwd": "/current/working/directory",
  "session_id": "abc123...",
  "session_name": "my-session",
  "transcript_path": "/path/to/transcript.jsonl",
  "model": {
    "id": "claude-opus-4-8",
    "display_name": "Opus"
  },
  "workspace": {
    "current_dir": "/current/working/directory",
    "project_dir": "/original/project/directory",
    "added_dirs": [],
    "git_worktree": "feature-xyz",
    "repo": {
      "host": "github.com",
      "owner": "anthropics",
      "name": "claude-code"
    }
  },
  "version": "2.1.90",
  "output_style": { "name": "default" },
  "cost": {
    "total_cost_usd": 0.01234,
    "total_duration_ms": 45000,
    "total_api_duration_ms": 2300,
    "total_lines_added": 156,
    "total_lines_removed": 23
  },
  "context_window": {
    "total_input_tokens": 15500,
    "total_output_tokens": 1200,
    "context_window_size": 200000,
    "used_percentage": 8,
    "remaining_percentage": 92,
    "current_usage": {
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  },
  "exceeds_200k_tokens": false,
  "effort": { "level": "high" },
  "thinking": { "enabled": true },
  "rate_limits": {
    "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 },
    "seven_day": { "used_percentage": 41.2, "resets_at": 1738857600 }
  },
  "vim": { "mode": "NORMAL" },
  "agent": { "name": "security-reviewer" },
  "pr": {
    "number": 1234,
    "url": "https://github.com/anthropics/claude-code/pull/1234",
    "review_state": "pending"
  },
  "worktree": {
    "name": "my-feature",
    "path": "/path/to/.claude/worktrees/my-feature",
    "branch": "worktree-my-feature",
    "original_cwd": "/path/to/project",
    "original_branch": "main"
  }
}
```

## Field reference

### Session & identity

| Field | Notes | HUD |
| ----- | ----- | --- |
| `session_id` | Unique session id | — |
| `session_name` | Only when set via `--name` / `/rename` | — |
| `transcript_path` | Path to the JSONL transcript | ✓ agents segment |
| `version` | Claude Code version | — |
| `output_style.name` | Current output style | — |
| `hook_event_name` | `"Status"` | — |

### Model

| Field | Notes | HUD |
| ----- | ----- | --- |
| `model.id` | e.g. `claude-opus-4-8` | ✓ cost family detection |
| `model.display_name` | e.g. `Opus` | ✓ model segment |

### Directory & git

| Field | Notes | HUD |
| ----- | ----- | --- |
| `cwd` / `workspace.current_dir` | Same value; `current_dir` preferred | ✓ uses `cwd` |
| `workspace.project_dir` | Launch dir (may differ from cwd) | — |
| `workspace.added_dirs` | From `/add-dir` | — |
| `workspace.git_worktree` | Worktree name for **any** linked worktree | — |
| `workspace.repo.{host,owner,name}` | Parsed from `origin` remote | — |

### Cost

`cost.total_cost_usd` (✓ HUD cost segment), `total_duration_ms` /
`total_api_duration_ms` (✓ HUD time segment), `total_lines_added`,
`total_lines_removed`.

### Context window — HUD context + speed segments

- `context_window.total_input_tokens` / `total_output_tokens` — *current* context
  usage (cumulative before v2.1.132)
- `context_window.context_window_size` — 200000, or 1000000 for extended context
- `context_window.used_percentage` / `remaining_percentage` — pre-calculated,
  input-only formula; may be `null` early in the session
- `context_window.current_usage.{input_tokens, output_tokens,
  cache_creation_input_tokens, cache_read_input_tokens}` — `null` before the first
  API call and again right after `/compact` until the next call repopulates it
- `exceeds_200k_tokens` — fixed-threshold bool (input+cache+output > 200k)

`used_percentage` is computed from input only:
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens` (excludes
`output_tokens`). Match this formula if calculating manually.

### Reasoning / thinking

- `effort.level` — `low | medium | high | xhigh | max`. Reflects live `/effort`
  changes mid-session. Ultracode reports as `xhigh`. Absent when the model does
  not support the effort parameter.
- `thinking.enabled` — bool

### Rate limits — HUD quota segment

`rate_limits.five_hour.{used_percentage, resets_at}` and
`rate_limits.seven_day.{...}`. Subscriber-only (Pro/Max), appears after the first
API response; each window may be independently absent. `resets_at` is unix epoch
**seconds**.

### Editor / agent / PR / worktree

- `vim.mode` — `NORMAL | INSERT | VISUAL | VISUAL LINE` (only when vim mode on)
- `agent.name` — when launched with `--agent`
- `pr.{number, url, review_state}` — open PR for the branch; `review_state` ∈
  `approved | pending | changes_requested | draft`
- `worktree.{name, path, branch, original_cwd, original_branch}` — only during
  `--worktree` sessions (✓ HUD reads `worktree.name`)

## Fields that may be absent

`session_name`, `workspace.git_worktree`, `workspace.repo`, `effort`, `vim`,
`agent`, `pr` (and independently `pr.review_state`), `worktree` (and for
hook-based worktrees, `branch` / `original_branch`), `rate_limits` (and each
window independently).

## Fields that may be `null`

`context_window.current_usage` (before first API call; after `/compact`),
`context_window.used_percentage`, `context_window.remaining_percentage`.

## Notes for the HUD implementation

1. **Effort display uses the native `effort.level` field.** The model segment
   appends `@ <Effort>` (e.g. `Opus 4.8 @ xHigh`) sourced from
   `stdin?.effort?.level`, and shows nothing when the field is absent (model
   doesn't support effort). This replaced an earlier approach that scraped
   `/effort` commands from the transcript and fell back to `settings.json` — no
   transcript parsing is needed now.

2. **Context percentage uses the native `context_window.used_percentage`.** The
   bar shows usage against the **full** window, input-only
   (`input + cache_creation + cache_read`, excluding output) — matching how Claude
   Code computes it. When `used_percentage` is `null` (early session, just after
   `/compact`) it falls back to the same formula from `current_usage`, then to `0`.

   This replaced an earlier scheme that rescaled tokens against an autocompact
   threshold (`windowSize × 0.775`) and included output tokens. That path keyed off
   `stdin.autocompact`, a field the CLI never sends — so it always ran and the
   official value was dead code. Both the undocumented-field read and the rescaling
   are now gone.
