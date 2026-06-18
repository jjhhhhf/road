/* global API */

async function renderAchievements(state) {
  const container = document.getElementById('achievements-content');
  if (!container) return;

  let allBadges = state.myBadges || [];
  try {
    const { badges } = await API.profile.badges();
    allBadges = badges;
  } catch { /* use cached */ }

  const points = state.me?.points || 0;
  const earnedIds = new Set(allBadges.map((b) => b.id));

  const allDefs = [
    { id: 'badge_first',  name: '初心排雷師', emoji: '🌱', description: '完成第 1 次回報' },
    { id: 'badge_10',     name: '勤奮排雷師', emoji: '⭐', description: '累積 10 次回報' },
    { id: 'badge_50',     name: '黃金排雷師', emoji: '🔥', description: '累積 50 次回報' },
    { id: 'badge_vote10', name: '熱心市民',   emoji: '👍', description: '累積附議 10 次' },
    { id: 'badge_fixed5', name: '排雷英雄',   emoji: '🏆', description: '5 筆回報達成修復' },
    { id: 'badge_night',  name: '夜鷹',       emoji: '🦉', description: '夜間回報 5 次' },
  ];

  container.innerHTML = `
    <div class="points-banner">
      <div class="points-num">${points.toLocaleString()}</div>
      <div class="points-label">累積積分</div>
    </div>
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">成就勳章</div>
    <div class="badges-grid">
      ${allDefs.map((b) => {
        const earned = earnedIds.has(b.id);
        return `
          <div class="badge-card ${earned ? 'earned' : ''}">
            <div class="badge-emoji">${b.emoji}</div>
            <div class="badge-name">${b.name}</div>
            <div class="badge-desc">${b.description}</div>
            ${earned ? '<div style="font-size:10px;color:var(--gold);margin-top:4px">已獲得 ✓</div>' : ''}
          </div>`;
      }).join('')}
    </div>`;
}

window.renderAchievements = renderAchievements;
