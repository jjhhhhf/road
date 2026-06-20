/* global API, initMap, renderCommunity, renderAchievements, renderProfile */

let STATE = null;
let currentUser = null;
Object.defineProperty(window, 'STATE', { get: () => STATE });

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

// ── Loading overlay ────────────────────────────────────
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 500); }
}

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
window.activateView = activateView;

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
      if (username === 'admin' || username === 'admindemo') {
        const creds = btoa(unescape(encodeURIComponent(username + ':' + password)));
        const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Basic ' + creds } });
        if (r.status === 401) { authError.textContent = '帳號或密碼錯誤'; return; }
        if (username === 'admindemo') await fetch('/api/demo/seed', { method: 'POST' });
        sessionStorage.setItem('adminCreds', creds);
        window.location.href = '/admin.html';
        return;
      }
      if (username === 'demo') {
        await fetch('/api/demo/seed', { method: 'POST' });
        const { user } = await API.auth.login({ username, password });
        currentUser = user;
        authOverlay.classList.add('hidden');
        await loadState();
        window.panTo && window.panTo(22.7729, 120.4007, 16);
        showToast('✅ 展示模式，地圖移至燕巢校區');
        return;
      }
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
    initMapSearch();
    renderNearbyList(STATE);
    initMapDrag();
    initPullToRefresh();
    initFilterDrawer();
    document.getElementById('fab').classList.remove('hidden');
    updateCommunityBadge();
  } catch {
    authOverlay.classList.remove('hidden');
  }
}

function updateStatsBar(state) {
  const total    = state.hazards.length;
  const verified = state.hazards.filter((h) => h.status === 'verified').length;
  const fixed    = state.hazards.filter((h) => h.status === 'fixed').length;
  document.getElementById('stat-total').textContent    = total.toLocaleString();
  document.getElementById('stat-verified').textContent = verified.toLocaleString();
  document.getElementById('stat-fixed').textContent    = fixed.toLocaleString();
}

// ── Community badge (notification) ─────────────────────
function updateCommunityBadge() {
  if (!STATE) return;
  const lastSeen = parseInt(localStorage.getItem('community_last_seen') || '0', 10);
  const newPosts = STATE.posts.filter((p) => p.createdAt > lastSeen).length;
  const badge = document.getElementById('community-badge');
  if (badge) badge.classList.toggle('hidden', newPosts === 0);
}

// ── Map drag handle ────────────────────────────────────
function initMapDrag() {
  const handle = document.getElementById('map-drag-handle');
  const mapEl  = document.getElementById('map');
  if (!handle || !mapEl) return;
  let dragging = false;
  let startY = 0;
  let startH = 0;
  const onMove = (y) => {
    const dy = y - startY;
    const newH = Math.max(100, Math.min(window.innerHeight * 0.75, startH + dy));
    mapEl.style.flex = 'none';
    mapEl.style.height = newH + 'px';
    window.invalidateMapSize && window.invalidateMapSize();
  };
  handle.addEventListener('touchstart', (e) => {
    dragging = true; startY = e.touches[0].clientY; startH = mapEl.offsetHeight;
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (!dragging) return; onMove(e.touches[0].clientY);
  }, { passive: true });
  handle.addEventListener('touchend', () => { dragging = false; });
  handle.addEventListener('mousedown', (e) => {
    dragging = true; startY = e.clientY; startH = mapEl.offsetHeight;
    const up = () => { dragging = false; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    const mv = (ev) => { if (dragging) onMove(ev.clientY); };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  });
}

// ── Pull-to-refresh ────────────────────────────────────
function initPullToRefresh() {
  const scroll = document.getElementById('map-scroll');
  const indicator = document.getElementById('ptr-indicator');
  if (!scroll || !indicator) return;
  let startY = 0, pulling = false;
  scroll.addEventListener('touchstart', (e) => {
    if (scroll.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });
  scroll.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 10) {
      indicator.classList.remove('hidden');
      indicator.classList.toggle('ready', dy > 60);
      indicator.textContent = dy > 60 ? '↑ 放開以刷新' : '↓ 繼續下拉刷新';
    }
  }, { passive: true });
  scroll.addEventListener('touchend', async (e) => {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    indicator.classList.add('hidden');
    if (dy > 60) {
      showToast('🔄 刷新中…');
      STATE = await API.state();
      updateStatsBar(STATE);
      renderNearbyList(STATE);
      window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
      showToast('✅ 已更新');
    }
  }, { passive: true });
}

