/* global API, showToast, escHtml */

let communityFilter = 'all'; // 'all' | category id | 'pending' | 'verified' | 'fixed'
let communityPage = 1;
const PAGE_SIZE = 10;
let communityHasMore = false;
let communityAllPosts = [];

function renderCommunity(state) {
  const container = document.getElementById('community-list');
  if (!container) return;

  communityPage = 1;
  communityAllPosts = state.posts || [];

  renderCommunityFilters(state);
  renderCommunityPosts(state, true);

  localStorage.setItem('community_last_seen', String(Date.now()));
  const badge = document.getElementById('community-badge');
  if (badge) badge.classList.add('hidden');
}

function renderCommunityFilters(state) {
  const bar = document.getElementById('community-filter-bar');
  if (!bar) return;

  const statusFilters = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '⏳ 待審' },
    { key: 'verified', label: '✅ 已驗證' },
    { key: 'fixed', label: '🔧 已修復' },
  ];
  const catFilters = (state.categories || []).map((c) => ({ key: 'cat:' + c.id, label: c.emoji + ' ' + c.name }));
  const all = [...statusFilters, ...catFilters];

  bar.innerHTML = all.map((f) =>
    `<button class="community-filter-chip ${communityFilter === f.key ? 'active' : ''}" data-key="${f.key}">${f.label}</button>`
  ).join('');

  bar.querySelectorAll('.community-filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      communityFilter = btn.dataset.key;
      bar.querySelectorAll('.community-filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      communityPage = 1;
      renderCommunityPosts(window.STATE, true);
    });
  });
}

function getFilteredPosts(state) {
  let posts = [...(state.posts || [])];
  if (communityFilter === 'all') return posts;
  if (communityFilter.startsWith('cat:')) {
    const catId = communityFilter.slice(4);
    const hazardIds = new Set((state.hazards || []).filter((h) => h.categoryId === catId).map((h) => h.id));
    return posts.filter((p) => hazardIds.has(p.hazardId));
  }
  // status filter
  const hazardsByStatus = new Set((state.hazards || []).filter((h) => h.status === communityFilter).map((h) => h.id));
  return posts.filter((p) => hazardsByStatus.has(p.hazardId));
}

function renderCommunityPosts(state, reset = false) {
  const container = document.getElementById('community-list');
  if (!container || !state) return;

  const filtered = getFilteredPosts(state);
  const start = reset ? 0 : (communityPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  communityHasMore = start + PAGE_SIZE < filtered.length;

  if (reset) {
    if (!slice.length) {
      container.innerHTML = '<p style="text-align:center;color:var(--text3);padding:40px">目前還沒有符合的貼文</p>';
      document.getElementById('community-load-more')?.classList.add('hidden');
      return;
    }
    container.innerHTML = slice.map((p) => postCard(p, state.me, state.categories || [], state.hazards || [])).join('');
    communityPage = 2;
  } else {
    slice.forEach((p) => {
      container.insertAdjacentHTML('beforeend', postCard(p, state.me, state.categories || [], state.hazards || []));
    });
    communityPage++;
  }

  const loadMore = document.getElementById('community-load-more');
  if (loadMore) loadMore.classList.toggle('hidden', !communityHasMore);

  attachCommunityHandlers(container, state);
}

function attachCommunityHandlers(container, state) {
  container.querySelectorAll('.vote-btn:not([data-bound])').forEach((btn) => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      const voted = btn.classList.contains('voted');
      try {
        const { votes } = voted ? await API.posts.unvote(postId) : await API.posts.vote(postId);
        btn.classList.toggle('voted', !voted);
        btn.querySelector('.vote-count').textContent = votes;
        btn.querySelector('.vote-label').textContent = !voted ? '已附議' : '附議';
      } catch (e) {
        showToast(e.message === 'already_voted' ? '你已附議過了' : '操作失敗');
      }
    });
  });

  container.querySelectorAll('.comment-toggle:not([data-bound])').forEach((btn) => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const section = btn.closest('.post-card').querySelector('.comments-section');
      section.classList.toggle('hidden');
    });
  });

  container.querySelectorAll('.comment-send:not([data-bound])').forEach((btn) => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const input = btn.previousElementSibling;
      const text = input.value.trim();
      if (!text) return;
      const postId = btn.dataset.id;
      try {
        const { comment } = await API.posts.comment(postId, text);
        const section = btn.closest('.comments-section');
        section.querySelector('.comment-list').insertAdjacentHTML('beforeend', commentItem(comment));
        input.value = '';
        const toggle = btn.closest('.post-card').querySelector('.comment-toggle');
        if (toggle) {
          const cur = parseInt(toggle.textContent.match(/\d+/)?.[0] || '0', 10);
          toggle.textContent = `💬 ${cur + 1} 則留言`;
        }
      } catch { showToast('留言失敗'); }
    });
  });

  container.querySelectorAll('.post-map-btn:not([data-bound])').forEach((btn) => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        window.activateView && window.activateView('map');
        setTimeout(() => window.panTo && window.panTo(lat, lng, 17), 50);
      }
    });
  });

  container.querySelectorAll('.post-photo:not([data-bound])').forEach((img) => {
    img.dataset.bound = '1';
    img.addEventListener('click', () => window.openLightbox && window.openLightbox(img.src));
  });
}

