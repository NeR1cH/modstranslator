# CLAUDE.md — modstranslator

Behavioral guidelines + project context for AI-assisted development.
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## Project Overview

**MOD_TRANSLATOR** — Next.js 14 web app for translating Minecraft mods and modpacks (EN → RU) via DeepL API.
Users drag-and-drop a `.jar` / `.zip` / `.lang` / `.json` / `.snbt` file, the app translates it, and returns the result for download. No backend storage — all processing is in-memory or via temp files.

**Current version:** 3.21.0 | **Status:** Production Ready

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| UI | React 18 + Tailwind CSS |
| Archive processing | JSZip |
| Translation API | DeepL API (via `node-fetch`) |
| Unit tests | Jest 30 (260 tests, ~75% coverage) |
| E2E tests | Playwright |
| CI | GitHub Actions (`.github/workflows/build.yml`) |

---

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run dev:safe         # Run tests first, then start server
npm run dev:clean        # Kill port 3000-3003, then start (Windows)
npm run build            # Production build
npm test                 # Run all unit tests (Jest)
npm run test:watch       # Tests in watch mode
npm run test:coverage    # Tests with coverage report
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright with UI
scripts\dev-menu.bat     # Interactive menu (Windows, recommended)
```

Node.js **v18+** required.

---

## Project Structure

```
modstranslator/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Main UI (~31KB — monolithic, intentional)
│   ├── layout.tsx              # Root layout
│   ├── globals.css
│   └── api/                   # API routes (Next.js Route Handlers)
│       ├── analyze/            # POST — analyze file, return string count
│       ├── translate/          # POST — translate (small files, base64)
│       ├── translate-stream/   # POST — translate with SSE progress stream
│       ├── upload-stream/      # POST — chunked upload for files >800MB
│       ├── process-upload/     # POST — process temp file after stream upload
│       ├── download-result/    # GET  — download translated file
│       ├── download-single/    # GET  — download single file from queue
│       ├── export/             # POST — export multiple files as ZIP
│       ├── cache-stats/        # GET  — translation cache statistics
│       ├── fragment-stats/     # GET  — fragment cache statistics
│       └── usage/              # GET  — DeepL API usage stats
│
├── components/                 # React UI components
│   ├── DropZone.tsx            # File drag-and-drop
│   ├── FileQueue.tsx           # Batch file queue
│   ├── ProgressBar.tsx         # Translation progress
│   ├── TerminalLog.tsx         # Real-time log output
│   ├── TranslationReportViewer.tsx  # Per-file translation report
│   ├── HistoryPanel.tsx        # Translation history (localStorage)
│   ├── CacheIndicator.tsx      # Cache hit/miss stats
│   └── UsageIndicator.tsx      # DeepL API usage display
│
├── lib/                        # Core business logic
│   ├── langParsers.ts          # Parse/serialize 11 file formats
│   ├── jarProcessor.ts         # JAR extraction → translate → repack
│   ├── modpackProcessor.ts     # ZIP modpack: scan → translate JARs + lang files
│   ├── deepl.ts                # DeepL API client (batching, retries, rate limit)
│   ├── translationCache.ts     # In-memory translation cache (key=hash)
│   ├── fragmentCache.ts        # Fragment cache (material names, item types)
│   ├── translationReport.ts    # Build per-file translation reports
│   ├── translationHistory.ts   # History tracking
│   ├── rateLimiter.ts          # 20 req/min rate limiter
│   ├── security.ts             # CSRF, path traversal, prototype pollution guards
│   └── queueLimits.ts          # Max queue/file size limits
│
├── types/
│   └── index.ts                # Shared TypeScript types
│
├── __tests__/lib/              # Unit tests (mirror lib/ structure)
│   ├── langParsers.test.ts
│   ├── jarProcessor.test.ts
│   ├── modpackProcessor.test.ts
│   ├── deepl.test.ts
│   ├── translationCache.test.ts
│   ├── fragmentCache.test.ts
│   ├── rateLimiter.test.ts
│   ├── security.test.ts
│   ├── translationHistory.test.ts
│   └── queueLimits.test.ts
│
├── docs/
│   ├── SESSION_STATE.md        # Current project state — READ FIRST when resuming
│   ├── ROADMAP.md
│   ├── CHANGELOG.md
│   └── reports/
│
├── scripts/                    # Windows .bat helpers
├── middleware.ts               # Next.js middleware (security headers, rate limit)
└── next.config.js              # Max file size: 1.5GB body limit
```

---

## Domain Rules (Critical)

These rules are non-negotiable for translation correctness:

### Never translate
- Translation **keys** — only values. Example: `"item.sword.name": "Sword"` → translate `"Sword"`, not `"item.sword.name"`.
- File paths, IDs, mod names used as identifiers.
- Already-Russian content — files matching `ru_ru`, `/ru/` in path are **skipped entirely** (see `modpackProcessor.ts`).

### Always preserve format codes
| Code type | Examples | Why |
|-----------|---------|-----|
| Minecraft color/format codes | `§6`, `§a`, `§l`, `§r` | In-game text formatting |
| Java-style placeholders | `%s`, `%d`, `%1$s` | Runtime string substitution |
| Numbered placeholders | `{0}`, `{1}` | Used by some mod frameworks |
| Named placeholders | `%(name)s` | Python-style, some mods |
| Escape sequences | `\n`, `\t` | Embedded newlines/tabs |

DeepL sometimes corrupts these — `deepl.ts` wraps placeholders before sending and unwraps after.

### Supported file formats
| Extension | MC version | Notes |
|-----------|-----------|-------|
| `.jar` | 1.13+ | Look for `assets/*/lang/en_us.json` → add `ru_ru.json` |
| `.jar` | < 1.13 | Look for `assets/*/lang/en_US.lang` → add `ru_ru.lang` |
| `.zip` | any | Modpack — scan all, translate JARs + lang files inside |
| `.json` | any | Flat or nested (Patchouli books, quests) |
| `.lang` | any | `key=value` per line |
| `.snbt` | any | FTB Quests / Better Questing |
| `.toml`, `.cfg`, `.xml`, `.properties`, `.txt` | any | Parsed by format-specific strategies in `langParsers.ts` |

### What gets skipped in modpacks
- Binary files: `.class`, `.png`, `.jpg`, `.ogg`, `.mp3`, etc.
- Nested ZIPs inside ZIP (but **not** nested JARs — those ARE processed)
- System folders: `META-INF`, `node_modules`, `.git`
- Files with < 2 chars or no Latin text

---

## Architecture Notes

### Translation flow for a JAR file
```
Upload → analyze/route.ts → jarProcessor.extractLangFiles()
       → deepl.translateBatch() → cache check first
       → jarProcessor.packTranslations() → download
