// ===== CONFIG =====
const CLIENT_ID = '1001792651105-u3770l50erss3ls6u29darms144m1d74.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'profile',
  'email'
].join(' ');

const SPREADSHEET_TITLE = 'HHTracker';
const CATEGORIES = ['Health', 'Learning', 'Other'];
// 旧カテゴリ名（日本語）→新カテゴリ名（英語）のマイグレーションマップ
const CATEGORY_MIGRATION = { '健康': 'Health', '学習': 'Learning', 'その他': 'Other' };

// RhythmCareから移行したデフォルト習慣（新規シート作成時に自動セット）
const DEFAULT_HABITS = [
  { id: 'rc01', name: 'Panic',             type: 'stars', icon: '❤️',  prevDayCarryover: false, category: 'Health' },
  { id: 'rc02', name: 'Evios',             type: 'stars', icon: '💊',  prevDayCarryover: false, category: 'Health' },
  { id: 'rc03', name: 'Journey',           type: 'check', icon: '✍️',  prevDayCarryover: false, category: 'Other' },
  { id: 'rc04', name: 'English(Anki)',     type: 'stars', icon: '🎧',  prevDayCarryover: false, category: 'Learning' },
  { id: 'rc05', name: 'English(ChatGPT)', type: 'stars', icon: '🗣️',  prevDayCarryover: false, category: 'Learning' },
  { id: 'rc06', name: 'English(Podcast)', type: 'stars', icon: '🎧',  prevDayCarryover: false, category: 'Learning' },
  { id: 'rc07', name: 'English(WSQ)',     type: 'check', icon: '🌍',  prevDayCarryover: false, category: 'Learning' },
  { id: 'rc08', name: 'English(Speak)',   type: 'stars', icon: '🗣️',  prevDayCarryover: false, category: 'Learning' },
  { id: 'rc09', name: 'AP',               type: 'stars', icon: '📚',  prevDayCarryover: false, category: 'Learning' },
  { id: 'rc10', name: 'Gym/HIIT',         type: 'stars', icon: '💪',  prevDayCarryover: false, category: 'Health' },
  { id: 'rc11', name: 'Walk/Run',         type: 'stars', icon: '🏃',  prevDayCarryover: false, category: 'Health' },
  { id: 'rc12', name: 'Stretch',          type: 'stars', icon: '🧘',  prevDayCarryover: false, category: 'Health' },
  { id: 'rc13', name: 'Meal amount',      type: 'stars', icon: '🍽️', prevDayCarryover: false, category: 'Health' },
  { id: 'rc14', name: 'Rheumatoid',       type: 'stars', icon: '🦵',  prevDayCarryover: false, category: 'Health' },
  { id: 'rc15', name: 'Rheumatoid(Area)', type: 'memo',  icon: '🦵',  prevDayCarryover: false, category: 'Health' },
];
const SHEET_NAME = 'Records';
const SETTINGS_SHEET = 'Settings';

// ===== STATE =====
let gisClient = null;
let accessToken = null;
let currentUser = null;
let spreadsheetId = null;
let spreadsheetName = '';
let habits = [];
let currentDate = todayStr();
let todayData = {};
let prevDayDefaults = {};
let editingHabitId = null;
let selectedFolderId = null;       // nullはマイドライブルート
let selectedFolderName = 'My Drive (root)';
let folderPickerStack = [];        // フォルダ階層ナビ用スタック [{id, name}]
let mealHistory = {};              // 食事種別ごとの入力履歴（正規化済み）

// ===== EMOJI PICKER =====
const EMOJI_LIST = [
  // 運動・身体
  '🏃','💪','🧘','🚶','🏋️','🚴','🤸','🧗',
  // ストレッチ・身体部位
  '🙆','🦵','🦴','🩻','💉','🩹',
  // 睡眠・医療
  '😴','💤','🛌','❤️','💊','🩺','🏥','🧪',
  // サプリ・栄養
  '🫙','🍵','🥗','🍎','🌿','💧',
  // メンタル
  '💆','😌','🫂','😊','😰','😢','🧠','💭',
  // 英語学習
  '🗣️','🎧','🔤',
  // IT・学習
  '🖥️','⌨️','👨‍💻','📚','✍️','📖','🎯','✅',
  // アルコール・食べすぎ
  '🍺','🍷','🥃','🍶','🥂','🍽️','😋','🤢','🫃','🍔',
  // Other
  '⭐','🌟','🌙','☀️','🎵','🎮','💻','🏠','📝',
];

function renderEmojiPicker(selectedEmoji = '') {
  const picker = $('emoji-picker');
  if (!picker) return;
  picker.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'emoji-grid';
  EMOJI_LIST.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn' + (emoji === selectedEmoji ? ' selected' : '');
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      const current = $('habit-icon-input').value;
      const next = current === emoji ? '' : emoji;
      $('habit-icon-input').value = next;
      renderEmojiPicker(next);
    });
    grid.appendChild(btn);
  });
  picker.appendChild(grid);
  // 選択中の絵文字表示
  const preview = document.createElement('div');
  preview.className = 'emoji-preview';
  preview.innerHTML = selectedEmoji
    ? `Selected: <span class="emoji-selected-val">${selectedEmoji}</span> <button type="button" class="emoji-clear-btn" id="emoji-clear">Clear</button>`
    : '<span style="color:var(--gray-400);font-size:12px">None selected (tap to select)</span>';
  picker.appendChild(preview);
  $('emoji-clear')?.addEventListener('click', () => {
    $('habit-icon-input').value = '';
    renderEmojiPicker('');
  });
}

