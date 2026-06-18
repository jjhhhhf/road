/* global API, initMap, renderCommunity, renderAchievements, renderProfile */

let STATE = null;
let currentUser = null;

// ── Toast ──────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}
window.showToast = showToast;

// ── Navigation ─────────────────────────────────────────
function activateView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(id + '-view').classList.add('active');
  document.querySelector(`.nav-btn[data-view="${id}"]`).classList.add('active');

  if (id === 'map' && STATE) { renderNearbyList(STATE); window.invalidateMapSize && setTimeout(window.invalidateMapSize, 50); }
  if (id === 'community' && STATE) renderCommunity(STATE);
  if (id === 'achievements' && STATE) renderAchievements(STATE);
  if (id === 'profile' && STATE) renderProfile(STATE, currentUser);
}

document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => activateView(btn.dataset.view));
});

// ── Auth overlay ───────────────────────────────────────
const authOverlay = document.getElementById('auth-overlay');
const authError = document.getElementById('auth-error');
let authMode = 'login';

document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    authMode = tab.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('auth-register-fields').classList.toggle('hidden', authMode !== 'register');
    authError.textContent = '';
  });
});

document.getElementById('auth-submit').addEventListener('click', async () => {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  authError.textContent = '';
  try {
    if (authMode === 'login') {
      // admin / admindemo → 驗證 Basic Auth 後跳轉管理後台
      if (username === 'admin' || username === 'admindemo') {
        const creds = btoa(unescape(encodeURIComponent(username + ':' + password)));
        const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Basic ' + creds } });
        if (r.status === 401) { authError.textContent = '帳號或密碼錯誤'; return; }
        if (username === 'admindemo') {
          await fetch('/api/demo/seed', { method: 'POST' });
        }
        sessionStorage.setItem('adminCreds', creds);
        window.location.href = '/admin.html';
        return;
      }
      // demo → 植入展示資料後登入並飛至燕巢
      if (username === 'demo') {
        await fetch('/api/demo/seed', { method: 'POST' });
        const { user } = await API.auth.login({ username, password });
        currentUser = user;
        authOverlay.classList.add('hidden');
        await loadState();
        window.panTo && window.panTo(22.6916, 120.3763, 16);
        showToast('✅ 展示模式，地圖移至燕巢校區');
        return;
      }
      // 一般登入
      const { user } = await API.auth.login({ username, password });
      currentUser = user;
    } else {
      const name = document.getElementById('auth-name').value.trim();
      const city = document.getElementById('auth-city').value.trim();
      await API.auth.register({ username, password, name, city });
      const { user } = await API.auth.login({ username, password });
      currentUser = user;
    }
    authOverlay.classList.add('hidden');
    await loadState();
  } catch (e) {
    const msgs = { invalid_login: '帳號或密碼錯誤', username_taken: '帳號已被使用', invalid_username: '帳號格式不符（3-24 字，英數底線）', weak_password: '密碼至少 6 字元' };
    authError.textContent = msgs[e.message] || e.message;
  }
});

// ── Load state ─────────────────────────────────────────
async function loadState() {
  window.initMap && window.initMap();
  try {
    STATE = await API.state();
    currentUser = STATE.me;
    renderFilterChips(STATE.categories || []);
    updateStatsBar(STATE);
    window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
    renderNearbyList(STATE);
    document.getElementById('fab').classList.remove('hidden');
  } catch {
    // not logged in — show auth
    authOverlay.classList.remove('hidden');
  }
}

function updateStatsBar(state) {
  const total = state.hazards.length;
  const pending = state.hazards.filter((h) => h.status === 'pending').length;
  const fixed = state.hazards.filter((h) => h.status === 'fixed').length;
  const pct = total > 0 ? Math.round((fixed / total) * 100) : 0;
  document.getElementById('stat-total').textContent = total.toLocaleString();
  document.getElementById('stat-pending').textContent = pending.toLocaleString();
  document.getElementById('stat-fixed').textContent = pct + '%';
}

