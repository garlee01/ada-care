/* Cloudflare Worker (Pages/Workers) API for hanasia community.
   - Sessions via HttpOnly cookie "sid"
   - Password hashing: PBKDF2-SHA256
   - Media upload: signed PUT URLs to R2
   - News ingestion: cron fetch RSS/Atom into board "news"
*/

export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  NEWS_FEEDS: string;
  ADMIN_INVITE_CODE: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

function bad(msg: string, code = 400) {
  return json({ ok: false, error: msg }, { status: code });
}

function ok(data: any = {}) {
  return json({ ok: true, ...data });
}

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowISO() {
  return new Date().toISOString();
}

function getIP(req: Request) {
  // Cloudflare populates this header
  return req.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

function getCookie(req: Request, name: string) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(headers: Headers, name: string, value: string, opts: { maxAge?: number } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  // If you serve over https (recommended), keep Secure on.
  parts.push("Secure");
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  headers.append("Set-Cookie", parts.join("; "));
}

async function readJSON<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("invalid_json");
  }
}

async function pbkdf2(password: string, salt: Uint8Array, iterations = 120_000) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  return new Uint8Array(bits);
}

function b64(buf: Uint8Array) {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getSession(req: Request, env: Env) {
  const sid = getCookie(req, "sid");
  if (!sid) return null;

  const row = await env.DB.prepare(
    "SELECT s.sid, s.user_id, s.expires_at, u.nickname, u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.sid=?"
  )
    .bind(sid)
    .first<any>();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    // cleanup expired
    await env.DB.prepare("DELETE FROM sessions WHERE sid=?").bind(sid).run();
    return null;
  }
  return { sid: row.sid, userId: row.user_id, nickname: row.nickname, role: row.role };
}

function requireAuth(sess: any) {
  if (!sess) throw new Response(JSON.stringify({ ok: false, error: "로그인이 필요해요." }), { status: 401, headers: JSON_HEADERS });
}

function requireAdmin(sess: any) {
  requireAuth(sess);
  if (sess.role !== "admin") throw new Response(JSON.stringify({ ok: false, error: "관리자 권한이 필요해요." }), { status: 403, headers: JSON_HEADERS });
}

async function logIP(env: Env, kind: string, refId: string | null, ip: string) {
  await env.DB.prepare("INSERT INTO ip_logs(id, kind, ref_id, ip, created_at) VALUES(?,?,?,?,?)")
    .bind(uid("ip"), kind, refId, ip, nowISO())
    .run();
}

async function purgeIPLogs(env: Env) {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM ip_logs WHERE created_at < ?").bind(cutoff).run();
}

async function purgeExpiredSessions(env: Env) {
  const now = nowISO();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
}

function corsify(req: Request, res: Response) {
  const h = new Headers(res.headers);
  const origin = req.headers.get("Origin");
  if (origin) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Vary", "Origin");
  }
  return new Response(res.body, { status: res.status, headers: h });
}

function isMediaTypeAllowed(ct: string) {
  return (
    ct.startsWith("image/") ||
    ct === "video/mp4" ||
    ct === "video/webm" ||
    ct === "application/octet-stream"
  );
}

