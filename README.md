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
- 未収者には `現金300円` と `PayPay確認` を表示し、受領票・取消履歴・二重受領防止を備える。

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
