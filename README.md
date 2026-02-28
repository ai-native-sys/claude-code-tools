# claude-code-tools

A marketplace of plugins for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

## Available Plugins

| Plugin | Description |
| ------ | ----------- |
| [notify](plugins/notify/) | Push notifications when Claude Code finishes tasks or needs input. Supports Bark (iOS) with extensible backend system. |

## Installation

```bash
# Add this marketplace
/plugin marketplace add ai-native-sys/claude-code-tools

# Install a plugin
/plugin install notify
```

## Adding a New Plugin

1. Create a directory under `plugins/<plugin-name>/`
2. Add a `.claude-plugin/plugin.json` with plugin metadata
3. Add `hooks/hooks.json` for event hooks
4. Optionally add `skills/` for interactive setup or other skills
5. Register the plugin in `.claude-plugin/marketplace.json`

### Plugin Structure

```text
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json       # Plugin metadata (name, version, description, author)
├── README.md             # Plugin documentation
├── hooks/
│   └── hooks.json        # Claude Code event hooks
├── skills/               # Optional interactive skills
│   └── <skill-name>/
│       └── SKILL.md
└── src/                  # Plugin source code
```

## License

MIT