async function handleAuth(req: Request, env: Env, url: URL) {
  const ip = getIP(req);

  if (url.pathname === "/api/auth/signup" && req.method === "POST") {
    const body = await readJSON<{ id: string; password: string; nickname: string; inviteCode?: string }>(req);
    const id = (body.id || "").trim();
    const nickname = (body.nickname || "").trim();
    const password = body.password || "";

    if (!id || !nickname || password.length < 6) return bad("아이디/닉네임/비밀번호(6자+)를 확인해줘.");
    const exists = await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(id).first();
    if (exists) return bad("이미 존재하는 아이디야.");

    let role = "user";
    // "관리자 role은 아이디에 넣어서" 요구: admin_ prefix + inviteCode 필요
    if (id.startsWith("admin_")) {
      if ((body.inviteCode || "") !== env.ADMIN_INVITE_CODE) return bad("관리자 초대코드가 필요해요.", 403);
      role = "admin";
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(password, salt);

    await env.DB.prepare(
      "INSERT INTO users(id, nickname, role, pass_salt, pass_hash, created_at) VALUES(?,?,?,?,?,?)"
    )
      .bind(id, nickname, role, b64(salt), b64(hash), nowISO())
      .run();

    await logIP(env, "signup", id, ip);

    return ok({ user: { id, nickname, role } });
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readJSON<{ id: string; password: string }>(req);
    const id = (body.id || "").trim();
    const password = body.password || "";

    const u = await env.DB.prepare(
      "SELECT id, nickname, role, pass_salt, pass_hash FROM users WHERE id=?"
    )
      .bind(id)
      .first<any>();

    await logIP(env, "login", id || null, ip);

    if (!u) return bad("아이디 또는 비밀번호가 달라요.", 401);

    const salt = unb64(u.pass_salt);
    const expected = u.pass_hash;
    const got = b64(await pbkdf2(password, salt));
    if (got !== expected) return bad("아이디 또는 비밀번호가 달라요.", 401);

    const sid = uid("sid");
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days
    await env.DB.prepare("INSERT INTO sessions(sid, user_id, expires_at, created_at) VALUES(?,?,?,?)")
      .bind(sid, u.id, expires, nowISO())
      .run();

    const headers = new Headers(JSON_HEADERS);
    setCookie(headers, "sid", sid, { maxAge: 14 * 24 * 60 * 60 });
    return corsify(req, new Response(JSON.stringify({ ok: true, user: { id: u.id, nickname: u.nickname, role: u.role } }), { status: 200, headers }));
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const sid = getCookie(req, "sid");
    if (sid) await env.DB.prepare("DELETE FROM sessions WHERE sid=?").bind(sid).run();
    const headers = new Headers(JSON_HEADERS);
    setCookie(headers, "sid", "", { maxAge: 0 });
    return corsify(req, new Response(JSON.stringify({ ok: true }), { status: 200, headers }));
  }

  if (url.pathname === "/api/me" && req.method === "GET") {
    const sess = await getSession(req, env);
    return ok({ user: sess ? { id: sess.userId, nickname: sess.nickname, role: sess.role } : null });
  }

  return null;
}

async function handlePosts(req: Request, env: Env, url: URL, sess: any) {
  const ip = getIP(req);

  if (url.pathname === "/api/posts" && req.method === "GET") {
    const board = (url.searchParams.get("board") || "free").toLowerCase();
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);

    let sql =
      "SELECT id, board, title, substr(content,1,180) as excerpt, author_nickname, is_pinned, created_at, media_json FROM posts WHERE board=? ";
    const binds: any[] = [board];

    if (q) {
      sql += "AND (title LIKE ? OR content LIKE ? OR author_nickname LIKE ?) ";
      binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += "ORDER BY is_pinned DESC, datetime(created_at) DESC LIMIT ? ";
    binds.push(limit);

    const rows = await env.DB.prepare(sql).bind(...binds).all<any>();
    return ok({ items: rows.results || [], count: rows.results?.length || 0 });
  }

  const postIdMatch = url.pathname.match(/^\/api\/posts\/([^\/]+)$/);
  if (postIdMatch && req.method === "GET") {
    const id = postIdMatch[1];
    const p = await env.DB.prepare(
      "SELECT id, board, title, content, author_id, author_nickname, is_pinned, created_at, updated_at, media_json, source_url FROM posts WHERE id=?"
    )
      .bind(id)
      .first<any>();
    if (!p) return bad("게시글을 찾을 수 없어요.", 404);

    const c = await env.DB.prepare(
      "SELECT id, post_id, author_id, author_nickname, content, created_at FROM comments WHERE post_id=? ORDER BY datetime(created_at) ASC"
    )
      .bind(id)
      .all<any>();

    return ok({ post: p, comments: c.results || [] });
  }

  if (url.pathname === "/api/posts" && req.method === "POST") {
    requireAuth(sess);
    const body = await readJSON<{ board: string; title: string; content: string; media?: any[] }>(req);
    const board = (body.board || "free").toLowerCase();
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    const media = Array.isArray(body.media) ? body.media : [];

    if (!title || !content) return bad("제목/내용을 입력해줘.");
    const id = uid("post");
    const now = nowISO();

    await env.DB.prepare(
      "INSERT INTO posts(id, board, title, content, author_id, author_nickname, media_json, is_pinned, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
    )
      .bind(id, board, title, content, sess.userId, sess.nickname, JSON.stringify(media), 0, now, now)
      .run();

    await logIP(env, "post", id, ip);
    return ok({ id });
  }

  if (postIdMatch && req.method === "DELETE") {
    requireAuth(sess);
    const id = postIdMatch[1];
    const p = await env.DB.prepare("SELECT author_id FROM posts WHERE id=?").bind(id).first<any>();
    if (!p) return bad("게시글이 없어요.", 404);
    if (sess.role !== "admin" && p.author_id !== sess.userId) return bad("삭제 권한이 없어요.", 403);

    await env.DB.prepare("DELETE FROM posts WHERE id=?").bind(id).run();
    return ok();
  }

  const pinMatch = url.pathname.match(/^\/api\/posts\/([^\/]+)\/pin$/);
  if (pinMatch && req.method === "POST") {
    requireAdmin(sess);
    const id = pinMatch[1];
    const body = await readJSON<{ pinned: boolean }>(req);
    await env.DB.prepare("UPDATE posts SET is_pinned=? WHERE id=?").bind(body.pinned ? 1 : 0, id).run();
    return ok();
  }

  const commentCreate = url.pathname.match(/^\/api\/posts\/([^\/]+)\/comments$/);
  if (commentCreate && req.method === "POST") {
    requireAuth(sess);
    const postId = commentCreate[1];
    const body = await readJSON<{ content: string }>(req);
    const content = (body.content || "").trim();
    if (!content) return bad("댓글 내용을 입력해줘.");

    const cId = uid("cmt");
    await env.DB.prepare(
      "INSERT INTO comments(id, post_id, author_id, author_nickname, content, created_at) VALUES(?,?,?,?,?,?)"
    )
      .bind(cId, postId, sess.userId, sess.nickname, content, nowISO())
      .run();

    await logIP(env, "comment", cId, ip);
    return ok({ id: cId });
  }

  const commentDelete = url.pathname.match(/^\/api\/comments\/([^\/]+)$/);
  if (commentDelete && req.method === "DELETE") {
    requireAuth(sess);
    const id = commentDelete[1];
    const c = await env.DB.prepare("SELECT author_id FROM comments WHERE id=?").bind(id).first<any>();
    if (!c) return bad("댓글이 없어요.", 404);
    if (sess.role !== "admin" && c.author_id !== sess.userId) return bad("삭제 권한이 없어요.", 403);
    await env.DB.prepare("DELETE FROM comments WHERE id=?").bind(id).run();
    return ok();
  }

  return null;
}

async function handleBanners(req: Request, env: Env, url: URL, sess: any) {
  const ip = getIP(req);

  if (url.pathname === "/api/banners" && req.method === "GET") {
    const rows = await env.DB.prepare("SELECT id, title, link, media_key, created_at FROM banners ORDER BY datetime(created_at) DESC")
      .all<any>();
    return ok({ items: rows.results || [] });
  }

  if (url.pathname === "/api/banners" && req.method === "POST") {
    requireAdmin(sess);
    const body = await readJSON<{ title: string; link: string; mediaKey: string }>(req);
    if (!body.title || !body.link || !body.mediaKey) return bad("title/link/mediaKey 필요");
    const id = uid("bnr");
    await env.DB.prepare("INSERT INTO banners(id,title,link,media_key,created_at) VALUES(?,?,?,?,?)")
      .bind(id, body.title.trim(), body.link.trim(), body.mediaKey, nowISO())
      .run();
    await logIP(env, "banner", id, ip);
    return ok({ id });
  }

  const del = url.pathname.match(/^\/api\/banners\/([^\/]+)$/);
  if (del && req.method === "DELETE") {
    requireAdmin(sess);
    await env.DB.prepare("DELETE FROM banners WHERE id=?").bind(del[1]).run();
    return ok();
  }

  return null;
}

async function handleAdmin(req: Request, env: Env, url: URL, sess: any) {
  if (!url.pathname.startsWith("/api/admin/")) return null;
  requireAdmin(sess);

  if (url.pathname === "/api/admin/users" && req.method === "GET") {
    const q = (url.searchParams.get("q") || "").trim();
    let sql = "SELECT id, nickname, role, created_at FROM users ";
    const binds: any[] = [];
    if (q) {
      sql += "WHERE id LIKE ? OR nickname LIKE ? ";
      binds.push(`%${q}%`, `%${q}%`);
    }
    sql += "ORDER BY datetime(created_at) DESC LIMIT 50";
    const rows = await env.DB.prepare(sql).bind(...binds).all<any>();
    return ok({ items: rows.results || [] });
  }

  const delUser = url.pathname.match(/^\/api\/admin\/users\/([^\/]+)$/);
  if (delUser && req.method === "DELETE") {
    const userId = delUser[1];
    if (userId === sess.userId) return bad("본인 계정은 삭제할 수 없어요.", 400);
    await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
    return ok();
  }

  const userPosts = url.pathname.match(/^\/api\/admin\/users\/([^\/]+)\/posts$/);
  if (userPosts && req.method === "GET") {
    const userId = userPosts[1];
    const rows = await env.DB.prepare(
      "SELECT id, board, title, created_at, is_pinned FROM posts WHERE author_id=? ORDER BY datetime(created_at) DESC LIMIT 100"
    )
      .bind(userId)
      .all<any>();
    return ok({ items: rows.results || [] });
  }

  return bad("Not found", 404);
}

async function handleUpload(req: Request, env: Env, url: URL, sess: any) {
  if (url.pathname === "/api/upload/sign" && req.method === "POST") {
    requireAuth(sess);
    const body = await readJSON<{ filename: string; contentType: string }>(req);
    const filename = (body.filename || "file").replace(/[^\w\.\-\(\)\[\]\s]/g, "_");
    const contentType = (body.contentType || "application/octet-stream").toLowerCase();
    if (!isMediaTypeAllowed(contentType)) return bad("허용되지 않는 파일 형식이에요.", 415);

    const ext = filename.includes(".") ? filename.split(".").pop() : "";
    const key = `${sess.userId}/${Date.now()}_${crypto.randomUUID()}${ext ? "." + ext : ""}`;

    const obj = env.MEDIA.object(key);
    const signed = await obj.createSignedUrl({
      method: "PUT",
      expiresIn: 60 * 10, // 10 min
      headers: { "content-type": contentType },
    });

    return ok({ key, url: signed, contentType });
  }

  const media = url.pathname.match(/^\/media\/(.+)$/);
  if (media && req.method === "GET") {
    const key = decodeURIComponent(media[1]);
    const obj = await env.MEDIA.get(key);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    const ct = obj.httpMetadata?.contentType || "application/octet-stream";
    headers.set("content-type", ct);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(obj.body, { status: 200, headers });
  }

  return null;
}

// --- RSS/Atom ingestion (simple, best-effort) ---
function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function ingestFeeds(env: Env) {
  const feeds = (env.NEWS_FEEDS || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, { headers: { "user-agent": "hanasia-worker/1.0" } });
      if (!res.ok) continue;
      const xml = await res.text();

      // Very small parser: extract <item> blocks
      const items = Array.from(xml.matchAll(/<item[\s\S]*?<\/item>/g)).slice(0, 15).map(m => m[0]);
      for (const it of items) {
        const title = (it.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || it.match(/<title>([\s\S]*?)<\/title>/))?.[1] || "";
        const link = (it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
        const guid = (it.match(/<guid[\s\S]*?>([\s\S]*?)<\/guid>/) || [])[1] || link || title;

        if (!title || !link) continue;

        const cleanTitle = stripHtml(title);
        const sourceGuid = `rss:${guid}`.slice(0, 400);

        // insert if new
        const id = uid("post");
        const now = nowISO();
        const content = `${cleanTitle}\n\n출처: ${link}`;

        await env.DB.prepare(
          "INSERT OR IGNORE INTO posts(id, board, title, content, author_id, author_nickname, media_json, is_pinned, source_url, source_guid, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
        )
          .bind(
            id,
            "news",
            cleanTitle,
            content,
            "system",
            "뉴스봇",
            "[]",
            0,
            link,
            sourceGuid,
            now,
            now
          )
          .run();
      }
    } catch {
      // ignore
    }
  }
}