// ── Nearby list ────────────────────────────────────────
let activeFilter = 'all';
let activeStatusFilter = 'all';
let activeSortMode = 'time';
let mapSearchTerm = '';
let userGpsPos = null;

function initMapSearch() {
  const wrap = document.getElementById('map-search-wrap');
  const input = document.getElementById('map-search');
  if (!wrap || !input) return;
  wrap.classList.remove('hidden');
  input.addEventListener('input', () => {
    mapSearchTerm = input.value.trim().toLowerCase();
    if (STATE) renderNearbyList(STATE);
  });
}

function filterHazards(hazards) {
  let result = [...hazards];
  if (activeFilter !== 'all') result = result.filter((h) => h.categoryId === activeFilter);
  if (activeStatusFilter !== 'all') result = result.filter((h) => h.status === activeStatusFilter);
  if (mapSearchTerm) {
    result = result.filter((h) =>
      (h.title || '').toLowerCase().includes(mapSearchTerm) ||
      (h.label || '').toLowerCase().includes(mapSearchTerm)
    );
  }
  if (activeSortMode === 'distance' && userGpsPos) {
    result.sort((a, b) => dist(a, userGpsPos) - dist(b, userGpsPos));
  } else if (activeSortMode === 'severity') {
    result.sort((a, b) => b.severity - a.severity);
  } else {
    result.sort((a, b) => b.createdAt - a.createdAt);
  }
  return result;
}

function dist(h, pos) {
  const dlat = h.lat - pos.lat, dlng = h.lng - pos.lng;
  return dlat * dlat + dlng * dlng;
}

function renderNearbyList(state) {
  const list = document.getElementById('nearby-list');
  const allFiltered = filterHazards(state.hazards);
  const hazards = allFiltered.slice(0, 20);
  const remaining = allFiltered.length - hazards.length;

  list.innerHTML = `
    <div class="section-header">
      <span class="title">📍 附近排雷點</span>
      <span class="see-all" id="see-all-btn">查看全部（${allFiltered.length}）</span>
    </div>
    ${hazards.map((h) => hazardCard(h, state.categories)).join('')}
    ${remaining > 0 ? `<div class="see-all-more" id="see-all-more-btn">還有 ${remaining} 筆，查看全部 →</div>` : ''}
  `;

  list.querySelectorAll('.hazard-card').forEach((card) => {
    card.addEventListener('click', () => {
      const h = state.hazards.find((x) => x.id === card.dataset.id);
      if (h) openHazardDetail(h, state.categories);
    });
  });

  document.getElementById('see-all-btn')?.addEventListener('click', () => openAllHazardsModal(state));
  document.getElementById('see-all-more-btn')?.addEventListener('click', () => openAllHazardsModal(state));
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

// ── Hazard Detail Modal ────────────────────────────────
function openHazardDetail(h, cats = []) {
  const cat = cats.find((c) => c.id === h.categoryId);
  const emoji = h.emoji || cat?.emoji || '⚠️';
  const sevLabel = ['', '輕微', '輕度', '中度', '嚴重', '極危'][h.severity] || '中度';
  const statusLabel = { pending: '待審', verified: '已驗證', fixed: '已修復', rejected: '已駁回' }[h.status] || h.status;
  const isOwn = STATE?.me && String(h.userId) === String(STATE.me.id);

  document.getElementById('hazard-detail-title').textContent = emoji + ' ' + (h.title || '危險點');
  document.getElementById('hazard-detail-content').innerHTML = `
    <div class="hazard-detail-meta">
      <div class="hazard-detail-row">
        <span class="tag tag-sev-${h.severity}">${sevLabel}</span>
        <span class="tag tag-status-${h.status}">${statusLabel}</span>
        ${cat ? `<span class="tag tag-type">${cat.name}</span>` : ''}
      </div>
      <div class="hazard-detail-row">📍 ${escHtml(h.label)}</div>
      <div class="hazard-detail-row">🕐 ${new Date(h.createdAt).toLocaleString('zh-TW')}</div>
    </div>
    ${h.description ? `<div class="hazard-detail-desc">${escHtml(h.description)}</div>` : ''}
    <div class="hazard-detail-actions">
      <button class="btn-secondary" id="hd-map-btn" style="flex:1;margin-top:0;padding:11px">🗺️ 查看地圖</button>
      <button class="btn-secondary" id="hd-share-btn" style="flex:1;margin-top:0;padding:11px">🔗 分享</button>
      ${isOwn ? `<button class="btn-secondary" id="hd-edit-btn" style="flex:1;margin-top:0;padding:11px">✏️ 編輯</button>` : ''}
      ${isOwn ? `<button class="btn-secondary" id="hd-delete-btn" style="flex:1;margin-top:0;padding:11px;border-color:rgba(255,59,78,0.4);color:var(--accent)">🗑️</button>` : ''}
    </div>`;

  const modal = document.getElementById('hazard-detail-modal');
  modal.classList.remove('hidden');

  document.getElementById('hd-map-btn')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    window.panTo && window.panTo(h.lat, h.lng, 17);
  });
  document.getElementById('hd-share-btn')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    openShareModal(h);
  });
  document.getElementById('hd-edit-btn')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    openEditHazardModal(h);
  });
  document.getElementById('hd-delete-btn')?.addEventListener('click', async () => {
    if (!confirm(`確定要刪除「${h.title}」嗎？此操作無法還原。`)) return;
    try {
      await API.hazards.delete(h.id);
      modal.classList.add('hidden');
      showToast('✅ 已刪除回報');
      STATE = await API.state();
      updateStatsBar(STATE);
      renderNearbyList(STATE);
      window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
    } catch { showToast('刪除失敗'); }
  });

  document.getElementById('hazard-detail-close')?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
}

