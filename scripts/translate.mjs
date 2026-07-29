// Auto-translate changed English source into the site's other languages.
//
// English is the source of truth. This script NEVER writes the default
// language — it only reads it and writes the 13 translations. The default
// language is read from config/_default/hugo.toml (defaultContentLanguage),
// and the target languages from config/_default/languages.toml. Nothing is
// hardcoded to "en".
//
// What it translates (three source shapes, English → each target):
//   content/**/*.md   (no lang suffix)  →  the same file with a .<lang>.md suffix
//   i18n/en.toml                        →  i18n/<lang>.toml
//   data/dogs/en.yaml                   →  data/dogs/<lang>.yaml
//
// It only (re)translates a target when the ENGLISH SOURCE has changed since the
// last run, or when the target file is missing. Change tracking uses a content
// hash recorded in .translation-manifest.json. On the very first run (no prior
// entry for a source) it does NOT overwrite existing translations — it only
// fills in missing ones and records a baseline, so hand-polished translations
// are preserved until the English actually changes.
//
// Usage:
//   ANTHROPIC_API_KEY=... node scripts/translate.mjs
//   TRANSLATE_MODEL=claude-sonnet-5 node scripts/translate.mjs   # cheaper
//   node scripts/translate.mjs --dry-run                          # plan only
//
// Requires Node 20+ and @anthropic-ai/sdk.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
// @anthropic-ai/sdk is imported lazily, only when there is something to
// translate — so --dry-run and up-to-date runs need no dependencies installed.

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, ".translation-manifest.json");
const MODEL = process.env.TRANSLATE_MODEL || "claude-opus-4-8";
const CONCURRENCY = Number(process.env.TRANSLATE_CONCURRENCY || 3);
const MAX_TOKENS = 8192;
const DRY_RUN = process.argv.includes("--dry-run");

// English display names for the target languages (regional hints where useful).
const LANG_NAMES = {
  en: "English",
  de: "German",
  fr: "French",
  nl: "Dutch",
  es: "Spanish",
  it: "Italian",
  ro: "Romanian",
  pl: "Polish",
  pt: "Portuguese (European, pt-PT)",
  sv: "Swedish",
  da: "Danish",
  cs: "Czech",
  hu: "Hungarian",
  el: "Greek",
};

// ---- config parsing -------------------------------------------------------

function readDefaultLang() {
  const toml = fs.readFileSync(path.join(ROOT, "config/_default/hugo.toml"), "utf8");
  const m = toml.match(/defaultContentLanguage\s*=\s*"([^"]+)"/);
  return m ? m[1] : "en";
}

function readLanguageCodes() {
  const toml = fs.readFileSync(path.join(ROOT, "config/_default/languages.toml"), "utf8");
  const codes = [];
  const re = /^\s*\[([a-z]{2}(?:-[A-Za-z]{2})?)\]/gm;
  let m;
  while ((m = re.exec(toml))) codes.push(m[1]);
  return codes;
}

// ---- source discovery -----------------------------------------------------

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

// Recursively list files under a directory relative to ROOT (posix separators).
function listFiles(relDir) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.posix.join(relDir, path.relative(abs, path.join(d.parentPath ?? d.path, d.name)).split(path.sep).join("/")));
}

// Build the list of { rel, kind, targets: [{ lang, rel }] } source entries.
function collectSources(defaultLang, allLangs, targetLangs) {
  const langSet = new Set(allLangs); // includes the default
  const sources = [];

  // 1) content/**/*.md that carry NO language suffix (English source pages).
  for (const rel of listFiles("content")) {
    if (!rel.endsWith(".md")) continue;
    const base = rel.slice(0, -".md".length); // e.g. content/crisis/_index.de
    const seg = base.split("/").pop().split(".").pop(); // last dotted segment of filename
    if (langSet.has(seg)) continue; // has a lang suffix → it's a translation, skip
    sources.push({
      rel,
      kind: "markdown",
      targets: targetLangs.map((lang) => ({ lang, rel: `${base}.${lang}.md` })),
    });
  }

  // 2) i18n/<default>.toml → i18n/<lang>.toml
  const i18nSrc = `i18n/${defaultLang}.toml`;
  if (fs.existsSync(path.join(ROOT, i18nSrc))) {
    sources.push({
      rel: i18nSrc,
      kind: "toml",
      targets: targetLangs.map((lang) => ({ lang, rel: `i18n/${lang}.toml` })),
    });
  }

  // 3) data/dogs/<default>.yaml → data/dogs/<lang>.yaml
  const dogsSrc = `data/dogs/${defaultLang}.yaml`;
  if (fs.existsSync(path.join(ROOT, dogsSrc))) {
    sources.push({
      rel: dogsSrc,
      kind: "yaml",
      targets: targetLangs.map((lang) => ({ lang, rel: `data/dogs/${lang}.yaml` })),
    });
  }

  return sources;
}

// ---- translation ----------------------------------------------------------

const KIND_LABEL = {
  markdown: "a Hugo content page: Markdown with a YAML front-matter block delimited by --- lines",
  toml: "a Hugo i18n translation table in TOML",
  yaml: "a Hugo data file in YAML",
};

