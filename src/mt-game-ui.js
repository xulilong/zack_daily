/* MT大冒险 · 共用 UI 交互 */
window.MTUI = (function(){
  let opts = {};
  let paused = false;
  let started = false;
  let hintCurrent = "";
  let toastTimer = 0;
  let overlayRestore = null;
  let collectDefs = [];
  let collectState = {};
  let collectPrev = {};
  let levelStartTs = 0;

  function track(event, props){
    if(!window.MTAnalytics) return;
    MTAnalytics.track(event, {
      levelId: opts.levelId ?? null,
      ...(props || {})
    });
  }

  function sessionStats(){
    const extra = typeof opts.getSessionStats === "function" ? opts.getSessionStats() : {};
    return {
      ...extra,
      durationMs: levelStartTs ? Date.now() - levelStartTs : 0
    };
  }

  function $(id){ return document.getElementById(id); }

  function hideOverlay(){
    const ov = $("overlay");
    if(ov) ov.classList.remove("show");
  }

  function showOverlay(){
    const ov = $("overlay");
    if(ov) ov.classList.add("show");
  }

  function showModal(cfg){
    const modal = $("modal");
    if(!modal) return;
    const tag = cfg.tag ? `<div class="modal-tag">${cfg.tag}</div>` : "";
    const actions = (cfg.actions || []).map(a =>
      `<button type="button" class="btn ${a.kind || "btn-primary"}" data-act="${a.id}">${a.label}</button>`
    ).join("");
    modal.innerHTML = `${tag}<h2>${cfg.title}</h2><div class="modal-body">${cfg.body || ""}</div><div class="modal-actions">${actions}</div>`;
    (cfg.actions || []).forEach(a => {
      const btn = modal.querySelector(`[data-act="${a.id}"]`);
      if(btn) btn.addEventListener("click", a.onClick);
    });
    showOverlay();
  }

  function showStart(){
    paused = false;
    started = false;
    syncPauseBtn();
    overlayRestore = showStart;
    showModal({
      tag: opts.levelTag || "关卡",
      title: opts.startTitle || "准备好了吗？",
      body: opts.startBody || "点击开始进入冒险。",
      actions: [{
        id: "start",
        label: opts.startBtn || "开始",
        kind: "btn-primary",
        onClick(){
          ensureStart();
        }
      }]
    });
  }

  function ensureStart(){
    if(typeof opts.onBeforeStart === "function") opts.onBeforeStart();
    started = true;
    paused = false;
    hideOverlay();
    overlayRestore = null;
    syncPauseBtn();
    if(typeof opts.ensureAudio === "function") opts.ensureAudio();
    levelStartTs = Date.now();
    track("level_start");
  }

  function showPauseMenu(){
    paused = true;
    syncPauseBtn();
    track("pause_open");
    overlayRestore = showPauseMenu;
    showModal({
      tag: "暂停",
      title: "休息一下",
      body: "Zack 喘口气。",
      actions: [
        { id: "resume", label: "继续", kind: "btn-primary", onClick: resume },
        { id: "retry", label: "重来", kind: "btn-secondary", onClick: retry },
        { id: "home", label: "首页", kind: "btn-ghost", onClick: goHome }
      ]
    });
  }

  function togglePause(){
    if(!started || (opts.isTerminal && opts.isTerminal())) return;
    if(paused) resume();
    else showPauseMenu();
  }

  function resume(){
    paused = false;
    syncPauseBtn();
    hideOverlay();
    overlayRestore = null;
  }

  function retry(){
    paused = false;
    started = true;
    syncPauseBtn();
    hideOverlay();
    overlayRestore = null;
    track("level_retry");
    if(opts.levelId === 1 && window.MTProgress) MTProgress.resetRunCoins();
    if(typeof opts.onRetry === "function") opts.onRetry();
  }

  function goHome(){
    track("home_click", { from: "level" });
    location.href = opts.homeUrl || "../index.html";
  }

  function syncBgmBtn(){
    const btn = $("btn_bgm");
    if(!btn || !window.MTBGM) return;
    const on = MTBGM.isBgmOn();
    btn.textContent = on ? "🎵" : "🔕";
    btn.classList.toggle("muted", !on);
    btn.setAttribute("aria-label", on ? "关闭背景音乐" : "开启背景音乐");
  }

  function toggleMute(){
    if(typeof opts.toggleSound === "function"){
      const on = opts.toggleSound();
      const btn = $("btn_mute");
      if(btn){
        btn.textContent = on ? "🔊" : "🔇";
        btn.classList.toggle("muted", !on);
        btn.setAttribute("aria-label", on ? "关闭声音" : "开启声音");
      }
      toast(on ? "声音已开" : "声音已关", 900);
    }
  }

  function ensureRankBtn(){
    let btn = $("btn_rank");
    if(btn) return btn;
    const tools = document.querySelector(".head-tools");
    if(!tools) return null;
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tb";
    btn.id = "btn_rank";
    btn.setAttribute("aria-label", "排行榜");
    btn.textContent = "🏆";
    tools.appendChild(btn);
    btn.addEventListener("click", showLeaderboard);
    return btn;
  }

  function showLeaderboard(){
    const savedRestore = overlayRestore;
    const shouldResumeOnClose = started && !paused && !(opts.isTerminal && opts.isTerminal());
    if(shouldResumeOnClose){
      paused = true;
      syncPauseBtn();
    }

    const myName = window.MTProgress ? MTProgress.getCeoName() : "";
    const runCoins = window.MTProgress ? MTProgress.getRunCoins() : 0;
    const loading = '<p class="lb-empty">加载排行榜…</p>';

    showModal({
      tag: "",
      title: "MT排行榜",
      body: loading,
      actions: [{
        id: "close",
        label: "关闭",
        kind: "btn-primary",
        onClick(){
          hideOverlay();
          if(shouldResumeOnClose) resume();
          else if(typeof savedRestore === "function") savedRestore();
        }
      }]
    });

    if(!window.MTLeaderboard){
      const modal = $("modal");
      if(modal){
        const bodyEl = modal.querySelector(".modal-body");
        if(bodyEl) bodyEl.innerHTML = '<p class="lb-empty">排行榜模块未加载。</p>';
      }
      return;
    }

    MTLeaderboard.fetchList(20).then(list => {
      const modal = $("modal");
      if(!modal || !modal.querySelector(".modal-body")) return;
      modal.querySelector(".modal-body").innerHTML = MTLeaderboard.renderHtml(list, { myName, runCoins });
    });
  }

  function showLevelProgress(){
    const savedRestore = overlayRestore;
    const shouldResumeOnClose = started && !paused && !(opts.isTerminal && opts.isTerminal());
    if(shouldResumeOnClose){
      paused = true;
      syncPauseBtn();
    }
    const body = window.MTProgress
      ? MTProgress.renderProgressHtml({ currentLevelId: opts.levelId || 0 })
      : "<p>暂无进度数据</p>";
    showModal({
      tag: "冒险",
      title: "关卡进度",
      body,
      actions: [{
        id: "close",
        label: "关闭",
        kind: "btn-primary",
        onClick(){
          hideOverlay();
          if(shouldResumeOnClose) resume();
          else if(typeof savedRestore === "function") savedRestore();
        }
      }]
    });
  }

  function toggleBgm(){
    if(!window.MTBGM) return;
    if(typeof opts.ensureAudio === "function") opts.ensureAudio();
    const on = MTBGM.toggleBgm();
    syncBgmBtn();
    toast(on ? "背景音乐已开" : "背景音乐已关", 900);
  }

  function syncPauseBtn(){
    const btn = $("btn_pause");
    if(btn){
      btn.textContent = paused ? "▶" : "⏸";
      btn.classList.toggle("active", paused);
      btn.setAttribute("aria-label", paused ? "继续" : "暂停");
    }
  }

  function syncKeys(keys){
    document.querySelectorAll(".key").forEach(k => {
      const w = k.dataset.k;
      let on = false;
      if(w === "left") on = keys.left;
      else if(w === "right") on = keys.right;
      else if(w === "down") on = keys.down;
      else if(w === "run") on = keys.run;
      else if(w === "attack") on = keys.attack;
      k.classList.toggle("on", !!on);
    });
  }

  function updateProgress(ratio){
    const bar = $("ui_progress");
    if(bar) bar.style.width = Math.min(100, Math.max(0, ratio * 100)).toFixed(1) + "%";
  }

  function updateHint(text){
    const el = $("ui_hint_text");
    if(!el || !text || text === hintCurrent) return;
    hintCurrent = text;
    el.textContent = text;
    el.classList.add("changed");
    setTimeout(() => el.classList.remove("changed"), 650);
  }

  function updateLives(n, max, flash){
    const el = $("ui_lives");
    if(!el) return;
    const hearts = "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, max - n));
    el.innerHTML = `<span class="lbl">命</span><span class="hearts">${hearts}</span>`;
    if(flash){
      el.classList.remove("lost");
      void el.offsetWidth;
      el.classList.add("lost");
    }
  }

  function normalizeCollectState(val){
    if(val === true || val === "done") return "done";
    if(val === "active") return "active";
    return "pending";
  }

  function setupCollectibles(items){
    collectDefs = Array.isArray(items) ? items : [];
    collectState = {};
    collectPrev = {};
    const header = document.querySelector(".game-header");
    if(!header) return;
    let bar = $("ui_collect");
    if(!collectDefs.length){
      if(bar) bar.remove();
      return;
    }
    if(!bar){
      bar = document.createElement("div");
      bar.className = "collect-bar";
      bar.id = "ui_collect";
      bar.innerHTML = '<span class="collect-label" id="ui_collect_label">目标</span><div class="collect-list" id="ui_collect_list"></div>';
      header.appendChild(bar);
    }
    collectDefs.forEach(item => {
      collectState[item.id] = "pending";
      collectPrev[item.id] = "pending";
    });
    renderCollectibles();
  }

  function renderCollectibles(){
    const list = $("ui_collect_list");
    const label = $("ui_collect_label");
    if(!list || !collectDefs.length) return;
    let doneCount = 0;
    list.innerHTML = collectDefs.map(item => {
      const state = collectState[item.id] || "pending";
      if(state === "done") doneCount++;
      const icon = state === "done" ? "✓" : (state === "active" ? "●" : "○");
      const title = state === "done" ? "已获得" : (state === "active" ? "进行中" : "未获得");
      const cls = state === "pending" ? "" : ` ${state}`;
      const flash = collectPrev[item.id] !== state && state !== "pending" ? " flash" : "";
      return `<span class="collect-item${cls}${flash}" data-id="${item.id}" title="${title}"><span class="ci-icon">${icon}</span>${item.label}</span>`;
    }).join("");
    if(label) label.innerHTML = `目标<em>${doneCount}/${collectDefs.length}</em>`;
    collectDefs.forEach(item => { collectPrev[item.id] = collectState[item.id] || "pending"; });
  }

  /** states: { id: true | false | "active" | "done" | "pending" } */
  function updateCollectibles(states){
    if(!collectDefs.length || !states) return;
    let changed = false;
    collectDefs.forEach(item => {
      if(!(item.id in states)) return;
      const next = normalizeCollectState(states[item.id]);
      if(collectState[item.id] !== next){
        collectState[item.id] = next;
        changed = true;
      }
    });
    if(changed) renderCollectibles();
  }

  function resetCollectibles(){
    collectDefs.forEach(item => {
      collectState[item.id] = "pending";
      collectPrev[item.id] = "pending";
    });
    if(collectDefs.length) renderCollectibles();
  }

  function toast(msg, ms){
    const el = $("ui_toast");
    if(!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms || 1200);
  }

  function showGameOver(cfg){
    started = false;
    track("level_fail", sessionStats());
    overlayRestore = () => showGameOver(cfg);
    showModal({
      tag: cfg.tag || "失败",
      title: cfg.title || "再来一次？",
      body: cfg.body || "生命用完了。",
      actions: [
        { id: "retry", label: "重来", kind: "btn-primary", onClick: retry },
        { id: "home", label: "首页", kind: "btn-ghost", onClick: goHome }
      ].concat(cfg.extraActions || [])
    });
  }

  /** 命用完且 MT币≥cost 时，询问是否花币续命 */
  function tryCoinContinue(cfg){
    const cost = cfg.cost ?? opts.coinLifeCost ?? 100;
    const failCfg = cfg.gameOverCfg || {
      tag: "失败",
      title: "再来一次？",
      body: "生命用完了。"
    };
    const goFail = () => {
      if(typeof cfg.onGameOver === "function") cfg.onGameOver(failCfg);
      else showGameOver(failCfg);
    };

    if((cfg.score|0) < cost){
      goFail();
      return;
    }

    started = false;
    paused = true;
    syncPauseBtn();
    overlayRestore = null;
    showModal({
      tag: "续命",
      title: "MT币换命？",
      body: `你还有 <strong>${cfg.score}</strong> MT币。<br>花 <strong>${cost}</strong> 买 1 条命继续？`,
      actions: [
        {
          id: "buy",
          label: `${cost} MT币续命`,
          kind: "btn-primary",
          onClick(){
            hideOverlay();
            started = true;
            paused = false;
            syncPauseBtn();
            overlayRestore = null;
            track("coin_continue", { cost, score: cfg.score|0 });
            if(typeof cfg.onRevive === "function") cfg.onRevive(cost);
          }
        },
        {
          id: "decline",
          label: "算了",
          kind: "btn-ghost",
          onClick: goFail
        }
      ]
    });
  }

  function showWin(cfg){
    started = false;
    if(cfg.levelId && window.MTProgress){
      MTProgress.completeLevel(cfg.levelId);
      const st = sessionStats();
      MTProgress.setRunCoins(st.score | 0);
    }
    track("level_win", sessionStats());
    const actions = [{ id: "retry", label: "再玩一次", kind: "btn-secondary", onClick: retry }];
    if(cfg.nextUrl){
      actions.unshift({ id: "next", label: cfg.nextLabel || "下一关", kind: "btn-primary",
        onClick(){
          track("next_level_click", { nextUrl: cfg.nextUrl });
          location.href = cfg.nextUrl;
        } });
    }
    actions.push({ id: "home", label: "回首页", kind: "btn-ghost", onClick: goHome });
    overlayRestore = () => showWin(cfg);
    showModal({
      tag: "通关",
      title: cfg.title || "过关！",
      body: cfg.body || "",
      actions
    });
  }

  function bindKeys(keys, doJump, ensureAudio, doAttack){
    addEventListener("keydown", e => {
      if(e.code === "Escape"){
        e.preventDefault();
        if(started) togglePause();
        return;
      }
      if(!started || paused) return;
      if(typeof ensureAudio === "function") ensureAudio();
      if(e.code === "ArrowLeft" || e.code === "KeyA"){ keys.left = true; e.preventDefault(); }
      else if(e.code === "ArrowRight" || e.code === "KeyD"){ keys.right = true; e.preventDefault(); }
      else if(e.code === "ArrowDown" || e.code === "KeyS"){ keys.down = true; e.preventDefault(); }
      else if(e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyZ"){ keys.run = true; e.preventDefault(); }
      else if((e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW") && !e.repeat){
        doJump(); e.preventDefault();
      }
      else if((e.code === "KeyX" || e.code === "KeyJ" || e.code === "KeyF") && !e.repeat && typeof doAttack === "function"){
        doAttack(); e.preventDefault();
      }
      syncKeys(keys);
    });
    addEventListener("keyup", e => {
      if(e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
      if(e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
      if(e.code === "ArrowDown" || e.code === "KeyS") keys.down = false;
      if(e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyZ") keys.run = false;
      syncKeys(keys);
    });
    document.querySelectorAll(".key").forEach(k => {
      const w = k.dataset.k;
      const dn = e => {
        e.preventDefault();
        if(!started || paused) return;
        if(typeof ensureAudio === "function") ensureAudio();
        if(w === "jump") doJump();
        else if(w === "attack" && typeof doAttack === "function") doAttack();
        else if(w === "run") keys.run = true;
        else keys[w] = true;
        syncKeys(keys);
      };
      const up = e => {
        e.preventDefault();
        if(w === "run") keys.run = false;
        else if(w !== "jump" && w !== "attack") keys[w] = false;
        syncKeys(keys);
      };
      k.addEventListener("pointerdown", dn);
      k.addEventListener("pointerup", up);
      k.addEventListener("pointerleave", up);
      k.addEventListener("pointercancel", up);
    });
  }

  function init(options){
    opts = options || {};
    hintCurrent = opts.defaultHint || "";
    const homeBtn = $("btn_home");
    const pauseBtn = $("btn_pause");
    const muteBtn = $("btn_mute");
    const bgmBtn = $("btn_bgm");
    const levelsBtn = $("btn_levels");
    if(homeBtn) homeBtn.addEventListener("click", goHome);
    if(pauseBtn) pauseBtn.addEventListener("click", togglePause);
    if(muteBtn) muteBtn.addEventListener("click", toggleMute);
    if(bgmBtn) bgmBtn.addEventListener("click", toggleBgm);
    if(levelsBtn) levelsBtn.addEventListener("click", showLevelProgress);
    ensureRankBtn();
    syncBgmBtn();
    document.addEventListener("visibilitychange", () => {
      if(document.hidden && started && !(opts.isTerminal && opts.isTerminal())){
        paused = true;
        syncPauseBtn();
      }
    });
    if(typeof opts.onInit === "function") opts.onInit();
    setupCollectibles(opts.collectibles);
    if(window.MTAnalytics){
      MTAnalytics.init({ page: location.pathname.split("/").pop(), levelId: opts.levelId || null });
    }
    showStart();
  }

  return {
    init, bindKeys, isActive(){ return started && !paused; },
    isStarted(){ return started; },
    syncKeys, updateProgress, updateHint, updateLives, toast,
    updateCollectibles, resetCollectibles,
    showGameOver, showWin, hideOverlay, ensureStart, retry, goHome, tryCoinContinue,
    track
  };
})();
