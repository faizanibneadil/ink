# AI Agent

For any Payload-related work, reference the skill at `node_modules/payload/skills/payload/SKILL.md`.

## Note editor performance rules

Notes can be large (long lectures). Work done on every editor change must cost the size of the edit, not the size of
the note.

- Never mirror the Lexical editor value into React state. The editor owns its state; pass `RenderLexical` a stable
  `value` (the initial value) and only read changes in `setValue` (`src/views/editor.tsx`).
- Do not serialize the whole document on every change. Detect changes cheaply (a dirty flag) and serialize once, at
  save time; pass that string on instead of stringifying it again (`src/views/note-autosave/autosaver.ts`,
  `saveNote.ts`).
- Do not download what the page does not read: save requests use `select` so the response is not the whole note.
- For any editor performance change, profile a large note (hundreds of KB) before and after, with the same note and
  method, and report the numbers.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
