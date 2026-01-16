import { mountShell } from "./ui.js";
import { fmtDate } from "./ui.js";
import { listPosts, listBanners } from "./store.js";

await mountShell();

await renderBanners();
await renderMini("news", "#mini-news");
await renderMini("free", "#mini-free");
await renderMini("jobs", "#mini-jobs");
await renderMini("used", "#mini-used");
await renderMini("estate", "#mini-estate");
await renderMini("ads", "#mini-ads");

async function renderBanners(){
  const mount = document.querySelector("#banner-strip");
  if (!mount) return;
  const list = await listBanners();
  mount.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "banner-grid";
  if (!list.length){
    const ph = document.createElement("div");
    ph.className = "banner-card";
    ph.textContent = "(샘플) 배너 광고";
    grid.appendChild(ph);
  } else {
    for (const b of list){
      const a = document.createElement("a");
      a.className = "banner-card";
      a.href = b.link || "#";
      a.target = b.link ? "_blank" : "_self";
      const img = document.createElement("img");
      img.alt = b.title || "banner";
      if (b.image) img.src = b.image;
      a.appendChild(img);
      grid.appendChild(a);
    }
  }
  mount.appendChild(grid);
}

async function renderMini(boardKey, selector){
  const mount = document.querySelector(selector);
  if (!mount) return;
  const r = await listPosts(boardKey, { limit: 1 });
  mount.innerHTML = "";
  if (!r.items.length){
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "아직 글이 없어요.";
    mount.appendChild(p);
    return;
  }
  const post = r.items[0];
  const a = document.createElement("a");
  a.className = "mini-item";
  a.href = `./pages/board.html?b=${encodeURIComponent(boardKey)}`;

  const title = document.createElement("div");
  title.className = "mini-title";
  title.textContent = post.title;

  const meta = document.createElement("div");
  meta.className = "mini-meta";
  const when = post.created_at ? fmtDate(post.created_at) : "";
  meta.textContent = when;

  a.appendChild(title);
  a.appendChild(meta);
  mount.appendChild(a);
}
