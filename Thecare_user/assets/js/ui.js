/* ui.js - shared UI helpers */
import { getAuth, isAdmin, isLoggedIn, logout, refreshMe } from "./auth.js";

export async function mountShell(){
  const header = document.querySelector("#app-header");
  const footer = document.querySelector("#app-footer");
  if(header) header.innerHTML = window.__PARTIALS__.header;
  if(footer) footer.innerHTML = window.__PARTIALS__.footer;

  // API 모드면 서버 세션 기준으로 auth 동기화
  await refreshMe();

// ====== Mobile UI: drawer ======
const drawer = document.querySelector("#drawer");
const drawerOverlay = document.querySelector("#drawerOverlay");

// Robust scroll lock for mobile (prevents background scroll when drawer open)
let __scrollY = 0;
const lockScroll = () => {
  __scrollY = window.scrollY || 0;
  document.body.classList.add("drawer-open");
  // iOS-friendly: freeze body
  document.body.style.position = "fixed";
  document.body.style.top = `-${__scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
};
const unlockScroll = () => {
  document.body.classList.remove("drawer-open");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, __scrollY || 0);
};

const openDrawer = () => {
  if(!drawer || !drawerOverlay) return;
  drawer.hidden = false;
  drawerOverlay.hidden = false;
  lockScroll();
};
const closeDrawer = () => {
  if(!drawer || !drawerOverlay) return;
  drawer.hidden = true;
  drawerOverlay.hidden = true;
  unlockScroll();
};

document.querySelector("#btn-mobile-menu")?.addEventListener("click", openDrawer);
document.querySelector("#btn-drawer-close")?.addEventListener("click", closeDrawer);
drawerOverlay?.addEventListener("click", closeDrawer);

window.addEventListener("keydown", (e)=>{
  if(e.key === "Escape"){
    closeDrawer();
  }
});

// ====== Auth UI ======
  const btnLogin = document.querySelector("#btn-login");
  const btnLogout = document.querySelector("#btn-logout");
  const btnDrawerLogout = document.querySelector("#btn-drawer-logout");
  const adminLinks = document.querySelectorAll(".admin-only");

  const auth = getAuth();
  const drawerLoginLink = document.querySelector("#drawer-login-link");

  if(auth){
    btnLogin && (btnLogin.textContent = `${auth.nickname}`);
    btnLogout && (btnLogout.hidden = false);
    btnDrawerLogout && (btnDrawerLogout.hidden = false);
    drawerLoginLink && (drawerLoginLink.hidden = true);
  }else{
    btnLogout && (btnLogout.hidden = true);
    btnDrawerLogout && (btnDrawerLogout.hidden = true);
    drawerLoginLink && (drawerLoginLink.hidden = false);
  }

  adminLinks.forEach(el => { el.hidden = !(getAuth() && isAdmin()); });

  btnLogout?.addEventListener("click", () => {
    logout();
    location.href = "/index.html";
  });
  btnDrawerLogout?.addEventListener("click", () => {
    logout();
    closeDrawer();
    location.href = "/index.html";
  });

  btnLogin?.addEventListener("click", () => {
    location.href = "/pages/login.html";
  });

  // close drawer when clicking a link
  drawer?.querySelectorAll("a").forEach(a=>{
    a.addEventListener("click", ()=> closeDrawer());
  });

  // ====== Active nav ======
  const path = location.pathname;
  const navKey =
    path.includes("/pages/admin") ? "admin" :
    path.includes("/pages/board") ? (new URLSearchParams(location.search).get("board") || "jobs") :
    path.includes("/pages/post") ? (new URLSearchParams(location.search).get("board") || "free") :
    path.includes("/pages/write") ? (new URLSearchParams(location.search).get("board") || "jobs") :
    "home";

  document.querySelectorAll("[data-nav]").forEach(a=>{
    if(a.dataset.nav === navKey) a.classList.add("active");
  });

  // ====== Search (desktop header + mobile drawer) ======
  const runSearch = (boardKey, term) => {
    const q = String(term || "").trim();
    const b = String(boardKey || "").trim() || "jobs";
    const u = new URL(location.origin + "/pages/board.html");
    u.searchParams.set("board", b);
    if(q) u.searchParams.set("q", q);
    location.href = u.toString();
  };

  const headerForm = document.querySelector("#headerSearchForm");
  headerForm?.addEventListener("submit", (e)=>{
    e.preventDefault();
    const b = document.querySelector("#headerSearchBoard")?.value;
    const q = document.querySelector("#headerSearchInput")?.value;
    runSearch(b, q);
  });

  const drawerForm = document.querySelector("#drawerSearchForm");
  drawerForm?.addEventListener("submit", (e)=>{
    e.preventDefault();
    const b = document.querySelector("#drawerSearchBoard")?.value;
    const q = document.querySelector("#drawerSearchInput")?.value;
    runSearch(b, q);
  });

  // Login page: back button
  document.querySelector("#btn-back")?.addEventListener("click", ()=>{
    // prefer history back, fallback to home
    if(history.length > 1) history.back();
    else location.href = "/index.html";
  });
}

export function requireLogin(){
  if(!isLoggedIn()){
    alert("로그인이 필요합니다.");
    location.href="/index.html";
    return false;
  }
  return true;
}

export function requireAdmin(){
  if(!isAdmin()){
    alert("관리자 권한이 필요합니다.");
    location.href="/index.html";
    return false;
  }
  return true;
}

export function fmtDate(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