```

### Translation flow for a modpack ZIP
```
Upload → modpackProcessor.processModpack()
       → for each .jar found: jarProcessor (same as above)
       → for each lang file found: langParsers → deepl
       → repack ZIP → download
```

### Large file flow (> ~800MB)
```
upload-stream/route.ts → chunked POST → temp file on disk
→ process-upload/route.ts → same pipeline as above
→ translate-stream/route.ts → Server-Sent Events for progress
```

### Caching
Two independent caches, both in-memory (reset on server restart):
- **`translationCache`** — keyed by `hash(original_string + targetLang)`. Cache hit = skip DeepL call entirely.
- **`fragmentCache`** — splits strings into fragments (material names, item type suffixes). Reuses fragment translations across entries.

---

## Key Invariants (Do Not Break)

- `lib/modpackProcessor.ts` — MUST skip `ru_ru` / `/ru/` paths, otherwise Russian files get overwritten with garbage.
- `lib/langParsers.ts` SNBT regex — must use `[A-Za-z0-9]+` (not just `[A-F0-9]+`) for quest/chapter/task/reward IDs.
- `jarProcessor.ts` — JAR must NOT be in `SKIP_PATTERNS` of modpackProcessor (was a bug in v3.10, fixed in v3.11).
- `security.ts` — Path traversal check must run before any file extraction.
- `middleware.ts` — Rate limiter applies globally; do not bypass in API routes.
- `next.config.js` — `bodyParser: false` on upload routes; streaming is required for large files.

---

## Environment

```env
DEEPL_API_KEY=your_key_here   # Required. Free key ends with :fx (500K chars/month)
```

Copy from `.env.example`. Never commit `.env`.

---

## Testing Conventions

- Unit tests live in `__tests__/lib/` and mirror `lib/` exactly.
- Test file = `libName.test.ts` for `lib/libName.ts`.
- **Before adding a feature:** write the test first, then implement.
- **Before fixing a bug:** write a test that reproduces it, then fix.
- Coverage targets: statements ≥ 75%, functions ≥ 82%.
- E2E tests (Playwright) cover the full upload → translate → download flow.

Success criteria template:
```
1. Write failing test that reproduces the issue → verify: test fails
2. Implement fix → verify: test passes
3. Run full suite: npm test → verify: no regressions
```

---

## What NOT to Touch Without Discussion

- `app/page.tsx` — intentionally monolithic (~31KB). Do not split into sub-components unless explicitly asked.
- `lib/fragmentCache.ts` — complex cache invalidation logic. Ask before refactoring.
- `lib/deepl.ts` placeholder wrapping/unwrapping — fragile, well-tested. If you change it, run full test suite.
- `docs/SESSION_STATE.md` — update this file at the end of each work session to record what changed.
- `docs/CHANGELOG.md` — append only, never edit past entries.

---

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## 5. Documentation Guidelines
**Organized structure. Clear navigation. Proper categorization.**

### Documentation Structure

The project uses a hierarchical documentation structure in `docs/`:

```
docs/
├── README.md                    # Main navigation hub - START HERE
├── CHANGELOG.md                 # History of all changes
├── ROADMAP.md                   # Development roadmap
├── SESSION_STATE.md             # Current project state
│
├── architecture/                # Architecture and systems
│   ├── README.md               # Architecture navigation
│   ├── WORD_BASED_SYSTEM.md    # Word-based translation system
│   ├── PROJECT_STRUCTURE.md    # Project structure
│   └── cache-system/           # Cache system documentation
│
├── releases/                    # Version releases
│   ├── README.md               # Release index with version history
│   ├── v3.16.0.md             # Latest release
│   └── v3.15.1.md             # Previous releases
│
└── archive/                     # Historical documents
    ├── README.md               # Archive navigation
    ├── sessions/               # Session reports by date
    └── reports/                # Technical reports
