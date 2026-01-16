window.__PARTIALS__ = {
  header: `
<header class="site-header">
  <div class="container header-inner">
    <!-- login page quick nav -->
    <div class="login-only login-nav" aria-label="login navigation">
</div>

    <a class="brand" href="/index.html" aria-label="HANASIA Home">
      <span class="brand-mark">T</span>
      <span class="brand-name">The care</span>
    </a>

    <nav class="nav desktop-nav" aria-label="Primary">
      <a data-nav="news" href="/pages/board.html?board=news">뉴스</a>
      <a data-nav="ads" href="/pages/board.html?board=ads">광고</a>
      <a data-nav="estate" href="/pages/board.html?board=estate">부동산</a>
      <a data-nav="used" href="/pages/board.html?board=used">중고</a>
      <a data-nav="jobs" href="/pages/board.html?board=jobs">구인구직</a>
      <a data-nav="free" href="/pages/board.html?board=free">게시판</a>
      <a data-nav="inquiry" href="/pages/board.html?board=inquiry">문의</a>
    </nav>

    <!-- PC only: search in header -->
    <form class="header-search desktop-only" id="headerSearchForm" role="search" aria-label="검색">
      <select id="headerSearchBoard" aria-label="검색 카테고리">
        <option value="news">뉴스</option>
        <option value="ads">광고</option>
        <option value="estate">부동산</option>
        <option value="used">중고</option>
        <option value="jobs" selected>구인구직</option>
        <option value="free">게시판</option>
        <option value="inquiry">문의</option>
      </select>
      <input id="headerSearchInput" type="search" placeholder="검색" autocomplete="off" />
      <button class="btn ghost" id="headerSearchBtn" type="submit">검색</button>
    </form>

    <div class="header-actions">

      <button class="icon-btn mobile-only" id="btn-mobile-menu" type="button" aria-label="메뉴">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/>
        </svg>
      </button>

      <button class="btn primary desktop-only" id="btn-login" type="button">로그인</button>
      <button class="btn ghost desktop-only" id="btn-logout" type="button" hidden>로그아웃</button>
</div>
  </div>
</header>

<div class="overlay" id="drawerOverlay" hidden></div>

<aside class="drawer" id="drawer" hidden aria-label="Menu">
  <div class="drawer-head">
    <div class="drawer-title">메뉴</div>
    <button class="icon-btn" id="btn-drawer-close" type="button" aria-label="닫기">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4z"/>
      </svg>
    </button>
  </div>

  <div class="drawer-body">
    <div class="drawer-group">
      <div class="drawer-label">계정</div>
      <a href="/pages/login.html" id="drawer-login-link">로그인 / 회원가입</a>
      <button class="btn ghost" id="btn-drawer-logout" type="button" hidden>로그아웃</button>
    </div>

    <div class="drawer-group">
      <div class="drawer-label">검색</div>
      <form class="drawer-search" id="drawerSearchForm" role="search">
        <select id="drawerSearchBoard" aria-label="검색 카테고리">
          <option value="news">뉴스</option>
          <option value="ads">광고</option>
          <option value="estate">부동산</option>
          <option value="used">중고</option>
          <option value="jobs" selected>구인구직</option>
          <option value="free">게시판</option>
          <option value="inquiry">문의</option>
        </select>
        <input id="drawerSearchInput" type="search" placeholder="검색" autocomplete="off" />
        <button class="btn primary" type="submit">검색</button>
      </form>
    </div>

    <div class="drawer-group">
      <div class="drawer-label">카테고리</div>
      <a data-nav="news" href="/pages/board.html?board=news">뉴스</a>
      <a data-nav="ads" href="/pages/board.html?board=ads">광고</a>
      <a data-nav="estate" href="/pages/board.html?board=estate">부동산</a>
      <a data-nav="used" href="/pages/board.html?board=used">중고</a>
      <a data-nav="jobs" href="/pages/board.html?board=jobs">구인·구직</a>
      <a data-nav="free" href="/pages/board.html?board=free">게시판</a>
      <a data-nav="inquiry" href="/pages/board.html?board=inquiry">문의</a>
    </div>
  </div>
</aside>

`,
  footer: `
<footer class="site-footer">
  <div class="container footer-inner">
    <div>© HANASIA-style community demo (wren 기반 스캐폴드)</div>
    <div class="muted">이 버전은 프론트엔드 데모(로컬스토리지)입니다. 실제 배포/보안은 서버/DB 권한(RLS)로 처리해야 합니다.</div>
  </div>
</footer>
`
};