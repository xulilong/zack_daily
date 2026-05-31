/* MT大冒险 · 排行榜（CEO 就职后按 MT 币排名） */
window.MTLeaderboard = (function(){
  function apiBase(){
    if(window.MT_LEADERBOARD_API) return String(window.MT_LEADERBOARD_API).replace(/\/$/, "");
    if(location.protocol === "http:" || location.protocol === "https:"){
      return location.origin + "/api/leaderboard";
    }
    return "http://localhost:3000/api/leaderboard";
  }

  function fetchList(limit){
    limit = limit || 20;
    return fetch(apiBase() + "?limit=" + limit)
      .then(r => r.json())
      .then(json => (json.ok ? json.data : []))
      .catch(() => []);
  }

  function submit(name, score){
    const payload = {
      name: String(name || "").trim(),
      score: Math.max(0, score | 0),
      visitorId: window.MTAnalytics ? MTAnalytics.getVisitorId() : null
    };
    if(!payload.name || payload.score <= 0){
      return Promise.resolve({ ok: false, skipped: true });
    }
    return fetch(apiBase() + "/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(r => r.json()).catch(() => ({ ok: false }));
  }

  function medal(rank){
    if(rank === 1) return "🥇";
    if(rank === 2) return "🥈";
    if(rank === 3) return "🥉";
    return rank;
  }

  function renderHtml(list, opts){
    opts = opts || {};
    const myName = opts.myName || "";
    const runCoins = opts.runCoins | 0;
    if(!list || !list.length){
      return `<p class="lb-empty">还没有 CEO 上榜。<br>通全关、完成就职仪式后，MT 币会自动计入。</p>${
        runCoins > 0 ? `<p class="lb-run">本局累计：<strong>${runCoins}</strong> MT币</p>` : ""
      }`;
    }
    const rows = list.map((item, i) => {
      const rank = i + 1;
      const mine = myName && item.name === myName ? " mine" : "";
      return `<li class="lb-item${mine}">
        <span class="lb-rank">${medal(rank)}</span>
        <span class="lb-name">${escapeHtml(item.name)}</span>
        <span class="lb-score">${item.score} MT币</span>
      </li>`;
    }).join("");
    const runLine = runCoins > 0
      ? `<p class="lb-run">本局累计：<strong>${runCoins}</strong> MT币${myName ? ` · ${escapeHtml(myName)}` : ""}</p>`
      : "";
    return `${runLine}<ol class="lb-list">${rows}</ol>`;
  }

  function escapeHtml(s){
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return { fetchList, submit, renderHtml };
})();
