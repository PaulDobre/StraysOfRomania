# Strays of Romania

Website for **Strays of Romania**, a nonprofit that **connects and funds a network**
of rescuers, fosterers and partner organisations working to end Romania's
street-dog crisis. The org itself doesn't run shelters or rehome dogs directly —
the hands-on work is done by the network. Per animal, the site's only call to
action is **remote adoption** (a recurring subscription that funds one dog's care);
physical adoption is arranged by partner organisations.

Built with [Hugo](https://gohugo.io/) (extended). Custom theme, no external
dependencies — the design system is hand-written CSS in `assets/css/main.css`.
The site is **multilingual** — see below.

## Run it

```bash
hugo server          # dev server at http://localhost:1313 with live reload
hugo                 # build the static site into ./public
```

Requires Hugo **extended** ≥ 0.164 (`brew install hugo`).

## Design system — "Field Dossier"

The site is styled as an honest, documented field report that warms into action.

- **Palette** (CSS custom properties in `main.css`): warm paper base, deep
  Carpathian pine green, ochre-amber accent, rust reserved for urgent facts.
- **Type:** Newsreader (display serif), IBM Plex Sans (body), IBM Plex Mono
  (labels, stats, dog case-IDs — the signature "field-notes" treatment).
- Fonts load from Google Fonts in `layouts/partials/head.html`. For production,
  consider self-hosting them.

## Editing content

Most page content lives in **front matter** so you can edit it without touching
HTML. Prose sections use Markdown bodies.

| Page | Content file | Template |
|------|--------------|----------|
| Home | `content/_index.md` (all copy in front matter) | `layouts/index.html` |
| The Crisis | `content/crisis/_index.md` (stats, causes, timeline, sources in front matter) | `layouts/crisis/list.html` |
| Our Work | `content/our-work/_index.md` | `layouts/our-work/list.html` |
| Remote Adoption | `content/adopt/_index.md` + `data/dogs/<lang>.yaml` | `layouts/adopt/list.html` |
| Join the Network | `content/get-involved/_index.md` | `layouts/get-involved/list.html` |
| Donate | `content/donate/_index.md` | `layouts/donate/list.html` |
| About | `content/about/_index.md` | `layouts/about/list.html` |
| Transparency | `content/about/transparency.md` | `layouts/_default/single.html` |
| Stories | `content/stories/*.md` | `layouts/_default/{list,single}.html` |
| FAQ | `content/faq/_index.md` | `layouts/faq/list.html` |
| Contact | `content/contact/_index.md` | `layouts/contact/list.html` |

### Dogs & remote adoption

Dog listings are **per language**: `data/dogs/en.yaml`, `data/dogs/de.yaml`, …
(the English list is the fallback for any language without its own). Edit the
relevant file, drop real photos in `static/img/dogs/`, and set each dog's
`photo:` path (e.g. `/img/dogs/luca.jpg`). Dogs without a photo show a styled
placeholder.

**Wiring each dog to your donation platform:** you don't create a separate
product per animal. Set **one** base URL in `config/_default/hugo.toml`:

```toml
remoteAdoptBaseUrl = "https://your-platform.org/remote-adoption"
```

Each dog's "Remotely adopt" button then links to that URL with the animal
attached as query parameters, so every subscription is tagged with the dog:

```
…/remote-adoption?animal=RO-241&name=Luca&amount=15&interval=month
```

Your platform (Donorbox designation/custom field, Stripe Payment Link
`client_reference_id`, GiveWP, etc.) records `animal` so you can reconcile which
dog each subscriber supports. Per-dog overrides: set `monthly:` for a custom
suggested amount, or `subscribe_url:` for a fully custom link on any dog.
The same pattern powers the Donate page via `donateBaseUrl`.

### Site-wide settings

`config/_default/hugo.toml` holds the org email, address, registration number,
social links and the donation-platform URLs. `config/_default/languages.toml`
defines the languages.

## Multilingual

The site ships in **14 languages**: English (default, served at `/`) plus German,
French, Dutch, Spanish, Italian, Romanian, Polish, Portuguese, Swedish, Danish,
Czech, Hungarian and Greek (each served at `/<lang>/`). A language switcher lives
in the header, and every page emits `hreflang` alternates for SEO.

**How translations are organised (English is the source of truth):**

- **UI micro-copy** (buttons, labels, nav, footer, form) → `i18n/<lang>.toml`.
  Translate the values; keep the keys and any `{{ .placeholder }}` tokens.
- **Page content** → a sibling Markdown file per language using a filename
  suffix, e.g. `content/crisis/_index.md` (English) and
  `content/crisis/_index.de.md` (German). Most copy is in front matter.
- **Dog listings** → `data/dogs/<lang>.yaml` (English is the fallback).

To **add a language**: add a block to `config/_default/languages.toml`, then
create `i18n/<lang>.toml`, `data/dogs/<lang>.yaml`, and the `*.<lang>.md`
content files. To **remove** one, delete its block and files.

> ⚠️ The non-English translations were AI-generated. Have a **native speaker
> review** each language before launch — especially the factual Crisis page.

## Editing in the browser — Sveltia CMS

The site ships with [Sveltia CMS](https://sveltiacms.app) — a free, self-hosted,
Git-based editor — at **`/admin/`** (`static/admin/index.html` + `config.yml`).
Editors get a friendly UI; every save is a Git commit.

**It's wired to the multilingual layout.** The config uses
`i18n.structure: multiple_files` with `omit_default_locale_from_file_path: true`,
which maps exactly onto Hugo's convention (English `_index.md`, others
`_index.de.md`). No content restructuring was needed. What's editable:

- **Pages** — every page's fields (home, crisis, our work, remote adoption, get
  involved, donate, about, transparency, FAQ, contact + the stories intro), each
  translatable per locale side-by-side.
- **Stories** — a folder collection; editors add/translate posts.
- **Adoptable dogs** — one list per language (`data/dogs/<lang>.yaml`, now keyed
  under `dogs:`). Add/edit/remove dogs and upload photos.

**What stays developer-edited** (by design): the UI micro-copy in `i18n/*.toml`
(button and label strings — they rarely change and would add 60 keys × 14 locales
of noise) and `config/_default/*.toml`.

### To make it work you must:

1. **Set your repo** — edit `backend.repo` in `static/admin/config.yml` to your
   GitHub `owner/repo` (and `branch` if not `main`).
2. **Enable auth** — the simplest path is to install the **Sveltia CMS
   Authentication** GitHub App on the repo (no server to run). Alternatively use
   your own GitHub OAuth app / Cloudflare Worker. See the Sveltia docs.
3. **Edit locally without deploying** (optional) — `config.yml` sets
   `local_backend: true`; run `npx @sveltia/cms-proxy-server` alongside
   `hugo server`, then open `http://localhost:1313/admin/`.

> The dog `photo` field uploads into `static/img/dogs/` and stores `/img/dogs/…`
> paths, matching the templates.

## ⚠️ Before you launch — replace the placeholders

This is a complete, working scaffold with **illustrative** content. Swap in real
data before going live:

- [ ] Real org details in `config/_default/hugo.toml` (email, phone, address, **registration/CIF number**, social URLs)
- [ ] **`remoteAdoptBaseUrl` + `donateBaseUrl`** in `config/_default/hugo.toml` → your real donation-platform URLs
- [ ] Real impact numbers on the home page (`content/_index.md`) and `content/about/transparency.md`
- [ ] Real founding story + team in `content/about/_index.md`
- [ ] Real **partner list + vetting criteria** (referenced in the FAQ and About)
- [ ] Real dogs + photos + carers in `data/dogs/*.yaml`
- [ ] Real rescue stories in `content/stories/`
- [ ] **Native-speaker review** of all non-English translations
- [ ] **CMS:** set `backend.repo` in `static/admin/config.yml` + enable Sveltia auth (GitHub App)
- [ ] **Donation platform**: confirm the base URLs resolve and your platform reads the `animal` / `amount` / `interval` params
- [ ] **Contact form**: point the form `action` in `layouts/contact/list.html` at your backend (Formspree, Netlify Forms, etc.)
- [ ] Add real photography throughout (hero, story headers)

All facts about the crisis are sourced and flagged where estimates vary; keep the
"estimate/as of year" framing if you edit them.

## Deploy

Any static host works. `hugo` outputs to `./public`. Good options: Netlify,
Cloudflare Pages, GitHub Pages. Set the production `baseURL` in
`config/_default/hugo.toml`.