// 無限捲動 load-more 按鈕
document.getElementById('load-more-btn')?.addEventListener('click', () => {
  if (window.STATE) renderCommunityPosts(window.STATE, false);
});

function postCard(p, me, categories = [], hazards = []) {
  const isMe = p.isMine || (me && p.userId === me.id);
  const timeAgo = formatTime(p.createdAt);
  const hazard = hazards.find((h) => h.id === p.hazardId);
  const cat = categories.find((c) => c.id === hazard?.categoryId);
  const statusLabel = { pending: '待審', verified: '已驗證', fixed: '已修復', rejected: '已駁回' }[hazard?.status] || '';
  const statusClass = hazard?.status || 'pending';
  return `
    <div class="post-card${p.pinned ? ' post-pinned' : ''}">
      ${p.pinned ? '<div class="pin-badge">📌 置頂</div>' : ''}
      <div class="post-header">
        <div class="post-avatar">${p.typeEmoji || '⚠️'}</div>
        <div style="flex:1;min-width:0">
          <div class="post-author">${escHtml(p.reporterName)} ${isMe ? '<span style="color:var(--accent);font-size:11px">（我）</span>' : ''}</div>
          <div class="post-time">${timeAgo}</div>
        </div>
        ${cat ? `<span class="post-cat-tag">${cat.emoji} ${cat.name}</span>` : ''}
      </div>
      ${hazard ? `<div class="post-status-row"><span class="tag tag-status-${statusClass}">${statusLabel}</span></div>` : ''}
      <div class="post-title">${escHtml(p.title)}</div>
      ${p.photoUrl ? `<img class="post-photo" src="${p.photoUrl}" alt="現場照片" loading="lazy" style="cursor:pointer">` : ''}
      <div class="post-actions">
        <button class="vote-btn ${p.voted ? 'voted' : ''}" data-id="${p.id}">
          <span>👍</span>
          <span class="vote-label">${p.voted ? '已附議' : '附議'}</span>
          <span class="vote-count">${p.votes}</span>
        </button>
        <span class="comment-toggle">💬 ${p.comments?.length || 0} 則留言</span>
        ${hazard?.lat ? `<button class="post-map-btn" data-lat="${hazard.lat}" data-lng="${hazard.lng}">📍 地圖</button>` : ''}
      </div>
      <div class="comments-section hidden">
        <div class="comment-list">
          ${(p.comments || []).map(commentItem).join('')}
        </div>
        <div class="comment-input-row">
          <input class="comment-input" type="text" placeholder="發表留言…">
          <button class="comment-send" data-id="${p.id}">送出</button>
        </div>
      </div>
    </div>`;
}

function commentItem(c) {
  return `
    <div class="comment-item">
      <span class="comment-author">${escHtml(c.author)}</span>
      <span class="comment-text"> ${escHtml(c.text)}</span>
    </div>`;
}

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '剛剛';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

window.renderCommunity = renderCommunity;
