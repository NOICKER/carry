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
 * @returns {Array<{ type: string, folderNames: string[], fileNames: string[], dependencies: string[], keywords: string[] }>}
 */
function loadPatterns() {
  const libPath = join(__dirname, '..', 'pattern-library.json');
  const raw = readFileSync(libPath, 'utf-8');
  const data = JSON.parse(raw);

  // Already an array → old format
  if (Array.isArray(data)) return data;

  // Object → new format, normalise into array
  return Object.entries(data).map(([type, p]) => ({
    type,
    folderNames: p.common_folders || p.folderNames || [],
    fileNames: p.common_files || p.fileNames || [],
    dependencies: p.common_dependencies || p.dependencies || [],
    keywords: p.keywords || [],
  }));
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
    let maxPossible = 0;

    // Folder name matches (weight 3)
    for (const folder of pattern.folderNames) {
      maxPossible += 3;
      if (lcFolders.has(folder.toLowerCase())) score += 3;
    }

    // File name matches (weight 2)
    for (const file of pattern.fileNames) {
      maxPossible += 2;
      if (lcFiles.has(file.toLowerCase())) score += 2;
    }

    // Dependency matches (weight 4)
    for (const dep of pattern.dependencies) {
      maxPossible += 4;
      if (lcImports.has(dep.toLowerCase())) score += 4;
    }

    // Keyword matches (weight 1)
    for (const kw of pattern.keywords) {
      maxPossible += 1;
      if (keywordBlob.includes(kw.toLowerCase())) score += 1;
    }

    const confidence = maxPossible > 0 ? Math.round((score / maxPossible) * 100) : 0;

    return { type: pattern.type, confidence };
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
