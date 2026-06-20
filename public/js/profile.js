/* global API, showToast */

const CITIES = [
  '台北市','新北市','桃園市','台中市','台南市','高雄市',
  '基隆市','新竹市','嘉義市','新竹縣','苗栗縣','彰化縣',
  '南投縣','雲林縣','嘉義縣','屏東縣','宜蘭縣','花蓮縣',
  '台東縣','澎湖縣','金門縣','連江縣',
];

function renderProfile(state, user) {
  const container = document.getElementById('profile-content');
  if (!container || !user) return;

  const prof  = state.profile || {};
  const prefs = state.prefs   || {};
  const stats = state.myStats || {};
  const initial = (prof.name || user.username || '?')[0].toUpperCase();
  const avatarHtml = prof.avatar
    ? `<img src="${prof.avatar}" alt="頭像">`
    : initial;

  const myHazards = (state.hazards || []).filter((h) => String(h.userId) === String(user.id));

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-wrap" id="avatar-wrap">
        <div class="profile-avatar">${avatarHtml}</div>
        <div class="profile-avatar-edit">✏️</div>
        <input id="avatar-input" type="file" accept="image/*" style="display:none">
      </div>
      <div class="profile-header-info">
        <div class="profile-name">${prof.name || user.username}</div>
        <div class="profile-handle">${prof.handle || '@' + user.username} · ${prof.city || ''}</div>
      </div>
      <button class="profile-edit-btn" id="profile-edit-toggle">編輯</button>
    </div>

    <div id="profile-edit-form" class="profile-edit-form hidden">
      <div class="form-group">
        <label class="form-label">顯示名稱</label>
        <input id="edit-name" class="form-input" type="text" value="${escHtml(prof.name || '')}" maxlength="20">
      </div>
      <div class="form-group">
        <label class="form-label">所在城市</label>
        <select id="edit-city" class="form-input">
          ${CITIES.map(c => `<option${prof.city === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="profile-edit-actions">
        <button id="profile-save-btn" class="btn-primary" style="margin-top:0">儲存</button>
        <button id="profile-cancel-btn" class="btn-secondary" style="margin-top:0">取消</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-num">${stats.myHazards || 0}</div><div class="stat-card-label">我的回報</div></div>
      <div class="stat-card"><div class="stat-card-num">${stats.myFixed || 0}</div><div class="stat-card-label">已修復</div></div>
      <div class="stat-card"><div class="stat-card-num">${stats.receivedVotes || 0}</div><div class="stat-card-label">獲得附議</div></div>
      <div class="stat-card"><div class="stat-card-num">${user.points || 0}</div><div class="stat-card-label">積分</div></div>
    </div>

    ${myHazards.length ? `
    <div class="section-title">我的回報地圖</div>
    <div id="profile-mini-map"></div>
    <div class="section-title" style="margin-top:4px">我的回報（${myHazards.length} 筆）</div>
    <div id="my-reports-list">
      ${myHazards.map((h) => myReportCard(h, state.categories || [])).join('')}
    </div>` : ''}

    <div class="section-title" style="margin-top:${myHazards.length ? '16px' : '0'}">偏好設定</div>
    <div class="settings-list">
      <div class="setting-row">
        <span class="setting-label">📍 附近通知</span>
        <button class="toggle ${prefs.nearbyNotify ? 'on' : ''}" data-key="nearbyNotify"></button>
      </div>
      <div class="setting-row">
        <span class="setting-label">🛰️ 自動 GPS</span>
        <button class="toggle ${prefs.autoGps ? 'on' : ''}" data-key="autoGps"></button>
      </div>
      <div class="setting-row">
        <span class="setting-label">🌙 夜間省電</span>
        <button class="toggle ${prefs.nightSaver ? 'on' : ''}" data-key="nightSaver"></button>
      </div>
    </div>

    <button id="logout-btn" class="btn-secondary" style="margin-top:20px">登出</button>`;

  // ── 頭像上傳 ──────────────────────────────────────────
  const avatarWrap = container.querySelector('#avatar-wrap');
  const avatarInput = container.querySelector('#avatar-input');
  avatarWrap?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { url } = await API.profile.uploadAvatar(file);
      container.querySelector('.profile-avatar').innerHTML = `<img src="${url}" alt="頭像">`;
      showToast('✅ 頭像已更新');
    } catch { showToast('頭像上傳失敗'); }
  });

  // ── 編輯表單 ──────────────────────────────────────────
  const editForm   = container.querySelector('#profile-edit-form');
  const editToggle = container.querySelector('#profile-edit-toggle');
  editToggle.addEventListener('click', () => {
    const open = !editForm.classList.contains('hidden');
    editForm.classList.toggle('hidden', open);
    editToggle.textContent = open ? '編輯' : '取消';
  });
  container.querySelector('#profile-cancel-btn').addEventListener('click', () => {
    editForm.classList.add('hidden'); editToggle.textContent = '編輯';
  });
  container.querySelector('#profile-save-btn').addEventListener('click', async () => {
    const name = container.querySelector('#edit-name').value.trim();
    const city = container.querySelector('#edit-city').value;
    const btn  = container.querySelector('#profile-save-btn');
    if (!name) { showToast('請輸入顯示名稱'); return; }
    btn.disabled = true;
    try {
      await API.profile.update({ name, city, handle: prof.handle || user.username });
      showToast('✅ 個人資料已更新');
      editForm.classList.add('hidden'); editToggle.textContent = '編輯';
      container.querySelector('.profile-name').textContent = name;
      container.querySelector('.profile-handle').textContent = `${prof.handle || '@' + user.username} · ${city}`;
      container.querySelector('.profile-avatar').textContent = name[0].toUpperCase();
    } catch { showToast('儲存失敗，請再試'); }
    finally { btn.disabled = false; }
  });

  // ── Toggles ───────────────────────────────────────────
  container.querySelectorAll('.toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.classList.toggle('on');
      try {
        await API.profile.prefs({ [btn.dataset.key]: btn.classList.contains('on') });
        showToast('設定已儲存');
      } catch { btn.classList.toggle('on'); showToast('儲存失敗'); }
    });
  });

  // ── 我的回報操作 ──────────────────────────────────────
  container.querySelectorAll('.my-report-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const h = (window.STATE?.hazards || []).find((x) => x.id === btn.dataset.id);
      if (h) window.openEditHazardModal && window.openEditHazardModal(h);
    });
  });
  container.querySelectorAll('.my-report-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const h = (window.STATE?.hazards || []).find((x) => x.id === btn.dataset.id);
      if (!h) return;
      if (!confirm(`確定要刪除「${h.title}」嗎？`)) return;
      try {
        await API.hazards.delete(h.id);
        showToast('✅ 已刪除回報');
        if (window.refreshState) {
          const newState = await window.refreshState();
          window.activateView && window.activateView('profile');
        }
      } catch { showToast('刪除失敗'); }
    });
  });

  // ── 個人回報迷你地圖 ──────────────────────────────────
  if (myHazards.length && window.L) {
    setTimeout(() => initMiniMap(myHazards, state.categories || []), 100);
  }

  container.querySelector('#logout-btn').addEventListener('click', async () => {
    await API.auth.logout();
    location.reload();
  });
}

