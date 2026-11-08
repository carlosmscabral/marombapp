/**
 * Deterministic architecture and documentation guardrail checker for MarombApp.
 * Enforces line-count ceilings, acyclic relative imports, and ASD-STE100 module header docstrings across src, server, scripts, and tests.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TARGET_DIRS = ['src', 'server', 'scripts', 'tests'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'dist-server', '.git', 'coverage']);
const ENTRYPOINTS = new Set(['src/main.tsx', 'src/App.tsx', 'server/index.ts']);
const ENTRYPOINT_MAX_LINES = 200;
const MODULE_MAX_LINES = 300;

/**
 * Recursively collects all target source files under `dirPath` in deterministic sorted order.
 */
function collectSourceFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

/**
 * Counts physical lines in `content`, ignoring a single trailing newline at EOF.
 */
function countLines(content) {
  if (content.length === 0) {
    return 0;
  }
  return content.replace(/\r?\n$/, '').split(/\r?\n/).length;
}

/**
 * Validates that `content` starts with a non-empty `/** ... * /` module header free of semicolons.
 */
function checkModuleHeader(relPath, content) {
  const errors = [];
  const normalized = content.replace(/^\uFEFF/, '').replace(/^#![^\r\n]*\r?\n/, '');
  const match = normalized.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  if (!match) {
    errors.push(
      `${relPath}: missing leading module header docstring (must start with /** ... */)`,
    );
    return errors;
  }
  const rawBody = match[1];
  const proseLines = rawBody
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean);

  if (proseLines.length === 0) {
    errors.push(`${relPath}: module header docstring is empty`);
    return errors;
  }

  const prose = proseLines.join(' ');
  if (prose.includes(';')) {
    errors.push(
      `${relPath}: module header docstring contains forbidden semicolon (";") in STE100 prose`,
    );
  }
  return errors;
}

/**
 * Strips block and line comments from source text before scanning import specifiers.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\r\n]*/g, '$1');
}

/**
 * Extracts static and dynamic module import specifiers from `source`.
 */
function extractImportSpecifiers(source) {
  const clean = stripComments(source);
  const specifiers = [];
  const staticRe =
    /(?:^|[\s;])(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = staticRe.exec(clean)) !== null) {
    specifiers.push(match[1]);
  }
  while ((match = dynamicRe.exec(clean)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * Resolves a relative or `@/` alias specifier against the set of known repository files.
 */
function resolveSpecifier(rootDir, fromFile, specifier, knownFiles) {
  let candidateBase;
  if (specifier.startsWith('.')) {
    candidateBase = path.resolve(path.dirname(fromFile), specifier);
  } else if (specifier.startsWith('@/')) {
    candidateBase = path.resolve(rootDir, specifier.slice(2));
  } else {
    return null;
  }

  const strippedBase = candidateBase.replace(/\.(ts|tsx|mjs|js|jsx)$/, '');
  const suffixes = [
    '',
    '.ts',
    '.tsx',
    '.mjs',
    '.d.ts',
    path.join('', 'index.ts'),
    path.join('', 'index.tsx'),
    path.join('', 'index.mjs'),
  ];

  for (const base of [candidateBase, strippedBase]) {
    for (const suffix of suffixes) {
      const probe = suffix.startsWith('index.')
        ? path.join(base, suffix)
        : `${base}${suffix}`;
      if (knownFiles.has(probe)) {
        return probe;
      }
    }
  }
  return null;
}

/**
 * Detects directed cycles in the local module dependency graph using depth-first search.
 */
function findImportCycles(rootDir, adjacency) {
  const errors = [];
  const state = new Map();
  const stack = [];
  const reportedCycles = new Set();

  function dfs(node) {
    state.set(node, 1);
    stack.push(node);

    const neighbors = adjacency.get(node) ?? [];
    for (const next of neighbors) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 1) {
        const startIdx = stack.indexOf(next);
        const cycleNodes = stack
          .slice(startIdx)
          .map((filePath) => path.relative(rootDir, filePath).split(path.sep).join('/'));
        const minNode = [...cycleNodes].sort()[0];
        const minIdx = cycleNodes.indexOf(minNode);
        const canonical = [
          ...cycleNodes.slice(minIdx),
          ...cycleNodes.slice(0, minIdx),
          minNode,
        ].join(' -> ');
        if (!reportedCycles.has(canonical)) {
          reportedCycles.add(canonical);
          errors.push(`Import cycle detected: ${canonical}`);
        }
      } else if (nextState === 0) {
        dfs(next);
      }
    }

    stack.pop();
    state.set(node, 2);
  }

  for (const node of adjacency.keys()) {
    if ((state.get(node) ?? 0) === 0) {
      dfs(node);
    }
  }

  return errors;
}

/**
 * Runs all MarombApp architectural checks against `rootDir`.
 */
export function checkArchitecture(rootDir = process.cwd()) {
  const resolvedRoot = path.resolve(rootDir);
  const allFiles = [];

  for (const dirName of TARGET_DIRS) {
    allFiles.push(...collectSourceFiles(path.join(resolvedRoot, dirName)));
  }

  const knownFiles = new Set(allFiles);
  const adjacency = new Map();
  const errors = [];

  for (const absPath of allFiles) {
    const relPath = path.relative(resolvedRoot, absPath).split(path.sep).join('/');
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = countLines(content);
    const maxLines = ENTRYPOINTS.has(relPath) ? ENTRYPOINT_MAX_LINES : MODULE_MAX_LINES;

    if (lines > maxLines) {
      const kind = ENTRYPOINTS.has(relPath) ? 'entrypoint' : 'module';
      errors.push(
        `${relPath}: ${lines} lines exceeds ${kind} limit of ${maxLines} lines`,
      );
    }

    errors.push(...checkModuleHeader(relPath, content));

    const specifiers = extractImportSpecifiers(content);
    const resolvedTargets = [];
    for (const spec of specifiers) {
      const target = resolveSpecifier(resolvedRoot, absPath, spec, knownFiles);
      if (target && target !== absPath) {
        resolvedTargets.push(target);
      }
    }
    adjacency.set(absPath, resolvedTargets);
  }

  errors.push(...findImportCycles(resolvedRoot, adjacency));

  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: allFiles.length,
  };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const targetRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const result = checkArchitecture(targetRoot);
  if (!result.ok) {
    console.error(`check-arch failed with ${result.errors.length} issue(s):`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log(`check-arch passed (${result.checkedFiles} files verified).`);
}
