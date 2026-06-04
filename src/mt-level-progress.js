/* MT大冒险 · 浏览器本地关卡进度（localStorage） */
window.MTProgress = (function(){
  const STORAGE_KEY = "mt_zack_level_progress";
  const RUN_COINS_KEY = "mt_zack_run_coins";
  const CEO_NAME_KEY = "mt_zack_ceo_name";
  const TOTAL = 5;
  const LEVELS = [
    { id: 1, file: "mt-level1-demo.html", name: "上班路上", desc: "从家门口出发，穿过拥堵路段。", image: "level1-opening-banner.webp" },
    { id: 2, file: "mt-level2-demo.html", name: "到公司了", desc: "刷工牌、过闸机，正式进入打工副本。", image: "level2-opening-banner.webp" },
    { id: 3, file: "mt-level3-demo.html", name: "会议室", desc: "在会议与道具之间找到通路。", image: "level3-opening-banner.webp" },
    { id: 4, file: "mt-level4-demo.html", name: "食堂", desc: "端稳餐盘，穿过午饭高峰。", image: "level4-opening-banner.webp" },
    { id: 5, file: "mt-level5-demo.html", name: "CEO办公室", desc: "完成最后的就职仪式。", image: "level5-opening-banner.webp" }
  ];

  function read(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const data = JSON.parse(raw);
        if(Array.isArray(data.unlocked) && data.unlocked.length){
          data.unlocked = [...new Set(data.unlocked)].sort((a, b) => a - b);
          if(!data.unlocked.includes(1)) data.unlocked.unshift(1);
          if(!Array.isArray(data.completed)) data.completed = [];
          return data;
        }
      }
    }catch(e){}
    return { unlocked: [1], completed: [] };
  }

  function write(data){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){}
  }

  function isUnlocked(id){
    return read().unlocked.includes(id);
  }

  function isCompleted(id){
    return read().completed.includes(id);
  }

  function completeLevel(id){
    const data = read();
    if(!data.completed.includes(id)) data.completed.push(id);
    const next = id + 1;
    if(next <= TOTAL && !data.unlocked.includes(next)){
      data.unlocked.push(next);
      data.unlocked.sort((a, b) => a - b);
    }
    write(data);
  }

  function getRunCoins(){
    try{ return Math.max(0, parseInt(localStorage.getItem(RUN_COINS_KEY) || "0", 10) || 0); }catch(e){ return 0; }
  }

  function addRunCoins(n){
    const add = Math.max(0, n | 0);
    if(!add) return getRunCoins();
    const next = getRunCoins() + add;
    try{ localStorage.setItem(RUN_COINS_KEY, String(next)); }catch(e){}
    return next;
  }

  function setRunCoins(n){
    const val = Math.max(0, n | 0);
    try{ localStorage.setItem(RUN_COINS_KEY, String(val)); }catch(e){}
    return val;
  }

  function resetRunCoins(){
    return setRunCoins(0);
  }

  function setCeoName(name){
    try{ localStorage.setItem(CEO_NAME_KEY, String(name || "").trim().slice(0, 12)); }catch(e){}
  }

  function getCeoName(){
    try{ return localStorage.getItem(CEO_NAME_KEY) || ""; }catch(e){ return ""; }
  }

  function levelUrl(id, fromRoot){
    const lv = LEVELS.find(l => l.id === id);
    if(!lv) return fromRoot ? "index.html" : "../index.html";
    return fromRoot ? "src/" + lv.file : lv.file;
  }

  function assetUrl(file, fromRoot){
    return (fromRoot ? "assets/" : "../assets/") + "images/generated/" + file;
  }

  function guardLevel(id){
    const unlock = new URLSearchParams(location.search).get("unlock");
    if(unlock === "all" || unlock === String(id)) return true;
    if(id === 1 || isUnlocked(id)) return true;
    location.href = "../index.html";
    return false;
  }

  function renderProgressHtml(opts){
    opts = opts || {};
    const fromRoot = !!opts.fromRoot;
    const currentLevelId = opts.currentLevelId || 0;
    const data = read();

    const completedCount = data.completed.filter(id => id >= 1 && id <= TOTAL).length;
    const unlockedCount = data.unlocked.filter(id => id >= 1 && id <= TOTAL).length;
    return `<div class="level-progress-summary"><strong>${completedCount}/${TOTAL}</strong> 已通关 · <strong>${unlockedCount}/${TOTAL}</strong> 已解锁</div><div class="level-progress-list">${LEVELS.map(lv => {
      const unlocked = data.unlocked.includes(lv.id);
      const completed = data.completed.includes(lv.id);
      const current = lv.id === currentLevelId;
      const url = levelUrl(lv.id, fromRoot);
      let state = completed ? "completed" : (unlocked ? "unlocked" : "locked");
      if(current) state += " current";
      const statusText = completed ? "已通关" : (unlocked ? "已解锁" : "未解锁");
      const icon = completed ? "✓" : (unlocked ? "进入" : "锁定");
      const thumb = assetUrl(lv.image, fromRoot);
      const nextTip = lv.id > 1 ? `通关关卡${lv.id - 1}后解锁` : "开始冒险";
      const tag = unlocked
        ? `<a class="level-item ${state}" href="${url}" title="进入${lv.name}">`
        : `<div class="level-item ${state}" title="${statusText}">`;
      const end = unlocked ? "</a>" : "</div>";
      return `${tag}<span class="level-thumb-wrap"><img class="level-thumb" src="${thumb}" alt="${lv.name}关卡图" loading="lazy"></span><span class="level-copy"><span class="level-title-row"><span class="level-num">${lv.id}</span><span class="level-name">${lv.name}</span></span><span class="level-desc">${unlocked ? lv.desc : nextTip}</span></span><span class="level-status" aria-label="${statusText}">${icon}</span>${end}`;
    }).join("")}</div>`;
  }

  function renderRecord(container, opts){
    if(!container) return;
    container.innerHTML = renderProgressHtml(opts);
  }

  return {
    LEVELS, TOTAL, read, write, isUnlocked, isCompleted,
    completeLevel, levelUrl, guardLevel, renderProgressHtml, renderRecord,
    getRunCoins, addRunCoins, setRunCoins, resetRunCoins, setCeoName, getCeoName
  };
})();
