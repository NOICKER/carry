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

  const categoryNames = Object.keys(categories);
  const rawCategoryData = {};

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

    // Filter by 30% frequency (no exclusion lists)
    const repoCount = allRepos.length;
    const commonFolders = filterByFrequency(allFolders, repoCount);
    const commonFiles = filterByFrequency(allFiles, repoCount);
    const commonDeps = filterByFrequency(allDeps, repoCount);
    const keywords = [...new Set(allTopics.map((t) => t.toLowerCase()))];

    rawCategoryData[category] = {
      commonFolders,
      commonFiles,
      commonDeps,
      keywords,
    };
  }

  // ── Calculate Specificity Scores ────────────────────────────────
  console.log(`\n🧮  Calculating specificity scores across categories...`);
  
  const frequencyMap = {
    folders: {},
    files: {},
    deps: {},
    keywords: {}
  };

  // Count how many categories each item appears in
  for (const cat of categoryNames) {
    const data = rawCategoryData[cat];
    data.commonFolders.forEach(f => frequencyMap.folders[f.toLowerCase()] = (frequencyMap.folders[f.toLowerCase()] || 0) + 1);
    data.commonFiles.forEach(f => frequencyMap.files[f.toLowerCase()] = (frequencyMap.files[f.toLowerCase()] || 0) + 1);
    data.commonDeps.forEach(d => frequencyMap.deps[d.toLowerCase()] = (frequencyMap.deps[d.toLowerCase()] || 0) + 1);
    data.keywords.forEach(k => frequencyMap.keywords[k.toLowerCase()] = (frequencyMap.keywords[k.toLowerCase()] || 0) + 1);
  }

  // Helper to determine weight
  // > 8 categories = 0
  // 4-8 categories = 1
  // 1-3 categories = 3
  const getWeight = (count) => {
    if (count > 8) return 0;
    if (count >= 4) return 1;
    return 3;
  };

  const finalResult = {};

  for (const cat of categoryNames) {
    const data = rawCategoryData[cat];
    
    // Transform arrays into objects with specificity weights
    const applyWeights = (items, freqTarget) => {
      const resultObj = {};
      for (const item of items) {
        const lowerItem = item.toLowerCase();
        resultObj[lowerItem] = getWeight(frequencyMap[freqTarget][lowerItem]);
      }
      return resultObj;
    };

    finalResult[cat] = {
      common_folders: applyWeights(data.commonFolders, 'folders'),
      common_files: applyWeights(data.commonFiles, 'files'),
      common_dependencies: applyWeights(data.commonDeps, 'deps'),
      keywords: applyWeights(data.keywords, 'keywords'),
    };

    console.log(`   ✅  ${cat}: ${data.commonFolders.length} folders, ${data.commonFiles.length} files, ${data.commonDeps.length} deps, ${data.keywords.length} keywords structured with weights.`);
  }

  // Write output
  const outPath = join(__dirname, 'pattern-library.json');
  writeFileSync(outPath, JSON.stringify(finalResult, null, 2) + '\n', 'utf-8');

  console.log(`\n🎉  Done! pattern-library.json updated with ${categoryNames.length} categories.`);
  console.log(`📁  Saved to: ${outPath}\n`);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err.message);
  process.exit(1);
});
