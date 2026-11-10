# Browser JS bundle audit (baseline)

Method: `.agents/skills/next-bundle-optimizer` (audit mode). Scope: whole app. Next.js 16.4.5 (Turbopack), Payload 4.0.0-beta.7.

## Evidence

| Kind | Source |
|------|--------|
| Build evidence | `next analyze --output --snapshot 'audit-before-1'` → `next analyze export` (graph v1), commit `410e0e0` |
| Runtime evidence | `tests/e2e/bundle-size.e2e.spec.ts` against `pnpm build && pnpm start` (Chromium, cache off, until network idle) |

### Runtime baseline (JS downloaded on first load)

| Page | JS files | Raw | Over the wire (compressed) |
|------|---------:|----:|----------------------------:|
| Landing `/` (guest) — renders one `<div>` | 17 | 2751 KiB | **873 KiB** |
| Guest note page `/<slug>` | 17 | 2751 KiB | **873 KiB** |
| Editor note page `/<slug>` (logged in) | 20 | 2802 KiB | 893 KiB |
| Admin dashboard `/` | 17 | 2751 KiB | 873 KiB |

### Build baseline (route `/[[...segments]]`, attributed compressed bytes of `[client-fs]` outputs)

- The whole app is **one page route** (`src/app/[[...segments]]/page.tsx`): admin, dashboard, editor, guest note and landing.
- Bootstrap group: 5 files, 162 KiB. Render-dependent groups (one per client reference): **the same 13 files, 780 KiB, for
  every client reference** — `src/app/layout.tsx` alone pulls 762 KiB. So every page downloads the admin's client code.
- Async-only (loaded on demand, not on first load): Excalidraw 1437 KiB, mermaid ~800 KiB, katex 75 KiB… — already lazy.

Top packages in bootstrap + render-dependent (first load):

| KiB | Package | Needed by |
|----:|---------|-----------|
| 391 | `@payloadcms/ui` | admin + editor (guest pages only because of the shared root layout) |
| 177 | `next` | everyone |
| 74 | `highlight.js` (40 grammars) | code blocks (guest view + editor) |
| 72 + 61 + ~70 | `@payloadcms/richtext-lexical`, `lexical`, `@lexical/*` | editor (guest view only needs serialized JSON → HTML) |
| 13 | `@dnd-kit/core` | admin / editor drag handle |

## Candidates (ranked)

### C1 — Website pages (landing, guest note) inside Payload's `RootLayout` → **biggest win**
- **Scope:** route `/[[...segments]]`, client output, snapshot `audit-before-1`, metric: wire KiB per page (runtime) +
  render-dependent attributed bytes (build).
- **Source:** `src/app/layout.tsx` renders `@payloadcms/next/layouts#RootLayout` (client providers import the
  `@payloadcms/ui` client barrel) for every URL. `page.tsx` imports `Editor` and `NoteViewer` into the same route, so
  Turbopack puts all client references of the route into the same chunk set.
- **Reachability:** all render-dependent groups share the same 13 outputs; no async boundary separates them.
- **Proposed edit:** guests (no Payload auth cookie) get the website pages from a separate route group with its own
  light root layout (no Payload providers). Logged-in users and Payload pages keep today's layout. Same URLs.
- **Behavior checks:** guest note page renders header, text, tables, code (highlighted, Copy), drawings; login and
  admin/editor unchanged; switching between them is a full page load (different root layouts).
- **Risk:** auth-based routing (cookie check only decides the layout; access control stays in Payload queries).

### C2 — `NoteViewer` is a client component
- `src/views/note-viewer.tsx` (`'use client'`) ships Lexical `RichText`, converters, `views` config and highlight.js
  to guests, though the output is static HTML. Proposed: Server Component; client islands only for the Copy button and
  the Excalidraw preview. Measurable only after C1 (until then all client code shares chunks).

### C3 — `@payloadcms/ui` in the guest drawing viewer
- `src/features/excalidraw/viewer/ExcalidrawViewer.tsx` imports `useTheme` from `@payloadcms/ui` (391 KiB barrel). On the
  separate website layout that provider is absent. Proposed: read the theme from `data-theme`/`prefers-color-scheme`.

### C4 — highlight.js grammars in the editor
- `src/features/code-block/notion/view.tsx` → `CodeBlockView` → `viewer/highlight.ts` registers 40 grammars
  (74 KiB) synchronously for every editor/admin page. Proposed: load highlight.js lazily (async chunk) in the editor;
  the server-rendered guest view (C2) keeps synchronous highlighting.

### C5 — Excalidraw (verified, no change)
- Already behind `next/dynamic` in `ExcalidrawPreview.tsx` and `ExcalidrawModal.tsx`; `shared/scene.ts` has type-only
  imports from `@excalidraw/excalidraw`. Graph: Excalidraw is async-only. Rejected as a candidate.

### Community / min-cut pass
Skipped as a separate solver pass: the graph has a single route whose render-dependent groups all resolve to the same
chunk set, so direct importer reasoning (layout → Payload providers; page → Editor/NoteViewer) accounts for every path.

