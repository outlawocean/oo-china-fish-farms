#!/usr/bin/env node
/**
 * Post-build guard for the map credentials.
 *
 * Both map credentials are NEXT_PUBLIC_* values, which Next.js inlines into the
 * client bundle at build time. A build with a missing or misnamed variable still
 * succeeds — it just ships a map that renders solid black. This has bitten the
 * GitHub Pages deploy (stale secret) and the Netlify deploy (variable never
 * added), both times with a green build.
 *
 * Note what is NOT checked: the literal `{MAPTILER_KEY}` placeholder is
 * *expected* in the output. The style JSONs keep it and cloneMapStyle()
 * substitutes it in the browser, so its presence is healthy. What matters is
 * whether the key's value made it into the bundle alongside it.
 *
 * Exits non-zero so the deploy fails loudly instead of publishing a blank map.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT_DIR = 'out';

// Next.js reads .env.local itself during the build, but a plain node script does
// not, so mirror that here. CI environments (Netlify, Actions) pass real
// environment variables and have no .env.local — those take precedence.
const loadEnvLocal = () => {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.trim().replace(/^["']|["']$/g, '');
  }
};

loadEnvLocal();

const REQUIRED = [
  {
    name: 'NEXT_PUBLIC_MAPTILER_KEY',
    purpose: 'basemap tiles, fonts, and sprites (MapTiler)',
  },
  {
    name: 'NEXT_PUBLIC_MAPBOX_TOKEN',
    purpose: 'Mapbox GL JS renderer',
  },
];

const collectFiles = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...collectFiles(path));
    } else if (/\.(js|css|html|txt|json)$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
};

let outputFiles;
try {
  outputFiles = collectFiles(OUTPUT_DIR);
} catch {
  console.error(`\n✗ verify-build: no ${OUTPUT_DIR}/ directory — did the build run?\n`);
  process.exit(1);
}

const failures = [];

for (const { name, purpose } of REQUIRED) {
  const value = process.env[name];

  if (!value) {
    failures.push(
      `${name} was not set at build time (needed for ${purpose}).\n` +
        `    Set it in whichever environment builds this app:\n` +
        `      • local   → .env.local\n` +
        `      • Netlify → Site configuration → Environment variables\n` +
        `      • Actions → repo secrets, passed through deploy.yml`
    );
    continue;
  }

  // The variable existed, but confirm the bundler actually inlined it. A typo in
  // next.config, or reading the var dynamically instead of as a full literal
  // expression, leaves it undefined in the browser despite being set here.
  const inlined = outputFiles.some((file) => readFileSync(file, 'utf8').includes(value));

  if (!inlined) {
    failures.push(
      `${name} is set (length ${value.length}) but its value does not appear ` +
        `anywhere in ${OUTPUT_DIR}/.\n` +
        `    Next.js inlines NEXT_PUBLIC_* by literal text substitution, so the ` +
        `code must reference\n    process.env.${name} in full — destructuring or ` +
        `dynamic indexing breaks inlining.`
    );
  }
}

if (failures.length > 0) {
  console.error('\n✗ verify-build failed:\n');
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  console.error('  Refusing to publish a build whose map cannot load.\n');
  process.exit(1);
}

console.log(
  `✓ verify-build: ${REQUIRED.map((r) => r.name).join(', ')} present and inlined ` +
    `into ${OUTPUT_DIR}/`
);
