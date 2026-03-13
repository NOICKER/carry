import chalk from 'chalk';
import { writeFileSync, readFileSync } from 'fs';

/**
 * Print a titled section to the terminal with colour.
 * @param {string} title  — section heading
 * @param {string} body   — section content
 * @param {'green'|'yellow'|'cyan'} colour
 */
export function printSection(title, body, colour = 'green', showBottomDivider = false) {
  const colourFn = chalk[colour] || chalk.white;
  const divider = chalk.gray('─'.repeat(40));
  console.log();
  console.log(divider);
  console.log(colourFn.bold(`  ${title}`));
  console.log(colourFn(body));
  if (showBottomDivider) {
    console.log(divider);
  }
}

/**
 * Print a single line in a given colour.
 */
export function printLine(text, colour = 'white') {
  const colourFn = chalk[colour] || chalk.white;
  console.log(colourFn(text));
}

/**
 * Save a string to a file (overwrites).
 */
export function saveToFile(filePath, content) {
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read a file and return its content as a string.
 * Returns null if the file cannot be read.
 */
export function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
