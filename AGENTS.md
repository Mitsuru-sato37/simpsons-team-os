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