## Client-dependency scan

| Source + client importer | Emitted identity | Routes | Compressed B | Disposition + evidence |
|---|---|---|---:|---|
| `src/features/code-block/server/CodeBlockServerNode.ts` ← `client/CodeBlockNode.tsx` | `[app-client]` | `/[[...segments]]` | 580 | suppressed: Lexical node class shared by design (client node extends it), no secrets |
| `src/features/excalidraw/server/ExcalidrawServerNode.ts` ← `client/ExcalidrawNode.tsx` | `[app-client]` | `/[[...segments]]` | 404 | suppressed: same as above |
| `src/collections/note-text.ts` ← `views/editor.tsx` | `[app-client]` | `/[[...segments]]` | 206 | suppressed: file header says "also used in the browser", pure text helper |
| `src/collections/media-rules.ts` ← `views/note-header/header-images.ts` | `[app-client]` | `/[[...segments]]` | 64 | suppressed: public upload rules shared on purpose |
| `src/collections/note-header.ts` ← `views/note-header/header-data.ts` | `[app-client]` | `/[[...segments]]` | 8 | suppressed: cover-position constants |
| `payload/dist/collections/config/defaults.js` ← `@payloadcms/ui` | `[app-client]` | `/[[...segments]]` | 16 | suppressed: Payload's own client defaults |
| Server Action `serverFunction` (`src/app/layout.tsx`, `'use server'`) ← Payload `RootLayout` | generated action reference | `/[[...segments]]` | (next router action code ~3 KiB) | suppressed: reference-only stub; `handleServerFunctions`/config not in client output |

### Possible server-only leaks
None found.

### Suppressed matches / evidence gaps
Suppressed: rows above. Evidence gaps: none — every `[client-fs]` JS chunk of this route has `exact` coverage (219); the 2 `not_a_chunk` JS
outputs are runtime/polyfill files; no unsupported outputs.

## Task order (updated by this evidence)
C1 dominates (every page pays for the admin). C2–C4 only change guest/editor numbers once pages stop sharing one chunk
set, so C1 goes first; then C3 + C2 (guest view), then C4 (editor).

## Results

### T2 — C1 + C3: guest website on its own root layout (accepted)

Guests without the Payload auth cookie are rewritten (same URL) by `src/proxy.ts` to `src/app/(site)` — a root layout
with Payload's CSS and fonts but no Payload client providers. Payload pages and logged-in users keep
`src/app/(payload)` (Payload's `RootLayout`, unchanged). `ExcalidrawViewer` reads the theme from `<html data-theme>`
(`src/views/useDocumentTheme.ts`) instead of `@payloadcms/ui`'s `useTheme`.

| Page | Before (wire / raw) | After (wire / raw) |
|------|--------------------:|-------------------:|
| Landing `/` (guest) | 873 / 2751 KiB | **206 / 670 KiB** (−76%) |
| Guest note page | 873 / 2751 KiB | **206 / 670 KiB** (−76%) |
| Editor note page | 893 / 2802 KiB | 893 / 2803 KiB (unchanged) |
| Admin dashboard | 873 / 2751 KiB | 873 / 2751 KiB (unchanged) |

Build evidence (snapshot `audit-after-T2`): route `/site/[[...segments]]` first load = bootstrap 162 KiB +
render-dependent 99 KiB; `@payloadcms/ui` 0 KiB (was 391). Remaining guest weight: `next` 170 KiB, `highlight.js`
74 KiB (C2/C4 next). Route `/[[...segments]]`: unchanged (+1 KiB).

Behavior checks:
- Guest note page in both layouts (fake cookie forces the old Payload route): screenshots pixel-identical in light,
  dark-system and dark-cookie modes. Guests keep Payload's theme rules (cookie, else light: Payload's ThemeProvider
  does not follow the system theme for the unauthenticated client config).