// ── Nearby list ────────────────────────────────────────
let activeFilter = 'all';
function renderNearbyList(state) {
  const list = document.getElementById('nearby-list');
  let hazards = [...state.hazards];
  if (activeFilter !== 'all') hazards = hazards.filter((h) => h.categoryId === activeFilter);
  hazards = hazards.slice(0, 20);

  list.innerHTML = `
    <div class="section-header">
      <span class="title">📍 附近排雷點</span>
      <span class="see-all">查看全部</span>
    </div>
    ${hazards.map((h) => hazardCard(h, state.categories)).join('')}
  `;

  list.querySelectorAll('.hazard-card').forEach((card) => {
    card.addEventListener('click', () => {
      const h = state.hazards.find((x) => x.id === card.dataset.id);
      if (h) window.panTo && window.panTo(h.lat, h.lng, 17);
      showPopup(card.dataset.id, state);
    });
  });
}

function hazardCard(h, cats = []) {
  const cat = cats.find((c) => c.id === h.categoryId);
  const emoji = h.emoji || cat?.emoji || '⚠️';
  const sevLabel = ['', '輕微', '輕度', '中度', '嚴重', '極危'][h.severity] || '中度';
  const statusLabel = { pending: '待審', verified: '已驗證', fixed: '已修復', rejected: '已駁回' }[h.status] || h.status;
  const accentColor = h.colors?.[0] || '#FF3B4E';
  return `
    <div class="hazard-card" data-id="${h.id}" style="border-left:3px solid ${accentColor}">
      <div class="hazard-icon" style="background:linear-gradient(135deg,${accentColor}22,${h.colors?.[1]||'#FF6B35'}22)">${emoji}</div>
      <div class="hazard-info">
        <div class="hazard-title">${escHtml(h.title)}</div>
        <div class="hazard-meta">📍 ${escHtml(h.label)}</div>
        <div class="hazard-tags">
          <span class="tag tag-sev-${h.severity}">${sevLabel}</span>
          <span class="tag tag-status-${h.status}">${statusLabel}</span>
          ${cat ? `<span class="tag tag-type">${cat.name}</span>` : ''}
        </div>
      </div>
    </div>`;
}

// ── Category filter chips ──────────────────────────────
function renderFilterChips(categories) {
  const bar = document.getElementById('map-filters');
  bar.innerHTML = `<button class="filter-chip active" data-cat="all">全部</button>` +
    categories.map((c) => `<button class="filter-chip" data-cat="${c.id}">${c.emoji} ${c.name}</button>`).join('');
  bar.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.cat;
      if (STATE) {
        renderNearbyList(STATE);
        const filtered = activeFilter === 'all'
          ? STATE.hazards
          : STATE.hazards.filter((h) => h.categoryId === activeFilter);
        window.renderMapHazards && window.renderMapHazards(filtered, STATE.categories);
      }
    });
  });
}

// ── Popup card ─────────────────────────────────────────
window.showHazardPopup = (hazardId) => { if (STATE) showPopup(hazardId, STATE); };