// ── Edit Hazard Modal ──────────────────────────────────
let editingHazardId = null;
let editSeverity = 3;

function openEditHazardModal(h) {
  editingHazardId = h.id;
  editSeverity = h.severity || 3;
  document.getElementById('edit-hazard-title').value = h.title || '';
  document.getElementById('edit-hazard-desc').value = h.description || '';
  updateEditSevUI();
  const modal = document.getElementById('edit-hazard-modal');
  modal.classList.remove('hidden');
  document.getElementById('edit-hazard-close')?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
}

function updateEditSevUI() {
  document.querySelectorAll('#edit-sev-row .sev-btn').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.sev) === editSeverity);
  });
}

document.querySelectorAll('#edit-sev-row .sev-btn').forEach((btn) => {
  btn.addEventListener('click', () => { editSeverity = Number(btn.dataset.sev); updateEditSevUI(); });
});

document.getElementById('edit-hazard-save')?.addEventListener('click', async () => {
  if (!editingHazardId) return;
  const title = document.getElementById('edit-hazard-title').value.trim();
  const description = document.getElementById('edit-hazard-desc').value.trim();
  const btn = document.getElementById('edit-hazard-save');
  btn.disabled = true;
  try {
    await API.hazards.update(editingHazardId, { title, description, severity: editSeverity });
    document.getElementById('edit-hazard-modal').classList.add('hidden');
    showToast('✅ 已更新回報');
    STATE = await API.state();
    updateStatsBar(STATE);
    renderNearbyList(STATE);
    window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
    if (document.getElementById('profile-view')?.classList.contains('active')) {
      renderProfile(STATE, currentUser);
    }
  } catch { showToast('更新失敗'); }
  finally { btn.disabled = false; }
});
window.openEditHazardModal = openEditHazardModal;

// ── Share Modal ────────────────────────────────────────
function openShareModal(h) {
  const url = `${location.origin}/?hazard=${h.id}`;
  document.getElementById('share-url-box').textContent = url;
  const modal = document.getElementById('share-modal');
  modal.classList.remove('hidden');
  document.getElementById('share-copy-btn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('✅ 連結已複製');
    } catch {
      showToast('請手動複製連結');
    }
  };
  document.getElementById('share-close-btn').onclick = () => modal.classList.add('hidden');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
}
window.openShareModal = openShareModal;

