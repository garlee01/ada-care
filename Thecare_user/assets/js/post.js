import { mountShell, requireLogin, fmtDate } from "./ui.js";
import { getAuth } from "./auth.js";
import { getPost, addComment, deletePost, deleteComment } from "./store.js";

await mountShell();

const sp = new URLSearchParams(location.search);
const id = sp.get("id");

if (!id) {
  document.querySelector("#post").innerHTML = `<div class="card container" style="padding:16px">잘못된 접근이에요.</div>`;
  throw new Error("no id");
}

const { post, comments } = await getPost(id);
const me = getAuth();

// Header
document.querySelector("#title").textContent = post.title;
document.querySelector("#meta").textContent = `${post.nickname} · ${fmtDate(post.createdAt)}`;

document.querySelector("#body").textContent = post.body || "";

const attach = document.querySelector("#attach");
attach.innerHTML = "";
for (const a of (post.attachments || [])) {
  if (a.type?.startsWith("image")) {
    const img = document.createElement("img");
    img.className = "post-img";
    img.alt = a.name || "image";
    img.src = a.dataUrl || a.url;
    attach.appendChild(img);
  } else if (a.type?.startsWith("video")) {
    const v = document.createElement("video");
    v.className = "post-video";
    v.controls = true;
    v.src = a.dataUrl || a.url;
    attach.appendChild(v);
  } else {
    const link = document.createElement("a");
    link.href = a.dataUrl || a.url;
    link.textContent = a.name || "첨부파일";
    link.target = "_blank";
    attach.appendChild(link);
  }
}

// Delete (owner only)
const btnDel = document.querySelector("#btnDelete");
const isOwner = !!(me && post.userId && me.id === post.userId);
if (btnDel) {
  btnDel.hidden = !isOwner;
  btnDel.addEventListener("click", async () => {
    if (!confirm("삭제할까요?")) return;
    await deletePost(post.id);
    location.href = `./board.html?b=${encodeURIComponent(post.board)}`;
  });
}

// Comments
const cList = document.querySelector("#commentList");
cList.innerHTML = "";
for (const c of (comments || [])) {
  const row = document.createElement("div");
  row.className = "comment";
  row.innerHTML = `
    <div class="comment-head">
      <span class="comment-who">${c.nickname}</span>
      <span class="comment-date">${fmtDate(c.createdAt)}</span>
    </div>
    <div class="comment-body"></div>
    <div class="comment-actions"></div>
  `;
  row.querySelector(".comment-body").textContent = c.body || "";

  const actions = row.querySelector(".comment-actions");
  const canDelC = !!(me && c.userId && me.id === c.userId);
  if (canDelC) {
    const b = document.createElement("button");
    b.className = "btn btn-ghost";
    b.textContent = "삭제";
    b.addEventListener("click", async () => {
      if (!confirm("댓글을 삭제할까요?")) return;
      await deleteComment(post.id, c.id);
      location.reload();
    });
    actions.appendChild(b);
  }

  cList.appendChild(row);
}

// Add comment
const form = document.querySelector("#commentForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  requireLogin();
  const body = document.querySelector("#commentBody").value.trim();
  if (!body) return;
  await addComment(post.id, body);
  location.reload();
});
