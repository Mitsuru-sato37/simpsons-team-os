# 選手写真整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 既存Drive写真を動かさず、確度を守って整理・確認・検索できる選手写真資産機能を追加する。

**Architecture:** Instagramモジュール内に独立したドメインサービス、Google Drive JSONカタログ／原子的ローカルJSONリポジトリ、差し替え可能なDrive写真ソース契約を置く。Google Driveの画像操作は既存Codex接続を呼び出し手順から利用し、写真はID参照で管理する。

**Tech Stack:** Node.js標準ES modules、JSON Schema、既存のCodex Google Drive接続。

**Spec:** `docs/superpowers/specs/2026-10-06-player-photo-library-design.md`

## Global Constraints

- 原本を移動、削除、上書きしない。
- 選手IDは既存の選手マスターを参照する。
- 試合IDは `MatchContext.matchId` を参照し、確定できない場合はnullにする。
- 強い根拠または明示的なユーザー確認なしに写真を確定しない。
- 用具、守備位置、連続性、撮影順は候補の絞り込みに限る。
- 顔認識・本人認証、認証基盤、外部API資格情報を追加しない。
- 集金機能から独立させる。

## Review Focus

- 同じDrive file IDの再取り込みが二重資産を作らないこと。
- candidate/unknownがconfirmedになるときに有効な選手IDと根拠が必要なこと。
- 位置・用具・連続写真の根拠だけでは確定できないこと。
- 手動確認が確認履歴を残すこと。
- dry-run、検索、候補返却がDriveを変更しないこと。

## Files

- Create `instagram/photo-library/asset.schema.json`: 資産レコード契約。
- Create `instagram/photo-library/photo-library.mjs`: 状態遷移、プレビュー、確認待ち、検索、集計。
- Create `instagram/photo-library/README.md`: callable service interface and record usage.
- Create `instagram/photo-library/json-file-repository.mjs`: 明示パスに対する原子的JSON保存。
- Create `instagram/photo-library/drive-json-repository.mjs`, `catalog.template.json`, `drive-sources.json`: Drive共有カタログポート、初期データ、既存フォルダID。
- Create `instagram/photo-library/runtime.mjs`: Drive connector callbacksと既存選手マスターlookupを注入してサービスを組み立てる。
- Create `instagram/photo-library/photo-source.mjs`: Drive一覧／プレビュー接続のprovider契約。
- Modify `instagram/match-context.schema.json`: FEATURE PLAYERでplayerIdを利用可能にする。
- Modify `instagram/AGENTS.md`, `instagram/README.md`, root `AGENTS.md`, root `README.md`: 独立ルートと判断・運用手順。
- Modify `docs/PROJECT_CONTEXT.md`, `docs/PROGRESS.md`, `docs/STATUS.md`: 永続設計とハンドオフ。

## Tasks

### Task 1: 資産レコードと永続リポジトリ

実装: IDベースのJSON Schemaと読み書きリポジトリを作る。読み込み時の破損JSONを黙って空DB扱いにせずエラーにする。保存時は親ディレクトリ作成、一時ファイル書き込み、renameで置換する。

### Task 2: 安全な写真ライブラリサービス

実装: `createPhotoLibrary({ repository, source, playerDirectory })` が `previewInbox`, `previewImage`, `previewDecisions`, `registerDecisions`, `confirmPlayer`, `findPhotos`, `getFeaturePlayerCandidates`, `getReviewQueue`, `summarize` を提供する。プレビューは保存しない。Drive file IDを一意にし、状態変更履歴を残す。confirmedには公式マスターの `playerId` と `jersey_number` / `uniform_name` / `trusted_metadata` / `user_confirmation` の根拠を要求し、position/gear/proximity/sequenceは拒否する。FEATURE PLAYER検索はconfirmedのみ返す。

### Task 3: DriveとInstagram呼び出し口の統合

実装: `PhotoSource` を注入可能にし、既存Codex Drive接続から `Simpsons/03_選手写真/99_未仕分け`、既存選手別フォルダ、`01_試合写真` を読む手順を追加する。物理移動はせず、ユーザー確認後に参照メタデータだけ登録する。FEATURE PLAYERのMatchContextにplayerIdを追加し、写真ライブラリルートを独立して呼べるようにする。

### Task 4: 利用・handoff文書

実装: 依頼例、根拠ルール、dry-run、ユーザー確認、Drive非変更、検索方法をREADME/AGENTSに書く。PROJECT_CONTEXT/PROGRESS/STATUSに調査・完成機能・次作業・同期ブロッカーを記録する。

## Verification

依頼された範囲では、変更ファイル、JSON契約の構文、`git diff --check`、既存テストへの非干渉を確認する。写真フォルダや画像は変更しない。Driveには既存写真フォルダ内に空カタログJSONを1点作成した。