// ── All hazards modal ──────────────────────────────────
function openAllHazardsModal(state) {
  const modal = document.getElementById('all-hazards-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderAllHazardsList(state, '');
  const searchInput = document.getElementById('all-hazards-search');
  if (searchInput) {
    searchInput.value = '';
    const handler = () => renderAllHazardsList(state, searchInput.value.trim().toLowerCase());
    searchInput.removeEventListener('input', handler);
    searchInput.addEventListener('input', handler);
    setTimeout(() => searchInput.focus(), 100);
  }
  document.getElementById('all-hazards-close')?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
}

function renderAllHazardsList(state, query) {
  let hazards = filterHazards(state.hazards);
  if (query) {
    hazards = hazards.filter((h) =>
      (h.title || '').toLowerCase().includes(query) ||
      (h.label || '').toLowerCase().includes(query)
    );
  }
  const countEl = document.getElementById('all-hazards-count');
  if (countEl) countEl.textContent = `${hazards.length} 筆`;
  const listEl = document.getElementById('all-hazards-list');
  if (!listEl) return;
  if (!hazards.length) {
    listEl.innerHTML = '<p style="text-align:center;color:var(--text3);padding:32px 0">找不到符合的危險點</p>';
    return;
  }
  listEl.innerHTML = hazards.map((h) => hazardCard(h, state.categories)).join('');
  listEl.querySelectorAll('.hazard-card').forEach((card) => {
    card.addEventListener('click', () => {
      const h = state.hazards.find((x) => x.id === card.dataset.id);
      if (h) {
        document.getElementById('all-hazards-modal').classList.add('hidden');
        openHazardDetail(h, state.categories);
      }
    });
  });
}

// ── Filter Drawer ──────────────────────────────────────
function initFilterDrawer() {
  document.getElementById('filter-drawer-btn')?.addEventListener('click', openFilterDrawer);
  document.getElementById('filter-drawer-close')?.addEventListener('click', () => {
    document.getElementById('filter-drawer').classList.add('hidden');
  });
  document.getElementById('filter-drawer')?.addEventListener('click', (e) => {
    if (e.target.id === 'filter-drawer') document.getElementById('filter-drawer').classList.add('hidden');
  });
  document.querySelectorAll('#drawer-status-btns .filter-status-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#drawer-status-btns .filter-status-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelectorAll('#drawer-sort-btns .filter-status-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#drawer-sort-btns .filter-status-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.getElementById('filter-apply-btn')?.addEventListener('click', applyFilterDrawer);
  document.getElementById('filter-reset-btn')?.addEventListener('click', resetFilterDrawer);
}

function openFilterDrawer() {
  if (!STATE) return;
  const grid = document.getElementById('drawer-cat-grid');
  if (grid && STATE.categories) {
    grid.innerHTML = `<button class="cat-pill ${activeFilter === 'all' ? 'active' : ''}" data-id="all">全部</button>` +
      STATE.categories.map((c) => `<button class="cat-pill ${activeFilter === c.id ? 'active' : ''}" data-id="${c.id}" data-color1="${c.color1||'#FF3B4E'}">
        <span class="cat-emoji">${c.emoji}</span>${c.name}</button>`).join('');
    grid.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.cat-pill').forEach((b) => { b.classList.remove('active'); b.style.borderColor = ''; b.style.background = ''; b.style.color = ''; });
        btn.classList.add('active');
        if (btn.dataset.id !== 'all' && btn.dataset.color1) {
          btn.style.borderColor = btn.dataset.color1;
          btn.style.background = btn.dataset.color1 + '22';
          btn.style.color = btn.dataset.color1;
        }
      });
    });
  }
  document.getElementById('filter-drawer').classList.remove('hidden');
}

function applyFilterDrawer() {
  const catBtn = document.querySelector('#drawer-cat-grid .cat-pill.active');
  activeFilter = catBtn?.dataset.id || 'all';
  const statusBtn = document.querySelector('#drawer-status-btns .filter-status-btn.active');
  activeStatusFilter = statusBtn?.dataset.status || 'all';
  const sortBtn = document.querySelector('#drawer-sort-btns .filter-status-btn.active');
  const newSort = sortBtn?.dataset.sort || 'time';
  if (newSort === 'distance') {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { userGpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; activeSortMode = 'distance'; applyFilters(); },
      () => { showToast('無法取得位置，改用時間排序'); activeSortMode = 'time'; applyFilters(); }
    );
  } else {
    activeSortMode = newSort;
    applyFilters();
  }
  document.getElementById('filter-drawer').classList.add('hidden');
}

