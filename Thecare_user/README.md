# hanasia community (wren 기반)

목표:
- 한아시아(hanasia.com) 느낌의 **태국 한인 커뮤니티형 구인/구직 + 광고 + 자유게시판**
- **일반유저**: 글/댓글, 미디어(이미지/gif/영상) 업로드
- **관리자**: 배너 추가/삭제, 유저 검색/삭제, 게시글/댓글 삭제, 게시글 고정, 뉴스봇 글 자동 생성

구성:
- `/` : 정적 프론트(HTML/JS)
- `/worker` : Cloudflare Workers API (D1 + R2)
  - 인증: HttpOnly 세션 쿠키(sid)
  - IP 로그: `ip_logs`에 저장 후 **3일 지난 것만 자동 삭제** (cron)
  - 뉴스봇: RSS/Atom 피드에서 가져와 **board=news**에 자동 글 작성 (cron)

---

## 로컬 실행(프론트만)
```bash
cd wren
python3 -m http.server 5173
# http://localhost:5173
```

> 로컬에서 API가 없으면(또는 USE_API=false) 기존처럼 demo(localStorage)로 일부 동작합니다.
> 실제 배포는 아래 Cloudflare 배포를 따라주세요.

---

## Cloudflare 배포(권장)
### 1) D1 생성 + 스키마 적용
```bash
cd wren/worker
wrangler d1 create hanasia_db
# wrangler.toml의 database_id / database_name 채우기

wrangler d1 execute hanasia_db --file=./schema.sql
```

### 2) R2 버킷 생성
```bash
wrangler r2 bucket create hanasia-media
```

### 3) Worker 배포
```bash
wrangler deploy
```

### 4) 프론트 배포(Cloudflare Pages)
- `wren/` 폴더를 Pages에 연결(빌드 없이)
- Pages Functions 대신 **Worker routes**를 쓰는 방식이라,
  같은 도메인에서 `/api/*`, `/media/*`가 Worker로 가도록 Route 설정을 해주세요.

---

## 관리자 계정 생성 규칙
- 아이디가 `admin_`으로 시작하면 관리자 계정으로 가입 가능
- 대신 Worker의 `ADMIN_INVITE_CODE`(wrangler.toml / CF Vars)와 일치해야 함

---

## 뉴스 자동 글쓰기(태국 뉴스/부동산)
- `worker/wrangler.toml`의 `NEWS_FEEDS`에 RSS URL을 콤마로 넣으면 됩니다.
- cron: 기본 10분마다(/10) ingestion + 매일 03:00 cleanup

---

## 보안 메모(중요)
- 이 구조는 “정적 프론트 + 서버에서 권한 강제”라서 기본적으로 안전한 편입니다.
- 그래도 운영 시 반드시:
  - 업로드 파일 용량 제한(Worker에서 헤더/사이즈 체크 강화)
  - Rate limit(Cloudflare WAF/Rules 또는 KV 기반)
  - CSP 헤더, XSS 방어(프론트는 escape 처리 포함)
  - 관리자 페이지는 Cloudflare Access/IP 제한(원하면 나중에 붙이기)
