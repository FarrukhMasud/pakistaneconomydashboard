#!/usr/bin/env node

/**
 * Pakistan Economic Dashboard — Master Update Script
 *
 * Orchestrates all data updates:
 *   1. Downloads fresh SBP source files from their URLs
 *   2. Runs parse-sbp-excel.mjs to parse Excel → JSON
 *   3. Runs update-data.mjs for SBP API (remittances)
 *   4. Prints a summary of what was updated
 *
 * Usage:
 *   npm run update
 *   node scripts/update-all.mjs
 *   node scripts/update-all.mjs --skip-download   # skip downloading, use existing files
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = resolve(__dirname, 'sbp-raw');

function hasPrefix(buffer, bytes) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function validateSourceFile(name, buffer, contentType = '') {
  const lowerName = name.toLowerCase();
  const header = buffer.subarray(0, 512).toString('utf8').trimStart().toLowerCase();

  if (contentType.toLowerCase().includes('text/html') || header.startsWith('<!doctype html') || header.startsWith('<html')) {
    return 'received an HTML page instead of the requested dataset';
  }

  if (lowerName.endsWith('.pdf')) {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
      ? null
      : 'invalid PDF signature';
  }

  if (lowerName.endsWith('.xlsx')) {
    return hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04])
      ? null
      : 'invalid XLSX/ZIP signature';
  }

  if (lowerName.endsWith('.xls')) {
    return hasPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
      ? null
      : 'invalid legacy XLS signature';
  }

  return `unsupported source file type for ${name}`;
}

// SBP source file URLs
const DOWNLOADS = [
  {
    name: 'exp_import_BOP.xls',
    url: 'https://archive.sbp.org.pk/ecodata/exp_import_BOP.xls',
    description: 'Trade (Imports/Exports BOP)',
    required: true,
  },
  {
    name: 'Foreign_Dir.xls',
    url: 'https://archive.sbp.org.pk/ecodata/Foreign_Dir.xls',
    fallbackUrl: 'https://www.sbp.org.pk/assets/document/Foreign_Dir.xls',
    description: 'FDI by Sector',
    required: true,
  },
  {
    name: 'Netinflow.xls',
    url: 'https://archive.sbp.org.pk/ecodata/Netinflow.xls',
    fallbackUrl: 'https://www.sbp.org.pk/assets/document/Netinflow.xls',
    description: 'FDI by Country',
    required: true,
  },
  {
    name: 'NetinflowSummary.xls',
    url: 'https://archive.sbp.org.pk/ecodata/NetinflowSummary.xls',
    fallbackUrl: 'https://www.sbp.org.pk/assets/document/NetinflowSummary.xls',
    description: 'FDI Annual Summary',
    required: true,
  },
  {
    name: 'GDP_table.xlsx',
    url: 'https://www.sbp.org.pk/assets/document/GDP_table.xlsx',
    fallbackUrl: 'https://archive.sbp.org.pk/ecodata/GDP_table.xlsx',
    description: 'GDP Growth Data',
    required: true,
  },
  {
    name: 'Balancepayment_BPM6.xls',
    url: 'https://www.sbp.org.pk/assets/document/Balancepayment_BPM6.xls',
    fallbackUrl: 'https://archive.sbp.org.pk/ecodata/Balancepayment_BPM6.xls',
    description: 'Balance of Payments',
    required: true,
  },
  {
    name: 'forex.pdf',
    url: 'https://www.sbp.org.pk/assets/document/forex.pdf',
    fallbackUrl: 'https://archive.sbp.org.pk/ecodata/forex.pdf',
    description: 'Foreign Exchange Reserves',
    required: true,
  },
  {
    name: 'IBF_Arch.xls',
    url: 'https://www.sbp.org.pk/assets/document/IBF_Arch.xls',
    fallbackUrl: 'https://archive.sbp.org.pk/ecodata/IBF_Arch.xls',
    description: 'Exchange Rate Archive',
    required: true,
  },
  {
    name: 'dt.xls',
    url: 'https://archive.sbp.org.pk/ecodata/dt.xls',
    description: 'Services Trade (EBOPS)',
    required: true,
  },
  {
    name: 'Export_Receipts_by_all_Countries.xls',
    url: 'https://archive.sbp.org.pk/ecodata/Export_Receipts_by_all_Countries.xls',
    description: 'Export by Country',
    required: false,
  },
  {
    name: 'Import-Payments-by-All-Countries.xlsx',
    url: 'https://archive.sbp.org.pk/ecodata/Import-Payments-by-All-Countries.xlsx',
    description: 'Import by Country',
    required: false,
  },
];

async function downloadFile(name, url, fallbackUrl, description) {
  const filepath = resolve(RAW_DIR, name);
  const urls = [url, fallbackUrl].filter(Boolean);

  for (const sourceUrl of urls) {
    try {
      const res = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });

      if (!res.ok) {
        console.log(`  ⚠️  ${description}: HTTP ${res.status} from ${sourceUrl}`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 1000) {
        console.log(`  ⚠️  ${description}: Response too small (${buffer.length} bytes) from ${sourceUrl}`);
        continue;
      }

      const validationError = validateSourceFile(name, buffer, res.headers.get('content-type') || '');
      if (validationError) {
        console.log(`  ⚠️  ${description}: ${validationError} from ${sourceUrl}`);
        continue;
      }

      await writeFile(filepath, buffer);
      console.log(`  ✅ ${description} (${(buffer.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (err) {
      console.log(`  ⚠️  ${description}: ${err.message} from ${sourceUrl}`);
    }
  }

  console.log(`  ⚠️  ${description}: no verified official source succeeded; existing source file preserved`);
  return false;
}

function runScript(scriptPath, label, args = []) {
  console.log(`\n▶️  Running ${label}...`);
  try {
    const cmd = `node "${scriptPath}"${args.length ? ' ' + args.join(' ') : ''}`;
    execSync(cmd, {
      cwd: resolve(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });
    return true;
  } catch (err) {
    console.error(`  ❌ ${label} failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  🇵🇰 Pakistan Economic Dashboard — Full Update    ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const skipDownload = args.includes('--skip-download');
  const summary = { downloaded: 0, failed: 0, skipped: 0 };

  // Step 1: Download fresh SBP Excel files
  if (!skipDownload) {
    console.log('\n📥 Step 1: Downloading SBP Excel files...\n');
    await mkdir(RAW_DIR, { recursive: true });

    for (const file of DOWNLOADS) {
      const ok = await downloadFile(file.name, file.url, file.fallbackUrl, file.description);
      if (ok) summary.downloaded++;
      else {
        summary.failed++;
        if (file.required) {
          throw new Error(`Required source download failed: ${file.description} (${file.url})`);
        }
      }
    }

    console.log(`\n  📊 Downloaded: ${summary.downloaded}/${DOWNLOADS.length}`);
    if (summary.failed > 0) {
      console.log(`  ⚠️  Failed: ${summary.failed} (will use existing files if available)`);
    }
  } else {
    console.log('\n⏭  Step 1: Skipping downloads (--skip-download)');
    summary.skipped = DOWNLOADS.length;
  }

  // Step 2: Parse Excel files
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Step 2: Parsing SBP Excel files...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const parseOk = runScript(resolve(__dirname, 'parse-sbp-excel.mjs'), 'parse-sbp-excel.mjs');

  // Step 3: Run SBP API update for remittances + inflation + monetary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💸 Step 3: Updating remittances + inflation + monetary via SBP API...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const apiOk = runScript(resolve(__dirname, 'update-data.mjs'), 'update-data.mjs (SBP API)');

  // Step 3b: Refresh FBR tax collection from official FBR month-wise PDFs
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧾 Step 3b: Updating FBR tax collection from official FBR PDFs...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const fbrOk = runScript(resolve(__dirname, 'update-fbr.mjs'), 'update-fbr.mjs');

  // Step 3c: Refresh official World Bank peer comparison data
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Step 3c: Updating peer-country comparison from World Bank API...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const peersOk = runScript(resolve(__dirname, 'update-peer-comparison.mjs'), 'update-peer-comparison.mjs');

  // Step 4: Regenerate KPI summary from all now-fresh data files
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Step 4: Regenerating KPI summary from all data files...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const kpiOk = runScript(resolve(__dirname, 'parse-sbp-excel.mjs'), 'KPI regeneration', ['--kpi-only']);

  // Step 4b: Generate auditable source/freshness metadata
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧾 Step 4b: Generating source manifest and freshness metadata...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const freshnessOk = runScript(resolve(__dirname, 'generate-data-freshness.mjs'), 'generate-data-freshness.mjs');

  // Step 4c: Enforce critical source freshness before any deployment.
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔎 Step 4c: Auditing critical dataset freshness...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const auditOk = runScript(resolve(__dirname, 'audit-data.mjs'), 'audit-data.mjs');

  // Step 5: Commit and push — Cloudflare Pages auto-builds & deploys on push.
  const autoPush = !args.includes('--no-deploy');
  const pipelineOk = parseOk && apiOk && fbrOk && peersOk && kpiOk && freshnessOk && auditOk;
  let pushOk = false;
  if (autoPush && pipelineOk) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 Step 5: Commit & push (Cloudflare auto-deploys)...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      const date = new Date().toISOString().split('T')[0];
      execSync('git add public/data/', { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
      const status = execSync('git status --porcelain public/data/', {
        cwd: resolve(__dirname, '..'), encoding: 'utf-8',
      }).trim();
      if (status) {
        execSync(
          `git commit -m "chore: update data ${date}\n\nAuto-updated by npm run update\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`,
          { cwd: resolve(__dirname, '..'), stdio: 'inherit' },
        );
        execSync('git push', { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
        pushOk = true;
        console.log('  ✅ Changes committed and pushed — Cloudflare Pages will build & deploy automatically');
      } else {
        console.log('  ⏭  No data changes to commit');
        pushOk = true;
      }
    } catch (err) {
      console.error(`  ⚠️  Git push failed: ${err.message}`);
      console.log('  💡 Push manually: git add public/data/ && git commit && git push');
    }
  } else if (!autoPush) {
    console.log('\n  ⏭  Skipping commit & push (--no-deploy flag)');
  } else {
    console.log('\n  ⛔ Skipping commit & push because one or more required update stages failed');
  }

  // Step 6: Summary
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║              Full Update Summary                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  📥 Downloads: ${summary.downloaded} succeeded, ${summary.failed} failed, ${summary.skipped} skipped`);
  console.log(`  📊 Excel parse: ${parseOk ? '✅ Success' : '❌ Failed'}`);
  console.log(`  💸 SBP API:     ${apiOk ? '✅ Success' : '⚠️  Failed (needs SBP_API_KEY in .env)'}`);
  console.log(`  🧾 FBR PDF:     ${fbrOk ? '✅ Success' : '⚠️  Failed (kept existing FBR data)'}`);
  console.log(`  🌐 Peers:       ${peersOk ? '✅ Success' : '⚠️  Failed (kept existing peer data)'}`);
  console.log(`  📊 KPI regen:   ${kpiOk ? '✅ Success' : '⚠️  Failed'}`);
  console.log(`  🧾 Freshness:   ${freshnessOk ? '✅ Success' : '⚠️  Failed'}`);
  console.log(`  🔎 Data audit:  ${auditOk ? '✅ Success' : '❌ Failed'}`);
  if (autoPush) {
    console.log(`  📤 Git push:    ${pushOk ? '✅ Success (Cloudflare auto-deploys)' : '⚠️  Failed'}`);
  }
  console.log('\n  🌐 Live at: https://economyofpakistan.com/\n');

  if (!pipelineOk || (autoPush && !pushOk)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
