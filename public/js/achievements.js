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
    </div>`;
}

window.renderAchievements = renderAchievements;
