#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compressionPhaseVector, cpsDistance, clusterCpsVectors, basinConsistencyMap } from "../runtime/compression-phase-space.js";
import { representativeEntropy, withinClassGeometry, unifiedQuotientInvariant } from "../runtime/quotient-space.js";

const cwd = process.cwd();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const [key, inline] = token.slice(2).split("=");
      if (inline !== undefined) {
        flags[key] = inline;
      } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      args.push(token);
    }
  }
  return { args, flags };
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonl(file) {
  return fs.readFileSync(file, "utf8").trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
}

function runNodeScript(scriptPath) {
  const result = spawnSync("node", [scriptPath], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `failed: ${scriptPath}`);
  return JSON.parse(result.stdout);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const [command, subcommand] = process.argv.slice(2);
  const { args, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === "--help" || command === "-h") {
    print({
      commands: ["run", "bench", "stress", "cps", "cluster", "compare", "basin", "trace", "export"]
    });
    return;
  }

  if (command === "run") {
    const root = flags.root ?? "unknown-root";
    const query = flags.query ?? "{}";
    print({ root, query, note: "run execution is wired through benchmarks and bridge modules" });
    return;
  }

  if (command === "bench") {
    const suite = flags.suite ?? "kcr-stress";
    if (suite === "kcr-stress") {
      const output = runNodeScript(path.join(__dirname, "..", "benchmarks", "kcr-stress", "index.js"));
      print({ suite, dataset: output });
      return;
    }
    throw new Error(`Unknown suite: ${suite}`);
  }

  if (command === "stress") {
    const output = runNodeScript(path.join(__dirname, "..", "benchmarks", "kcr-stress", "index.js"));
    print(output);
    return;
  }

  if (command === "cps") {
    const input = flags.input;
    if (!input) throw new Error("--input is required");
    const rows = input.endsWith(".jsonl") ? readJsonl(input) : [loadJson(input)];
    print(rows.map((row) => compressionPhaseVector(row)));
    return;
  }

  if (command === "cluster") {
    const input = flags.input;
    if (!input) throw new Error("--input is required");
    const vectors = readJsonl(input).map((row) => compressionPhaseVector(row));
    print({ method: flags.method ?? "simple", threshold: Number(flags.threshold ?? 10), basins: clusterCpsVectors(vectors, Number(flags.threshold ?? 10)) });
    return;
  }

  if (command === "compare") {
    const leftPath = args[1];
    const rightPath = args[2];
    if (!leftPath || !rightPath) throw new Error("compare requires two inputs");
    const left = compressionPhaseVector(loadJson(leftPath));
    const right = compressionPhaseVector(loadJson(rightPath));
    const geometry = withinClassGeometry([left, right]);
    const hRep = representativeEntropy([left, right]);
    const kcr = Math.max(left.KCR_Q, right.KCR_Q);
    const uQ = unifiedQuotientInvariant({ kcr, representativeEntropy: hRep, geometry });
    const basins = clusterCpsVectors([left, right], Number(flags.threshold ?? 10));
    print({
      cpsDistance: cpsDistance(left, right),
      sameBasinProbability: 1 / (1 + cpsDistance(left, right)),
      divergence: { H_rep: hRep, G_Q: geometry, KCR_delta: Math.abs(left.KCR_Q - right.KCR_Q), U_Q: uQ },
      basinConsistency: basinConsistencyMap(basins)
    });
    return;
  }

  if (command === "basin") {
    const input = flags.input;
    const id = Number(flags.id ?? 0);
    if (!input) throw new Error("--input is required");
    const vectors = readJsonl(input).map((row) => compressionPhaseVector(row));
    const basins = clusterCpsVectors(vectors, Number(flags.threshold ?? 10));
    print(basins[id] ?? null);
    return;
  }

  if (command === "trace") {
    const input = flags.input;
    if (!input) throw new Error("--input is required");
    const data = loadJson(input);
    print(data.trajectory ?? data);
    return;
  }

  if (command === "export") {
    const input = flags.input;
    const format = flags.format ?? "jsonl";
    if (!input) throw new Error("--input is required");
    const data = runNodeScript(path.join(__dirname, "..", "benchmarks", "kcr-stress", "index.js"));
    if (format === "jsonl") {
      const vectors = [compressionPhaseVector(data.forward), compressionPhaseVector(data.reverse)];
      process.stdout.write(`${vectors.map((row) => JSON.stringify(row)).join("\n")}\n`);
      return;
    }
    print(data);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