function myReportCard(h, cats = []) {
  const cat = cats.find((c) => c.id === h.categoryId);
  const emoji = h.emoji || cat?.emoji || '⚠️';
  const statusLabel = { pending: '待審', verified: '已驗證', fixed: '已修復', rejected: '已駁回' }[h.status] || h.status;
  return `
    <div class="my-report-card">
      <div style="font-size:22px;flex-shrink:0">${emoji}</div>
      <div class="my-report-info">
        <div class="my-report-title">${escHtml(h.title)}</div>
        <div class="my-report-meta">
          <span class="tag tag-status-${h.status}" style="font-size:10px">${statusLabel}</span>
          ${cat ? ` · ${cat.name}` : ''}
        </div>
      </div>
      <div class="my-report-actions">
        <button class="btn-icon my-report-edit" data-id="${h.id}" title="編輯">✏️</button>
        <button class="btn-icon danger my-report-delete" data-id="${h.id}" title="刪除">🗑️</button>
      </div>
    </div>`;
}

let miniMap = null;
function initMiniMap(hazards, categories) {
  const el = document.getElementById('profile-mini-map');
  if (!el) return;
  if (miniMap) { miniMap.remove(); miniMap = null; }
  miniMap = window.L.map(el, { zoomControl: false, scrollWheelZoom: false });
  window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '', subdomains: 'abcd', maxZoom: 18,
  }).addTo(miniMap);
  const bounds = [];
  hazards.forEach((h) => {
    if (!h.lat || !h.lng) return;
    bounds.push([h.lat, h.lng]);
    const cat = categories.find((c) => c.id === h.categoryId);
    const emoji = h.emoji || cat?.emoji || '⚠️';
    const color = h.colors?.[0] || '#FF3B4E';
    const icon = window.L.divIcon({
      html: `<div style="background:${color};width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,0.4)"><span style="transform:rotate(45deg);font-size:12px">${emoji}</span></div>`,
      className: '', iconSize: [24, 24], iconAnchor: [12, 24],
    });
    window.L.marker([h.lat, h.lng], { icon }).addTo(miniMap);
  });
  if (bounds.length) {
    miniMap.fitBounds(bounds, { padding: [20, 20] });
  }
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.renderProfile = renderProfile;
