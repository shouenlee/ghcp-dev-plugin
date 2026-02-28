# Contributing to ghcp-dev-plugins

Thanks for your interest in contributing a plugin to this marketplace!

## Adding a New Plugin

### 1. Create the plugin directory

```
plugins/<your-plugin-name>/
├── .claude-plugin/
│   └── plugin.json
├── skills/<skill-name>/SKILL.md     # if your plugin has a skill
├── agents/<name>.agent.md           # if your plugin has an agent
└── hooks.json                       # if your plugin has hooks
```

### 2. Write `plugin.json`

Create `.claude-plugin/plugin.json` inside your plugin directory:

```json
{
  "name": "your-plugin-name",
  "version": "1.0.0",
  "description": "A short description of what your plugin does",
  "components": {
    "skills": [
      {
        "name": "skill-name",
        "path": "skills/skill-name/SKILL.md"
      }
    ],
    "agents": [
      {
        "name": "agent-name",
        "path": "agents/agent-name.agent.md"
      }
    ],
    "hooks": [
      {
        "path": "hooks.json"
      }
    ]
  }
}
```

Only include the component types your plugin uses. You can omit `skills`, `agents`, or `hooks` if your plugin doesn't need them.

### 3. Write your components

**Skills** (`skills/<name>/SKILL.md`):
- Start with `# /<command> - Title`
- Include a `## Usage` section with the invocation syntax
- Include a `## Instructions` section with detailed behavior

**Agents** (`agents/<name>.agent.md`):
- Start with `# Agent Name`
- Describe the agent's role, available tools, behavior, and constraints

**Hooks** (`hooks.json`):
```json
{
  "hooks": [
    {
      "event": "before_command | after_command | after_edit",
      "pattern": "regex pattern to match",
      "action": "suggest",
      "message": "Message shown to the user"
    }
  ]
}
```

### 4. Register in the marketplace

Add your plugin to **both** marketplace manifest files:

- `.claude-plugin/marketplace.json`
- `.github/plugin/marketplace.json`

Add an entry to the `plugins` array:

```json
{
  "name": "your-plugin-name",
  "source": "plugins/your-plugin-name",
  "description": "A short description",
  "version": "1.0.0",
  "category": "one-of: code-quality, git, security, testing, docs, workflow",
  "tags": ["relevant", "tags"]
}
```

Both files must stay identical.

### 5. Submit a pull request

- One plugin per PR
- Include a brief description of what the plugin does and why it's useful
- Make sure your plugin follows the structure above

## Guidelines

- **Keep plugins focused** - Each plugin should do one thing well
- **Use clear naming** - Plugin names should be lowercase, hyphenated, and descriptive
- **Write good SKILL.md files** - They serve as both documentation and instructions
- **Test your plugin** - Verify it works with at least one of the supported tools before submitting
- **No secrets or credentials** - Never include API keys, tokens, or passwords

## Questions?

Open an issue on this repository.
