# ghcp-dev-plugins

A cross-platform plugin marketplace for **Claude Code** and **GitHub Copilot CLI**.

Both tools share compatible plugin systems, so every plugin in this marketplace works with either tool out of the box.

## Available Plugins

| Plugin | Components | Description |
|--------|-----------|-------------|
| **code-review** | skill + agent | Analyzes code for bugs, security issues, performance problems, and readability |
| **commit-helper** | skill + hook | Generates conventional commit messages; reminds you on bare `git commit` |
| **security-check** | skill + hook | Scans for hardcoded secrets, injection risks, and common vulnerabilities |

## Installation

### Claude Code

```bash
# Add this marketplace
/plugin marketplace add shouenlee/ghcp-dev-plugin

# Install a plugin
/plugin install code-review@ghcp-dev-plugins
/plugin install commit-helper@ghcp-dev-plugins
/plugin install security-check@ghcp-dev-plugins
```

### GitHub Copilot CLI

```bash
# Add this marketplace
copilot plugin marketplace add shouenlee/ghcp-dev-plugin

# Install a plugin
copilot plugin install code-review@ghcp-dev-plugins
copilot plugin install commit-helper@ghcp-dev-plugins
copilot plugin install security-check@ghcp-dev-plugins
```

## Usage

### Code Review

```
/review                    # Review files changed in the working tree
/review src/               # Review all files in src/
/review src/auth.ts        # Review a specific file
```

### Commit Helper

```
/commit                    # Generate a commit message from staged changes
```

The commit-helper hook will also suggest using `/commit` when you run `git commit` without a message.

### Security Check

```
/security                  # Scan the entire project
/security src/             # Scan a specific directory
/security config.yaml      # Scan a specific file
```

The security-check hook suggests running `/security` after editing source files.

## Project Structure

```
ghcp-dev-plugin/
├── .claude-plugin/
│   └── marketplace.json            # Marketplace manifest
├── .github/
│   └── plugin/
│       └── marketplace.json        # Duplicate for Copilot CLI
├── plugins/
│   ├── code-review/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/review/SKILL.md
│   │   └── agents/reviewer.agent.md
│   ├── commit-helper/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/commit/SKILL.md
│   │   └── hooks.json
│   └── security-check/
│       ├── .claude-plugin/plugin.json
│       ├── skills/security/SKILL.md
│       └── hooks.json
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## License

MIT
