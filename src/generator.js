/**
 * Command generator - translates natural language to shell commands using Claude
 */
import { query } from "@anthropic-ai/claude-code";
import { readFileSync } from "fs";
import path from "path";
import { colors } from "./utils/colors.js";
import {
  CLAUDE_EXECUTABLE,
  MAX_TURNS,
  PERMISSION_MODE,
  PROMPTS_DIR,
} from "./config.js";

/**
 * Load the system prompt
 * @returns {string} System prompt content
 */
function loadSystemPrompt() {
  const promptPath = path.join(PROMPTS_DIR, "system.txt");
  try {
    return readFileSync(promptPath, "utf-8");
  } catch (err) {
    console.error(`${colors.yellow}Warning: Could not load system prompt${colors.reset}`);
    return "";
  }
}

/**
 * Generate shell command(s) from natural language
 * @param {string} userRequest - Natural language request
 * @param {string} cwd - Current working directory
 * @returns {Promise<string[]>} Array of generated commands
 */
export async function generateCommands(userRequest, cwd) {
  const customSystemPrompt = loadSystemPrompt() + `\n\nCurrent directory: ${cwd}`;

  let commandOutput = "";

  const options = {
    cwd,
    pathToClaudeCodeExecutable: CLAUDE_EXECUTABLE,
    maxTurns: MAX_TURNS,
    permissionMode: PERMISSION_MODE,
    model: "claude-sonnet-4-5-20250929",
    customSystemPrompt,
    // Disable all tools - we only want text generation
    disallowedTools: [
      "Task", "Bash", "Glob", "Grep", "Read", "Edit", "Write",
      "NotebookEdit", "WebFetch", "TodoWrite", "WebSearch",
      "BashOutput", "KillShell", "ExitPlanMode", "EnterPlanMode",
      "AskUserQuestion", "Skill", "SlashCommand",
    ],
  };

  const response = query({
    prompt: userRequest,
    options,
  });

  for await (const message of response) {

    // Stream text content
    if (message.type === "stream_event" && message.event) {
      const event = message.event;
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        commandOutput += event.delta.text;
      }
    }

    // Also capture from assistant messages directly
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if (block.type === "text") {
          // Only use this if we didn't get stream events
          if (!commandOutput) {
            commandOutput = block.text;
          }
        }
      }
    }

    // Handle result
    if (message.type === "result") {
      // Capture text from result if we don't have it yet
      if (!commandOutput && message.result) {
        commandOutput = message.result;
      }
      if (message.is_error) {
        throw new Error("Failed to generate command");
      }
    }
  }

  // Parse output into individual commands
  // Remove markdown code blocks if present
  let cleanOutput = commandOutput
    .replace(/```(?:bash|sh|shell)?\n?/g, "")
    .replace(/```/g, "")
    .trim();

  const commands = cleanOutput
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("#"));

  return commands;
}