// ===== DATE HELPERS =====
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(str) {
  const d = parseDate(str);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDateShort(str) {
  const d = parseDate(str);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ===== DOM HELPERS =====
const $ = id => document.getElementById(id);
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function showStatus(msg, isError = false, duration = 3000) {
  const bar = $('status-bar');
  bar.textContent = msg;
  bar.className = 'status-bar' + (isError ? ' error' : '');
  show(bar);
  if (duration > 0) setTimeout(() => hide(bar), duration);
}

// ===== GOOGLE IDENTITY SERVICES =====
function setSigninStatus(msg, isError = false) {
  const el = document.getElementById('signin-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#ef4444' : '#6b7280';
}

// ===== TOKEN CACHE =====
// アクセストークンをLocalStorageに保存して次回起動時の自動ログインに使う
const TOKEN_CACHE_KEY = 'gac_token';
const TOKEN_EXPIRY_KEY = 'gac_expiry';
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // 期限5分前に失効とみなす

function saveTokenCache(token, expiresIn) {
  const expiry = Date.now() + (expiresIn * 1000) - TOKEN_BUFFER_MS;
  localStorage.setItem(TOKEN_CACHE_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
}

function loadTokenCache() {
  const token = localStorage.getItem(TOKEN_CACHE_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
  return token && expiry > Date.now() ? token : null;
}

function clearTokenCache() {
  localStorage.removeItem(TOKEN_CACHE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// ===== GOOGLE IDENTITY SERVICES =====
function initGIS() {
  gisClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse,
    error_callback: (err) => {
      console.error('GIS error:', err);
      // サイレント認証失敗は静かに無視してログイン画面を表示する
      if (err.type === 'popup_closed' || err.type === 'access_denied') {
        setSigninStatus('');
        return;
      }
      const msg = err.type === 'popup_failed_to_open'
        ? 'Popup was blocked. Please check your browser settings.'
        : ('Error: ' + (err.message || err.type || JSON.stringify(err)));
      setSigninStatus('❌ ' + msg, true);
      const btn = $('signin-btn');
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg class="google-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google'; }
    },
  });
  setSigninStatus('');
  // GIS初期化後にサイレント認証を試みる（ユーザー操作なしでトークン取得）
  gisClient.requestAccessToken({ prompt: '' });
}

function handleTokenResponse(resp) {
  const btn = $('signin-btn');
  if (resp.error) {
    console.error('Token error:', resp);
    clearTokenCache();
    setSigninStatus('❌ Authentication failed: ' + resp.error, true);
    if (btn) { btn.disabled = false; }
    return;
  }
  accessToken = resp.access_token;
  // トークンをキャッシュしてログインを自動化する
  saveTokenCache(resp.access_token, resp.expires_in || 3600);
  fetchUserProfile();
}

function signIn() {
  const btn = $('signin-btn');
  if (!gisClient) {
    setSigninStatus('⏳ Loading Google library... please try again', false);
    return;
  }
  if (btn) btn.disabled = true;
  setSigninStatus('⏳ Select your Google account...', false);
  gisClient.requestAccessToken({ prompt: 'select_account' });
}

function signOut() {
  clearTokenCache();
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
    accessToken = null;
  }
  currentUser = null;
  spreadsheetId = null;
  spreadsheetName = '';
  habits = [];
  todayData = {};
  prevDayDefaults = {};
  localStorage.removeItem('spreadsheetId');
  localStorage.removeItem('sheetData');
  showAuthScreen();
}

async function fetchUserProfile() {
  try {
    const resp = await gfetch('https://www.googleapis.com/oauth2/v3/userinfo');
    currentUser = resp;
    $('user-avatar').src = currentUser.picture || '';
    $('settings-avatar').src = currentUser.picture || '';
    $('settings-name').textContent = currentUser.name || '';
    $('settings-email').textContent = currentUser.email || '';
    showAppScreen();
  } catch (e) {
    // トークンが無効な場合はキャッシュをクリアしてログイン画面に戻す
    clearTokenCache();
    accessToken = null;
    setSigninStatus('Session expired. Please sign in again.', true);
  }
}

// ===== FETCH WRAPPER =====
async function gfetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ===== SPREADSHEET =====
async function createSpreadsheet() {
  const name = $('new-sheet-name-input').value.trim() || SPREADSHEET_TITLE;
  showStatus(`Creating "${name}"...`, false, 0);
  try {
    const resp = await gfetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: name },
        sheets: [
          { properties: { title: SHEET_NAME } },
          { properties: { title: SETTINGS_SHEET } }
        ]
      })
    });
    spreadsheetId = resp.spreadsheetId;
    spreadsheetName = name;
    // 保存先フォルダが選択されている場合はルートから移動する
    if (selectedFolderId) {
      await gfetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${encodeURIComponent(selectedFolderId)}&removeParents=root&fields=id`,
        { method: 'PATCH', body: JSON.stringify({}) }
      );
    }
    saveSheetData();
    // 新規シートには常にデフォルト習慣をセットする
    habits = DEFAULT_HABITS.map(h => ({ ...h }));
    renderHabits();
    renderHabitsSettings();
    await initializeSheet();
    await saveHabitsToSheet();
    updateSheetStatus();
    showStatus(`✅ Created "${name}"`, false, 3000);
  } catch (e) {
    showStatus('Create failed: ' + e.message, true);
  }
}

function saveSheetData() {
  localStorage.setItem('sheetData', JSON.stringify({ id: spreadsheetId, name: spreadsheetName }));
  localStorage.setItem('spreadsheetId', spreadsheetId); // 後方互換
}

async function searchSpreadsheetsInDrive(query) {
  const q = query
    ? `name contains '${query.replace(/'/g,"\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    : `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const resp = await gfetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=20`
  );
  return resp.files || [];
}

async function connectToSheet(id, name) {
  spreadsheetId = id;
  spreadsheetName = name;
  saveSheetData();
  try {
    await loadHabitsFromSheet();
    updateSheetStatus();
    showStatus(`✅ Connected to "${name}"`, false, 3000);
  } catch (e) {
    showStatus('Connection failed: ' + e.message, true);
  }
  hide($('sheet-search-results'));
}

async function initializeSheet() {
  await sheetsUpdate([[...buildHeaderRow()]], `${SHEET_NAME}!A1`);
}

function buildHeaderRow() {
  return ['日付', ...habits.map(h => h.name), '朝食', '昼食', '間食', '夕食', '飲酒量', 'メモ'];
}

async function sheetsUpdate(values, range) {
  await gfetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values }) }
  );
}

async function sheetsGet(range) {
  const resp = await gfetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
  );
  return resp.values || [];
}

async function sheetsAppend(values, range) {
  await gfetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values }) }
  );
}

// ===== HABITS (Settings Sheet) =====
async function saveHabitsToSheet() {
  if (!spreadsheetId) return;
  const rows = [
    ['id', 'name', 'type', 'icon', 'prevDayCarryover', 'category'],
    ...habits.map(h => [h.id, h.name, h.type, h.icon || '', h.prevDayCarryover ? 'true' : 'false', h.category || 'Other'])
  ];
  await sheetsUpdate(rows, `${SETTINGS_SHEET}!A1`);
}

async function loadHabitsFromSheet() {
  if (!spreadsheetId) return;
  try {
    const rows = await sheetsGet(`${SETTINGS_SHEET}!A:F`);
    const loaded = rows.length < 2 ? [] : rows.slice(1).filter(r => r[0]).map(r => ({
      id: r[0], name: r[1] || '', type: r[2] || 'stars', icon: r[3] || '',
      prevDayCarryover: r[4] === 'true',
      category: CATEGORIES.includes(r[5]) ? r[5] : (CATEGORY_MIGRATION[r[5]] || 'Other')
    }));
    // 習慣が空ならデフォルト項目を適用してシートに保存する
    if (loaded.length === 0) {
      habits = DEFAULT_HABITS.map(h => ({ ...h }));
      await saveHabitsToSheet();
    } else {
      habits = loaded;
    }
    renderHabits();
    renderHabitsSettings();
  } catch (e) {
    console.warn('loadHabits error', e);
  }
}

// ===== RECORDS =====

// 指定日のデータを取得して返す（state変更なし）
async function fetchDayData(dateStr) {
  if (!spreadsheetId) return {};
  try {
    const rows = await sheetsGet(`${SHEET_NAME}!A:Z`);
    if (rows.length < 2) return {};
    const headers = rows[0];
    const row = rows.find(r => r[0] === dateStr);
    if (!row) return {};
    const data = {};
    headers.forEach((h, i) => { data[h] = row[i] || ''; });
    return data;
  } catch (e) {
    console.warn('fetchDayData error', e);
    return {};
  }
}

