
(() => {
  const STORAGE_KEY = 'wren_blog_posts_v1';
  const SELECTED_KEY = 'wren_selected_post_id';
  const SELECTED_PERSIST_KEY = 'wren_selected_post_id_persist';
  const COMMENT_KEY = 'wren_blog_comments_v1';

  const form = document.getElementById('writeForm');
  const fileInput = document.getElementById('postMedia');
  const preview = document.getElementById('mediaPreview');
  const titleEl = document.getElementById('postTitle');
  const bodyEl = document.getElementById('postBody');
  // 댓글 관련 DOM
  const commentCountEl = document.getElementById('commentCount');
  const commentListEl = document.getElementById('commentList');
  const openCommentFormBtn = document.getElementById('openCommentForm');
  const commentFormEl = document.getElementById('commentForm');
  const commentTextEl = document.getElementById('commentText');
  const cancelCommentBtn = document.getElementById('cancelComment');
  const submitCommentBtn = document.getElementById('submitComment');

  const table = document.querySelector('.board-table');
  if (!table) return;

  let tableBody = table.querySelector('tbody');
  if (!tableBody) {
    tableBody = document.createElement('tbody');
    table.appendChild(tableBody);
  }

  const fileToDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const readSelectedMedia = async () => {
    const files = Array.from(fileInput?.files || []);
    const out = [];
    for (const f of files) {
      try {
        const dataUrl = await fileToDataURL(f);
        out.push({ name: f.name, type: f.type, dataUrl });
      } catch {}
    }
    return out;
  };
  const loadPosts = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const savePosts = (posts) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch {
      // ignore
    }
  };

  // --- 댓글 저장/로드/헬퍼 ---
  const loadCommentsMap = () => {
    try {
      const raw = localStorage.getItem(COMMENT_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  };

  const saveCommentsMap = (map) => {
    try {
      localStorage.setItem(COMMENT_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const getCommentsForPost = (postId) => {
    const map = loadCommentsMap();
    const arr = map[String(postId)] || [];
    return Array.isArray(arr) ? arr : [];
  };

  const addCommentForPost = (postId, content) => {
    const map = loadCommentsMap();
    const key = String(postId);
    const arr = Array.isArray(map[key]) ? map[key] : [];
    arr.push({
      id: String(Date.now()),
      createdAt: Date.now(),
      author: '나',
      content,
    });
    map[key] = arr;
    saveCommentsMap(map);
  };

  const formatCommentTime = (ts) => {
    const d = new Date(ts);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yy}/${mm}/${dd} ${hh}:${mi}`;
  };

  const renderComments = (postId) => {
    if (!commentCountEl || !commentListEl) return;

    const comments = getCommentsForPost(postId)
      .slice()
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

    commentCountEl.textContent = `댓글 ${comments.length}개`;
    commentListEl.innerHTML = '';

    comments.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="meta">
          <span>${c.author || '익명'}</span>
          <span>${formatCommentTime(c.createdAt)}</span>
        </div>
        <div class="content">${(c.content || '').replace(/[&<>\"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[ch]))}</div>
      `;
      commentListEl.appendChild(item);
    });
  };

  const formatNow = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yy}/${mm}/${dd} ${hh}:${mi}`;
  };

  const nextPostNo = (posts) => {
    const max = posts.reduce((m, p) => Math.max(m, Number(p.no) || 0), 0);
    return max + 1;
  };

  const clearPreview = () => {
    if (preview) preview.innerHTML = '';
  };

  const addPreviewItem = (file) => {
    if (!preview) return;

    const url = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'preview-item';

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = file.name;
      item.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const vid = document.createElement('video');
      vid.src = url;
      vid.controls = true;
      vid.playsInline = true;
      item.appendChild(vid);
    } else {
      const p = document.createElement('p');
      p.textContent = file.name;
      item.appendChild(p);
    }

    preview.appendChild(item);
  };

  const insertRowIntoTable = (tr) => {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const lastPinnedIdx = rows.reduce((idx, row, i) => (row.classList.contains('is-notice') ? i : idx), -1);

    if (lastPinnedIdx >= 0 && rows[lastPinnedIdx].nextSibling) {
      tableBody.insertBefore(tr, rows[lastPinnedIdx].nextSibling);
    } else {
      tableBody.insertBefore(tr, tableBody.firstChild);
    }
  };

  const buildRow = (post) => {
    const tr = document.createElement('tr');
    tr.dataset.postId = post.id;

    tr.innerHTML = `
      <td class="col-no">${post.no}</td>
      <td class="col-tag"><span class="badge badge-normal">일반</span></td>
      <td class="col-title">
        <a href="#post" class="board-link" data-post-link="true" data-post-id="${post.id}">
          <span class="icon-comment" aria-hidden="true"></span>
          ${post.title}
        </a>
      </td>
      <td class="col-author">나</td>
      <td class="col-date">${post.date}</td>
      <td class="col-view">0</td>
      <td class="col-like">0</td>
    `;

    return tr;
  };

  const getPostById = (id) => {
    const posts = loadPosts();
    return posts.find((p) => String(p.id) === String(id));
  };

  const renderPostDetail = (id) => {
    const title = document.getElementById('postDetailTitle');
    const meta = document.getElementById('postDetailMeta');
    const body = document.getElementById('postDetailBody');
    const post = getPostById(id);

    if (!title || !meta || !body) return;

    if (!post) {
      title.textContent = '게시물을 찾을 수 없음';
      meta.textContent = '';
      body.textContent = '';
      return;
    }

    title.textContent = post.title;
    meta.textContent = `작성자: 나 · 작성일: ${post.date}`;
    body.textContent = post.body || '';

    // 미디어 렌더링
    const mediaWrap = document.getElementById('postDetailMedia');
    if (mediaWrap) {
      mediaWrap.innerHTML = '';
      const media = Array.isArray(post.media) ? post.media : [];

      media.forEach((m) => {
        if (!m?.dataUrl) return;

        const box = document.createElement('div');
        box.className = 'post-media-item';

        if (String(m.type || '').startsWith('video/')) {
          const v = document.createElement('video');
          v.src = m.dataUrl;
          v.controls = true;
          v.playsInline = true;
          box.appendChild(v);
        } else {
          const img = document.createElement('img');
          img.src = m.dataUrl;
          img.alt = m.name || '첨부 이미지';
          box.appendChild(img);
        }
        mediaWrap.appendChild(box);
      });
    }

    renderComments(post.id);
  };

  const syncPostDetail = () => {
    if (location.hash !== '#post') return;
    const id = sessionStorage.getItem(SELECTED_KEY) || localStorage.getItem(SELECTED_PERSIST_KEY);
    if (id) {
      renderPostDetail(id);
      if (commentFormEl) commentFormEl.hidden = true;
      if (commentTextEl) commentTextEl.value = '';
    }
  };

  // ---------- init render ----------
  const initialPosts = loadPosts();
  initialPosts
    .slice()
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .forEach((p) => insertRowIntoTable(buildRow(p)));

  // ---------- events ----------
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      clearPreview();
      Array.from(fileInput.files || []).forEach(addPreviewItem);
    });
  }

  tableBody.addEventListener('click', (e) => {
    if (
      e.target.closest('a') ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('textarea')
    ) {
      return;
    }

    const row = e.target.closest('tr');
    if (!row || !row.dataset.postId) return;

    const id = row.dataset.postId;

    sessionStorage.setItem(SELECTED_KEY, id);
    localStorage.setItem(SELECTED_PERSIST_KEY, id);
    location.hash = 'post';
    renderPostDetail(id);
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = (titleEl?.value || '').trim();
      const body = (bodyEl?.value || '').trim();
      if (!title || !body) return;

      const media = await readSelectedMedia();

      const posts = loadPosts();
      const post = {
        id: String(Date.now()),
        createdAt: Date.now(),
        no: nextPostNo(posts),
        title,
        body,
        media,
        date: formatNow(),
      };

      posts.push(post);
      savePosts(posts);

      insertRowIntoTable(buildRow(post));

      form.reset();
      clearPreview();

      location.hash = 'recent';
    });
  }

  window.addEventListener('load', syncPostDetail);
  window.addEventListener('hashchange', syncPostDetail);

  // 댓글 쓰기 열기/닫기
  if (openCommentFormBtn && commentFormEl) {
    openCommentFormBtn.addEventListener('click', () => {
      commentFormEl.hidden = false;
      if (commentTextEl) commentTextEl.focus();
    });
  }

  if (cancelCommentBtn && commentFormEl) {
    cancelCommentBtn.addEventListener('click', () => {
      commentFormEl.hidden = true;
      if (commentTextEl) commentTextEl.value = '';
    });
  }

  if (submitCommentBtn) {
    submitCommentBtn.addEventListener('click', () => {
      const postId = sessionStorage.getItem(SELECTED_KEY) || localStorage.getItem(SELECTED_PERSIST_KEY);
      if (!postId) return;
      const content = (commentTextEl?.value || '').trim();
      if (!content) return;

      addCommentForPost(postId, content);
      renderComments(postId);

      if (commentTextEl) commentTextEl.value = '';
      if (commentFormEl) commentFormEl.hidden = true;
    });
  }

})();