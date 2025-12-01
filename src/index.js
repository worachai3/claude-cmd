#!/usr/bin/env node
/**
 * claude-cmd CLI entry point
 *
 * A natural language to shell command translator.
 * Converts user requests into executable shell commands
 * with interactive approval before execution.
 */

import { colors } from "./utils/colors.js";
import { generateCommands } from "./generator.js";
import { processCommands } from "./executor.js";

const currentDir = process.cwd();

/**
 * Show CLI usage information
 */
function showUsage() {
  console.error(`${colors.bold}claude-cmd${colors.reset} - Natural language to shell command translator\n`);
  console.error("Usage: claude-cmd [options] <natural language request>\n");
  console.error("Options:");
  console.error(`  --print-only${colors.dim}    Output command only (for shell integration)${colors.reset}`);
  console.error(`  -h, --help${colors.dim}      Show this help message${colors.reset}\n`);
  console.error("Examples:");
  console.error(`  claude-cmd "list all files"${colors.dim}              # ls -la${colors.reset}`);
  console.error(`  claude-cmd "find large files"${colors.dim}            # find . -size +100M${colors.reset}`);
  console.error(`  claude-cmd "show git status"${colors.dim}             # git status${colors.reset}`);
  console.error(`  claude-cmd "compress this folder"${colors.dim}        # tar -czf ...${colors.reset}`);
  process.exit(1);
}

/**
 * Main CLI handler
 * @param {string} request - Natural language request
 * @param {boolean} printOnly - If true, only print the command without execution
 */
async function handleRequest(request, printOnly = false) {
  if (!printOnly) {
    console.error(`${colors.dim}Translating: "${request}"...${colors.reset}`);
  }

  try {
    const commands = await generateCommands(request, currentDir);

    if (commands.length === 0) {
      if (!printOnly) {
        console.error(`${colors.yellow}Could not generate a command for this request.${colors.reset}`);
      }
      process.exit(1);
    }

    if (printOnly) {
      // Output command(s) to stdout for shell integration (print -z)
      // Join multiple commands with && for chaining
      console.log(commands.join(" && "));
    } else {
      await processCommands(commands);
    }
  } catch (err) {
    if (!printOnly) {
      console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    }
    process.exit(1);
  }
}

/**
 * Main CLI router
 */
function main() {
  const args = process.argv.slice(2);

  // Check for --print-only flag
  const printOnly = args.includes("--print-only");
  const filteredArgs = args.filter(arg => arg !== "--print-only");
  const request = filteredArgs.join(" ");

  if (!request || request === "--help" || request === "-h") {
    showUsage();
    return;
  }

  handleRequest(request, printOnly);
}

main();
