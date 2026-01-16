import { mountShell, fmtDate } from "./ui.js";
import { listPosts } from "./store.js";

await mountShell();

const sp = new URLSearchParams(location.search);
const board = (sp.get("board") || "jobs").toLowerCase();
const q0 = sp.get("q") || "";
const page = Math.max(1, parseInt(sp.get("p") || "1", 10) || 1);
const pageSize = clamp(parseInt(sp.get("ps") || "20", 10) || 20, 10, 50);

document.querySelector("#board-name").textContent = boardLabel(board);

const pageSizeSel = document.querySelector("#pageSize");
if(pageSizeSel){
  pageSizeSel.value = String(pageSize);
  pageSizeSel.addEventListener("change", ()=>{
    const ps = parseInt(pageSizeSel.value, 10) || 20;
    const u = new URL(location.href);
    u.searchParams.set("board", board);
    if(q0) u.searchParams.set("q", q0);
    else u.searchParams.delete("q");
    u.searchParams.set("ps", String(ps));
    u.searchParams.set("p", "1");
    location.href = u.toString();
  });
}

document.querySelector("#btn-write-here")?.addEventListener("click", ()=>{
  location.href = `/pages/write.html?board=${encodeURIComponent(board)}`;
});

await render();

async function render(){
  const q = (q0 || "").trim();
  // In demo we can fetch a larger slice and paginate on client
  const res = await listPosts(board, { q, limit: 500 });
  const all = res.items || [];
  const total = typeof res.count === "number" ? res.count : all.length;
  document.querySelector("#count").textContent = String(total);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = clamp(page, 1, pages);
  document.querySelector("#page-info").textContent = `${cur} / ${pages}`;
  const start = (cur - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  const tbody = document.querySelector("#tbody");
  tbody.innerHTML = items.map(p=>{
    const media = safeParse(p.media_json, []);
    const hasMedia = media?.length ? ` <span class="badge">미디어</span>` : "";
    const pinned = p.is_pinned ? ` <span class="badge">고정</span>` : "";
    const author = escapeHtml(p.author_nickname||"익명");
    const date = fmtDate(p.created_at);
    return `
      <tr>
        <td class="td-title">
          <a class="row-title" href="/pages/post.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.title)}</a>${pinned}${hasMedia}
          <div class="row-meta"><span class="meta-author">${author}</span><span class="meta-dot"> · </span><span class="meta-date">${escapeHtml(date)}</span></div>
        </td>
        <td class="muted td-author">${author}</td>
        <td class="muted td-date">${escapeHtml(date)}</td>
      </tr>
    `;
  }).join("");

  renderPager({ pages, cur, q, pageSize });
}

function renderPager({ pages, cur, q, pageSize }){
  const wrap = document.querySelector("#pages");
  if(!wrap) return;

  const mkUrl = (p)=>{
    const u = new URL(location.href);
    u.searchParams.set("board", board);
    if(q) u.searchParams.set("q", q);
    else u.searchParams.delete("q");
    u.searchParams.set("ps", String(pageSize));
    u.searchParams.set("p", String(p));
    return u.toString();
  };

  // windowed page numbers (1..5 around current)
  const windowSize = 5;
  let start = Math.max(1, cur - Math.floor(windowSize/2));
  let end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const btn = (label, href, disabled=false, cls="")=>
    `<a class="page-btn ${cls} ${disabled?"disabled":""}" href="${disabled?"#":href}" ${disabled?"aria-disabled=\"true\" tabindex=\"-1\"":""}>${label}</a>`;

  const leftIcon = `<img class="page-ico" src="/assets/images/arrow-left.svg" alt="이전"/>`;
  const rightIcon = `<img class="page-ico" src="/assets/images/arrow-right.svg" alt="다음"/>`;

  let html = "";
  html += btn(leftIcon, mkUrl(cur-1), cur<=1, "ico");
  for(let p=start;p<=end;p++){
    html += btn(String(p), mkUrl(p), false, p===cur?"active":"");
  }
  html += btn(rightIcon, mkUrl(cur+1), cur>=pages, "ico");
  wrap.innerHTML = html;
}

function clamp(n, a, b){
  n = Number.isFinite(n) ? n : a;
  return Math.max(a, Math.min(b, n));
}

function boardLabel(b){
    return ({news:"뉴스", ads:"광고", estate:"부동산", used:"중고", jobs:"구인·구직", free:"게시판", inquiry:"문의"}[b]) || b;
}
function safeParse(s, fallback){
  try{ return JSON.parse(s||""); }catch{ return fallback; }
}
function escapeHtml(str=""){
  return String(str).replace(/[&<>'"]/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
}
