# Instagram 制作モジュール

このモジュールは、CodexがCanvaとGoogle Driveの接続機能を使って、Simpsonsの試合用Instagram画像を制作するときの共通情報と運用ルールをまとめます。Google Apps Script製の `fee-collector/` とは別に起動し、集金状態を読み書きしません。

## 独立した呼び出し

- `starting-lineup`: 試合前のSTARTING LINEUP制作。現行制作方法を使います。新しいMASTERは作りません。
- `post-game`: 試合後制作。GAME RESULT、GAME STATS、FEATURE PLAYERを必要なものだけ個別に作れます。

Codexへの依頼例は「この試合のSTARTING LINEUPを作って」「このスコアブックからGAME STATSを作って」です。対象試合の共通情報は [match-context.schema.json](match-context.schema.json) の `MatchContext` に合わせます。日付、対戦相手、会場、matchIdなどの必須情報を確認できなければ、制作に進まず不足点を質問します。

## モジュール内容

- `match-context.schema.json`: 試合前後で共有するデータ形式。
- `designs.json`: 確認済みCanva Design IDとDrive参照先。
- `AGENTS.md`: Codexの制作手順、編集許可範囲、停止条件。

Codexは試合後制作時にGoogle Driveの `Simpsons_試合後SNS標準運用ガイド_v2.1` を確認し、指定MASTERを複製して使用します。Canvaの確定保存はプレビュー提示後にユーザーの明示承認を得てから行います。Instagramへの投稿は手動のままです。