```

### Rules for Documentation Updates

#### When adding a new feature:
1. **Update architecture docs** if it's a new system/component
   - Create `docs/architecture/SYSTEM_NAME.md` if needed
   - Update `docs/architecture/README.md` to include it
2. **Update CHANGELOG.md** with the change
3. **Update SESSION_STATE.md** at end of session
4. **Do NOT** create session summaries unless explicitly asked

#### When creating a new release:
1. **Create release notes** in `docs/releases/vX.Y.Z.md`
2. **Update** `docs/releases/README.md` (add to version table)
3. **Update** `docs/CHANGELOG.md` (add new version section)
4. **Update** `package.json` version number
5. **Update** `docs/README.md` (update version in main table)

#### When writing session reports:
1. **Only create if explicitly requested** by the user
2. **Place in** `docs/archive/sessions/YYYY-MM-DD/`
3. **Update** `docs/archive/README.md` to include it
4. **Do NOT** create automatically after every session

#### What goes where:

| Document Type | Location | When to Update |
|--------------|----------|----------------|
| Architecture docs | `docs/architecture/` | New system/component |
| Release notes | `docs/releases/` | New version release |
| Session reports | `docs/archive/sessions/` | Only if requested |
| Technical reports | `docs/archive/reports/` | Only if requested |
| Current state | `docs/SESSION_STATE.md` | End of each session |
| Change history | `docs/CHANGELOG.md` | Every significant change |

#### Navigation files (README.md):
- **Always update** the relevant README.md when adding new documents
- `docs/README.md` - main navigation, update for major changes
- `docs/architecture/README.md` - update when adding architecture docs
- `docs/releases/README.md` - update when adding new release
- `docs/archive/README.md` - update when adding archived documents

#### What NOT to do:
- ❌ Don't create documents in `docs/` root (except the 4 main files)
- ❌ Don't create session summaries automatically
- ❌ Don't move documents without updating all README files
- ❌ Don't edit old release notes (append-only)
- ❌ Don't create duplicate documentation

#### Version numbering in docs:
- Update version in `docs/README.md` main table
- Update version in `docs/ROADMAP.md` header
- Update version in `docs/SESSION_STATE.md` header
- Update version in `package.json`
- Keep all 4 synchronized

### Quick Reference

**Starting a session?** Read `docs/SESSION_STATE.md`  
**Adding a feature?** Update `docs/CHANGELOG.md` and architecture docs  
**Creating a release?** Follow the release checklist above  
**Ending a session?** Update `docs/SESSION_STATE.md`  
**Need to find something?** Start at `docs/README.md`

---
**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