async function saveDayData() {
  if (!spreadsheetId) {
    showStatus('Please configure a spreadsheet first', true);
    return;
  }
  $('save-btn').disabled = true;
  $('save-btn').innerHTML = '<span class="loading-spinner"></span> Saving...';

  try {
    const newHeader = buildHeaderRow();

    // 全データを読み込んでヘッダーの変化を検出する
    const allRows = await sheetsGet(`${SHEET_NAME}!A:Z`);
    const oldHeader = allRows[0] || [];
    let dataRows = allRows.slice(1).filter(r => r[0]);

    // 習慣の追加・削除・並び替えでヘッダーが変わった場合、既存データを新スキーマに移行する
    if (JSON.stringify(oldHeader) !== JSON.stringify(newHeader)) {
      dataRows = dataRows.map(row =>
        newHeader.map(col => {
          const i = oldHeader.indexOf(col);
          return i >= 0 ? (row[i] || '') : '';
        })
      );
    }

    // 今日のデータ行を作成
    // 前日引き継ぎ値は編集されなくても保存する（引き継ぎチェーンが途切れないように）
    const todayRow = [currentDate];
    habits.forEach(h => todayRow.push(todayData[h.name] || prevDayDefaults[h.name] || ''));
    // 類似表記を正規形に統一してから保存する
    const breakfastVal = getCanonicalMealEntry('朝食', $('meal-breakfast').value);
    const lunchVal     = getCanonicalMealEntry('昼食', $('meal-lunch').value);
    const snackVal     = getCanonicalMealEntry('間食', $('meal-snack').value);
    const dinnerVal    = getCanonicalMealEntry('夕食', $('meal-dinner').value);
    if (breakfastVal !== $('meal-breakfast').value) $('meal-breakfast').value = breakfastVal;
    if (lunchVal     !== $('meal-lunch').value)     $('meal-lunch').value = lunchVal;
    if (snackVal     !== $('meal-snack').value)     $('meal-snack').value = snackVal;
    if (dinnerVal    !== $('meal-dinner').value)    $('meal-dinner').value = dinnerVal;
    todayRow.push(
      breakfastVal,
      lunchVal,
      snackVal,
      dinnerVal,
      todayData['飲酒量'] || '0',
      $('notes-input').value
    );

    // 今日の行を更新または追加
    const rowIndex = dataRows.findIndex(r => r[0] === currentDate);
    if (rowIndex >= 0) {
      dataRows[rowIndex] = todayRow;
    } else {
      dataRows.push(todayRow);
    }

    // ヘッダー＋全データを一括書き込み（スキーマ移行も兼ねる）
    await sheetsUpdate([newHeader, ...dataRows], `${SHEET_NAME}!A1`);

    // 保存後はデフォルト表示フラグを解除
    prevDayDefaults = {};
    clearDefaultIndicators();

    $('save-status').textContent = 'Saved: ' + new Date().toLocaleTimeString('en-US');
    showStatus('✅ Saved', false, 2000);
    // 保存後に食事履歴を更新してオートコンプリートに反映する
    loadMealHistory().catch(() => {});
  } catch (e) {
    showStatus('Save failed: ' + e.message, true);
  } finally {
    $('save-btn').disabled = false;
    $('save-btn').innerHTML = '💾 Save';
  }
}

// ===== UI: TODAY VIEW =====
function updateDateDisplay() {
  $('date-label').textContent = formatDate(currentDate);
  $('date-sub').textContent = currentDate === todayStr() ? 'Today' : '';
  $('next-day-btn').disabled = currentDate >= todayStr();
}

function renderHabits() {
  const list = $('habits-list');
  const empty = $('no-habits');
  if (habits.length === 0) { hide(list); show(empty); return; }
  show(list);
  hide(empty);

  list.innerHTML = '';
  // カテゴリごとにグループ表示する
  CATEGORIES.forEach(cat => {
    const catHabits = habits.filter(h => (h.category || 'Other') === cat);
    if (catHabits.length === 0) return;

    const header = document.createElement('div');
    header.className = 'habit-category-header';
    header.textContent = cat;
    list.appendChild(header);

    // メモ型は1列、それ以外は2列グリッドで表示する
    const memoHabits = catHabits.filter(h => h.type === 'memo');
    const gridHabits = catHabits.filter(h => h.type !== 'memo');

    if (gridHabits.length > 0) {
      const grid = document.createElement('div');
      grid.className = 'habits-grid';
      gridHabits.forEach(habit => {
        const item = document.createElement('div');
        item.className = 'habit-item';
        item.innerHTML = `<div class="habit-icon">${habit.icon || defaultIcon(habit.type)}</div>
           <div class="habit-name">${escHtml(habit.name)}</div>
           <div class="habit-control" id="ctrl-${habit.id}"></div>`;
        grid.appendChild(item);
      });
      list.appendChild(grid);
      gridHabits.forEach(habit => renderHabitControl(habit));
    }

    memoHabits.forEach(habit => {
      const item = document.createElement('div');
      item.className = 'habit-item habit-memo';
      item.innerHTML = `<div class="habit-item-header">
           <div class="habit-icon">${habit.icon || defaultIcon(habit.type)}</div>
           <div class="habit-name">${escHtml(habit.name)}</div>
         </div>
         <div class="habit-control" id="ctrl-${habit.id}"></div>`;
      list.appendChild(item);
      renderHabitControl(habit);
    });
  });
}

function renderHabitControl(habit) {
  const ctrl = $('ctrl-' + habit.id);
  if (!ctrl) return;
  const val = todayData[habit.name] || '';
  const def = prevDayDefaults[habit.name] || '';

  if (habit.type === 'stars') {
    const rating = parseInt(val) || 0;
    ctrl.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'star-rating';
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.className = 'star-btn' + (i <= rating ? ' filled' : '');
      btn.textContent = '★';
      btn.title = `${i}`;
      btn.addEventListener('click', () => setStarRating(habit, i));
      div.appendChild(btn);
    }
    ctrl.appendChild(div);
  } else if (habit.type === 'memo') {
    ctrl.innerHTML = '';
    const isDefault = !val && !!def;
    const ta = document.createElement('textarea');
    ta.className = 'habit-memo-input' + (isDefault ? ' is-default' : '');
    ta.value = val || def;
    ta.placeholder = 'Enter memo...';
    ta.rows = 2;
    ta.addEventListener('input', () => {
      todayData[habit.name] = ta.value;
      ta.classList.remove('is-default');
      ctrl.querySelector('.default-badge')?.remove();
    });
    ctrl.appendChild(ta);
    if (isDefault) {
      const badge = document.createElement('div');
      badge.className = 'default-badge';
      badge.textContent = '📋 From yesterday';
      ctrl.appendChild(badge);
    }
  } else {
    ctrl.innerHTML = '';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'check-toggle';
    cb.checked = val === '1' || val === 'true' || val === 'TRUE';
    cb.addEventListener('change', () => {
      todayData[habit.name] = cb.checked ? '1' : '0';
    });
    ctrl.appendChild(cb);
  }
}

