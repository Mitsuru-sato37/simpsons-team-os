# 選手写真整理 設計

## 調査結果

- リポジトリの実装機能は Apps Script の `fee-collector/`。選手ID・背番号・氏名は既存の `Simpsons_選手マスター` を参照するが、写真管理とは独立している。
- `instagram/` はCodexがGoogle DriveとCanvaを操作する制作手順、`MatchContext`、デザイン参照情報で構成される。アプリから呼べるGoogle Drive APIクライアント、DB、写真リポジトリは存在しない。
- Driveには既存の `Simpsons/03_選手写真`、`#背番号氏名` の選手別フォルダ、`99_未仕分け`、`01_試合写真` がある。ユーザー確認では現在 `99_未仕分け` は空で、今後追加される写真の仕分け先とする。既存構成をそのまま利用し、既存写真の一括取り込みはしない。
- 試合共通IDは `instagram/match-context.schema.json` の `matchId`。独立した試合マスターサービスはリポジトリにはない。

## 方針

写真原本と既存Driveリンクを守るため、初期実装は参照管理とする。画像の移動・削除はせず、Drive file IDと元／現在フォルダIDを資産レコードに保存する。既存の `03_選手写真` に空のJSONカタログを置き、PC間共有の正本にする。Drive JSONリポジトリと原子的ローカルJSONアダプターを用意する。判定・検索・確認履歴はリポジトリ抽象の上に置く。現在のCodex実行層がproviderとしてDrive list/fetch/updateと選手マスターrange取得をサービスへ渡す。NodeコードからCodexのMCPツールを直接importする前提にはせず、別API資格情報も導入しない。Drive connector tool mappingと読戻し手順は `instagram/photo-library/README.md` に固定する。

## データと判断

資産は `photoId`（Drive file IDを元にした安定ID）、`driveFileId`、`fileName`、選手ID、matchId、status、候補選手と根拠、判定理由、作成／更新日時、元／現在保存場所、タグ、変更履歴を持つ。確定状態だけが `playerId` を持つ。候補は公式選手マスターのIDを参照し、unknownは候補を持たない。未確認のmatchIdはnullとする。

背番号・ユニフォーム名・信頼できるメタデータ・人間の明示確認を確定根拠にする。守備位置、用具、防具、連続性、撮影順は候補理由に限り、confirmedへの遷移根拠にならない。顔認識・本人認証は行わない。状態変更は履歴を残す。

## 接続

独立した `photo-library` 呼び出し口を追加し、未仕分けの確認、候補提示、確認待ち一覧、手動確定、選手ID／matchId検索、FEATURE PLAYER向けの確定済み写真候補を提供する。Instagram制作側は共有 `MatchContext` の `matchId` と選手マスターのIDを使う。集金機能とは接続しない。現行の選手別／未仕分けDriveフォルダは初期参照元とし、候補写真を自動で物理移動しない。

## 安全性

プレビュー結果と登録判断を分け、dry-runはレコード保存を行わない。Driveの画像変更操作は提供しない。二重Drive ID登録を拒否し、手動確認後だけ正式な選手IDを付ける。Driveカタログは1回のファイル更新、ローカルJSONは一時ファイルからの置換で保存する。保存先は明示する。
