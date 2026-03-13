#!/usr/bin/env node

import { resolve, join } from 'path';
import chalk from 'chalk';
import { walkProject } from './walker.js';
import { analyseStyle } from './style.js';
import { matchProject } from './matcher.js';
import { assembleHandoff } from './assembler.js';
import { printSection, printLine, saveToFile } from './utils.js';

async function main() {
  const cwd = process.cwd();

  // ── Banner ──
  console.log();
  console.log(chalk.bold.magenta('  🧳 CArrY — Codebase Handoff Generator'));
  console.log(chalk.gray(`  Scanning: ${cwd}`));
  console.log();

  // ── Step 1: Walk the project ──
  printLine('⏳ Walking project files...', 'gray');
  const walkerData = walkProject(cwd);

  const treeSummary = [
    `  Files found: ${walkerData.tree.length}`,
    `  Folders:     ${new Set(walkerData.folderNames).size}`,
    `  Extensions:  ${Object.entries(walkerData.extensions).map(([k, v]) => `${k} (${v})`).join(', ')}`,
    `  Imports:     ${walkerData.imports.filter(Boolean).length} unique modules`,
    `  Symbols:     ${walkerData.symbols.length} exported`,
  ].join('\n');

  printSection('📁 FILE SCAN', treeSummary, 'green');

  // ── Step 2: Style Snapshot ──
  const styleSummary = analyseStyle(walkerData.fileContents);
  printSection('🎨 STYLE SNAPSHOT', styleSummary.split('\n').map(l => `  ${l}`).join('\n'), 'green');

  // ── Step 3: Project Matcher ──
  const matchResult = matchProject(walkerData);

  let matchBody = `  Best match: ${matchResult.bestMatch.type} (${matchResult.bestMatch.confidence}% confidence)`;
  if (matchResult.secondary.length > 0) {
    matchBody += '\n  Secondary:';
    for (const s of matchResult.secondary) {
      matchBody += `\n    - ${s.type} (${s.confidence}%)`;
    }
  }
  printSection('🔍 PROJECT MATCH', matchBody, 'green');

  // Miscellaneous items in yellow
  if (matchResult.miscellaneous.length > 0) {
    const miscLines = matchResult.miscellaneous.map(m => {
      const suggestion = m.suggestion ? ` → could be ${m.suggestion}` : '';
      return `  ${m.file}${suggestion}`;
    });

    // Cap at 15 lines to avoid flooding the terminal
    const display = miscLines.length > 15
      ? [...miscLines.slice(0, 15), `  ... and ${miscLines.length - 15} more`]
      : miscLines;

    printSection('⚠️  MISCELLANEOUS', display.join('\n'), 'yellow');
  }

  // ── Step 4: Handoff Prompt ──
  const handoffPrompt = await assembleHandoff(matchResult, walkerData, styleSummary);

  printSection('📋 HANDOFF PROMPT (copy-paste ready)', `\n${handoffPrompt}\n`, 'cyan');

  // ── Save to file ──
  const outputPath = join(cwd, 'carry-output.txt');
  saveToFile(outputPath, handoffPrompt);
  console.log();
  printLine(`✅ Handoff prompt saved to ${chalk.underline(outputPath)}`, 'green');
  console.log();
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}\n`));
  process.exit(1);
});