function showPopup(hazardId, state) {
  const h = state.hazards.find((x) => x.id === hazardId);
  if (!h) return;
  const cat = state.categories?.find((c) => c.id === h.categoryId);
  const popup = document.getElementById('popup-card');
  const sevLabel = ['', '輕微', '輕度', '中度', '嚴重', '極危'][h.severity] || '';
  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">${escHtml(h.title)}</span>
      <button class="popup-close" onclick="document.getElementById('popup-card').classList.add('hidden')">✕</button>
    </div>
    <div class="popup-meta">
      ${cat ? `<span>${cat.emoji} ${cat.name}</span>` : ''}
      <span class="tag tag-sev-${h.severity}">${sevLabel}</span>
      <span class="tag tag-status-${h.status}">${{ pending:'待審', verified:'已驗證', fixed:'已修復', rejected:'已駁回' }[h.status]||''}</span>
    </div>`;
  popup.classList.remove('hidden');
}

// ── Report modal ───────────────────────────────────────
let selectedSeverity = 3;
let selectedCategoryId = null;
let uploadedPhotoUrl = null;
let currentGps = null;

document.getElementById('fab').addEventListener('click', openReportModal);

function openReportModal() {
  if (!STATE) return;
  selectedSeverity = 3;
  selectedCategoryId = null;
  uploadedPhotoUrl = null;
  document.getElementById('report-desc').value = '';
  document.getElementById('report-photo-preview').innerHTML = '';
  updateSeverityUI();
  renderCategoryPicker(STATE.categories || []);
  document.getElementById('report-modal').classList.remove('hidden');
  // HTTP 非 localhost 下手機瀏覽器會拒絕 GPS，直接顯示地圖選點
  const isHttpMobile = location.protocol === 'http:' && location.hostname !== 'localhost';
  if (!navigator.geolocation || isHttpMobile) {
    currentGps = null;
    setGpsStatus('fail');
  } else {
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsStatus('ok');
      },
      () => {
        currentGps = null;
        setGpsStatus('fail');
      },
      { timeout: 5000, maximumAge: 60000 },
    );
  }
}

function setGpsStatus(state) {
  const el = document.getElementById('gps-status');
  if (!el) return;
  if (state === 'loading') {
    el.innerHTML = '<span style="color:var(--text3)">⏳ 取得 GPS 位置中…</span>';
    el.style.display = 'block';
  } else if (state === 'ok') {
    el.innerHTML = '<span style="color:var(--green)">✓ 已取得 GPS 位置</span>';
    el.style.display = 'block';
  } else if (state === 'map') {
    el.innerHTML = '<span style="color:var(--green)">✓ 地圖選取位置</span>';
    el.style.display = 'block';
  } else {
    el.innerHTML = `<span style="color:var(--gold)">⚠ GPS 無法取得 &nbsp;</span><button class="btn-pick-map" onclick="startMapPick()">在地圖點選位置</button>`;
    el.style.display = 'block';
  }
}

function startMapPick() {
  document.getElementById('report-modal').classList.add('hidden');
  document.getElementById('map-pick-bar').classList.remove('hidden');
  window.setPickingMode && window.setPickingMode(true);
  window.pickingLocation = true;
  window.onMapPick = (lat, lng) => confirmMapPick(lat, lng);
}

function confirmMapPick(lat, lng) {
  if (lat == null || lng == null) {
    const c = window.getMapCenter && window.getMapCenter();
    if (!c) return;
    lat = c.lat; lng = c.lng;
  }
  currentGps = { lat, lng };
  window.pickingLocation = false;
  window.onMapPick = null;
  window.setPickingMode && window.setPickingMode(false);
  document.getElementById('map-pick-bar').classList.add('hidden');
  document.getElementById('report-modal').classList.remove('hidden');
  setGpsStatus('map');
}

function cancelMapPick() {
  window.pickingLocation = false;
  window.onMapPick = null;
  window.setPickingMode && window.setPickingMode(false);
  document.getElementById('map-pick-bar').classList.add('hidden');
  document.getElementById('report-modal').classList.remove('hidden');
}

window.startMapPick   = startMapPick;
window.confirmMapPick = confirmMapPick;
window.cancelMapPick  = cancelMapPick;

function renderCategoryPicker(cats) {
  const grid = document.getElementById('report-cat-grid');
  grid.innerHTML = cats.map((c) => `
    <button class="cat-pill" data-id="${c.id}" data-color1="${c.color1||'#FF3B4E'}" data-color2="${c.color2||'#FF6B35'}">
      <span class="cat-emoji">${c.emoji}</span>${c.name}
    </button>`).join('');
  grid.querySelectorAll('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.cat-pill').forEach((b) => {
        b.classList.remove('active');
        b.style.borderColor = '';
        b.style.background = '';
        b.style.color = '';
      });
      btn.classList.add('active');
      btn.style.borderColor = btn.dataset.color1;
      btn.style.background = btn.dataset.color1 + '22';
      btn.style.color = btn.dataset.color1;
      selectedCategoryId = btn.dataset.id;
    });
  });
}

function updateSeverityUI() {
  document.querySelectorAll('.sev-btn').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.sev) === selectedSeverity);
  });
}

document.querySelectorAll('.sev-btn').forEach((btn) => {
  btn.addEventListener('click', () => { selectedSeverity = Number(btn.dataset.sev); updateSeverityUI(); });
});

document.getElementById('report-photo-btn').addEventListener('click', () => {
  document.getElementById('report-photo-input').click();
});

document.getElementById('report-photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const { url } = await API.hazards.upload(file);
    uploadedPhotoUrl = url;
    document.getElementById('report-photo-preview').innerHTML =
      `<img src="${url}" style="width:100%;border-radius:8px;margin-top:8px;">`;
    showToast('照片上傳成功');
  } catch {
    showToast('照片上傳失敗');
  }
});

document.getElementById('report-submit').addEventListener('click', async () => {
  if (!selectedCategoryId) {
    showToast('⚠ 請先選擇缺陷類別');
    document.getElementById('report-cat-grid').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (!currentGps) {
    showToast('請先透過 GPS 或點選地圖設定位置');
    return;
  }
  const cat = STATE?.categories?.find((c) => c.id === selectedCategoryId);
  const desc = document.getElementById('report-desc').value.trim();
  const btn = document.getElementById('report-submit');
  btn.disabled = true;
  try {
    await API.hazards.report({
      hazard: {
        lat: currentGps.lat,
        lng: currentGps.lng,
        categoryId: selectedCategoryId,
        type: cat?.emoji || '⚠️',
        label: cat?.name || '道路缺陷',
        title: desc || `${cat?.name || '道路缺陷'}（GPS 回報）`,
        description: desc,
        severity: selectedSeverity,
        colors: cat ? [cat.color1, cat.color2] : undefined,
      },
      post: { photoUrl: uploadedPhotoUrl },
    });
    document.getElementById('report-modal').classList.add('hidden');
    showToast('✅ 回報成功！獲得 10 積分');
    STATE = await API.state();
    updateStatsBar(STATE);
    renderNearbyList(STATE);
    window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
  } catch (e) {
    showToast('回報失敗：' + e.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('report-modal-close').addEventListener('click', () => {
  document.getElementById('report-modal').classList.add('hidden');
});

// ── Utils ──────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
window.escHtml = escHtml;

// ── Demo seed（供 profile 頁呼叫）──────────────────────
window.triggerDemoSeed = async (btn) => {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 載入中…'; }
  try {
    await fetch('/api/demo/seed', { method: 'POST' });
    STATE = await API.state();
    updateStatsBar(STATE);
    renderNearbyList(STATE);
    window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
    window.panTo && window.panTo(22.6916, 120.3763, 16);
    activateView('map');
    showToast('✅ 展示資料已載入，地圖移至燕巢校區');
  } catch {
    showToast('載入失敗，請重試');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🎬 載入展示資料'; }
  }
};


// ── Boot ───────────────────────────────────────────────
(async () => {
  document.getElementById('fab').classList.add('hidden');
  const { loggedIn, user } = await API.auth.me();
  const adminNames = ['admin', 'admindemo'];
  if (loggedIn && !adminNames.includes(user?.username)) {
    currentUser = user;
    authOverlay.classList.add('hidden');
    await loadState();
    // demo 帳號 panTo 燕巢，一般帳號自動定位
    if (user.username === 'demo') {
      window.panTo && window.panTo(22.6916, 120.3763, 16);
    } else {
      window.locateMe && window.locateMe(true);
    }
  } else {
    authOverlay.classList.remove('hidden');
  }
})();
