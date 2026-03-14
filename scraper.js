#!/usr/bin/env node

/**
 * scraper.js — Populate pattern-library.json from GitHub repos.
 *
 * Usage:
 *   1. Create a .env file with GITHUB_TOKEN=ghp_xxxxx
 *   2. Run: node scraper.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Load .env ──────────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = join(__dirname, '.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = value;
    }
  } catch {
    console.error('❌  Could not read .env file. Make sure it exists with GITHUB_TOKEN=...');
    process.exit(1);
  }
}

// ── Global Exclusions ──────────────────────────────────────────
const EXCLUDE_FOLDERS = new Set(['src', 'public', 'assets', 'components', 'pages', 'utils', 'hooks', 'lib', 'styles', 'types', 'tests', '__tests__', 'config']);
const EXCLUDE_FILES = new Set(['readme.md', '.gitignore', 'package.json', 'package-lock.json', 'index.js', 'index.ts', 'index.html', 'app.js', 'app.ts', 'tsconfig.json', '.eslintrc', '.prettierrc', 'vite.config.ts', 'vite.config.js', 'webpack.config.js']);
const EXCLUDE_KEYWORDS = new Set(['react', 'javascript', 'typescript', 'nodejs', 'api', 'node', 'js', 'mobile', 'python', 'vue', 'hacktoberfest', 'starter-kit', 'create-react-app', 'expressjs', 'mongodb', 'firebase']);

// ── Helpers ────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ghFetch(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${msg.slice(0, 120)}`);
  }
  return res.json();
}

// ── Search repos for a single query ────────────────────────────
async function searchRepos(query, token) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=10`;
  const data = await ghFetch(url, token);
  return (data.items || []).map((r) => ({
    full_name: r.full_name,
    topics: r.topics || [],
  }));
}

// ── Get root contents of a repo ────────────────────────────────
async function getRepoContents(fullName, token) {
  const url = `https://api.github.com/repos/${fullName}/contents`;
  const items = await ghFetch(url, token);
  const folders = [];
  const files = [];
  for (const item of items) {
    if (item.type === 'dir') folders.push(item.name);
    else files.push(item.name);
  }
  return { folders, files };
}

// ── Get package.json deps ──────────────────────────────────────
async function getPackageDeps(fullName, token) {
  try {
    const url = `https://api.github.com/repos/${fullName}/contents/package.json`;
    const meta = await ghFetch(url, token);
    const decoded = Buffer.from(meta.content, 'base64').toString('utf-8');
    const pkg = JSON.parse(decoded);
    return [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ];
  } catch {
    return []; // No package.json or parse error
  }
}

// ── Frequency filter ───────────────────────────────────────────
function filterByFrequency(items, repoCount, threshold = 0.3) {
  const freq = {};
  for (const item of items) {
    const lc = item.toLowerCase();
    freq[lc] = (freq[lc] || 0) + 1;
  }
  const minCount = Math.max(1, Math.floor(repoCount * threshold));
  return Object.entries(freq)
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  loadEnv();

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌  GITHUB_TOKEN not found in .env');
    process.exit(1);
  }

  // Load categories
  const catPath = join(__dirname, 'categories.json');
  const categories = JSON.parse(readFileSync(catPath, 'utf-8'));

  const result = {};
  const categoryNames = Object.keys(categories);

  console.log(`\n🔍  Scraping ${categoryNames.length} categories...\n`);

  for (const category of categoryNames) {
    const searchTerms = categories[category];
    const seenRepos = new Set();
    const allRepos = [];

    console.log(`── ${category} ──`);

    // Search across all terms for this category
    for (const term of searchTerms) {
      try {
        console.log(`   🔎  Searching: "${term}"`);
        const repos = await searchRepos(term, token);
        for (const repo of repos) {
          if (!seenRepos.has(repo.full_name)) {
            seenRepos.add(repo.full_name);
            allRepos.push(repo);
          }
        }
        await sleep(1000);
      } catch (err) {
        console.log(`   ⚠️  Search failed for "${term}": ${err.message}`);
      }
    }

    console.log(`   📦  ${allRepos.length} unique repos found`);

    // Scrape each repo
    const allFolders = [];
    const allFiles = [];
    const allDeps = [];
    const allTopics = [];

    for (const repo of allRepos) {
      try {
        console.log(`   📂  Scraping ${repo.full_name}`);
        const contents = await getRepoContents(repo.full_name, token);
        allFolders.push(...contents.folders);
        allFiles.push(...contents.files);

        const deps = await getPackageDeps(repo.full_name, token);
        allDeps.push(...deps);

        allTopics.push(...repo.topics);

        await sleep(1000);
      } catch (err) {
        console.log(`   ⚠️  Skipping ${repo.full_name}: ${err.message}`);
      }
    }

    // Filter by 30% frequency
    const repoCount = allRepos.length;
    const commonFolders = filterByFrequency(allFolders, repoCount)
      .filter((f) => !EXCLUDE_FOLDERS.has(f.toLowerCase()));
    const commonFiles = filterByFrequency(allFiles, repoCount)
      .filter((f) => !EXCLUDE_FILES.has(f.toLowerCase()));
    const commonDeps = filterByFrequency(allDeps, repoCount)
      .filter((d) => !EXCLUDE_KEYWORDS.has(d.toLowerCase()));
    const keywords = [...new Set(allTopics.map((t) => t.toLowerCase()))]
      .filter((k) => !EXCLUDE_KEYWORDS.has(k));

    const totalUnique = new Set([...commonFolders, ...commonFiles, ...commonDeps, ...keywords]).size;
    if (totalUnique < 3) {
      console.warn(`   ⚠️  WARNING: Category "${category}" has only ${totalUnique} unique patterns left. Needs better search terms!`);
    }

    result[category] = {
      common_folders: commonFolders,
      common_files: commonFiles,
      common_dependencies: commonDeps,
      keywords,
    };

    console.log(
      `   ✅  ${commonFolders.length} folders, ${commonFiles.length} files, ` +
      `${commonDeps.length} deps, ${keywords.length} keywords\n`
    );
  }

  // Write output
  const outPath = join(__dirname, 'pattern-library.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');

  console.log(`\n🎉  Done! pattern-library.json updated with ${categoryNames.length} categories.`);
  console.log(`📁  Saved to: ${outPath}\n`);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err.message);
  process.exit(1);
});