function systemPrompt(langName, kind) {
  return `You are a professional localization translator for the website of "Strays of Romania", a nonprofit that funds and connects a network of rescuers ending Romania's street-dog crisis. Translate the file the user sends from English into ${langName}.

The file is ${KIND_LABEL[kind]}.

STRICT RULES — follow every one:
1. Output ONLY the translated file content. No explanations, no commentary, and NO Markdown code fences.
2. Translate human-readable text values only. Keep the file's structure and syntax byte-for-byte identical apart from the translated text.
3. Never translate or alter any of these — copy them through unchanged:
   - Keys / field names (everything to the left of ":" or "=").
   - URLs, file paths, and link/href target values (e.g. "adopt/", "/img/dogs/luca.jpg").
   - Hugo/template tokens and shortcodes such as {{ .Placeholder }} and {{< ... >}}.
   - HTML tags, email addresses, and identifiers/codes (e.g. RO-241).
   - Developer comment lines (starting with #) — leave them exactly as written.
   - Proper nouns: "Strays of Romania", "Four Paws", "Ceaușescu", "EU", and any person or dog name (e.g. Luca, Mara).
4. Keep all delimiters, indentation, and layout identical — including the --- front-matter fences in Markdown, and TOML/YAML structure. Preserve Markdown formatting (**, links, lists).
5. Geographic names may use the conventional ${langName} exonym where one exists (e.g. Bucharest).
6. Adapt number, date, and currency formatting to ${langName} conventions where it reads naturally (e.g. thousands separators like 500,000 → 500.000), but never change the actual numeric values or currency symbols.
7. Produce fluent, natural ${langName} that matches the source's warm, direct, factual nonprofit tone.`;
}

function stripFences(s) {
  let t = s.trim();
  const m = t.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  if (m) t = m[1];
  if (!t.endsWith("\n")) t += "\n";
  return t;
}

async function translateFile(client, content, langName, kind) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt(langName, kind),
    messages: [{ role: "user", content }],
  });
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return stripFences(text);
}

// ---- a tiny concurrency pool ----------------------------------------------

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

// ---- main -----------------------------------------------------------------

async function main() {
  const defaultLang = readDefaultLang();
  const allLangs = readLanguageCodes();
  const targetLangs = allLangs.filter((l) => l !== defaultLang);

  if (targetLangs.length === 0) {
    console.log("No target languages configured. Nothing to do.");
    return;
  }
  console.log(`Default (source) language: ${defaultLang}`);
  console.log(`Target languages: ${targetLangs.join(", ")}`);
  console.log(`Model: ${MODEL}\n`);

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
    : {};
  const nextManifest = { ...manifest };

  const sources = collectSources(defaultLang, allLangs, targetLangs);

  // Decide which (source → target) pairs need translating.
  const tasks = [];
  for (const src of sources) {
    const content = fs.readFileSync(path.join(ROOT, src.rel), "utf8");
    const hash = sha256(content);
    src._content = content;
    src._hash = hash;
    const known = Object.prototype.hasOwnProperty.call(manifest, src.rel);
    const changed = known && manifest[src.rel] !== hash;
    src._failed = false;

    for (const t of src.targets) {
      const missing = !fs.existsSync(path.join(ROOT, t.rel));
      if (changed || missing) {
        tasks.push({ src, target: t, reason: missing ? "missing" : "source changed" });
      }
    }
    // Bootstrap (unknown source with all targets present): record baseline now.
    if (!known && !src.targets.some((t) => !fs.existsSync(path.join(ROOT, t.rel)))) {
      nextManifest[src.rel] = hash;
    }
  }

  if (tasks.length === 0) {
    console.log("Everything is up to date — no translations needed.");
  } else {
    console.log(`${tasks.length} file(s) to translate:`);
    for (const t of tasks) console.log(`  ${t.target.rel}  (${t.reason})`);
    console.log("");
  }

  if (DRY_RUN) {
    console.log("--dry-run: not calling the API or writing files.");
    return;
  }

  if (tasks.length > 0) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    // maxRetries rides out transient 429/5xx/529 (overloaded) with the SDK's
    // exponential backoff, so a momentary API spike doesn't fail the run.
    const client = new Anthropic({ maxRetries: 8 }); // reads ANTHROPIC_API_KEY from env
    await pool(tasks, CONCURRENCY, async ({ src, target }) => {
      try {
        const out = await translateFile(client, src._content, LANG_NAMES[target.lang] || target.lang, src.kind);
        fs.writeFileSync(path.join(ROOT, target.rel), out);
        console.log(`  ✓ ${target.rel}`);
      } catch (err) {
        src._failed = true;
        console.error(`  ✗ ${target.rel} — ${err.message || err}`);
      }
    });
  }

  // Record the source hash only when every target for it is present and none failed,
  // so a failed or interrupted source retries on the next run.
  for (const src of sources) {
    const allPresent = !src.targets.some((t) => !fs.existsSync(path.join(ROOT, t.rel)));
    if (!src._failed && allPresent) nextManifest[src.rel] = src._hash;
  }

  // Sort keys so the manifest is byte-stable regardless of directory-walk order
  // (macOS vs Linux differ), avoiding spurious diffs.
  const sorted = Object.fromEntries(Object.keys(nextManifest).sort().map((k) => [k, nextManifest[k]]));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n");
  console.log("\nUpdated .translation-manifest.json");

  const anyFailed = sources.some((s) => s._failed);
  if (anyFailed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