function setStarRating(habit, rating) {
  // 同じ星をタップしたら0（未評価）に戻す
  const current = parseInt(todayData[habit.name]) || 0;
  todayData[habit.name] = current === rating ? '0' : String(rating);
  renderHabitControl(habit);
}

function defaultIcon(type) {
  return type === 'stars' ? '⭐' : type === 'memo' ? '📝' : '✅';
}

// テキスト入力フィールドの設定（前日デフォルト対応）
const TEXT_FIELDS = [
  { id: 'meal-breakfast', key: '朝食' },
  { id: 'meal-lunch',     key: '昼食' },
  { id: 'meal-snack',     key: '間食' },
  { id: 'meal-dinner',    key: '夕食' },
  { id: 'notes-input',   key: 'メモ' },
];

function fillTodayUI() {
  TEXT_FIELDS.forEach(({ id, key }) => {
    const el = $(id);
    el.value = todayData[key] || '';
    el.classList.remove('is-default');
    el.parentElement?.querySelector('.default-badge')?.remove();
  });
  habits.forEach(h => renderHabitControl(h));
  renderAlcoholRating();
}

function renderAlcoholRating() {
  const ctrl = $('ctrl-alcohol');
  if (!ctrl) return;
  const rating = parseInt(todayData['飲酒量']) || 0;
  ctrl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'star-rating';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.className = 'star-btn' + (i <= rating ? ' filled' : '');
    btn.textContent = '★';
    btn.title = `${i}`;
    btn.addEventListener('click', () => {
      // 同じ星をタップすると0（なし）に戻す
      const current = parseInt(todayData['飲酒量']) || 0;
      todayData['飲酒量'] = current === i ? '0' : String(i);
      renderAlcoholRating();
    });
    div.appendChild(btn);
  }
  ctrl.appendChild(div);
}

function updateDefaultBadge(textarea, show) {
  const card = textarea.closest('.meal-card, .section');
  if (!card) return;
  let badge = card.querySelector('.default-badge');
  if (show) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'default-badge';
      badge.textContent = '📋 From yesterday';
      textarea.after(badge);
    }
  } else {
    badge?.remove();
  }
}

function clearDefaultIndicators() {
  document.querySelectorAll('.is-default').forEach(el => el.classList.remove('is-default'));
  document.querySelectorAll('.default-badge').forEach(el => el.remove());
}

// 日付を切り替えてデータ読み込み（前日デフォルト対応）
async function loadAndShowDay(dateStr) {
  currentDate = dateStr;
  updateDateDisplay();
  todayData = await fetchDayData(dateStr);
  prevDayDefaults = {};

  // メモ型習慣で前日引き継ぎが有効かつ今日が未入力のものを確認
  if (spreadsheetId) {
    const memoHabitsNeedCarryover = habits.filter(
      h => h.type === 'memo' && h.prevDayCarryover && !todayData[h.name]
    );
    if (memoHabitsNeedCarryover.length > 0) {
      const prev = await fetchDayData(addDays(dateStr, -1));
      memoHabitsNeedCarryover.forEach(h => {
        if (prev[h.name]) prevDayDefaults[h.name] = prev[h.name];
      });
    }
  }

  fillTodayUI();
}

// ===== UI: HISTORY VIEW =====
function renderHistoryCalendar() {
  const monthSel = $('history-month-select');
  const now = new Date();
  monthSel.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const opt = document.createElement('option');
    opt.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    opt.textContent = `${months[d.getMonth()]} ${d.getFullYear()}`;
    monthSel.appendChild(opt);
  }
  renderCalendarForMonth(monthSel.value);
}

