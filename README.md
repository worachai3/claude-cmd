# claude-cmd

A natural language to shell command translator powered by Claude AI. Type what you want to do in plain English, and get executable shell commands.

## Prerequisites

- **Node.js** v18 or higher
- **Claude Code CLI** installed and authenticated (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic API access** (Claude Code must be configured with valid credentials)

## Installation

```bash
# Clone the repository
git clone git@github.com:worachai3/claude-cmd.git
cd claude-cmd

# Install dependencies
npm install

# Link globally (makes 'claude-cmd' available everywhere)
npm link
```

## Usage

### Direct usage

```bash
claude-cmd "list all files"           # Generates: ls -la
claude-cmd "find large files"         # Generates: find . -size +100M
claude-cmd "show git status"          # Generates: git status
claude-cmd "compress this folder"     # Generates: tar -czf ...
```

### Options

```
--print-only    Output command only (for shell integration)
-h, --help      Show help message
```

### Interactive Approval

When a command is generated, you'll be prompted:

- `y` - Execute the command
- `n` - Skip/cancel
- `e` - Edit the command before executing
- `i` - Fill in placeholders (if command contains `<placeholder>`)
- `a` - Execute all remaining commands (for multi-command responses)

## Shell Integration (Recommended)

Add this to your `~/.zshrc` to use natural language directly in your terminal:

```zsh
# Claude AI - handle unknown commands as natural language prompts
setopt NO_NOMATCH  # Pass unmatched globs as literals (allows ? and * in prompts)
command_not_found_handler() {
  claude-cmd "$*"
}
```

After adding, reload your shell:

```bash
source ~/.zshrc
```

### How it works

With shell integration, any "unknown command" gets passed to `claude-cmd`. This means you can type natural language directly:

```bash
# Instead of typing:
claude-cmd "show disk usage"

# Just type:
show disk usage
```

The shell will recognize "show" isn't a real command, and pass the full phrase to `claude-cmd`.

## Configuration

The tool uses the Claude Code SDK and reads a system prompt from:

```
~/.local/share/claude-tools/claude-cmd/prompts/system.txt
```

You can customize this prompt to adjust command generation behavior.

## How It Works

1. Takes your natural language input
2. Sends it to Claude AI via the Claude Code SDK
3. Returns executable shell command(s)
4. Prompts for approval before execution
5. Executes the approved command(s)

## License

MIT
