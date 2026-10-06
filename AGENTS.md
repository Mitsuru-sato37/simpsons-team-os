# Project instructions

## Source of truth

Read `README.md`, `docs/PROJECT_CONTEXT.md`, and `docs/PROGRESS.md` before starting.

Use only decisions recorded in the repository or explicitly given by the user. Do not infer unapproved branding, Instagram automation behavior, posting schedules, account credentials, or application features.

## Brand / content rules

- Team name: Simpsons.
- Team colors: purple and yellow.
- Mascot name: ラキポタ.
- Mascot uniform number: 2023.
- ラキポタ is a ghost character that often disguises itself in potage soup, especially corn potage.
- Character color may vary by use case.
- A small motif of two fallen feathers drifting from the tail is part of the character concept; do not turn this into full wings.
- Baseball identity should remain visible in team-branded visual work.

Treat reference images and official team assets as source material when supplied. Do not fabricate exact player names, logos, uniforms, or other details when the source asset is unavailable.

## Development workflow

GitHub is the shared source of truth across PCs.

Before work:

```powershell
git status
git fetch origin
git switch main
git pull --ff-only
```

Use `codex/<topic>` branches for coherent work. Commit and push before handoff to another PC.

Never discard unrelated local changes in order to synchronize.

## Secrets / external services

- Never commit passwords, API tokens, Instagram credentials, cookies, session data, or real `.env*` files.
- Do not introduce Meta/Instagram APIs, paid services, scheduled posting, authentication, or cloud infrastructure unless the user explicitly asks for them.
- Use `.env.example` for safe variable names only if environment variables become necessary.

## Handoff

Before stopping a meaningful development session, update `docs/PROGRESS.md` with completed work, current branch, next task, and any blocking dependency.

## Instagram production routes

- For a pre-game lineup request (for example, `試合前投稿作成` or `STARTING LINEUP`), read and follow `instagram/AGENTS.md` using the `starting-lineup` route.
- For a post-game asset request (for example, `試合後投稿作成`, `GAME RESULT`, `GAME STATS`, or `FEATURE PLAYER`), read and follow `instagram/AGENTS.md` using the `post-game` route. Produce only the requested asset or combination.
- Use `instagram/match-context.schema.json` for match information shared by both routes. Keep the Instagram workflow independently callable from `fee-collector/`.
- Do not infer missing scorebook/player/design facts, create a STARTING LINEUP master, or use new AI image generation as a fallback. Follow the Canva preview/approval and Drive-save requirements in `instagram/AGENTS.md`.

## Cross-PC Codex handoff standard

This repository must remain resumable from another PC without relying on Codex chat history or uncommitted local files.

### Fixed entry points

At the start of every meaningful session, read in this order:

1. `AGENTS.md`
2. `docs/SPEC.md`
3. `docs/STATUS.md`
4. the canonical documents referenced by those files

Codex conversation history is not a source of truth. Durable requirements, decisions, status, and next steps belong in the repository.

### Start of session

1. Run `git status` and preserve any unrelated local work.
2. Run `git fetch origin`.
3. Read `docs/STATUS.md` and resume the active branch recorded by its canonical handoff document when one exists; otherwise synchronize `main`.
4. Pull with `git pull --ff-only`.
5. Read the specification/status sources before changing code.

Do not discard local changes merely to synchronize.

### During work

- Record durable product or architecture decisions in the repository in the same change as the implementation.
- Do not leave important context only in a Codex conversation, terminal scrollback, or an uncommitted file.
- Keep one coherent task on one branch unless the repository explicitly defines another workflow.

### End of session / PC handoff

Before work is considered safely handed off:

1. Update the canonical handoff document referenced by `docs/STATUS.md` (or `docs/STATUS.md` itself when it is canonical).
2. Record at least: active branch, completed work, next work, verification performed, and blockers/external dependencies.
3. Commit all intended changes.
4. Push the active branch to GitHub.
5. Confirm the pushed branch contains the handoff update.

On another PC, recovery is: fetch -> switch to the recorded branch -> pull -> read `AGENTS.md`, `docs/SPEC.md`, and `docs/STATUS.md`.


## Quick Git sync check

On Windows, run this from the repository root at the start of work and before handing work to another PC:

```powershell
.\git-status.cmd
```

It fetches `origin` and reports the current branch, uncommitted changes, whether pull or push is needed, and whether the current feature branch is merged into `main`. If GitHub CLI (`gh`) is available, PR state is used for a more precise merge result; otherwise Git history/patch equivalence is used as a fallback.
