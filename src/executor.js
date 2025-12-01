/**
 * Command executor - handles approval and execution of generated commands
 */
import { spawn } from "child_process";
import { createInterface } from "readline";
import { colors } from "./utils/colors.js";

// Regex to match placeholders like <name>, <account-name>, <value>, etc.
const PLACEHOLDER_REGEX = /<([a-zA-Z][a-zA-Z0-9_-]*)>/g;

/**
 * Check if a command contains placeholders
 * @param {string} command - Shell command to check
 * @returns {boolean} True if command has placeholders
 */
export function hasPlaceholders(command) {
  // Use a new regex instance to avoid lastIndex state issues with global flag
  return /<([a-zA-Z][a-zA-Z0-9_-]*)>/.test(command);
}

/**
 * Extract unique placeholders from a command
 * @param {string} command - Shell command
 * @returns {string[]} Array of placeholder names (without < >)
 */
export function extractPlaceholders(command) {
  const matches = [...command.matchAll(PLACEHOLDER_REGEX)];
  const unique = [...new Set(matches.map(m => m[1]))];
  return unique;
}

/**
 * Display a command with syntax highlighting
 * @param {string} command - Shell command to display
 * @param {number} index - Command index (for multi-command display)
 * @param {number} total - Total number of commands
 */
export function displayCommand(command, index = 0, total = 1) {
  if (total > 1) {
    console.error(`\n${colors.dim}Command ${index + 1}/${total}:${colors.reset}`);
  } else {
    console.error();
  }
  // Highlight placeholders in yellow
  const highlighted = command.replace(PLACEHOLDER_REGEX, `${colors.yellow}<$1>${colors.cyan}${colors.bold}`);
  console.error(`  ${colors.cyan}${colors.bold}$ ${highlighted}${colors.reset}`);
}

/**
 * Prompt user for approval (single keypress, no Enter required)
 * @param {Object} options - Options object
 * @param {boolean} options.isMultiple - Whether there are multiple commands
 * @param {boolean} options.hasPlaceholders - Whether command has placeholders
 * @returns {Promise<string>} User's choice: 'y', 'n', 'e', 'i', or 'a' (for multiple)
 */
export function askApproval({ isMultiple = false, hasPlaceholders: hasPh = false } = {}) {
  return new Promise((resolve) => {
    let optionStr = "[y]es / [n]o / [e]dit";
    if (hasPh) {
      optionStr += " / [i]nput";
    }
    if (isMultiple) {
      optionStr += " / [a]ll";
    }
    const prompt = `${colors.cyan}Execute? ${optionStr}: ${colors.reset}`;

    process.stderr.write(prompt);

    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      // Enable raw mode for single keypress input
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const onKeypress = (key) => {
        // Handle Ctrl+C
        if (key === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.exit(0);
        }

        // Restore normal mode
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKeypress);

        const lower = key.toLowerCase();
        // Echo the key pressed
        process.stderr.write(`${lower}\n`);

        resolve(lower);
      };

      process.stdin.on("data", onKeypress);
    } else {
      // Non-TTY mode: use readline for line-based input
      const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
      });

      rl.question("", (answer) => {
        rl.close();
        const lower = (answer || "n").toLowerCase().charAt(0);
        resolve(lower);
      });
    }
  });
}

/**
 * Prompt user to edit a command
 * @param {string} command - Original command
 * @returns {Promise<string>} Edited command
 */
export function editCommand(command) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    process.stderr.write(`${colors.dim}Edit command (press Enter to confirm):${colors.reset}\n`);
    rl.question(`${colors.cyan}$ ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim() || command);
    });

    // Pre-fill with original command
    rl.write(command);
  });
}

/**
 * Prompt user for a single input value
 * @param {string} placeholder - Placeholder name
 * @returns {Promise<string>} User input value
 */
function promptForValue(placeholder) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(`  ${colors.yellow}${placeholder}${colors.reset}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt user for all placeholder values and replace them in command
 * @param {string} command - Command with placeholders
 * @returns {Promise<string>} Command with placeholders replaced
 */
export async function fillPlaceholders(command) {
  const placeholders = extractPlaceholders(command);

  if (placeholders.length === 0) {
    return command;
  }

  console.error(`${colors.dim}Enter values for placeholders:${colors.reset}`);

  const values = {};
  for (const placeholder of placeholders) {
    const value = await promptForValue(placeholder);
    if (!value) {
      // User left it empty, keep placeholder
      values[placeholder] = `<${placeholder}>`;
    } else {
      values[placeholder] = value;
    }
  }

  // Replace all placeholders with their values
  let result = command;
  for (const [placeholder, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`<${placeholder}>`, 'g'), value);
  }

  return result;
}

/**
 * Execute a shell command
 * @param {string} command - Shell command to execute
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
export function executeCommand(command) {
  return new Promise((resolve) => {
    console.error(`${colors.dim}Executing...${colors.reset}\n`);

    const child = spawn("sh", ["-c", command], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 0 });
    });

    child.on("error", (err) => {
      console.error(`${colors.red}Execution error: ${err.message}${colors.reset}`);
      resolve({ exitCode: 1 });
    });
  });
}

/**
 * Process and execute commands with user approval
 * @param {string[]} commands - Array of commands to execute
 * @returns {Promise<void>}
 */
export async function processCommands(commands) {
  if (commands.length === 0) {
    console.error(`${colors.yellow}No commands generated.${colors.reset}`);
    return;
  }

  let approveAll = false;

  for (let i = 0; i < commands.length; i++) {
    let command = commands[i];
    const hasPh = hasPlaceholders(command);
    displayCommand(command, i, commands.length);

    if (approveAll) {
      const result = await executeCommand(command);
      if (result.exitCode !== 0) {
        console.error(`\n${colors.red}Command failed with exit code ${result.exitCode}${colors.reset}`);
        // Stop executing remaining commands on failure
        break;
      }
      continue;
    }

    const choice = await askApproval({ isMultiple: commands.length > 1, hasPlaceholders: hasPh });

    switch (choice) {
      case "y":
        const result = await executeCommand(command);
        if (result.exitCode !== 0) {
          console.error(`\n${colors.red}Command failed with exit code ${result.exitCode}${colors.reset}`);
        }
        break;

      case "a":
        approveAll = true;
        const resultAll = await executeCommand(command);
        if (resultAll.exitCode !== 0) {
          console.error(`\n${colors.red}Command failed with exit code ${resultAll.exitCode}${colors.reset}`);
          return; // Stop on failure
        }
        break;

      case "i":
        command = await fillPlaceholders(command);
        // Re-process this command with the filled values
        commands[i] = command;
        i--; // Decrement to re-process this command
        break;

      case "e":
        command = await editCommand(command);
        // Re-process this command with the edited value
        commands[i] = command;
        i--; // Decrement to re-process this command
        break;

      case "n":
      default:
        console.error(`${colors.dim}Command skipped.${colors.reset}`);
        break;
    }
  }
}