- Guest 404: same markup and look as Payload's NotFound view; now answers with HTTP 404 (was 200).
- `/site/...` opened directly: 404 (the site pages need the proxy's `x-ink-site` header). `site` is a reserved slug.
- Tests: `tests/e2e/site-routing.e2e.spec.ts` (new), `tests/int/siteRoute.int.spec.ts` (new; checks the proxy's static
  list against `getReservedSlugs(config)`), full e2e 91/91 on a production server, int 95/95, `pnpm test:workerd`
  90/90 on workerd (OpenNext: Node.js proxy support is marked experimental there; verified locally and on preview).
- Known flaky, also on `main`: `admin.e2e` "list views" (Payload adds `?limit=10`), SQLITE_BUSY on login when the test
  process and the server share the local SQLite file.

### T3 — C2: guest note view is a Server Component (accepted)

`src/views/note-viewer.tsx`, both read-only converters and `CodeBlockView` no longer are client modules: Payload's
`RichText` (a plain function), the converters and highlight.js run on the server. Client islands: `CopyButton`
(`src/features/code-block/viewer/CopyButton.tsx`) and `ExcalidrawViewer` (drawings, still loaded on scroll). The
`nodeMap` from `src/views/config.tsx` is dropped there: its only entry renders the same `CodeBlockView` read-only.

| Page | After T2 (wire / raw) | After T3 (wire / raw) |
|------|----------------------:|----------------------:|
| Landing `/` (guest) | 206 / 670 KiB | **144 / 465 KiB** |
| Guest note page | 206 / 670 KiB | **144 / 465 KiB** |
| Editor note page | 893 / 2803 KiB | 889 / 2790 KiB |
| Admin dashboard | 873 / 2751 KiB | 869 / 2739 KiB |

Build evidence (snapshot `audit-after-T3`), route `/site/[[...segments]]` first load: bootstrap 162 KiB +
render-dependent 15 KiB. App code ~6 KiB; `highlight.js` and Lexical are gone from the guest's browser. What is
left is the Next.js runtime.

Behavior checks: the same guest note (cover, icon, table, two code blocks, a drawing) on the T2 build and this build:
identical DOM except the server's port, screenshots pixel-identical below the cover (the T2 worktree had no
`media/` folder, so its cover images did not load). New e2e: guest drawing renders as an SVG. Full e2e 92/92 (with
the admin list-view test fixed: Payload may add `?limit=10` to list URLs, also on `main`), int 95/95,
workerd 90/90.

### T4 — C4: highlight.js only for notes with a code block (accepted)

`src/features/code-block/notion/view.tsx` is in every Payload page's bundle (via `src/views/config.tsx` in the import
map) and imported `CodeBlockView` → `highlight.ts` synchronously. Now it renders `CodeBlockFrame` with `plainLines`
(no highlight.js) as the Suspense fallback; highlight.js only comes with the lazy `NotionCodeBlock` / `CodeBlockView`
chunk. `CodeBlockView` = `CodeBlockFrame` + `highlightLines` (the guest view still highlights on the server).

| Page | After T3 (wire / raw) | After T4 (wire / raw) |
|------|----------------------:|----------------------:|
| Editor, note without a code block | 884 KiB | **828 / 2595 KiB** |
| Editor, note with a code block | 889 / 2790 KiB | 889 / 2791 KiB (highlight.js on demand) |
| Admin dashboard | 869 / 2739 KiB | **812 / 2551 KiB** |
| Guest pages | 144 KiB | 144 KiB |

Build evidence (snapshot `audit-after-T4`), route `/[[...segments]]`: render-dependent 781 → 701 KiB;
`highlight.js` (74 KiB) moved to async-only.

Large-note profile (AGENTS.md rule), same method before/after: production server, a 516 KiB note (900 paragraphs),
cold cache, 5 runs, median, time from navigation:

| Note | Before: editor / coloured code / JS | After: editor / coloured code / JS |
|------|------------------------------------:|-----------------------------------:|
| No code block | 1280 ms / – / 884 KiB | 1251 ms / – / 828 KiB |
| With a code block | 1284 ms / 1333 ms / 889 KiB | 1279 ms / 1283 ms / 889 KiB |

The uncoloured fallback shows for a few ms (colours 4 ms after the editor is visible); `tests/int/code-block-lines`
checks it has the same lines and text as the highlighted block, so nothing moves when colours arrive.
Tests: e2e 93/93 incl. a new "editor without a code block downloads no highlight.js" check, int 103/103,
workerd 90/90.

### T5 — remaining candidates (audit only, no edit)

Snapshot `audit-after-T4`, route `/[[...segments]]` (Payload admin + editor), first load (bootstrap +
render-dependent): `@payloadcms/ui` 391, `next` 176, `@payloadcms/richtext-lexical` 67, `lexical` 60, `@lexical/*`
~65, `@dnd-kit/core` 12, app code 23 KiB.

| Candidate | Evidence | Disposition |
|-----------|----------|-------------|
| `@payloadcms/ui` client (391 KiB) | 330 KiB is one pre-bundled file (`dist/exports/client/index.js`) that Payload's own `RootLayout` (`RootProviders`) imports; Turbopack cannot tree-shake it | rejected: needs a Payload change |
| Lexical on the admin dashboard | Payload's layout group alone carries 128 KiB of Lexical (`src/app/importMap.js` → richtext feature clients); moving the note editor to its own route would not remove it | rejected: no gain without Payload changes |
| Lazy `ImageDrawer` + `MediaLibrary` + `header-images` (editor) | 2.6 KiB together (0.3% of the editor's 828 KiB); would add a load step when opening the cover/icon drawer | rejected: below noise, visible timing cost |
| Duplicate packages (19: `roughjs`, `d3-*`, `@radix-ui/*`, `layout-base`…) | all inside `@excalidraw/excalidraw` / `mermaid` trees, async-only (opening a drawing), largest pair ~15 KiB | rejected: not first load; overriding transitive versions risks Excalidraw / mermaid |
| `next` runtime (176 KiB) | framework bootstrap | out of scope |

No further accepted edits. Guest pages are at the Next.js runtime floor; admin/editor are bound by Payload's
client bundle.
