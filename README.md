# simpsons-team-os

Simpsons baseball team の運営を支える小さな機能を、必要な順に追加していく開発リポジトリです。

## Codex entry point

変更前に次のファイルを確認してください。

1. `AGENTS.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/PROGRESS.md`

GitHub: `Mitsuru-sato37/simpsons-team-os`

## Current feature

`fee-collector/` に、Google Sheets 台帳と連携する Apps Script 製の当日集金サイトがあります。

- 開発ブランチ: `codex/fee-collector`
- 画面: `fee-collector/Index.html`, `App.html`, `Styles.html`
- サーバー処理: `fee-collector/Code.gs`
- 純粋ロジック: `fee-collector/Logic.gs`
- 台帳仕様と起動手順: `fee-collector/README.md`

## Instagram制作モジュール

`instagram/` にはCodexがCanvaとGoogle Driveを使って試合画像を作成するルールと、共通の試合データ契約があります。集金アプリとは独立して利用できます。

- 試合前: 「この試合のSTARTING LINEUPを作って」と依頼します。現行の制作元・手順が確認できない場合は、新しいMASTERを作らず確認で止まります。
- 試合後: 「このスコアブックからGAME RESULTを作って」「GAME STATSを作って」など、成果物ごとに依頼できます。GAME RESULTとGAME STATSは指定Canva MASTERを複製して可変項目だけ更新します。FEATURE PLAYERはDriveの基準デザインと完成例を参照します。
- 試合の日付、対戦相手、会場、`matchId` など共通情報（MatchContext）の形式は `instagram/match-context.schema.json` を参照します。
- Codexは制作前に必要な事実とCanva/Driveの参照先を確認します。Canva保存前にプレビューを提示し、Drive保存先が不明なら確認します。

詳しいルールは `instagram/AGENTS.md`、デザインIDと参照先は `instagram/designs.json` にあります。

## Multi-PC development

GitHubを共有の正本として使います。作業は `codex/<topic>` ブランチで行い、PCを切り替える前にコミット・プッシュしてください。

```powershell
git clone https://github.com/Mitsuru-sato37/simpsons-team-os.git
cd simpsons-team-os
git fetch origin
git switch codex/fee-collector
git pull --ff-only
```

認証情報、パスワード、APIトークン、Cookie、実データの `.env` はコミットしません。Instagram自動投稿、PayPay API、認証基盤、課金サービスなどは、明示的な依頼がない限り追加しません。
