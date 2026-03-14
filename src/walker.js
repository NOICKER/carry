import { readdirSync, statSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { readFile } from './utils.js';
import chalk from 'chalk';

/** Folders / files to ignore while walking */
const IGNORE = new Set([
  'node_modules', '.git', 'dist', '.env',
  'carry-output.txt', '.DS_Store', 'package-lock.json',
]);

/**
 * Recursively walk a directory and collect project data.
 * @param {string} rootDir — absolute path to project root
 * @returns {{ tree: string[], extensions: Record<string,number>, imports: string[], symbols: string[], folderNames: string[], fileContents: Map<string,string> }}
 */
export function walkProject(rootDir) {
  const tree = [];
  const extensions = {};
  const imports = [];
  const symbols = [];
  const folderNames = [];
  const fileContents = new Map();
  const fileStats = new Map();

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // skip unreadable dirs
    }

    for (const entry of entries) {
      const name = entry.name;
      if (IGNORE.has(name)) continue;
      if (name.startsWith('.env')) continue; // .env.local etc.

      const fullPath = join(dir, name);

      if (entry.isDirectory()) {
        folderNames.push(relative(rootDir, fullPath));
        walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = relative(rootDir, fullPath);
        tree.push(relPath);

        const stat = statSync(fullPath);
        fileStats.set(relPath, stat);

        // Count extensions
        const ext = extname(name);
        if (ext) {
          extensions[ext] = (extensions[ext] || 0) + 1;
        }

        // Read text files for analysis (skip binaries by extension)
        const binaryExts = new Set([
          '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
          '.mp3', '.mp4', '.wav', '.ogg', '.woff', '.woff2', '.ttf',
          '.eot', '.zip', '.tar', '.gz', '.pdf', '.lock',
        ]);

        if (!binaryExts.has(ext.toLowerCase())) {
          const content = readFile(fullPath);
          if (content !== null) {
            fileContents.set(relPath, content);
            extractImports(content, imports);
            extractSymbols(content, symbols);
          }
        }
      }
    }
  }

  walk(rootDir);

  // Sanity check
  if (tree.length === 0) {
    console.warn(chalk.red('⚠ Warning: unexpected scan result — 0 files detected. Check your project path.'));
  } else if (folderNames.length === 0 && tree.length > 0) {
    console.warn(chalk.red('⚠ Warning: unexpected scan result — 0 folders detected. Check your project path.'));
  }

  // Deduplicate imports
  const uniqueImports = [...new Set(imports)];

  return { tree, extensions, imports: uniqueImports, symbols, folderNames, fileContents, fileStats };
}

/**
 * Extract import/require module names from file content.
 */
function extractImports(content, imports) {
  // ES module: import ... from 'module'
  const esRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = esRegex.exec(content)) !== null) {
    imports.push(normaliseModuleName(match[1]));
  }

  // CommonJS: require('module')
  const cjsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsRegex.exec(content)) !== null) {
    imports.push(normaliseModuleName(match[1]));
  }
}

/**
 * Extract exported function and variable names.
 */
function extractSymbols(content, symbols) {
  // export function myFunc  /  export const myVar  /  export default
  const exportRegex = /export\s+(?:default\s+)?(?:function|const|let|var|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    symbols.push(match[1]);
  }

  // Top-level function declarations: function myFunc(
  const fnRegex = /^(?:export\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
  while ((match = fnRegex.exec(content)) !== null) {
    symbols.push(match[1]);
  }
}

/**
 * Normalise an import path to a bare module name.
 * './utils' → skip (local), 'react' → 'react', '@prisma/client' → '@prisma/client'
 */
function normaliseModuleName(raw) {
  if (raw.startsWith('.') || raw.startsWith('/')) return null;
  // Scoped packages: @scope/name
  if (raw.startsWith('@')) {
    const parts = raw.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : raw;
  }
  return raw.split('/')[0];
}
