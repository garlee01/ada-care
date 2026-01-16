
const DB_KEY = "wren_db_v1";

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function nowISO(){ return new Date().toISOString(); }

function load(){
  try { return JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch { return null; }
}
function save(db){
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function dbGet(){
  let db = load();
  if(!db){
    db = seed();
    save(db);
  }
  return db;
}
export function dbSet(db){ save(db); }

function seed(){
  const users = [
    { id: uid("u"), nickname:"admin", role:"admin", createdAt: nowISO() },
    { id: uid("u"), nickname:"user1", role:"user", createdAt: nowISO() },
  ];
  const posts = [
    mkPost({board:"news", title:"(샘플) 태국 뉴스 - 주요 이슈 정리", author:"admin", body:"뉴스 게시판 샘플 글입니다.", tags:["뉴스"]}),
    mkPost({board:"free", title:"(샘플) 게시판 첫 글", author:"user1", body:"한아시아 느낌의 커뮤니티 게시판 데모입니다.", tags:["잡담"]}),
    mkPost({board:"jobs", title:"(샘플) 매장 스태프 구합니다", author:"admin", body:"근무지/시간/급여 적는 형식 예시입니다.", tags:["파트타임"]}),
    mkPost({board:"used", title:"(샘플) 중고 - 미니 냉장고 팝니다", author:"user1", body:"중고 거래 글 샘플입니다.", tags:["중고"]}),
    mkPost({board:"estate", title:"(샘플) 부동산 - 원룸 임대", author:"admin", body:"부동산 게시판 샘플 글입니다.", tags:["임대"]}),
    mkPost({board:"ads", title:"(샘플) 광고 - 이사/청소 서비스", author:"user1", body:"광고글 예시입니다. 연락처는 실제로는 서버에서 마스킹/검증 권장.", tags:["서비스"]}),
    mkPost({board:"inquiry", title:"(샘플) 문의 - 사이트 이용 방법", author:"user1", body:"문의 게시판 샘플 글입니다.", tags:["문의"]}),
  ];
  const banners = [
    { id: uid("b"), title:"(샘플) 배너 광고", link:"#", imageDataUrl:"", createdAt: nowISO(), createdBy:"admin" }
  ];
  return { users, posts, banners };
}

function mkPost({board, title, author, body, tags=[]}){
  const id = uid("p");
  return {
    id, board, title, author,
    body,
    tags,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    attachments: [], // {type, name, dataUrl}
    comments: [
      { id: uid("c"), author:"admin", body:"댓글 예시입니다.", createdAt: nowISO() }
    ]
  };
}

function _listPosts({board, q="", page=1, pageSize=10}){
  const db = dbGet();
  let items = db.posts.slice().sort((a,b)=> (b.createdAt.localeCompare(a.createdAt)));
  if(board) items = items.filter(p=>p.board===board);
  if(q){
    const qq = q.toLowerCase();
    items = items.filter(p =>
      (p.title||"").toLowerCase().includes(qq) ||
      (p.body||"").toLowerCase().includes(qq) ||
      (p.author||"").toLowerCase().includes(qq) ||
      (p.tags||[]).join(" ").toLowerCase().includes(qq)
    );
  }
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total/pageSize));
  const start = (page-1)*pageSize;
  return { total, pages, page, pageSize, items: items.slice(start, start+pageSize) };
}

// store.js expects: listPosts(board, opts) -> {items, count}
export function listPosts(boardOrParams, opts = {}){
  const params = (typeof boardOrParams === "string")
    ? { board: boardOrParams, q: opts.q || "", page: opts.page || 1, pageSize: opts.pageSize || opts.limit || 20 }
    : boardOrParams;
  const r = _listPosts(params);
  return { items: r.items, count: r.total };
}

// store.js expects: getPost(id) -> {post, comments}
export function getPost(id){
  const db = dbGet();
  const post = db.posts.find(p=>p.id===id) || null;
  return { post, comments: post?.comments || [] };
}

// store.js expects createPost(...) -> id
export function createPost(post){
  const db = dbGet();
  const p = {
    id: uid("p"),
    board: post.board,
    title: post.title,
    author: post.author,
    body: post.body,
    tags: post.tags || [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    attachments: post.attachments || [],
    comments: []
  };
  db.posts.push(p);
  save(db);
  return p.id;
}

export function deletePost(id){
  const db = dbGet();
  db.posts = db.posts.filter(p=>p.id!==id);
  save(db);
  return true;
}

// store.js expects addComment(postId, {author, body}) -> comment id
export function addComment(postId, comment){
  const db = dbGet();
  const p = db.posts.find(x=>x.id===postId);
  if(!p) return null;
  p.comments = p.comments || [];
  const cid = uid("c");
  p.comments.push({ id: cid, author: comment.author, body: comment.body, createdAt: nowISO() });
  p.updatedAt = nowISO();
  save(db);
  return cid;
}


export function deleteComment(commentId){
  const db = dbGet();
  for(const p of db.posts){
    if(!p.comments) continue;
    const before = p.comments.length;
    p.comments = p.comments.filter(c=>c.id !== commentId);
    if(p.comments.length !== before){
      p.updatedAt = nowISO();
      save(db);
      return true;
    }
  }
  return false;
}

export function listBanners(){
  const db = dbGet();
  return db.banners.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export function addBanner(banner){
  const db = dbGet();
  const id = uid("b");
  db.banners.push({ id, ...banner, createdAt: nowISO() });
  save(db);
  return id;
}
export function deleteBanner(id){
  const db = dbGet();
  db.banners = db.banners.filter(b=>b.id!==id);
  save(db);
  return true;
}

export function listUsers({q=""}){
  const db = dbGet();
  let users = db.users.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(q){
    const qq=q.toLowerCase();
    users = users.filter(u => (u.nickname||"").toLowerCase().includes(qq));
  }
  return users;
}
export function deleteUserByNickname(nickname){
  const db = dbGet();
  db.users = db.users.filter(u=>u.nickname!==nickname);
  // also delete their posts
  db.posts = db.posts.filter(p=>p.author!==nickname);
  save(db);
}

// ===== Admin helpers (store.js expects these names) =====
export function adminListUsers(q=""){
  return listUsers({ q });
}
export function adminDeleteUser(nickname){
  deleteUserByNickname(nickname);
  return true;
}
export function adminUserPosts(nickname){
  const db = dbGet();
  return db.posts.filter(p=>p.author===nickname).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
