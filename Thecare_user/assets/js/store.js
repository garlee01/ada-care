// store.js - API-first store with localStorage fallback (demo mode)
import { USE_API } from "./config.js";
import { api } from "./api.js";
import * as local from "./data.js";

async function tryApi(fn){
  if (!USE_API) return null;
  try { return await fn(); } catch (e) { console.warn("[API fail] fallback to local:", e.message); return null; }
}

export async function listPosts(board, opts = {}){
  const q = opts.q ? encodeURIComponent(opts.q) : "";
  const lim = opts.limit || 20;
  const r = await tryApi(() => api(`/api/posts?board=${encodeURIComponent(board)}&limit=${lim}${q ? `&q=${q}` : ""}`));
  if (r) return { items: r.items, count: r.count };
  return local.listPosts(board, opts);
}

export async function getPost(id){
  const r = await tryApi(() => api(`/api/posts/${encodeURIComponent(id)}`));
  if (r) return { post: r.post, comments: r.comments };
  return local.getPost(id);
}

export async function createPost(payload){
  const r = await tryApi(() => api(`/api/posts`, { method:"POST", body: JSON.stringify(payload)}));
  if (r) return r.id;
  return local.createPost(payload);
}

export async function deletePost(id){
  const r = await tryApi(() => api(`/api/posts/${encodeURIComponent(id)}`, { method:"DELETE" }));
  if (r) return true;
  return local.deletePost(id);
}

export async function setPinned(){ throw new Error('admin 기능은 사용자 페이지에서 비활성화되었습니다.'); }

export async function listBanners(){
  const r = await tryApi(() => api(`/api/banners`));
  if (r) return r.items;
  return local.listBanners();
}

export async function addBanner(){ throw new Error('admin 기능은 사용자 페이지에서 비활성화되었습니다.'); }

export async function deleteBanner(){ throw new Error('admin 기능은 사용자 페이지에서 비활성화되었습니다.'); }

// admin
export async function adminListUsers(){ throw new Error("이 기능은 유저 페이지에서 비활성화되어 있어요."); }
export async function adminDeleteUser(){ throw new Error("이 기능은 유저 페이지에서 비활성화되어 있어요."); }
export async function adminUserPosts(){ throw new Error("이 기능은 유저 페이지에서 비활성화되어 있어요."); }
