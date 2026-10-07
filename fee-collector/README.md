# Simpsons 当日集金 Web

Simpsonsの試合参加費を、試合当日にスマホから受領確認するApps Script Webアプリです。請求額は `試合会計` の試合別「実徴収額/人」を参照します。

## 対応台帳

- Spreadsheet: `Simpsons会計`
- Spreadsheet ID: `1GFTMkvMaqkAm2QQ61yNdt51_l7UldxaOkBfBO2zHDqQ`
- Legacy backup spreadsheet: `Simpsons_集金台帳_試作版` (`1yVT9_c1RVdnosvZlN3r2bse6B3NtJo9JvKDggqDI61E`); migration reads from it and never deletes or modifies it.
- Player master spreadsheet: `Simpsons_選手マスター`
- Player master spreadsheet ID: `1doROrxTeGioK6rct9tCxNYugl-WIdzxqkDqYWMPypT4`
- Time zone used by the app: `Asia/Tokyo`

The existing accounting tabs (`ダッシュボード`, `取引台帳`, `試合会計`, `メンバー請求`, `会費管理`, `メンバー`) remain the finance source of truth. The app adds `集金_試合`, `集金_参加者`, and `集金_受領履歴` for operational data. A receipt updates the member invoice, transaction ledger, match accounting, and dashboard formulas; cancellation retains the receipt and reverses its active accounting projections. The legacy spreadsheet stays available as a backup.

必要なタブとヘッダー:

| タブ | ヘッダー |
| --- | --- |
| `試合` | 試合ID / 日付 / 対戦相手 / 場所 / 集合時刻 / 試合時刻 / グラウンド費 / 状態 / メモ |
| `参加者` | 試合ID / 選手ID / 選手名 / 参加費 / 対象 / 請求額 / 受領額 / 残額 / メモ |
| `受領履歴` | 受領ID / 試合ID / 選手ID / 選手名 / 受領日時 / 金額 / 支払方法 / 状態 / メモ |

The operational app tabs are `集金_試合`, `集金_参加者`, and `集金_受領履歴`. The receipt tab is the app's formal receipt record.
選手名と背番号は、別の `選手マスター` スプレッドシートを正として参照します。既存の `P001` 形式の参加者IDもマスターの `001` として解決します。会計側の `メンバーID` は内部キーとして `M001` 形式に対応付け、会計のメンバー一覧へマスターの氏名と背番号を同期します。利用者は背番号と氏名で確認します。
現時点では、試合ごとに `参加者` タブへ `試合ID` と `選手ID` を登録します。選手名を毎回手入力する必要はなく、画面表示では選手マスターから氏名と背番号を解決します。アプリ画面からマスターの選手を選んで参加登録する機能はまだありません。

## 動作

- 初期表示は、シート順で `完了` / `中止` ではない最初の試合。
- 画面右上の `台帳を開く` から、アプリが接続中の集金台帳スプレッドシートを別タブで開ける。
- 試合完了後は、現在の試合より後の最初の未完了試合へ移動。後続がなければ先頭の未完了試合へ戻る。
- 過去・未来の試合はプルダウンから手動選択できる。時刻だけでは切り替えない。
- 未収者を上に固定し、現金・PayPay・銀行振込とも残額全額を記録する。請求額が試合会計に未設定の場合は「請求額未設定」と表示し、受領操作を出さない。
- PayPayと銀行振込は履歴・入金を確認したうえで手動記録する。API連携はしない。
- 受領後は受領票を表示でき、直後の「取り消す」で取消できる。
- 同じ試合・同じ選手の二重受領は、Apps Scriptロックと有効受領の再確認で防ぐ。
- `完了` または `中止` の試合はプルダウンで参照できるが、完了操作はできない。サーバー側でも状態を再確認する。

## 取消履歴

取消しても `受領履歴` の行は削除しません。状態を `取消` に変更し、メモに画面からの取消を追記します。選手は未収へ戻り、画面の折りたたみ式 `取消履歴` で選手名、金額、方法、日時、受領IDを確認できます。

## Apps Scriptでの起動

1. 対応するGoogle Sheetsを開く。
2. **拡張機能 → Apps Script** を開く。
3. このフォルダの `Code.gs`、`Logic.gs`、`Index.html`、`Styles.html`、`App.html`、`appsscript.json` をApps Scriptプロジェクトへ作成する。
4. スタンドアロンApps Scriptでも、接続先は `Code.gs` の `SPREADSHEET_ID` で指定する。旧台帳IDは移行元として別設定されている。
5. **デプロイ → 新しいデプロイ → ウェブアプリ** から試作アクセスを自分だけにして公開する。

## 次の実装

スタメン表（控えを含む当日参加者全員が載る画像）から `参加者` タブへ自動登録する機能は次段階です。認証、PayPay API、公開範囲の拡大も今回の範囲には含めません。
