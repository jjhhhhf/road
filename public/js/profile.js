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

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${initial}</div>
      <div class="profile-header-info">
        <div class="profile-name">${prof.name || user.username}</div>
        <div class="profile-handle">${prof.handle || '@' + user.username} · ${prof.city || ''}</div>
      </div>
      <button class="profile-edit-btn" id="profile-edit-toggle">編輯</button>
    </div>

    <!-- 編輯表單（預設隱藏）-->
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
      <div class="stat-card">
        <div class="stat-card-num">${stats.myHazards || 0}</div>
        <div class="stat-card-label">我的回報</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-num">${stats.myFixed || 0}</div>
        <div class="stat-card-label">已修復</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-num">${stats.receivedVotes || 0}</div>
        <div class="stat-card-label">獲得附議</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-num">${stats.helpedVotes || 0}</div>
        <div class="stat-card-label">我的附議</div>
      </div>
    </div>

    <div class="section-title">偏好設定</div>
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

  // ── 編輯切換 ──────────────────────────────────────────
  const editForm   = container.querySelector('#profile-edit-form');
  const editToggle = container.querySelector('#profile-edit-toggle');

  editToggle.addEventListener('click', () => {
    const open = !editForm.classList.contains('hidden');
    editForm.classList.toggle('hidden', open);
    editToggle.textContent = open ? '編輯' : '取消';
  });

  container.querySelector('#profile-cancel-btn').addEventListener('click', () => {
    editForm.classList.add('hidden');
    editToggle.textContent = '編輯';
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
      editForm.classList.add('hidden');
      editToggle.textContent = '編輯';
      // Update display inline
      container.querySelector('.profile-name').textContent = name;
      container.querySelector('.profile-handle').textContent =
        `${prof.handle || '@' + user.username} · ${city}`;
      // Update avatar initial
      container.querySelector('.profile-avatar').textContent = name[0].toUpperCase();
    } catch {
      showToast('儲存失敗，請再試');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Toggles ───────────────────────────────────────────
  container.querySelectorAll('.toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.classList.toggle('on');
      const key = btn.dataset.key;
      const val = btn.classList.contains('on');
      try {
        await API.profile.prefs({ [key]: val });
        showToast('設定已儲存');
      } catch {
        btn.classList.toggle('on');
        showToast('儲存失敗');
      }
    });
  });

  container.querySelector('#logout-btn').addEventListener('click', async () => {
    await API.auth.logout();
    location.reload();
  });
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.renderProfile = renderProfile;
