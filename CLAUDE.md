# CLAUDE.md

Orientation for agents working in this repo. `README.md` has the full human-facing docs — read it for depth; this file is the fast map + the non-obvious rules.

## What this is

Marketing/informational website for **Strays of Romania**, a nonprofit that *funds and connects a network* of rescuers, fosterers and partner shelters ending Romania's street-dog crisis. The org does not run shelters or rehome dogs directly. Per-animal call to action is **remote adoption** (a recurring subscription that funds one dog's care); physical adoption is handled by partners.

Static site built with **Hugo (extended) ≥ 0.164**. Hand-written theme — no JS framework, no external build. The design system is bespoke CSS in `assets/css/main.css` ("Field Dossier": warm paper, Carpathian pine green, ochre accent; Newsreader serif + IBM Plex Sans/Mono).

## Commands

```bash
hugo server          # dev server at http://localhost:1313 (live reload)
hugo                 # build static site into ./public
npm run translate    # regenerate translations for changed English (needs ANTHROPIC_API_KEY)
npm run translate:dry # preview what translation would do, no API calls
```

There are no unit tests. To verify a change, run `hugo server` (or `hugo`) and check it builds clean.

## Layout

- `content/**` — page content, **mostly in YAML front matter** (edit copy without touching HTML). Prose sections use Markdown bodies. One file per page; see the page→file→template table in README.
- `layouts/` — templates. Per-section `list.html` under `layouts/<section>/`, `index.html` for home, shared bits in `layouts/partials/`, base in `layouts/_default/`.
- `i18n/<lang>.toml` — UI micro-copy (buttons, nav, labels). Keys + `{{ .placeholder }}` tokens; translate values only.
- `data/dogs/<lang>.yaml` — adoptable-dog listings (English is the fallback). Keyed under `dogs:`.
- `config/_default/hugo.toml` — org details, donation base URLs (`params.remoteAdoptBaseUrl`, `params.donateBaseUrl`), `baseURL`. `languages.toml` — the 14 language blocks.
- `static/admin/` — Sveltia CMS (Git-based browser editor at `/admin/`).
- `scripts/translate.mjs` + `.github/workflows/translate.yml` — auto-translation (below).

## Multilingual — English is the source of truth

14 languages: English (default, served at `/`) + de, fr, nl, es, it, ro, pl, pt, sv, da, cs, hu, el (served at `/<lang>/`). The default language is read from `defaultContentLanguage` in `hugo.toml` — never hardcode "en".

File conventions (English has **no** suffix; other langs are siblings):
- Content: `content/x/_index.md` (English) → `content/x/_index.de.md` (German)
- i18n: `i18n/en.toml` → `i18n/de.toml`
- Dogs: `data/dogs/en.yaml` → `data/dogs/de.yaml`

## Auto-translation (important)

Editing **English** content and pushing to `main` triggers `.github/workflows/translate.yml`, which regenerates the other 12 languages via the Claude API and **opens a review PR** (branch `chore/auto-translations`). English is never overwritten.

Rules to respect when touching this system:
- A language is only regenerated when its **English source changes** (content-hash tracked in `.translation-manifest.json`, keys kept sorted for cross-platform stability) **or** a target file is missing. So **hand-polished translations persist** until the English changes — don't assume editing a `.de.md` directly will survive; it will, until that page's English is edited, at which point the PR overwrites it.
- It re-translates the **whole file** on any change, so a one-field English edit can slightly reword other fields in the PR. That's what PR review is for.
- Already configured (not in the repo): the `ANTHROPIC_API_KEY` Actions secret, and the "Allow GitHub Actions to create and approve pull requests" repo setting (off by default — was enabled).
- Default model `claude-opus-4-8`; `TRANSLATE_MODEL=claude-sonnet-5` cuts cost ~⅔.
- Don't commit `package-lock.json` or `node_modules/` (gitignored — CI regenerates the lock).

## Conventions & gotchas

- Prefer editing **front matter** over templates for copy changes.
- Facts on the Crisis page are sourced and use "estimate / as of year" framing — keep that framing if editing them (see the `romania-stray-dog-facts` memory).
- The site ships with **illustrative placeholder** content (impact numbers, dogs, stories, org details). See the "Before you launch" checklist in README before treating anything as real.
- Non-English translations are AI-generated and need native-speaker review before launch.
- Deploy: any static host; `hugo` → `./public`; set production `baseURL` in `hugo.toml`.
