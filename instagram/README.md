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
- `photo-library/`: Drive原本への参照を選手ID／試合IDで管理し、候補確認、検索、変更履歴を扱う独立写真資産機能。

### 選手写真整理

「選手写真整理して」「未仕分けを確認して」「匠の写真を出して」「○○戦の匠の写真を出して」と依頼できます。現行Driveの `Simpsons/03_選手写真` 直下にある `99_未仕分け` を今後追加される写真の受け入れ先として使い、選手別フォルダと `01_試合写真` は既存構成として維持します。`00` フォルダやアーカイブを正として参照しません。未仕分けは現在空のため、写真が追加されてから整理を実行します。依頼時に空なら処理対象0件と報告します。原本は移動・名前変更せず、Drive file IDを写真IDとしてメタデータを管理します。

判定は、`confirmed`（選手IDを正式登録）、`candidate`（選手ID候補と理由を残して確認待ち）、`unknown`（未仕分け）の3状態です。confirmedは背番号、ユニフォーム上の名前、信頼できるメタデータ、またはユーザーの明示確認を必要とします。位置、用具、防具、連続性、撮影順は候補を絞る補助情報に限ります。顔認識は行いません。試合IDが確認できない場合はnullです。

写真資産カタログはGoogle Driveの `03_選手写真` に置くJSONファイルを正本とし、`photo-library/drive-sources.json` の `catalogFileId` にIDを記録します。ローカル保管用のJSONリポジトリもありますが、PC間共有にはDriveカタログを使います。Drive上の書き込み前にプレビューし、確認対象と登録内容をユーザーに見せます。候補／不明の写真はSNS制作用の確定写真として返しません。

Codexは試合後制作時にGoogle Driveの `Simpsons_試合後SNS標準運用ガイド_v2.1` を確認し、指定MASTERを複製して使用します。Canvaの確定保存はプレビュー提示後にユーザーの明示承認を得てから行います。Instagramへの投稿は手動のままです。
