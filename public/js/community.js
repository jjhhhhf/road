/* global API, showToast, escHtml */

function renderCommunity(state) {
  const container = document.getElementById('community-list');
  if (!container) return;

  if (!state.posts || !state.posts.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text3);padding:40px">目前還沒有社群回報</p>';
    return;
  }

  container.innerHTML = state.posts.map((p) => postCard(p, state.me, state.categories || [])).join('');

  container.querySelectorAll('.vote-btn').forEach((btn) => {
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

  container.querySelectorAll('.comment-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.post-card').querySelector('.comments-section');
      section.classList.toggle('hidden');
    });
  });

  container.querySelectorAll('.comment-send').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const input = btn.previousElementSibling;
      const text = input.value.trim();
      if (!text) return;
      const postId = btn.dataset.id;
      try {
        const { comment } = await API.posts.comment(postId, text);
        const list = btn.closest('.comments-section').querySelector('.comment-list');
        list.insertAdjacentHTML('beforeend', commentItem(comment));
        input.value = '';
      } catch {
        showToast('留言失敗');
      }
    });
  });
}

function postCard(p, me, categories = []) {
  const isMe = p.isMine || (me && p.userId === me.id);
  const timeAgo = formatTime(p.createdAt);
  const hazard = window.STATE?.hazards?.find(h => h.id === p.hazardId);
  const cat = categories.find(c => c.id === hazard?.categoryId);
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
      ${p.photoUrl ? `<img class="post-photo" src="${p.photoUrl}" alt="現場照片" loading="lazy">` : ''}
      <div class="post-actions">
        <button class="vote-btn ${p.voted ? 'voted' : ''}" data-id="${p.id}">
          <span>👍</span>
          <span class="vote-label">${p.voted ? '已附議' : '附議'}</span>
          <span class="vote-count">${p.votes}</span>
        </button>
        <span class="comment-toggle">💬 ${p.comments?.length || 0} 則留言</span>
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
