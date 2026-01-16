(() => {
  const KEY_ID = 'wren_user_id_v1';
  const KEY_BAL = 'wren_points_balance_v1';
  const KEY_CONV = 'wren_points_convertible_v1';

  const elId = document.getElementById('userId');
  const elBal = document.getElementById('balancePoints');
  const elConv = document.getElementById('convertiblePoints');
  const btn = document.getElementById('convertPointsBtn');

  if (!elId || !elBal || !elConv || !btn) return;

  const fmt = (n) => {
    const x = Number(n) || 0;
    return x.toLocaleString('en-US');
  };

  const getId = () => {
    let id = localStorage.getItem(KEY_ID);
    if (!id) {
      id = 'user_' + Math.random().toString(16).slice(2, 8);
      localStorage.setItem(KEY_ID, id);
    }
    return id;
  };

  const getNum = (k, def = 0) => {
    const v = localStorage.getItem(k);
    const n = v == null ? def : Number(v);
    return Number.isFinite(n) ? n : def;
  };

  const setNum = (k, n) => {
    localStorage.setItem(k, String(Math.max(0, Math.floor(Number(n) || 0))));
  };

  if (localStorage.getItem(KEY_BAL) == null) setNum(KEY_BAL, 0);
  if (localStorage.getItem(KEY_CONV) == null) setNum(KEY_CONV, 0);

  const render = () => {
    const id = getId();
    const bal = getNum(KEY_BAL, 0);
    const conv = getNum(KEY_CONV, 0);

    elId.textContent = id;
    elBal.textContent = fmt(bal);
    elConv.textContent = fmt(conv);

    btn.disabled = conv <= 0;
  };

  btn.addEventListener('click', () => {
    const bal = getNum(KEY_BAL, 0);
    const conv = getNum(KEY_CONV, 0);
    if (conv <= 0) return;

    setNum(KEY_BAL, bal + conv);
    setNum(KEY_CONV, 0);
    render();
  });

  window.addEventListener('load', render);
})();