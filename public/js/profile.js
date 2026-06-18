/* global API, showToast */

function renderProfile(state, user) {
  const container = document.getElementById('profile-content');
  if (!container || !user) return;

  const prof = state.profile || {};
  const prefs = state.prefs || {};
  const stats = state.myStats || {};
  const initial = (prof.name || user.username || '?')[0].toUpperCase();

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${initial}</div>
      <div>
        <div class="profile-name">${prof.name || user.username}</div>
        <div class="profile-handle">${prof.handle || '@' + user.username} · ${prof.city || ''}</div>
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

    <div style="font-size:14px;font-weight:700;margin-bottom:10px">偏好設定</div>
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

window.renderProfile = renderProfile;
