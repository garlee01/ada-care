
import { USE_API } from "./config.js";
import { api } from "./api.js";

const AUTH_KEY = "hanasia_auth_v2";

export function getAuth(){
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
  catch { return null; }
}

export function setAuth(auth){
  if(auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  else localStorage.removeItem(AUTH_KEY);
}

export function isLoggedIn(){ return !!getAuth(); }
export function isAdmin(){ return false; }

export async function refreshMe(){
  if(!USE_API) return getAuth();
  try{
    const r = await api("/api/me", { method:"GET", headers:{} });
    if(r?.user){
      setAuth({ nickname: r.user.nickname, role: "user", id: r.user.id, ts: Date.now() });
      return getAuth();
    }
    setAuth(null);
    return null;
  }catch{
    return getAuth();
  }
}

export async function signup({id, password, nickname, inviteCode}){
  if(!USE_API) throw new Error("회원가입은 API 모드에서만 지원해요.");
  const r = await api("/api/auth/signup", { method:"POST", body: JSON.stringify({id, password, nickname, inviteCode}) });
  return r.user;
}

export async function login({id, password}){
  if(USE_API){
    const r = await api("/api/auth/login", { method:"POST", body: JSON.stringify({id, password}) });
    if(r?.user){
      setAuth({ nickname: r.user.nickname, role: 'user', id: r.user.id, ts: Date.now() });
      return getAuth();
    }
    throw new Error("로그인 실패");
  }
  const auth = { nickname: id || "guest", role: "user", id: id || "guest", ts: Date.now() };
  setAuth(auth);
  return auth;
}


export async function logout(){
  if(USE_API){
    try{ await api("/api/auth/logout", { method:"POST", body: "{}" }); }catch{/*ignore*/}
  }
  setAuth(null);
}
