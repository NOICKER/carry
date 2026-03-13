/**
 * Style Snapshot — pure regex analysis, no AI.
 * Detects coding conventions from file contents.
 */

/**
 * Analyse a collection of file contents and return a style summary.
 * @param {Map<string,string>} fileContents — map of relPath → content
 * @returns {string} human-readable style summary (5–6 lines)
 */
export function analyseStyle(fileContents) {
  let semicolonYes = 0;
  let semicolonNo = 0;
  let camelCase = 0;
  let snakeCase = 0;
  let arrowFn = 0;
  let regularFn = 0;
  let asyncAwait = 0;
  let promiseThen = 0;
  let tabs = 0;
  let spaces = 0;
  let esImport = 0;
  let cjsRequire = 0;

  for (const [relPath, content] of fileContents) {
    // Only analyse code files
    if (!/\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(relPath)) continue;

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

      // --- Semicolons ---
      if (trimmed.endsWith(';')) semicolonYes++;
      else if (trimmed.length > 5 && !trimmed.endsWith('{') && !trimmed.endsWith('}') && !trimmed.endsWith(',') && !trimmed.endsWith('(') && !trimmed.endsWith(':')) {
        semicolonNo++;
      }

      // --- Indentation (first indented character) ---
      if (line.startsWith('\t')) tabs++;
      else if (line.startsWith('  ')) spaces++;

      // --- Naming: extract identifiers from let/const/var declarations ---
      const declMatch = trimmed.match(/(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (declMatch) {
        const name = declMatch[1];
        if (name.includes('_') && name !== name.toUpperCase()) snakeCase++;
        else if (/[a-z][A-Z]/.test(name)) camelCase++;
      }

      // --- Arrow vs regular function ---
      if (/=>\s*[{(]?/.test(trimmed)) arrowFn++;
      if (/\bfunction\s+[a-zA-Z_$]/.test(trimmed) || /\bfunction\s*\(/.test(trimmed)) regularFn++;

      // --- Async/await vs .then ---
      if (/\basync\b/.test(trimmed) || /\bawait\b/.test(trimmed)) asyncAwait++;
      if (/\.then\s*\(/.test(trimmed)) promiseThen++;

      // --- Import style ---
      if (/\bimport\s+.*\s+from\s+/.test(trimmed)) esImport++;
      if (/\brequire\s*\(/.test(trimmed)) cjsRequire++;
    }
  }

  // Build summary
  const lines = [];

  lines.push(`Semicolons: ${semicolonYes >= semicolonNo ? 'yes' : 'no'}`);

  if (camelCase + snakeCase > 0) {
    lines.push(`Naming: ${camelCase >= snakeCase ? 'camelCase' : 'snake_case'}`);
  } else {
    lines.push('Naming: not enough data');
  }

  lines.push(`Functions: ${arrowFn >= regularFn ? 'arrow functions preferred' : 'regular functions preferred'}`);

  lines.push(`Async: ${asyncAwait >= promiseThen ? 'async/await' : '.then() promises'}`);

  lines.push(`Indentation: ${tabs >= spaces ? 'tabs' : `spaces`}`);

  lines.push(`Imports: ${esImport >= cjsRequire ? 'ES modules (import/export)' : 'CommonJS (require)'}`);

  return lines.join('\n');
}
