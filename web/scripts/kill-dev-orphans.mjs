#!/usr/bin/env node
/**
 * Kill orphaned Next.js/Turbopack dev worker processes belonging to THIS repo.
 *
 * Why this exists
 * ---------------
 * On Windows, killing the `next dev` parent does not reap its child worker
 * processes (postcss / turbopack build workers under `web/.next/`). They become
 * orphans and sit there consuming CPU and memory. A misconfigured project root
 * once caused every CSS compile to fail and leak one worker each — 762 orphaned
 * node processes accumulated in a single day and made the whole machine laggy.
 *
 * Safety
 * ------
 * This ONLY targets processes whose command line contains this repository's
 * `web/.next` path. That path is unique to dev-server build workers, so it can
 * never match your editor, Claude Code, an unrelated project, or a shell. It
 * also refuses to kill its own PID. It never does a blanket "kill all node".
 *
 * Usage:  node scripts/kill-dev-orphans.mjs [--dry-run]
 *         npm run kill-orphans
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
// Unique marker: only dev-server build workers reference this path.
const marker = path.join(webDir, ".next");
const dryRun = process.argv.includes("--dry-run");

/** @returns {{pid: number, cmd: string}[]} */
function listNodeProcesses() {
  if (process.platform === "win32") {
    // CSV avoids CommandLine truncation that Format-Table would introduce.
    const ps =
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
      "Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation";
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", ps],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    return out
      .split(/\r?\n/)
      .slice(1) // drop CSV header
      .map((line) => {
        const m = line.match(/^"(\d+)","?([\s\S]*?)"?$/);
        if (!m) return null;
        return { pid: Number(m[1]), cmd: m[2] ?? "" };
      })
      .filter((p) => p !== null);
  }

  const out = execFileSync("ps", ["-eo", "pid=,args="], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\n")
    .map((line) => {
      const m = line.trim().match(/^(\d+)\s+([\s\S]*)$/);
      if (!m) return null;
      return { pid: Number(m[1]), cmd: m[2] };
    })
    .filter((p) => p !== null && p.cmd.includes("node"));
}

let procs;
try {
  procs = listNodeProcesses();
} catch (err) {
  console.error("[kill-dev-orphans] could not list processes:", err.message);
  process.exit(0); // never fail a build/hook because of cleanup
}

const targets = procs.filter(
  (p) => p.pid !== process.pid && p.cmd.includes(marker),
);

if (targets.length === 0) {
  console.log("[kill-dev-orphans] no leftover dev workers found.");
  process.exit(0);
}

if (dryRun) {
  console.log(`[kill-dev-orphans] would kill ${targets.length} process(es):`);
  for (const t of targets) console.log(`  pid ${t.pid}`);
  process.exit(0);
}

let killed = 0;
for (const t of targets) {
  try {
    process.kill(t.pid, "SIGKILL");
    killed++;
  } catch {
    // already gone, or not ours to kill — ignore
  }
}
console.log(`[kill-dev-orphans] cleaned up ${killed} leftover dev worker(s).`);
