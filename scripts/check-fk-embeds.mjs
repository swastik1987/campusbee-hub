#!/usr/bin/env node
/**
 * FK-disambiguation guard for PostgREST embeds.
 *
 * Background (see CLAUDE.md § Data Fetching):
 *   When a table has more than one FK pointing at the same target — e.g.
 *   enrollments.batch_id and enrollments.pending_switch_to_batch_id both
 *   FK to batches (migration 029_learner_drop_and_switch.sql) — a bare
 *   `batches(...)` embed throws "Could not embed because more than one
 *   relationship was found" and returns zero rows silently. The fix is
 *   to spell the FK column: `batches!batch_id(...)`.
 *
 * This script scans `.select(\`...\`)` template literals in src/ and
 * flags every `batches(` whose parent embed is `enrollments` — either
 * because the chain starts at `.from("enrollments")` or because the
 * batches embed is nested inside an `enrollments(...)` embed.
 *
 * Each flagged `batches(` must instead be qualified as
 * `batches!batch_id(` or `batches!pending_switch_to_batch_id(`.
 *
 * Exit codes: 0 clean, 1 violations found.
 *
 * Add new (parent → ambiguous embed) pairs to AMBIGUOUS_EMBEDS whenever
 * a new FK pair to a popular target is added.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../..");
const srcRoot = join(repoRoot, "src");

/**
 * Each entry: when the parent of an `embed(` is `parent` (either as the
 * `.from()` source or as an enclosing `parent(...)` embed), the embed
 * must be qualified with one of the allowed FK columns.
 */
const AMBIGUOUS_EMBEDS = [
  {
    parent: "enrollments",
    embed: "batches",
    allowedQualifiers: ["batch_id", "pending_switch_to_batch_id"],
  },
];

const EXTS = new Set([".ts", ".tsx"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(full, acc);
    } else if (EXTS.has(full.slice(full.lastIndexOf(".")))) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Returns [{ source, template, offsetInFile }] — every backtick-delimited
 * `.select(\`...\`)` template literal in the file, along with the nearest
 * preceding `.from("X")` source (null if none).
 */
function findSelectTemplates(text) {
  const results = [];
  const re = /\.select\(`([\s\S]*?)`\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const upto = text.slice(0, m.index);
    const fromRe = /\.from\(\s*["'](\w+)["']\s*\)/g;
    let lastFrom = null;
    let fm;
    while ((fm = fromRe.exec(upto)) !== null) lastFrom = fm[1];
    // Offset to the first char of the template literal (after the opening backtick).
    const templateOffset = m.index + m[0].indexOf("`") + 1;
    results.push({ source: lastFrom, template: m[1], offset: templateOffset });
  }
  return results;
}

/**
 * Returns offsets (within the template) of every bare `embed(` that's
 * parented by `parent` — either because the template's source is `parent`
 * or because the `embed(` is nested inside a `parent(...)` embed in the
 * template.
 *
 * "Bare" = not qualified by `embed!<col>(`.
 */
function findBareEmbedViolations(template, source, parent, embed) {
  const violations = new Set();
  const embedRe = new RegExp(String.raw`\b${embed}\(`, "g");

  const flag = (start) => {
    // Skip if preceded by `!<word>` (= already qualified, e.g. `batches!batch_id(`).
    // Our regex \b${embed}\( matches `embed(` literally — if qualified, the char
    // before `(` would be the qualifier identifier, not `embed`, so the match wouldn't
    // happen. So every match here is bare by construction. But also skip identifier
    // suffix false positives like `my_batches(`.
    if (start > 0) {
      const prev = template[start - 1];
      if (/[A-Za-z0-9_]/.test(prev)) return;
    }
    violations.add(start);
  };

  if (source === parent) {
    let m;
    while ((m = embedRe.exec(template)) !== null) flag(m.index);
  }

  // Nested case: scan for `parent(` and walk paren-matched to its close.
  const parentRe = new RegExp(String.raw`\b${parent}\(`, "g");
  let pm;
  while ((pm = parentRe.exec(template)) !== null) {
    // Skip identifier-suffix false positives.
    if (pm.index > 0 && /[A-Za-z0-9_]/.test(template[pm.index - 1])) continue;
    const inner = pm.index + pm[0].length;
    let depth = 1;
    let i = inner;
    while (i < template.length && depth > 0) {
      const c = template[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (depth > 0) i++;
    }
    const innerEnd = i; // template[inner..innerEnd] is the parent's inside
    const sub = template.slice(inner, innerEnd);
    embedRe.lastIndex = 0;
    let m;
    while ((m = embedRe.exec(sub)) !== null) {
      // Translate offset back to template coords.
      const absStart = inner + m.index;
      flag(absStart);
    }
  }

  return [...violations].sort((a, b) => a - b);
}

function offsetToLine(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

function main() {
  const files = walk(srcRoot);
  const allViolations = [];

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const selects = findSelectTemplates(text);
    for (const { source, template, offset } of selects) {
      for (const rule of AMBIGUOUS_EMBEDS) {
        const offs = findBareEmbedViolations(template, source, rule.parent, rule.embed);
        for (const o of offs) {
          const absOffset = offset + o;
          const line = offsetToLine(text, absOffset);
          // Get the snippet (single line).
          const lineStart = text.lastIndexOf("\n", absOffset - 1) + 1;
          const lineEnd = text.indexOf("\n", absOffset);
          const snippet = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim();
          allViolations.push({ file: relative(repoRoot, file), line, snippet, rule });
        }
      }
    }
  }

  if (allViolations.length === 0) {
    console.log("✓ check-fk-embeds: no bare ambiguous embeds found.");
    process.exit(0);
  }

  console.error(
    `✗ check-fk-embeds: found ${allViolations.length} bare PostgREST embed(s) on a multi-FK target.\n`,
  );
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.snippet}`);
    console.error(
      `    Use \`${v.rule.embed}!${v.rule.allowedQualifiers[0]}(\` (allowed FK columns: ${v.rule.allowedQualifiers.join(", ")}).\n`,
    );
  }
  console.error("See CLAUDE.md § Data Fetching for the PostgREST FK-disambiguation pattern.");
  process.exit(1);
}

main();
