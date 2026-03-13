import { createInterface } from 'readline';

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
 * @param {{ tree: string[], folderNames: string[], imports: string[] }} walkerData
 * @param {string} styleSummary
 * @returns {Promise<string>} the composed handoff prompt
 */
export async function assembleHandoff(matchResult, walkerData, styleSummary) {
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

  const prompt = [
    `You are continuing a coding session.`,
    `This is a ${projectType} project (matched with ${confidence}% confidence)`,
    `with ${fileCount} ${fileCount === 1 ? 'file' : 'files'} across ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}.`,
    `Key dependencies: ${topImports}.`,
    ``,
    `This project uses:`,
    styleSummary.split('\n').map(l => `  ${l}`).join('\n'),
    ``,
    `Previously I was working on: ${lastMessage}`,
    ``,
    `Continue from here.`,
  ].join('\n');

  return prompt;
}
