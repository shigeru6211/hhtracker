# 習慣・体調トラッカー

毎日の習慣と体調を記録するWebアプリです。データはGoogle Driveのスプレッドシートに保存されます。

## 機能

- ⭐ **星評価（1〜5段階）**: 体調・睡眠の質・運動の質など
- ✅ **チェックボックス**: 習慣の実施確認（済/未）
- 🍽️ **食事記録**: 朝食・昼食・夕食のフリーテキスト
- 📅 **カレンダー履歴**: 過去の記録を月別カレンダーで確認
- 📊 **Google Sheets保存**: データはGoogle Driveのスプレッドシートに自動保存

## セットアップ手順

### 1. Google Cloud Console でプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成（例：「HabitTracker」）
3. 左メニュー → **APIs & Services** → **Library** を開く
4. 以下のAPIを有効化:
   - **Google Sheets API**
   - **Google Drive API**

### 2. OAuth クライアントIDを取得

1. **APIs & Services** → **Credentials** を開く
2. **CREATE CREDENTIALS** → **OAuth client ID** をクリック
3. アプリケーションの種類: **Web application** を選択
4. 名前: 任意（例：「Habit Tracker Web」）
5. **Authorized JavaScript origins** に以下を追加:
   - `http://localhost:3000`（ローカル開発用）
   - 実際にホストするURL（例：`https://yourdomain.com`）
6. **CREATE** をクリック → **クライアントID** をコピー

> **注意**: OAuth同意画面の設定も必要です。
> - User Type: **External**
> - アプリ名、メールアドレスを入力
> - スコープ: `../auth/spreadsheets`, `../auth/drive.file`, `openid`, `profile`, `email`
> - テストユーザー: 自分のGmailアドレスを追加

### 3. app.js の CLIENT_ID を設定

`app.js` の先頭にある以下の行を編集:

```javascript
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
```

取得したクライアントIDに置き換える（例）:
```javascript
const CLIENT_ID = '123456789-abcdefghijklmnop.apps.googleusercontent.com';
```

### 4. アプリを起動

**簡単な方法（Pythonサーバー）:**
```bash
cd habit-tracker
python3 -m http.server 3000
```

ブラウザで `http://localhost:3000` を開く。

**Node.jsの場合:**
```bash
npx serve . -p 3000
```

### 5. 初回使用

1. ブラウザで開き、**「Googleでサインイン」** をクリック
2. Googleアカウントでログイン
3. **「設定」** タブを開き、**「新しいスプレッドシートを作成」** をクリック
4. **「習慣・体調項目」** の「＋ 追加」から記録したい項目を登録
5. **「今日」** タブで記録を始める

## ファイル構成

```
habit-tracker/
├── index.html      # メインHTML
├── style.css       # スタイルシート
├── app.js          # アプリケーションロジック
├── manifest.json   # PWAマニフェスト
└── README.md       # このファイル
```

## Googleスプレッドシートの構造

アプリが自動的に以下の2つのシートを作成します:

### `Records` シート（記録データ）
| 日付 | 習慣1 | 習慣2 | ... | 朝食 | 昼食 | 夕食 | メモ |
|------|-------|-------|-----|------|------|------|------|
| 2024-01-01 | 4 | 1 | ... | ご飯と味噌汁 | ランチ | 夕食 | ... |

### `Settings` シート（習慣設定）
| id | name | type | icon |
|----|------|------|------|
| abc123 | 運動 | check | 🏃 |
| def456 | 睡眠の質 | stars | 😴 |

## スマートフォンでの使用（PWA）

iOSの場合：
1. Safariで開く
2. 共有ボタン → **「ホーム画面に追加」**

Androidの場合：
1. Chromeで開く
2. メニュー → **「ホーム画面に追加」**

## 公開ホスティング（任意）

GitHub Pages、Netlify、Vercel などで無料ホスティングできます。

**GitHub Pagesの例:**
1. GitHubリポジトリを作成してファイルをpush
2. Settings → Pages → Source: main branch
3. Google Cloud ConsoleのAuthorized originsにGitHub PagesのURLを追加

## 注意事項

- データはあなた自身のGoogleアカウントのGoogle Driveに保存されます
- 第三者サーバーにデータは送信されません
- OAuth 2.0を使用した安全な認証を採用しています
