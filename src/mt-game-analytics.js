/* MT大冒险 · 游戏统计打点（写入本地后端 analytics.jsonl） */
window.MTAnalytics = (function(){
  const VISITOR_KEY = "mt_analytics_visitor";
  const SESSION_KEY = "mt_analytics_session";
  let page = "";
  let levelId = null;
  let enabled = true;

  function safeNumber(n){
    const x = Number(n);
    return Number.isFinite(x) ? x : null;
  }

  function getClientSnapshot(){
    // “用户能获取到的信息”里，挑常用且稳定的字段；避免读取隐私敏感/权限相关信息。
    try{
      const nav = navigator || {};
      const scr = screen || {};
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
      const tz = (() => { try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }catch(e){ return null; } })();
      return {
        href: (location && location.href) ? String(location.href) : null,
        origin: (location && location.origin) ? String(location.origin) : null,
        userAgent: nav.userAgent ? String(nav.userAgent) : null,
        language: nav.language ? String(nav.language) : null,
        languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 8).map(String) : null,
        platform: nav.platform ? String(nav.platform) : null,
        cookieEnabled: typeof nav.cookieEnabled === "boolean" ? nav.cookieEnabled : null,
        online: typeof nav.onLine === "boolean" ? nav.onLine : null,
        timeZone: tz,
        timeZoneOffsetMin: safeNumber(new Date().getTimezoneOffset()),
        screen: {
          w: safeNumber(scr.width),
          h: safeNumber(scr.height),
          availW: safeNumber(scr.availWidth),
          availH: safeNumber(scr.availHeight),
          colorDepth: safeNumber(scr.colorDepth),
          pixelRatio: safeNumber(window.devicePixelRatio)
        },
        viewport: {
          w: safeNumber(window.innerWidth),
          h: safeNumber(window.innerHeight)
        },
        hardwareConcurrency: safeNumber(nav.hardwareConcurrency),
        deviceMemory: safeNumber(nav.deviceMemory),
        connection: conn ? {
          effectiveType: conn.effectiveType ? String(conn.effectiveType) : null,
          downlink: safeNumber(conn.downlink),
          rtt: safeNumber(conn.rtt),
          saveData: typeof conn.saveData === "boolean" ? conn.saveData : null
        } : null
      };
    }catch(e){
      return null;
    }
  }

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
    const client = getClientSnapshot();
    const mergedProps = {
      ...(props || {}),
      ...(client ? { __client: client } : {})
    };
    const payload = {
      event,
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      page: page || location.pathname.split("/").pop() || "unknown",
      levelId: levelId ?? props?.levelId ?? null,
      props: mergedProps
    };

    const url = apiBase() + "/track";
    const body = JSON.stringify(payload);
    const maxAttempts = 4;

    function beaconFallback(){
      try{
        if(navigator.sendBeacon){
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon(url, blob);
        }
      }catch(e){}
    }

    function post(attempt){
      const delay = attempt === 0 ? 0 : Math.min(2000 * attempt, 8000);
      setTimeout(() => {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          mode: "cors"
        }).then(res => {
          if(!res.ok && attempt + 1 < maxAttempts) post(attempt + 1);
        }).catch(() => {
          if(attempt + 1 < maxAttempts) post(attempt + 1);
          else beaconFallback();
        });
      }, delay);
    }

    post(0);
  }

  let inited = false;
  function init(cfg){
    cfg = cfg || {};
    page = cfg.page || location.pathname.split("/").pop() || "unknown";
    levelId = cfg.levelId ?? null;
    if(cfg.enabled === false) enabled = false;
    if(inited) return;
    inited = true;
    track("page_view", {
      referrer: document.referrer || null,
      title: document.title || null
    });
  }

  return { init, track, getSessionId, getVisitorId };
})();
