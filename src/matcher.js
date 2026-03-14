import { readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the pattern library from the package root.
 * Supports both formats:
 *   OLD: [ { type, folderNames, fileNames, dependencies, keywords } ]
 *   NEW: { "category": { common_folders, common_files, common_dependencies, keywords } }
 *
 * @returns {Array<{ type: string, folderNames: string[], fileNames: string[], dependencies: string[], keywords: string[], folderWeights: object, fileWeights: object, depWeights: object, keywordWeights: object }>}
 */
function loadPatterns() {
  const libPath = join(__dirname, '..', 'pattern-library.json');
  const raw = readFileSync(libPath, 'utf-8');
  const data = JSON.parse(raw);

  const parseItems = (items) => {
    if (!items) return {};
    if (Array.isArray(items)) {
      // Old format: Array of strings. Assume weight 1
      return Object.fromEntries(items.map(i => [i, 1]));
    }
    // New format: Object of { name: weight }
    return items;
  };

  const normalize = (entries) => {
    return Object.entries(entries).map(([type, p]) => {
      const folderWeights = parseItems(p.common_folders || p.folderNames);
      const fileWeights = parseItems(p.common_files || p.fileNames);
      const depWeights = parseItems(p.common_dependencies || p.dependencies);
      const keywordWeights = parseItems(p.keywords);

      return {
        type,
        folderWeights,
        fileWeights,
        depWeights,
        keywordWeights,
        folderNames: Object.keys(folderWeights),
        fileNames: Object.keys(fileWeights),
        dependencies: Object.keys(depWeights),
        keywords: Object.keys(keywordWeights)
      };
    });
  };

  // Already an array → old root format, map it to dictionary first
  if (Array.isArray(data)) {
    const dict = Object.fromEntries(data.map(p => [p.type, p]));
    return normalize(dict);
  }

  return normalize(data);
}

/**
 * Score a project against the pattern library.
 *
 * @param {{ tree: string[], extensions: Record<string,number>, imports: string[], symbols: string[], folderNames: string[] }} walkerData
 * @returns {{ bestMatch: { type: string, confidence: number }, secondary: Array<{ type: string, confidence: number }>, miscellaneous: Array<{ file: string, suggestion: string|null }> }}
 */
export function matchProject(walkerData) {
  const patterns = loadPatterns();
  const { tree, imports, symbols, folderNames } = walkerData;

  // Lower-case sets for matching
  const lcFolders = new Set(folderNames.map(f => f.toLowerCase()));
  const lcFiles = new Set(tree.map(f => basename(f).toLowerCase()));
  const lcImports = new Set(imports.filter(Boolean).map(i => i.toLowerCase()));

  // Combine symbols + file content keywords into a searchable blob
  const keywordBlob = [
    ...symbols,
    ...tree,
    ...imports.filter(Boolean),
  ].join(' ').toLowerCase();

  // Score each pattern
  const scores = patterns.map(pattern => {
    let score = 0;

    // Folder name matches
    for (const [folder, weight] of Object.entries(pattern.folderWeights)) {
      if (lcFolders.has(folder.toLowerCase())) score += weight;
    }

    // File name matches
    for (const [file, weight] of Object.entries(pattern.fileWeights)) {
      if (lcFiles.has(file.toLowerCase())) score += weight;
    }

    // Dependency matches
    for (const [dep, weight] of Object.entries(pattern.depWeights)) {
      if (lcImports.has(dep.toLowerCase())) score += weight;
    }

    // Keyword matches
    for (const [kw, weight] of Object.entries(pattern.keywordWeights)) {
      if (keywordBlob.includes(kw.toLowerCase())) score += weight;
    }

    // Use a soft-capped curve to map unlimited score to 0-100%
    // A score of 15 gives ~63% confidence, score of 30 gives ~86%
    const confidence = score > 0 ? Math.round((1 - Math.exp(-score / 15)) * 100) : 0;

    return { type: pattern.type, confidence, score };
  });

  // Sort by confidence descending
  scores.sort((a, b) => b.confidence - a.confidence);

  const bestMatch = scores[0];
  const secondary = scores.slice(1).filter(s => s.confidence > 0);

  // Identify miscellaneous files — files that don't appear in the best-match pattern
  const bestPattern = patterns.find(p => p.type === bestMatch.type);
  const bestFileSet = new Set(
    (bestPattern?.fileNames || []).map(f => f.toLowerCase())
  );
  const bestFolderSet = new Set(
    (bestPattern?.folderNames || []).map(f => f.toLowerCase())
  );

  const miscellaneous = [];
  for (const filePath of tree) {
    const file = basename(filePath).toLowerCase();
    const parentFolder = filePath.includes('\\') || filePath.includes('/')
      ? filePath.replace(/\\/g, '/').split('/').slice(-2, -1)[0]?.toLowerCase()
      : null;

    const matchesBest = bestFileSet.has(file) ||
      (parentFolder && bestFolderSet.has(parentFolder));

    if (!matchesBest) {
      // Check if it matches any OTHER pattern
      let suggestion = null;
      for (const pattern of patterns) {
        if (pattern.type === bestMatch.type) continue;
        const otherFiles = new Set(pattern.fileNames.map(f => f.toLowerCase()));
        const otherFolders = new Set(pattern.folderNames.map(f => f.toLowerCase()));
        if (otherFiles.has(file) || (parentFolder && otherFolders.has(parentFolder))) {
          suggestion = pattern.type;
          break;
        }
      }
      miscellaneous.push({ file: filePath, suggestion });
    }
  }

  const lowConfidence = bestMatch.confidence < 50;

  return { bestMatch, secondary, miscellaneous, lowConfidence };
}