async function renderCalendarForMonth(yearMonth) {
  const cal = $('history-calendar');
  cal.innerHTML = '<div style="text-align:center;color:#9ca3af;font-size:13px;padding:16px">Loading...</div>';

  let records = new Set();
  if (spreadsheetId) {
    try {
      const rows = await sheetsGet(`${SHEET_NAME}!A:A`);
      rows.slice(1).forEach(r => { if (r[0]?.startsWith(yearMonth)) records.add(r[0]); });
    } catch (e) {}
  }

  const [year, month] = yearMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const today = todayStr();
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let html = '<div class="calendar-grid">';
  dayNames.forEach(d => { html += `<div class="cal-header">${d}</div>`; });
  for (let i = 0; i < firstDay.getDay(); i++) {
    html += '<div class="cal-day other-month"></div>';
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasData = records.has(ds);
    const isToday = ds === today;
    const cls = ['cal-day', hasData ? 'has-data' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-date="${ds}">${d}${hasData ? '<div class="cal-dot"></div>' : ''}</div>`;
  }
  html += '</div>';
  cal.innerHTML = html;

  cal.querySelectorAll('.cal-day[data-date]').forEach(el => {
    el.addEventListener('click', () => showHistoryDetail(el.dataset.date));
  });
}

async function showHistoryDetail(dateStr) {
  const detail = $('history-detail');
  detail.innerHTML = '<div style="text-align:center;color:#9ca3af;font-size:13px;padding:16px">Loading...</div>';
  show(detail);

  const d = await fetchDayData(dateStr);

  let html = `<h3 style="font-size:16px;font-weight:600;margin-bottom:16px">${formatDate(dateStr)}</h3>`;

  if (habits.length > 0) {
    html += '<div style="margin-bottom:12px">';
    habits.forEach(h => {
      const val = d[h.name] || '';
      let display = '';
      if (h.type === 'stars') {
        const n = parseInt(val) || 0;
        display = '★'.repeat(n) + '☆'.repeat(5 - n) + ` (${n}/5)`;
      } else {
        display = val === '1' ? '✅ Done' : '⬜ Not done';
      }
      html += `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--gray-200)">
        <span>${h.icon || defaultIcon(h.type)}</span>
        <span style="flex:1;font-size:14px;font-weight:500">${escHtml(h.name)}</span>
        <span style="font-size:14px;color:var(--gray-500)">${display}</span>
      </div>`;
    });
    html += '</div>';
  }

  const meals = [['朝食','🌅 Breakfast'], ['昼食','☀️ Lunch'], ['間食','🍪 Snack'], ['夕食','🌙 Dinner']];
  const hasMeal = meals.some(([k]) => d[k]);
  if (hasMeal) {
    html += '<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;color:var(--gray-600);margin-bottom:8px">Meals</div>';
    meals.forEach(([key, label]) => {
      if (d[key]) {
        html += `<div style="margin-bottom:6px">
          <span style="font-size:12px;color:var(--gray-500)">${label}</span><br>
          <span style="font-size:14px;color:var(--gray-700)">${escHtml(d[key])}</span></div>`;
      }
    });
    html += '</div>';
  }

  if (d['飲酒量'] && d['飲酒量'] !== '0') {
    const n = parseInt(d['飲酒量']) || 0;
    html += `<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;color:var(--gray-600);margin-bottom:4px">🍶 Alcohol</div>
      <span style="font-size:14px">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span></div>`;
  }

  if (d['メモ']) {
    html += `<div><div style="font-size:13px;font-weight:600;color:var(--gray-600);margin-bottom:4px">Notes</div>
      <p style="font-size:14px;color:var(--gray-700);white-space:pre-wrap">${escHtml(d['メモ'])}</p></div>`;
  }

  if (!habits.length && !hasMeal && !d['メモ']) {
    html += '<p style="color:#9ca3af;font-size:14px;text-align:center">No records</p>';
  }

  detail.innerHTML = html;
}

// ===== UI: SETTINGS =====
function updateSheetStatus() {
  const el = $('sheet-status');
  if (spreadsheetId) {
    el.className = 'sheet-status connected';
    const displayName = spreadsheetName || spreadsheetId;
    el.innerHTML = `✅ Connected: <strong>${escHtml(displayName)}</strong>`;
  } else {
    el.className = 'sheet-status';
    el.textContent = 'Not configured';
  }
}

function renderHabitsSettings() {
  const list = $('habits-settings-list');
  if (habits.length === 0) {
    list.innerHTML = '<p style="color:#9ca3af;font-size:14px;text-align:center;padding:16px">No habits yet</p>';
  } else {
    list.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const catHabits = habits.filter(h => (h.category || 'Other') === cat);

      const header = document.createElement('div');
      header.className = 'habit-category-header';
      header.textContent = `${cat} (${catHabits.length})`;
      list.appendChild(header);

      if (catHabits.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'color:#9ca3af;font-size:12px;padding:8px 4px;margin:0';
        empty.textContent = 'No items';
        list.appendChild(empty);
        return;
      }

      catHabits.forEach((h, idxInCat) => {
        const typeLabel = h.type === 'stars' ? '⭐ Stars' : h.type === 'memo' ? '📝 Memo' + (h.prevDayCarryover ? ' · carry over' : '') : '✅ Check';
        const catOptions = CATEGORIES.map(c => `<option value="${c}"${c === cat ? ' selected' : ''}>${c}</option>`).join('');

        const item = document.createElement('div');
        item.className = 'habit-settings-item';
        item.innerHTML = `
          <div class="habit-icon">${h.icon || defaultIcon(h.type)}</div>
          <div class="habit-settings-info">
            <div class="habit-settings-name">${escHtml(h.name)}</div>
            <div class="habit-settings-type">${typeLabel}</div>
          </div>
          <div class="habit-settings-actions">
            <button class="move-btn move-up-btn" data-id="${h.id}" title="Move up" ${idxInCat === 0 ? 'disabled' : ''}>↑</button>
            <button class="move-btn move-down-btn" data-id="${h.id}" title="Move down" ${idxInCat === catHabits.length - 1 ? 'disabled' : ''}>↓</button>
            <select class="category-select" data-id="${h.id}">${catOptions}</select>
            <button class="icon-action-btn edit-habit" data-id="${h.id}" title="編集">✏️</button>
            <button class="icon-action-btn delete delete-habit" data-id="${h.id}" title="Delete">🗑️</button>
          </div>
        `;
        list.appendChild(item);
      });
    });

    // イベント登録
    list.querySelectorAll('.move-up-btn').forEach(btn => {
      btn.addEventListener('click', () => moveHabitUp(btn.dataset.id));
    });
    list.querySelectorAll('.move-down-btn').forEach(btn => {
      btn.addEventListener('click', () => moveHabitDown(btn.dataset.id));
    });
    list.querySelectorAll('.category-select').forEach(sel => {
      sel.addEventListener('change', () => changeHabitCategory(sel.dataset.id, sel.value));
    });
    list.querySelectorAll('.edit-habit').forEach(btn => {
      btn.addEventListener('click', () => openHabitModal(btn.dataset.id));
    });
    list.querySelectorAll('.delete-habit').forEach(btn => {
      btn.addEventListener('click', () => deleteHabit(btn.dataset.id));
    });
  }

  // 表示設定のトグルを同期
  const toggle = $('prev-day-toggle');
  if (toggle) toggle.checked = appSettings.prevDayDefault;
}

// ===== HABIT MODAL =====
function openHabitModal(id = null) {
  editingHabitId = id;
  $('modal-title').textContent = id ? 'Edit Habit' : 'Add Habit';
  $('habit-name-input').value = '';
  $('habit-icon-input').value = '';
  $('habit-carryover-input').checked = false;
  document.querySelector('input[name="habit-type"][value="stars"]').checked = true;
  document.querySelector('input[name="habit-category"][value="Health"]').checked = true;
  hide($('memo-carryover-group'));

  if (id) {
    const h = habits.find(h => h.id === id);
    if (h) {
      $('habit-name-input').value = h.name;
      $('habit-icon-input').value = h.icon || '';
      document.querySelector(`input[name="habit-type"][value="${h.type}"]`).checked = true;
      $('habit-carryover-input').checked = h.prevDayCarryover || false;
      if (h.type === 'memo') show($('memo-carryover-group'));
      const catVal = CATEGORY_MIGRATION[h.category] || h.category || 'Other';
      document.querySelector(`input[name="habit-category"][value="${catVal}"]`).checked = true;
    }
  }
  renderEmojiPicker($('habit-icon-input').value);
  show($('habit-modal'));
  $('habit-name-input').focus();
}

function closeHabitModal() {
  hide($('habit-modal'));
  editingHabitId = null;
}

async function saveHabitFromModal() {
  const name = $('habit-name-input').value.trim();
  if (!name) { $('habit-name-input').focus(); return; }
  const type = document.querySelector('input[name="habit-type"]:checked').value;
  const icon = $('habit-icon-input').value.trim();
  const prevDayCarryover = type === 'memo' && $('habit-carryover-input').checked;
  const category = document.querySelector('input[name="habit-category"]:checked').value;

  if (editingHabitId) {
    const h = habits.find(h => h.id === editingHabitId);
    if (h) { h.name = name; h.type = type; h.icon = icon; h.prevDayCarryover = prevDayCarryover; h.category = category; }
  } else {
    habits.push({ id: genId(), name, type, icon, prevDayCarryover, category });
  }

  closeHabitModal();
  renderHabits();
  renderHabitsSettings();
  if (spreadsheetId) {
    await saveHabitsToSheet();
    await initializeSheet();
  }
}

// カテゴリ内で習慣を上に移動する
async function moveHabitUp(id) {
  const h = habits.find(h => h.id === id);
  if (!h) return;
  const catHabits = habits.filter(h2 => (h2.category || 'Other') === (h.category || 'Other'));
  const idxInCat = catHabits.findIndex(h2 => h2.id === id);
  if (idxInCat <= 0) return;
  const prev = catHabits[idxInCat - 1];
  const gi = habits.indexOf(h);
  const gp = habits.indexOf(prev);
  [habits[gi], habits[gp]] = [habits[gp], habits[gi]];
  renderHabits();
  renderHabitsSettings();
  if (spreadsheetId) saveHabitsToSheet().catch(() => {});
}

// カテゴリ内で習慣を下に移動する
async function moveHabitDown(id) {
  const h = habits.find(h => h.id === id);
  if (!h) return;
  const catHabits = habits.filter(h2 => (h2.category || 'Other') === (h.category || 'Other'));
  const idxInCat = catHabits.findIndex(h2 => h2.id === id);
  if (idxInCat >= catHabits.length - 1) return;
  const next = catHabits[idxInCat + 1];
  const gi = habits.indexOf(h);
  const gn = habits.indexOf(next);
  [habits[gi], habits[gn]] = [habits[gn], habits[gi]];
  renderHabits();
  renderHabitsSettings();
  if (spreadsheetId) saveHabitsToSheet().catch(() => {});
}

// 習慣のカテゴリを変更する
async function changeHabitCategory(id, newCategory) {
  const h = habits.find(h => h.id === id);
  if (!h || h.category === newCategory) return;
  h.category = newCategory;
  renderHabits();
  renderHabitsSettings();
  if (spreadsheetId) saveHabitsToSheet().catch(() => {});
}

async function deleteHabit(id) {
  if (!confirm('Delete this item?\n(Previously recorded data for this column will remain.)')) return;
  habits = habits.filter(h => h.id !== id);
  renderHabits();
  renderHabitsSettings();
  if (spreadsheetId) await saveHabitsToSheet();
}

// ===== VIEW SWITCHING =====
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // ヘッダーナビ＆ボトムナビ両方を更新
  document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));

  const target = $('view-' + view);
  target.classList.remove('hidden'); // hidden !important があっても確実に解除
  target.classList.add('active');
  document.querySelectorAll(`[data-view="${view}"]`).forEach(b => b.classList.add('active'));

  if (view === 'history') renderHistoryCalendar();
  if (view === 'settings') { updateSheetStatus(); renderHabitsSettings(); }
}

// ===== SCREEN SWITCHING =====
function showAuthScreen() {
  hide($('app-screen'));
  show($('auth-screen'));
}

async function showAppScreen() {
  hide($('auth-screen'));
  show($('app-screen'));

  // sheetData（新形式）または spreadsheetId（旧形式）から復元
  try {
    const saved = localStorage.getItem('sheetData');
    if (saved) {
      const data = JSON.parse(saved);
      spreadsheetId = data.id;
      spreadsheetName = data.name || '';
    } else {
      const oldId = localStorage.getItem('spreadsheetId');
      if (oldId) { spreadsheetId = oldId; spreadsheetName = ''; }
    }
    if (spreadsheetId) await loadHabitsFromSheet();
  } catch (e) {
    console.warn('Could not load from saved sheet:', e);
  }

  updateDateDisplay();
  await loadAndShowDay(currentDate);
  renderHabits();
  renderHabitsSettings();
  updateSheetStatus();
  updateFolderStatus();
  loadMealHistory().catch(() => {});
}

// ===== MEAL HISTORY & AUTOCOMPLETE =====

const MEAL_AC_FIELDS = [
  { id: 'meal-breakfast', suggId: 'sugg-breakfast', key: '朝食' },
  { id: 'meal-lunch',     suggId: 'sugg-lunch',     key: '昼食' },
  { id: 'meal-snack',     suggId: 'sugg-snack',     key: '間食' },
  { id: 'meal-dinner',    suggId: 'sugg-dinner',    key: '夕食' },
];

// 文字列を文字単位でソートして類似判定用のキーを生成する（語順違いを同一視）
function normalizeForSimilarity(s) {
  return s.replace(/\s+/g, '').split('').sort().join('');
}

// 類似エントリを除去して正規形（最初に登場した表記）のみ残す
function deduplicateSimilar(entries) {
  const seen = new Map(); // normalizedKey → canonical
  entries.forEach(entry => {
    const key = normalizeForSimilarity(entry);
    if (!seen.has(key)) seen.set(key, entry);
  });
  return [...seen.values()].reverse(); // 最新を上に表示
}

// 入力値が既存の正規形と類似していれば正規形に変換して返す（改行区切りの複数アイテム対応）
function getCanonicalMealEntry(mealKey, input) {
  if (!input.trim()) return input;
  return input.split('\n').map(line => {
    const s = line.trim();
    if (!s) return s;
    const normalized = normalizeForSimilarity(s);
    for (const canonical of (mealHistory[mealKey] || [])) {
      if (normalizeForSimilarity(canonical) === normalized && canonical !== s) {
        return canonical;
      }
    }
    return s;
  }).join('\n');
}

// スプレッドシートから食事履歴を読み込む
async function loadMealHistory() {
  if (!spreadsheetId) return;
  try {
    const rows = await sheetsGet(`${SHEET_NAME}!A:Z`);
    if (rows.length < 2) return;
    const headers = rows[0];
    const mealKeys = ['朝食', '昼食', '間食', '夕食'];
    const rawHistory = {};
    mealKeys.forEach(k => { rawHistory[k] = []; });

    rows.slice(1).forEach(row => {
      mealKeys.forEach(k => {
        const i = headers.indexOf(k);
        if (i >= 0 && row[i]?.trim()) {
          // 改行でアイテムを分割して個別に履歴へ追加する
          row[i].trim().split('\n').forEach(line => {
            const l = line.trim();
            if (l) rawHistory[k].push(l);
          });
        }
      });
    });

    mealKeys.forEach(k => {
      mealHistory[k] = deduplicateSimilar(rawHistory[k]);
    });
  } catch (e) {
    console.warn('loadMealHistory error:', e);
  }
}

// 食事欄のオートコンプリートイベントを設定する
function setupMealAutocomplete() {
  MEAL_AC_FIELDS.forEach(({ id, suggId, key }) => {
    const ta = $(id);
    const dropdown = $(suggId);
    if (!ta || !dropdown) return;

    const refresh = () => renderMealSuggestions(ta, dropdown, key);
    ta.addEventListener('focus', refresh);
    ta.addEventListener('input', refresh);
    ta.addEventListener('blur', () => setTimeout(() => hide(dropdown), 150));
  });
}

function renderMealSuggestions(ta, dropdown, key) {
  const history = mealHistory[key] || [];
  const q = ta.value.trim();
  const matches = history.filter(h =>
    !q || h.includes(q) || normalizeForSimilarity(h) === normalizeForSimilarity(q)
  );

  if (matches.length === 0) { hide(dropdown); return; }

  dropdown.innerHTML = '';
  matches.slice(0, 10).forEach(item => {
    const div = document.createElement('div');
    div.className = 'meal-suggestion-item';
    div.textContent = item;
    // mousedownでblurより先に発火させてドロップダウンを閉じる前に値をセットする
    div.addEventListener('mousedown', e => {
      e.preventDefault();
      ta.value = item;
      hide(dropdown);
    });
    dropdown.appendChild(div);
  });
  show(dropdown);
}

// ===== FOLDER PICKER =====
async function listDriveFolders(parentId) {
  const parent = parentId || 'root';
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parent}' in parents`;
  const resp = await gfetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name&pageSize=100`
  );
  return resp.files || [];
}

function openFolderPicker() {
  folderPickerStack = [];
  show($('folder-picker-modal'));
  renderFolderPicker(null, 'My Drive');
}

async function renderFolderPicker(folderId, folderName) {
  const listEl = $('folder-list');
  const breadcrumbEl = $('folder-breadcrumb');

  listEl.innerHTML = '<p style="padding:16px;color:#9ca3af;font-size:14px;text-align:center">Loading...</p>';

  // パンくずリストを構築
  breadcrumbEl.innerHTML = '';
  const addBreadcrumb = (label, onClick, isCurrent) => {
    const span = document.createElement('span');
    span.className = isCurrent ? 'folder-breadcrumb-current' : 'folder-breadcrumb-item';
    span.textContent = label;
    if (!isCurrent) span.addEventListener('click', onClick);
    breadcrumbEl.appendChild(span);
  };

  addBreadcrumb('My Drive', async () => {
    folderPickerStack = [];
    await renderFolderPicker(null, 'My Drive');
  }, folderPickerStack.length === 0 && !folderId);

  folderPickerStack.forEach((item, i) => {
    const sep = document.createElement('span');
    sep.className = 'folder-breadcrumb-sep';
    sep.textContent = ' › ';
    breadcrumbEl.appendChild(sep);
    const isLast = i === folderPickerStack.length - 1;
    addBreadcrumb(item.name, async () => {
      folderPickerStack = folderPickerStack.slice(0, i + 1);
      await renderFolderPicker(item.id, item.name);
    }, isLast && !folderId);
  });

  if (folderId && folderPickerStack.length > 0) {
    const sep = document.createElement('span');
    sep.className = 'folder-breadcrumb-sep';
    sep.textContent = ' › ';
    breadcrumbEl.appendChild(sep);
    addBreadcrumb(folderName, null, true);
  }

  // "ここに保存"ボタンにフォルダ情報をセット
  const hereBtn = $('folder-select-here-btn');
  hereBtn.dataset.folderId = folderId || '';
  hereBtn.dataset.folderName = folderId ? folderName : 'My Drive (root)';

  try {
    const folders = await listDriveFolders(folderId);
    listEl.innerHTML = '';
    if (folders.length === 0) {
      listEl.innerHTML = '<p style="padding:16px;color:#9ca3af;font-size:14px;text-align:center">No subfolders</p>';
      return;
    }
    folders.forEach(folder => {
      const item = document.createElement('div');
      item.className = 'folder-item';
      item.innerHTML = `<span class="folder-item-icon">📁</span><span class="folder-item-name">${escHtml(folder.name)}</span><span style="margin-left:auto;color:#9ca3af;font-size:12px">›</span>`;
      item.addEventListener('click', async () => {
        folderPickerStack.push({ id: folderId, name: folderId ? folderName : 'My Drive' });
        await renderFolderPicker(folder.id, folder.name);
      });
      listEl.appendChild(item);
    });
  } catch (e) {
    listEl.innerHTML = `<p style="padding:16px;color:#ef4444;font-size:14px">Load failed: ${escHtml(e.message)}</p>`;
  }
}

function closeFolderPicker() {
  hide($('folder-picker-modal'));
  folderPickerStack = [];
}

function saveFolderData() {
  localStorage.setItem('selectedFolder', JSON.stringify({ id: selectedFolderId, name: selectedFolderName }));
}

function updateFolderStatus() {
  const el = $('folder-status');
  if (el) el.textContent = selectedFolderName || 'My Drive (root)';
}

// ===== SETTINGS =====
// 認証不要な設定をLocalStorageから復元する（起動時に呼ぶ）
function loadSettings() {
  try {
    const saved = localStorage.getItem('sheetData');
    if (saved) {
      const data = JSON.parse(saved);
      spreadsheetId = data.id || null;
      spreadsheetName = data.name || '';
    } else {
      const oldId = localStorage.getItem('spreadsheetId');
      if (oldId) { spreadsheetId = oldId; spreadsheetName = ''; }
    }
    const folderData = localStorage.getItem('selectedFolder');
    if (folderData) {
      const f = JSON.parse(folderData);
      selectedFolderId = f.id || null;
      selectedFolderName = f.name || 'My Drive (root)';
    }
  } catch (e) {
    console.warn('loadSettings error:', e);
  }
}

// ===== RHYTHMCARE CSV IMPORT =====

// ダブルクォート対応のシンプルなCSVパーサー
function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function importRhythmCareCSV(file) {
  const raw = await file.text();
  // BOM除去・改行正規化
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');

  // 行1: "RhythmCare"（スキップ）、行2: ヘッダー、行3: サブヘッダー、行4以降: データ
  if (lines.length < 4) throw new Error('無効なCSVファイルです');

  const headers    = parseCSVRow(lines[1]);
  const subheaders = parseCSVRow(lines[2]);

  // 各項目名 → 値列インデックスを構築（サブヘッダーが"コメント"でない列が値列）
  const colMap = {}; // {itemName: valueColIndex}
  for (let i = 1; i < headers.length; i++) {
    const name = headers[i].trim();
    const sub  = (subheaders[i] || '').trim();
    if (name && sub !== 'コメント') colMap[name] = i;
  }

  const sheetHeader = buildHeaderRow();

  // データ行をパース
  const importRows = [];
  for (const line of lines.slice(3)) {
    if (!line.trim()) continue;
    const row = parseCSVRow(line);
    if (!row[0] || !row[0].trim()) continue;

    // 全値列が空なら skip
    const hasData = Object.values(colMap).some(i => (row[i] || '').trim());
    if (!hasData) continue;

    // 日付: YYYY/MM/DD → YYYY-MM-DD
    const dateStr = row[0].trim().replace(/\//g, '-');

    // 習慣列（MealとAlcoholはhhtracker固定列へ統合するので除外）
    const habitValues = habits.map(h => {
      const idx = colMap[h.name];
      return idx !== undefined ? (row[idx] || '') : '';
    });

    // 固定列: Meal→朝食、Alcohol→飲酒量
    const breakfast = (row[colMap['Meal']] || '').trim();
    const alcohol   = (row[colMap['Alcohol']] || '').trim() || '0';

    const sheetRow = [dateStr, ...habitValues, breakfast, '', '', '', alcohol, ''];
    importRows.push(sheetRow);
  }

  if (importRows.length === 0) throw new Error('インポートできるデータがありません');

  // 既存シートデータと日付キーでマージ
  const allRows = await sheetsGet(`${SHEET_NAME}!A:Z`);
  const oldHeader = allRows[0] || [];
  let existingRows = allRows.slice(1).filter(r => r[0]);

  // 既存データを現在のヘッダーに移行
  let mergedRows = existingRows.map(row =>
    sheetHeader.map(col => { const i = oldHeader.indexOf(col); return i >= 0 ? (row[i] || '') : ''; })
  );

  // インポートデータをマージ（同日付は上書き）
  for (const importRow of importRows) {
    const idx = mergedRows.findIndex(r => r[0] === importRow[0]);
    if (idx >= 0) mergedRows[idx] = importRow;
    else mergedRows.push(importRow);
  }

  // 日付順にソート
  mergedRows.sort((a, b) => a[0].localeCompare(b[0]));

  await sheetsUpdate([sheetHeader, ...mergedRows], `${SHEET_NAME}!A1`);
  return importRows.length;
}

// ===== UTILITY =====
function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== EVENT LISTENERS =====
function attachEvents() {
  // 食事欄オートコンプリート
  setupMealAutocomplete();

  // Auth
  $('signin-btn').addEventListener('click', signIn);
  $('signout-btn').addEventListener('click', signOut);
  $('settings-signout-btn').addEventListener('click', signOut);

  // User menu toggle
  $('user-avatar').addEventListener('click', e => {
    e.stopPropagation();
    $('user-dropdown').classList.toggle('hidden');
  });
  document.addEventListener('click', () => hide($('user-dropdown')));

  // ヘッダーナビ
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // ボトムナビ（モバイル）
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // 日付ナビゲーション
  $('prev-day-btn').addEventListener('click', () => loadAndShowDay(addDays(currentDate, -1)));
  $('next-day-btn').addEventListener('click', () => {
    if (currentDate < todayStr()) loadAndShowDay(addDays(currentDate, 1));
  });

  // 保存
  $('save-btn').addEventListener('click', saveDayData);

  // 習慣追加（今日ビューのボタン）
  $('add-habit-btn').addEventListener('click', () => {
    switchView('settings');
    setTimeout(() => openHabitModal(), 50);
  });

  // テキストエリアを編集したらデフォルト表示フラグを解除
  TEXT_FIELDS.forEach(({ id }) => {
    $(id).addEventListener('input', e => {
      e.target.classList.remove('is-default');
      e.target.parentElement.querySelector('.default-badge')?.remove();
    });
  });

  // 設定: フォルダ選択
  $('select-folder-btn').addEventListener('click', openFolderPicker);
  $('folder-modal-close-btn').addEventListener('click', closeFolderPicker);
  $('folder-cancel-btn').addEventListener('click', closeFolderPicker);
  $('folder-picker-modal').querySelector('.modal-overlay').addEventListener('click', closeFolderPicker);
  $('folder-select-here-btn').addEventListener('click', () => {
    const btn = $('folder-select-here-btn');
    selectedFolderId = btn.dataset.folderId || null;
    selectedFolderName = btn.dataset.folderName || 'My Drive (root)';
    saveFolderData();
    updateFolderStatus();
    closeFolderPicker();
    showStatus(`📁 Save folder: ${selectedFolderName}`, false, 2000);
  });

  // 設定: スプレッドシート作成
  $('create-sheet-btn').addEventListener('click', createSpreadsheet);

  // 設定: スプレッドシート検索
  $('search-sheet-btn').addEventListener('click', async () => {
    const query = $('sheet-search-input').value.trim();
    const resultsEl = $('sheet-search-results');
    resultsEl.innerHTML = '<div style="padding:8px;color:#9ca3af;font-size:13px">Searching...</div>';
    show(resultsEl);
    try {
      const files = await searchSpreadsheetsInDrive(query);
      if (files.length === 0) {
        resultsEl.innerHTML = '<div style="padding:8px;color:#9ca3af;font-size:13px">No results found</div>';
        return;
      }
      resultsEl.innerHTML = '';
      files.forEach(f => {
        const item = document.createElement('div');
        item.className = 'sheet-result-item';
        const date = new Date(f.modifiedTime).toLocaleDateString('en-US');
        item.innerHTML = `<span class="sheet-result-name">${escHtml(f.name)}</span><span class="sheet-result-date">${date}</span>`;
        item.addEventListener('click', () => connectToSheet(f.id, f.name));
        resultsEl.appendChild(item);
      });
    } catch (e) {
      resultsEl.innerHTML = `<div style="padding:8px;color:#ef4444;font-size:13px">Error: ${e.message}</div>`;
    }
  });
  $('sheet-search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('search-sheet-btn').click();
  });

  // 設定: 習慣追加ボタン
  $('add-habit-settings-btn').addEventListener('click', () => openHabitModal());

  // 設定: RhythmCare CSVインポート
  $('rc-import-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!spreadsheetId) {
      showStatus('先にスプレッドシートを設定してください', true);
      e.target.value = '';
      return;
    }
    showStatus('インポート中...', false, 0);
    try {
      const count = await importRhythmCareCSV(file);
      showStatus(`✅ ${count}件のデータをインポートしました`, false, 5000);
    } catch (err) {
      showStatus('インポート失敗: ' + err.message, true);
    } finally {
      e.target.value = '';
    }
  });

  // モーダル
  $('modal-close-btn').addEventListener('click', closeHabitModal);
  $('modal-cancel-btn').addEventListener('click', closeHabitModal);
  $('modal-save-btn').addEventListener('click', saveHabitFromModal);
  $('habit-modal').querySelector('.modal-overlay').addEventListener('click', closeHabitModal);

  // 履歴: 月選択
  $('history-month-select').addEventListener('change', e => {
    renderCalendarForMonth(e.target.value);
    hide($('history-detail'));
  });

  // モーダル: 種類変更で前日引き継ぎオプション表示切替
  document.querySelectorAll('input[name="habit-type"]').forEach(r => {
    r.addEventListener('change', () => {
      const isMemo = document.querySelector('input[name="habit-type"]:checked').value === 'memo';
      isMemo ? show($('memo-carryover-group')) : hide($('memo-carryover-group'));
    });
  });

  // モーダル: Enterキー確定
  $('habit-name-input').addEventListener('keydown', e => {
    // IME変換中のEnterキーは無視する（日本語入力の確定と保存が競合するため）
    if (e.key === 'Enter' && !e.isComposing) saveHabitFromModal();
  });
}

// ===== INIT =====
window.addEventListener('load', () => {
  loadSettings();

  // イベントリスナーはGIS読み込みと無関係にすぐ設定する
  attachEvents();

  // Service Worker 登録（Android PWA 対応）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
  }

  // キャッシュされたトークンがあれば即座にログインしてログイン画面をスキップする
  const cachedToken = loadTokenCache();
  if (cachedToken) {
    accessToken = cachedToken;
    fetchUserProfile();
    // バックグラウンドでGISを準備してトークン期限切れ時の再取得に備える
    loadGISScript(() => initGIS());
    return;
  }

  // キャッシュなし → GISを読み込んでサイレント認証を試みる
  loadGISScript(() => initGIS());
});

function loadGISScript(onload) {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = onload;
  script.onerror = () => {
    showStatus('Failed to load Google library. Please check your network connection.', true, 0);
  };
  document.head.appendChild(script);
}
