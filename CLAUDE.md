# HHTracker — Claude Code ガイド

## プロジェクトドキュメント

以下のファイルをセッション開始時に読むこと:

- `/Users/sotani/Documents/Zettelkasten/Projects/hhtracker/concept.md` — コンセプト・設計思想
- `/Users/sotani/Documents/Zettelkasten/Projects/hhtracker/spec.md` — 技術仕様（スタック・データモデル・API）
- `/Users/sotani/Documents/Zettelkasten/Projects/hhtracker/README.md` — セットアップガイド
- `/Users/sotani/Documents/Zettelkasten/Projects/hhtracker/devlog.md` — 開発ログ（最近の変更・TODO）

## プロジェクト概要

習慣・体調・食事を記録するVanilla JS PWA。バックエンドなし、データはGoogle Driveのスプレッドシートに保存。

**主要ファイル:**
- `app.js` — 全ロジック（認証・API・UI）
- `index.html` — マークアップ（ビュー・モーダル）
- `style.css` — ダークテーマ・レスポンシブCSS
- `sw.js` — Service Worker

## 開発上の注意

- `client_secret_*.json` はOAuth認証情報。コミットしないこと
- Google Sheets/Drive API の変更は `app.js` 内のAPI関数を確認すること
- 新機能を追加したら `devlog.md` に記録すること
