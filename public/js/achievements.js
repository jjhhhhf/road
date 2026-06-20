/* global API */

async function renderAchievements(state) {
  const container = document.getElementById('achievements-content');
  if (!container) return;

  let allBadges = state.myBadges || [];
  try {
    const { badges } = await API.profile.badges();
    allBadges = badges;
  } catch { /* use cached */ }

  const points   = state.me?.points || 0;
  const stats    = state.myStats || {};
  const earnedIds = new Set(allBadges.map((b) => b.id));

  const allDefs = [
    { id: 'badge_first',  name: '初心排雷師', emoji: '🌱', description: '完成第 1 次回報',  metric: 'reports',      threshold: 1  },
    { id: 'badge_10',     name: '勤奮排雷師', emoji: '⭐', description: '累積 10 次回報',   metric: 'reports',      threshold: 10 },
    { id: 'badge_50',     name: '黃金排雷師', emoji: '🔥', description: '累積 50 次回報',   metric: 'reports',      threshold: 50 },
    { id: 'badge_vote10', name: '熱心市民',   emoji: '👍', description: '累積附議 10 次',   metric: 'votes_given',  threshold: 10 },
    { id: 'badge_fixed5', name: '排雷英雄',   emoji: '🏆', description: '5 筆回報達成修復', metric: 'fixed',        threshold: 5  },
    { id: 'badge_night',  name: '夜鷹',       emoji: '🦉', description: '夜間回報 5 次',    metric: 'night_reports',threshold: 5  },
  ];

  const metricVal = {
    reports:       stats.myHazards   || 0,
    votes_given:   stats.helpedVotes || 0,
    fixed:         stats.myFixed     || 0,
    night_reports: stats.nightReports|| 0,
  };

  container.innerHTML = `
    <div class="points-banner">
      <div>
        <div class="points-num">${points.toLocaleString()}</div>
        <div class="points-unit">積分</div>
      </div>
      <div class="points-label">持續回報缺陷<br>累積更多積分</div>
    </div>
    <div class="badges-section-title">成就勳章</div>
    <div class="badges-list">
      ${allDefs.map((b) => {
        const earned  = earnedIds.has(b.id);
        const current = Math.min(metricVal[b.metric], b.threshold);
        const pct     = Math.round((current / b.threshold) * 100);
        return `
          <div class="badge-row ${earned ? 'earned' : ''}">
            <div class="badge-row-icon ${earned ? 'earned' : ''}">${b.emoji}</div>
            <div class="badge-row-body">
              <div class="badge-row-head">
                <span class="badge-row-name">${b.name}</span>
                ${earned ? '<span class="badge-earned-tag">已獲得</span>' : ''}
              </div>
              <div class="badge-row-desc">${b.description}</div>
              ${!earned ? `
                <div class="badge-progress-wrap">
                  <div class="badge-progress-bar" style="width:${pct}%"></div>
                </div>
                <div class="badge-progress-label">${current} / ${b.threshold}</div>
              ` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="badges-section-title" style="margin-top:24px">🏆 積分排行榜</div>
    <div id="leaderboard-list"><div style="text-align:center;color:var(--text3);padding:16px">載入中…</div></div>`;

  loadLeaderboard(state.me?.id);
}

async function loadLeaderboard(myId) {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;
  try {
    const { leaders } = await API.profile.leaderboard();
    if (!leaders.length) { listEl.innerHTML = '<p style="text-align:center;color:var(--text3);padding:16px">暫無資料</p>'; return; }
    const rankEmoji = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
    const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    listEl.innerHTML = leaders.map((u, i) => {
      const isMe = String(u.id) === String(myId);
      const initial = (u.name || '?')[0].toUpperCase();
      return `
        <div class="leaderboard-row${isMe ? ' me-row' : ''}">
          <div class="leaderboard-rank ${rankClass(i)}">${rankEmoji(i)}</div>
          <div class="leaderboard-avatar">
            ${u.avatar ? `<img src="${u.avatar}" alt="">` : initial}
          </div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${u.name || '匿名'}${isMe ? ' <span style="font-size:11px;color:var(--accent)">（我）</span>' : ''}</div>
            <div class="leaderboard-city">${u.city || ''}</div>
          </div>
          <div class="leaderboard-pts">${(u.points || 0).toLocaleString()}</div>
        </div>`;
    }).join('');
  } catch {
    listEl.innerHTML = '<p style="text-align:center;color:var(--text3);padding:16px">無法載入排行榜</p>';
  }
}

window.renderAchievements = renderAchievements;