async function ensureSystemUser(env: Env) {
  const exists = await env.DB.prepare("SELECT id FROM users WHERE id='system'").first();
  if (exists) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = crypto.getRandomValues(new Uint8Array(32));
  await env.DB.prepare(
    "INSERT INTO users(id, nickname, role, pass_salt, pass_hash, created_at) VALUES(?,?,?,?,?,?)"
  ).bind("system", "뉴스봇", "admin", b64(salt), b64(hash), nowISO()).run();
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight (useful if you later split domains)
    if (req.method === "OPTIONS") {
      const h = new Headers();
      const origin = req.headers.get("Origin");
      if (origin) {
        h.set("Access-Control-Allow-Origin", origin);
        h.set("Access-Control-Allow-Credentials", "true");
        h.set("Access-Control-Allow-Headers", "content-type");
        h.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
      }
      return new Response(null, { status: 204, headers: h });
    }

    // only handle api/media
    if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/media/")) {
      return new Response("Not found", { status: 404 });
    }

    const sess = await getSession(req, env);

    try {
      const r1 = await handleAuth(req, env, url);
      if (r1) return corsify(req, r1);

      const r2 = await handleUpload(req, env, url, sess);
      if (r2) return corsify(req, r2);

      const r3 = await handleBanners(req, env, url, sess);
      if (r3) return corsify(req, r3);

      const r4 = await handleAdmin(req, env, url, sess);
      if (r4) return corsify(req, r4);

      const r5 = await handlePosts(req, env, url, sess);
      if (r5) return corsify(req, r5);

      return corsify(req, bad("Not found", 404));
    } catch (e: any) {
      if (e instanceof Response) return corsify(req, e);
      return corsify(req, bad("서버 오류", 500));
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await ensureSystemUser(env);
      // run both: ingestion + cleanup
      await ingestFeeds(env);
      await purgeIPLogs(env);
      await purgeExpiredSessions(env);
    })());
  },
};
