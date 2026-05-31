/* MT大冒险 · 游戏统计打点（写入本地后端 analytics.jsonl） */
window.MTAnalytics = (function(){
  const VISITOR_KEY = "mt_analytics_visitor";
  const SESSION_KEY = "mt_analytics_session";
  let page = "";
  let levelId = null;
  let enabled = true;

  function apiBase(){
    if(window.MT_ANALYTICS_API) return String(window.MT_ANALYTICS_API).replace(/\/$/, "");
    if(location.protocol === "http:" || location.protocol === "https:"){
      return location.origin + "/api/analytics";
    }
    return "http://localhost:3000/api/analytics";
  }

  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function getVisitorId(){
    try{
      let id = localStorage.getItem(VISITOR_KEY);
      if(!id){
        id = uid();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    }catch(e){
      return uid();
    }
  }

  function getSessionId(){
    try{
      let id = sessionStorage.getItem(SESSION_KEY);
      if(!id){
        id = uid();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    }catch(e){
      return uid();
    }
  }

  function track(event, props){
    if(!enabled || !event) return;
    const payload = {
      event,
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      page: page || location.pathname.split("/").pop() || "unknown",
      levelId: levelId ?? props?.levelId ?? null,
      props: props || {}
    };

    const url = apiBase() + "/track";
    const body = JSON.stringify(payload);

    try{
      if(navigator.sendBeacon){
        const blob = new Blob([body], { type: "application/json" });
        if(navigator.sendBeacon(url, blob)) return;
      }
    }catch(e){}

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  }

  function init(cfg){
    cfg = cfg || {};
    page = cfg.page || location.pathname.split("/").pop() || "unknown";
    levelId = cfg.levelId ?? null;
    if(cfg.enabled === false) enabled = false;
    track("page_view", {
      referrer: document.referrer || null,
      title: document.title || null
    });
  }

  return { init, track, getSessionId, getVisitorId };
})();
