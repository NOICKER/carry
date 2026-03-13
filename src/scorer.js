import { dirname, basename } from 'path';

/**
 * Score files and categorize them into CORE, SUPPORTING, and BACKGROUND.
 *
 * @param {{ tree: string[], fileStats: Map<string, import('fs').Stats> }} walkerData
 * @param {string} lastMessage
 * @returns {Map<string, { score: number, tier: string }>}
 */
export function scoreFiles(walkerData, lastMessage) {
  const { tree, fileStats } = walkerData;
  const keywords = (lastMessage || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(' ')
    .filter(w => w.length > 2);

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Find recently modified folders
  const recentlyModifiedFolders = new Set();
  if (fileStats) {
    for (const [relPath, stat] of fileStats.entries()) {
      if (now - stat.mtimeMs < DAY_MS * 3) { // within last 3 days
        recentlyModifiedFolders.add(dirname(relPath));
      }
    }
  }

  const scores = new Map();

  for (const file of tree) {
    let score = 0;
    const name = basename(file).toLowerCase();
    const folder = dirname(file);
    const stat = fileStats ? fileStats.get(file) : null;

    // 1. Logs, backups, locks ALWAYS score 0
    if (/\.log$/.test(name) || /\.bak$/.test(name) || /lock/i.test(name)) {
      scores.set(file, { score: 0, tier: 'BACKGROUND' });
      continue;
    }

    // 2. Config files always score low
    if (/^\.env/.test(name) || name === 'package.json' || name.includes('config') || name.startsWith('.')) {
      score += 0;
    } else {
      // 3. Entry point files always score high
      if (['index.js', 'main.js', 'app.js', 'cli.js'].includes(name)) {
        score += 5;
      }

      // 4. Recently modified files score higher
      if (stat) {
        const ageDays = (now - stat.mtimeMs) / DAY_MS;
        if (ageDays < 1) score += 3;
        else if (ageDays < 7) score += 2;
        else if (ageDays < 30) score += 1;
      }

      // 5. Files in the same folder as recently modified files score higher
      if (recentlyModifiedFolders.has(folder)) {
        score += 2;
      }

      // 6. Keyword matching from last message
      const fileLower = file.toLowerCase();
      let keywordMatches = 0;
      for (const kw of keywords) {
        if (fileLower.includes(kw)) keywordMatches++;
      }
      score += Math.min(keywordMatches * 2, 4); // cap keyword points at 4
    }

    score = Math.min(score, 10);

    let tier = 'BACKGROUND'; // 0-3
    if (score >= 7) {
      tier = 'CORE'; // 7-10
    } else if (score >= 4) {
      tier = 'SUPPORTING'; // 4-6
    }

    scores.set(file, { score, tier });
  }

  return scores;
}