function resetFilterDrawer() {
  activeFilter = 'all'; activeStatusFilter = 'all'; activeSortMode = 'time';
  document.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
  document.querySelector('.filter-chip[data-cat="all"]')?.classList.add('active');
  applyFilters();
  document.getElementById('filter-drawer').classList.add('hidden');
}

function applyFilters() {
  if (!STATE) return;
  renderNearbyList(STATE);
  const filtered = filterHazards(STATE.hazards);
  window.renderMapHazards && window.renderMapHazards(filtered, STATE.categories);
}

// ── Category filter chips ──────────────────────────────
function renderFilterChips(categories) {
  const bar = document.getElementById('map-filters');
  bar.innerHTML = `<button class="filter-chip active" data-cat="all">全部</button>` +
    categories.map((c) => `<button class="filter-chip" data-cat="${c.id}">${c.emoji} ${c.name}</button>`).join('') +
    `<button class="heatmap-btn" id="heatmap-toggle-btn">🌡️ 熱點</button>`;
  bar.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.cat;
      applyFilters();
    });
  });
  document.getElementById('heatmap-toggle-btn')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
    window.toggleHeatmap && window.toggleHeatmap(e.currentTarget.classList.contains('active'), STATE?.hazards || []);
  });
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
  document.getElementById('report-title').value = '';
  document.getElementById('report-desc').value = '';
  document.getElementById('report-photo-preview').innerHTML = '';
  updateSeverityUI();
  renderCategoryPicker(STATE.categories || []);
  const reportModal = document.getElementById('report-modal');
  reportModal.classList.remove('hidden');
  reportModal.querySelector('.modal-sheet').scrollTop = 0;
  const isHttpMobile = location.protocol === 'http:' && location.hostname !== 'localhost';
  if (!navigator.geolocation || isHttpMobile) {
    currentGps = null; setGpsStatus('fail');
  } else {
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => { currentGps = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setGpsStatus('ok'); },
      () => { currentGps = null; setGpsStatus('fail'); },
      { timeout: 5000, maximumAge: 60000 },
    );
  }
}

function setGpsStatus(state) {
  const el = document.getElementById('gps-status');
  if (!el) return;
  el.style.display = 'block';
  if (state === 'loading') { el.innerHTML = '<span style="color:var(--text3)">⏳ 取得 GPS 位置中…</span>'; }
  else if (state === 'ok') { el.innerHTML = '<span style="color:var(--green)">✓ 已取得 GPS 位置</span>'; }
  else if (state === 'map') { el.innerHTML = '<span style="color:var(--green)">✓ 地圖選取位置</span>'; }
  else { el.innerHTML = `<span style="color:var(--gold)">⚠ GPS 無法取得 &nbsp;</span><button class="btn-pick-map" onclick="startMapPick()">在地圖點選位置</button>`; }
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
  window.pickingLocation = false; window.onMapPick = null;
  window.setPickingMode && window.setPickingMode(false);
  document.getElementById('map-pick-bar').classList.add('hidden');
  document.getElementById('report-modal').classList.remove('hidden');
  setGpsStatus('map');
}

function cancelMapPick() {
  window.pickingLocation = false; window.onMapPick = null;
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
      grid.querySelectorAll('.cat-pill').forEach((b) => { b.classList.remove('active'); b.style.borderColor = ''; b.style.background = ''; b.style.color = ''; });
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
    const compressed = await compressImage(file, 1024);
    const { url } = await API.hazards.upload(compressed);
    uploadedPhotoUrl = url;
    const preview = document.getElementById('report-photo-preview');
    preview.innerHTML = `<img src="${url}" style="width:100%;border-radius:8px;margin-top:8px;cursor:pointer">
      <div class="compress-hint">已壓縮至適合大小</div>`;
    preview.querySelector('img')?.addEventListener('click', () => openLightbox(url));
    showToast('照片上傳成功');
  } catch { showToast('照片上傳失敗'); }
});

