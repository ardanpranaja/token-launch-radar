// Token Radar 2.0 — the entrypoint for token-radar-01 (Node 22, standard library only).
//
// What this program does, end to end:
//   1. Reads the sealed DefiLlama snapshot (input/snapshot.json in the grader, or
//      --input <snapshot.json|directory> when you run it by hand).
//   2. Scores every pre-token protocol with the Radar 2.0 model in lib/model.ts:
//        potential  = TVL x category multiple x momentum x maturity x breadth x confidence
//        likelihood = weighted index of scale, age, momentum, breadth, category prior, confidence
//        implied    = potential x probability          (the probability-weighted launch value)
//      The board holds all 40 watchlist protocols plus every other pre-token protocol
//      that passes the conservative product screen — 198 rows in this snapshot.
//   3. Writes /output/board.json (the ranked board), /output/data.js (the dashboard's
//      dataset), the static dashboard/ and screenshots/ folders, and /output/dossier.json
//      (rebuilt from the finished /output by the vendored make.fun library, so the
//      dossier the judge reads is exactly the output the scorer checks).
//
// The scoring itself lives in lib/model.ts; this file is only the wiring: arguments,
// file I/O and the gate checks that refuse a board the competition would refuse.
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

// Where this file lives: dashboard/ and screenshots/ are copied from next to it.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

/** The gate's own caps: the text cap shapes bytes, the rest refuse. */
const TEXT_CAP_BYTES = 65_536;
const MIN_SCREENSHOTS = 3;
const SCREENSHOT_LIMIT = { max: 4, max_bytes: 524_288 };
const DASHBOARD_LIMIT = { max_files: 400, max_bytes: 4_194_304 };
const SCREENSHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read one --flag <value> (or --flag=<value>) out of process.argv; the space form wins. */
function flagValue(flag: string, fallback: string): string {
  const spaced = process.argv.indexOf(`--${flag}`);
  if (spaced >= 0 && spaced + 1 < process.argv.length) return process.argv[spaced + 1]!;
  const glued = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return glued === undefined ? fallback : glued.slice(flag.length + 3);
}

// --- Input -----------------------------------------------------------------

const inputArg = flagValue('input', '/input');
const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  process.stderr.write(
    `token radar: no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input\n`,
  );
  process.exit(2);
}
const outputDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// --- Score -----------------------------------------------------------------

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const boardProblem = boardIssue(board, snapshot);
if (boardProblem !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${boardProblem}\n`);
  process.exit(1);
}

// --- Write the board and the dashboard dataset -----------------------------

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outputDir, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping dotfiles, and list what landed. */
function copyDirectory(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const landed: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    landed.push(name);
  }
  return landed;
}

copyDirectory(join(repoRoot, 'dashboard'), join(outputDir, 'dashboard'));
const screenshots = copyDirectory(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
if (screenshots.length < MIN_SCREENSHOTS) {
  process.stderr.write(
    `token radar: screenshots/ holds ${screenshots.length} image${screenshots.length === 1 ? '' : 's'}: hand in ${MIN_SCREENSHOTS}, the board, a detail view and a filtered view\n`,
  );
  process.exit(1);
}
for (const name of screenshots) {
  if (!SCREENSHOT_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// --- Dossier, last ----------------------------------------------------------
// The scorer rebuilds the dossier from this /output and compares bytes, so it is
// written after everything else is in place.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, { text_max_bytes: TEXT_CAP_BYTES, screenshots: SCREENSHOT_LIMIT, dashboard: DASHBOARD_LIMIT }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(outputDir, 'board.json')}, ${join(outputDir, 'data.js')}, ${join(outputDir, 'dashboard')} (3 files), ${join(outputDir, 'screenshots')} (${screenshots.length} images) and ${join(outputDir, 'dossier.json')}\n`,
);
