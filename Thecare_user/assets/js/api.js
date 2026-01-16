
import { API_BASE } from "./config.js";

export async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: "include",
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {})
    }
  });

  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (data && data.ok === false) throw new Error(data.error || "요청 실패");
  return data;
}
