import { createInterface } from 'readline';
import { scoreFiles } from './scorer.js';

/**
 * Ask the user a question via stdin and return their answer.
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Assemble the final handoff prompt.
 *
 * @param {{ bestMatch: { type: string, confidence: number } }} matchResult
 * @param {{ tree: string[], folderNames: string[], imports: string[], fileStats: Map<string, import('fs').Stats> }} walkerData
 * @param {string} styleSummary
 * @param {boolean} isFull
 * @returns {Promise<string>} the composed handoff prompt
 */
export async function assembleHandoff(matchResult, walkerData, styleSummary, isFull) {
  console.log();
  const lastMessage = await ask(
    '📝 What were you last working on? Paste your last message to the AI:\n> '
  );

  const fileCount = walkerData.tree.length;
  const folderCount = new Set(walkerData.folderNames).size;
  const topImports = walkerData.imports
    .filter(Boolean)
    .slice(0, 10)
    .join(', ') || 'none detected';

  const projectType = matchResult.bestMatch.type;
  const confidence = matchResult.bestMatch.confidence;

  const scores = scoreFiles(walkerData, lastMessage);
  
  let coreFiles = [];
  let supportCount = 0;
  for (const [file, data] of scores.entries()) {
    if (data.tier === 'CORE') coreFiles.push(file);
    else if (data.tier === 'SUPPORTING') supportCount++;
  }

  let fileFilterText = '';
  if (isFull) {
    fileFilterText = `Focused on ${fileCount} core files out of ${fileCount} total (run with --full for complete context)\nAll files included.`;
  } else {
    fileFilterText = `Focused on ${coreFiles.length} core files out of ${fileCount} total (run with --full for complete context)\nCore files:\n` +
      coreFiles.map(f => `  - ${f}`).join('\n') +
      `\nPlus ${supportCount} supporting files.`;
  }

  const prompt = [
    `You are continuing a coding session.`,
    `This is a ${projectType} project (matched with ${confidence}% confidence)`,
    `with ${fileCount} ${fileCount === 1 ? 'file' : 'files'} across ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}.`,
    `Key dependencies: ${topImports}.`,
    ``,
    `This project uses:`,
    styleSummary.split('\n').map(l => `  ${l}`).join('\n'),
    ``,
    fileFilterText,
    ``,
    `Previously I was working on: ${lastMessage}`,
    ``,
    `Continue from here.`,
  ].join('\n');

  return { prompt, coreCount: coreFiles.length, supportCount };
}
