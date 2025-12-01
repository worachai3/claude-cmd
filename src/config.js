/**
 * Configuration constants for claude-cmd CLI
 */
import path from "path";
import os from "os";

// Base directories
export const DATA_DIR = path.join(os.homedir(), ".local/share/claude-tools/claude-cmd");
export const PROMPTS_DIR = path.join(DATA_DIR, "prompts");

// Claude executable path
export const CLAUDE_EXECUTABLE = "/opt/homebrew/bin/claude";

// SDK options
export const MAX_TURNS = 1;  // Single turn for command generation
export const PERMISSION_MODE = "default";

// Command generation settings
export const MAX_COMMANDS = 5;  // Max number of commands to suggest