document.getElementById('report-submit').addEventListener('click', async () => {
  if (!selectedCategoryId) { showToast('⚠ 請先選擇缺陷類別'); document.getElementById('report-cat-grid').scrollIntoView({ behavior: 'smooth' }); return; }
  if (!currentGps) { showToast('請先透過 GPS 或點選地圖設定位置'); return; }
  const cat = STATE?.categories?.find((c) => c.id === selectedCategoryId);
  const titleInput = document.getElementById('report-title').value.trim();
  const desc = document.getElementById('report-desc').value.trim();
  const autoTitle = `${cat?.name || '道路缺陷'}（GPS 回報）`;
  const btn = document.getElementById('report-submit');
  btn.disabled = true;
  try {
    await API.hazards.report({
      hazard: {
        lat: currentGps.lat, lng: currentGps.lng, categoryId: selectedCategoryId,
        type: cat?.emoji || '⚠️', label: cat?.name || '道路缺陷',
        title: titleInput || desc || autoTitle, description: desc,
        severity: selectedSeverity, colors: cat ? [cat.color1, cat.color2] : undefined,
      },
      post: { photoUrl: uploadedPhotoUrl },
    });
    document.getElementById('report-modal').classList.add('hidden');
    showToast('✅ 回報成功！獲得 10 積分');
    STATE = await API.state();
    updateStatsBar(STATE);
    renderNearbyList(STATE);
    window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
  } catch (e) { showToast('回報失敗：' + e.message); }
  finally { btn.disabled = false; }
});

document.getElementById('report-modal-close').addEventListener('click', () => {
  document.getElementById('report-modal').classList.add('hidden');
});

// ── Image compression ──────────────────────────────────
async function compressImage(file, maxKB = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.naturalWidth, h = img.naturalHeight;
      const max = 1920;
      if (w > max) { h = Math.round(h * max / w); w = max; }
      if (h > max) { w = Math.round(w * max / h); h = max; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.82);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// ── Lightbox ───────────────────────────────────────────
function openLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'photo-lightbox';
  lb.innerHTML = `<img src="${src}"><button class="photo-lightbox-close">✕</button>`;
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('photo-lightbox-close')) lb.remove(); });
  document.body.appendChild(lb);
}
window.openLightbox = openLightbox;

// ── Utils ──────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
window.escHtml = escHtml;

// ── Refresh state (for use by other modules) ───────────
window.refreshState = async () => {
  STATE = await API.state();
  updateStatsBar(STATE);
  renderNearbyList(STATE);
  window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
  return STATE;
};

// ── Demo seed ──────────────────────────────────────────
window.triggerDemoSeed = async (btn) => {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 載入中…'; }
  try {
    await fetch('/api/demo/seed', { method: 'POST' });
    STATE = await API.state();
    updateStatsBar(STATE);
    renderNearbyList(STATE);
    window.renderMapHazards && renderMapHazards(STATE.hazards, STATE.categories);
    window.panTo && window.panTo(22.7729, 120.4007, 16);
    activateView('map');
    showToast('✅ 展示資料已載入');
  } catch { showToast('載入失敗，請重試'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🎬 載入展示資料'; } }
};

// ── Boot ───────────────────────────────────────────────
(async () => {
  document.getElementById('fab').classList.add('hidden');
  try {
    const { loggedIn, user } = await API.auth.me();
    hideLoading();
    const adminNames = ['admin', 'admindemo'];
    if (loggedIn && !adminNames.includes(user?.username)) {
      currentUser = user;
      authOverlay.classList.add('hidden');
      await loadState();
      if (user.username === 'demo') {
        window.panTo && window.panTo(22.7729, 120.4007, 16);
      } else {
        window.locateMe && window.locateMe(true);
      }
      // 處理分享 URL (?hazard=ID)
      const params = new URLSearchParams(location.search);
      const hazardId = params.get('hazard');
      if (hazardId && STATE) {
        const h = STATE.hazards.find((x) => x.id === hazardId);
        if (h) { setTimeout(() => openHazardDetail(h, STATE.categories), 500); }
      }
    } else {
      authOverlay.classList.remove('hidden');
    }
  } catch {
    hideLoading();
    authOverlay.classList.remove('hidden');
  }
})();
