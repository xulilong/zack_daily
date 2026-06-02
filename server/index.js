const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const storage = require("./storage");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const LEVEL_NAMES = {
  1: "上班路上",
  2: "到公司了",
  3: "会议室",
  4: "食堂",
  5: "CEO办公室"
};

function levelFromPage(page){
  const m = String(page || "").match(/mt-level(\d+)-demo\.html/i);
  return m ? Number(m[1]) : null;
}

function pctRatio(n, d){
  return d ? Number((n / d).toFixed(3)) : 0;
}

function inc(map, key){
  const k = key || "unknown";
  map[k] = (map[k] || 0) + 1;
}

function topList(map, limit = 10){
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function clientFromEvent(ev){
  return ev && ev.props && ev.props.__client ? ev.props.__client : null;
}

function deviceType(client){
  const ua = String(client?.userAgent || "").toLowerCase();
  const w = Number(client?.viewport?.w || client?.screen?.w || 0);
  if(/mobile|iphone|android|openharmony|phone/.test(ua) || (w && w < 700)) return "mobile";
  if(/ipad|tablet/.test(ua) || (w && w < 1100)) return "tablet";
  return "desktop";
}

function browserName(client){
  const ua = String(client?.userAgent || "");
  if(/QQBrowser/i.test(ua)) return "QQBrowser";
  if(/HuaweiBrowser/i.test(ua)) return "HuaweiBrowser";
  if(/Edg\//i.test(ua)) return "Edge";
  if(/Chrome\//i.test(ua)) return "Chrome";
  if(/Safari\//i.test(ua) && /Version\//i.test(ua)) return "Safari";
  if(/Firefox\//i.test(ua)) return "Firefox";
  if(/Electron\//i.test(ua)) return "Electron";
  return ua ? "Other" : "unknown";
}

function referrerHost(referrer){
  if(!referrer) return "direct";
  try{ return new URL(referrer).hostname || "direct"; }
  catch(e){ return "unknown"; }
}

function avg(list){
  return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;
}

async function submitLeaderboardEntry(name, score, visitorId){
  name = String(name || "").trim().slice(0, 12);
  score = Math.max(0, parseInt(score, 10) || 0);
  if(!name || score <= 0) return null;

  const list = await storage.readLeaderboard();
  let entry = list.find(item => item.name === name);
  const now = new Date().toISOString();

  if(entry){
    if(score > entry.score){
      entry.score = score;
      entry.updatedAt = now;
      if(visitorId) entry.visitorId = visitorId;
    }
  } else {
    entry = {
      id: crypto.randomUUID(),
      name,
      score,
      updatedAt: now,
      visitorId: visitorId || null
    };
    list.push(entry);
  }

  list.sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return storage.writeLeaderboard(list);
}

function aggregateStats(events){
  const totals = {
    events: events.length,
    sessions: new Set(),
    visitors: new Set(),
    pageViews: 0
  };

  const levels = {};
  const levelActors = {};
  for(let id = 1; id <= 5; id++){
    levels[id] = {
      levelId: id,
      name: LEVEL_NAMES[id] || `关卡${id}`,
      starts: 0,
      wins: 0,
      fails: 0,
      retries: 0,
      coinContinues: 0,
      deaths: 0,
      helpOpens: 0,
      winDurations: [],
      failDurations: []
    };
    levelActors[id] = {
      reached: new Set(),
      started: new Set(),
      won: new Set(),
      failed: new Set()
    };
  }

  const eventCounts = {};
  const pages = {};
  const deviceCounts = {};
  const browserCounts = {};
  const referrerCounts = {};
  const languageCounts = {};
  const timeZoneCounts = {};
  const recent = events.slice(-100).reverse();
  const users = {};

  for(const ev of events){
    const client = clientFromEvent(ev);
    if(ev.sessionId) totals.sessions.add(ev.sessionId);
    if(ev.visitorId) totals.visitors.add(ev.visitorId);
    if(ev.event === "page_view") totals.pageViews++;

    if(client){
      inc(deviceCounts, deviceType(client));
      inc(browserCounts, browserName(client));
      inc(languageCounts, client.language || (Array.isArray(client.languages) ? client.languages[0] : null));
      inc(timeZoneCounts, client.timeZone);
    }
    if(ev.event === "page_view") inc(referrerCounts, referrerHost(ev.props?.referrer));

    eventCounts[ev.event] = (eventCounts[ev.event] || 0) + 1;

    const page = ev.page || "unknown";
    pages[page] = (pages[page] || 0) + 1;

    const levelId = ev.levelId || ev.props?.levelId;
    const pageLevelId = levelFromPage(ev.page);
    const normalizedLevelId = levelId || pageLevelId;
    const bucket = normalizedLevelId && levels[normalizedLevelId] ? levels[normalizedLevelId] : null;
    const actorId = ev.visitorId || ev.sessionId || null;

    // 用户明细（按 visitorId 聚合）
    if(ev.visitorId){
      const u = users[ev.visitorId] || (users[ev.visitorId] = {
        visitorId: ev.visitorId,
        firstSeen: ev.ts,
        lastSeen: ev.ts,
        sessions: new Set(),
        events: 0,
        pages: {},
        lastPage: ev.page || null,
        lastLevelId: ev.levelId ?? null,
        lastEvent: ev.event || null,
        client: null
      });
      u.events++;
      if(ev.sessionId) u.sessions.add(ev.sessionId);
      if(ev.ts && String(ev.ts).localeCompare(u.firstSeen) < 0) u.firstSeen = ev.ts;
      if(ev.ts && String(ev.ts).localeCompare(u.lastSeen) > 0){
        u.lastSeen = ev.ts;
        u.lastPage = ev.page || null;
        u.lastLevelId = ev.levelId ?? null;
        u.lastEvent = ev.event || null;
        if(ev.props && ev.props.__client) u.client = ev.props.__client;
      } else {
        if(!u.client && ev.props && ev.props.__client) u.client = ev.props.__client;
      }
      const p = ev.page || "unknown";
      u.pages[p] = (u.pages[p] || 0) + 1;
    }

    if(bucket){
      if(ev.event === "level_start") bucket.starts++;
      if(ev.event === "level_win") bucket.wins++;
      if(ev.event === "level_fail") bucket.fails++;
      if(ev.event === "level_retry") bucket.retries++;
      if(ev.event === "coin_continue") bucket.coinContinues++;
      if(ev.event === "player_death") bucket.deaths++;
      if(ev.event === "help_open") bucket.helpOpens++;
      if(ev.event === "level_win" && Number.isFinite(Number(ev.props?.durationMs))) bucket.winDurations.push(Number(ev.props.durationMs));
      if(ev.event === "level_fail" && Number.isFinite(Number(ev.props?.durationMs))) bucket.failDurations.push(Number(ev.props.durationMs));

      if(actorId){
        const actorBucket = levelActors[bucket.levelId];
        actorBucket.reached.add(actorId);
        if(ev.event === "page_view") actorBucket.reached.add(actorId);
        if(ev.event === "level_start") actorBucket.started.add(actorId);
        if(ev.event === "level_win") actorBucket.won.add(actorId);
        if(ev.event === "level_fail") actorBucket.failed.add(actorId);
      }
    }
  }

  const levelList = Object.values(levels).map(item => ({
    levelId: item.levelId,
    name: item.name,
    starts: item.starts,
    wins: item.wins,
    fails: item.fails,
    retries: item.retries,
    coinContinues: item.coinContinues,
    deaths: item.deaths,
    helpOpens: item.helpOpens,
    avgWinDurationMs: avg(item.winDurations),
    avgFailDurationMs: avg(item.failDurations),
    winRate: pctRatio(item.wins, item.starts),
    failRate: pctRatio(item.fails, item.starts)
  }));

  const firstStarts = levelActors[1].started.size;
  const firstReached = levelActors[1].reached.size;
  const levelFunnel = levelList.map((lv, idx) => {
    const actors = levelActors[lv.levelId];
    const prev = idx > 0 ? levelActors[levelList[idx - 1].levelId] : null;
    const reachedUsers = actors.reached.size;
    const startedUsers = actors.started.size;
    const wonUsers = actors.won.size;
    return {
      levelId: lv.levelId,
      name: lv.name,
      reachedUsers,
      startedUsers,
      wonUsers,
      startRateFromReach: pctRatio(startedUsers, reachedUsers),
      winRateFromStart: pctRatio(wonUsers, startedUsers),
      retentionFromLevel1Start: pctRatio(startedUsers, firstStarts),
      retentionFromLevel1Reach: pctRatio(reachedUsers, firstReached),
      stepStartConversion: prev ? pctRatio(startedUsers, prev.started.size) : 1,
      stepReachConversion: prev ? pctRatio(reachedUsers, prev.reached.size) : 1
    };
  });

  const dropoffs = levelFunnel.slice(1).map((item, idx) => ({
    fromLevelId: levelFunnel[idx].levelId,
    toLevelId: item.levelId,
    fromName: levelFunnel[idx].name,
    toName: item.name,
    fromStartedUsers: levelFunnel[idx].startedUsers,
    toStartedUsers: item.startedUsers,
    lostUsers: Math.max(0, levelFunnel[idx].startedUsers - item.startedUsers),
    conversion: item.stepStartConversion
  }));
  const biggestDropoff = dropoffs.slice().sort((a, b) => b.lostUsers - a.lostUsers || a.conversion - b.conversion)[0] || null;
  const level5 = levelFunnel[levelFunnel.length - 1] || null;
  const funnelSummary = {
    baseLevel1StartedUsers: firstStarts,
    baseLevel1ReachedUsers: firstReached,
    finalLevelStartedUsers: level5 ? level5.startedUsers : 0,
    finalLevelWonUsers: level5 ? level5.wonUsers : 0,
    startToLevel5StartRate: level5 ? pctRatio(level5.startedUsers, firstStarts) : 0,
    startToLevel5WinRate: level5 ? pctRatio(level5.wonUsers, firstStarts) : 0,
    biggestDropoff
  };

  const topEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([event, count]) => ({ event, count }));

  const userList = Object.values(users).map(u => ({
    visitorId: u.visitorId,
    firstSeen: u.firstSeen,
    lastSeen: u.lastSeen,
    sessions: u.sessions.size,
    events: u.events,
    pages: u.pages,
    lastPage: u.lastPage,
    lastLevelId: u.lastLevelId,
    lastEvent: u.lastEvent,
    client: u.client
  })).sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      events: totals.events,
      sessions: totals.sessions.size,
      visitors: totals.visitors.size,
      pageViews: totals.pageViews
    },
    levels: levelList,
    levelFunnel,
    funnelSummary,
    dimensions: {
      devices: topList(deviceCounts),
      browsers: topList(browserCounts),
      referrers: topList(referrerCounts),
      languages: topList(languageCounts),
      timeZones: topList(timeZoneCounts),
      pages: topList(pages, 12)
    },
    topEvents,
    pages,
    recent,
    users: userList
  };
}

const app = express();

// GitHub Pages 游戏页：https://xulilong.github.io/zack_daily/
const DEFAULT_ALLOWED_ORIGINS = ["https://xulilong.github.io"];

function resolveCorsOrigin(req){
  const origin = req.headers.origin;
  const env = process.env.CORS_ORIGIN;
  if(env === "*") return "*";
  if(env){
    const list = env.split(",").map(s => s.trim()).filter(Boolean);
    if(origin && list.includes(origin)) return origin;
    return list[0] || "*";
  }
  if(!origin) return "*";
  if(DEFAULT_ALLOWED_ORIGINS.includes(origin)) return origin;
  return "*";
}

function applyApiCors(req, res){
  const allowOrigin = resolveCorsOrigin(req);
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(allowOrigin !== "*") res.setHeader("Vary", "Origin");
}

app.use((req, res, next) => {
  if(req.path.startsWith("/api/analytics") || req.path.startsWith("/api/leaderboard")){
    applyApiCors(req, res);
    if(req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "32kb" }));

app.post("/api/analytics/track", async (req, res) => {
  try{
    const body = req.body || {};
    const eventName = String(body.event || "").trim();
    if(!eventName) return res.status(400).json({ ok: false, error: "event required" });

    const event = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      event: eventName,
      sessionId: body.sessionId || null,
      visitorId: body.visitorId || null,
      page: body.page || null,
      levelId: body.levelId ?? body.props?.levelId ?? null,
      props: body.props && typeof body.props === "object" ? body.props : {}
    };

    await storage.appendEvent(event);
    res.json({ ok: true, id: event.id });
  }catch(err){
    console.error("[analytics] track failed:", err);
    res.status(500).json({ ok: false, error: "write failed" });
  }
});

app.get("/api/analytics/stats", async (_req, res) => {
  try{
    const events = await storage.readEvents();
    res.json({ ok: true, data: aggregateStats(events) });
  }catch(err){
    console.error("[analytics] stats failed:", err);
    res.status(500).json({ ok: false, error: "read failed" });
  }
});

app.get("/api/analytics/health", (_req, res) => {
  const paths = storage.getPaths();
  res.json({
    ok: true,
    storage: storage.getBackend(),
    persistent: storage.getBackend() === "redis",
    eventsFile: path.basename(paths.eventsFile)
  });
});

app.get("/api/leaderboard", async (req, res) => {
  try{
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const list = (await storage.readLeaderboard()).slice(0, limit);
    res.json({ ok: true, data: list });
  }catch(err){
    console.error("[leaderboard] read failed:", err);
    res.status(500).json({ ok: false, error: "read failed" });
  }
});

app.post("/api/leaderboard/submit", async (req, res) => {
  try{
    const body = req.body || {};
    const list = await submitLeaderboardEntry(body.name, body.score, body.visitorId);
    if(!list) return res.status(400).json({ ok: false, error: "name and score required" });
    res.json({ ok: true, data: list.slice(0, 20) });
  }catch(err){
    console.error("[leaderboard] submit failed:", err);
    res.status(500).json({ ok: false, error: "write failed" });
  }
});

app.use("/assets", express.static(path.join(ROOT, "assets"), {
  maxAge: process.env.NODE_ENV === "production" ? "30d" : 0,
  etag: true,
  lastModified: true
}));

app.use(express.static(ROOT, {
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  etag: true
}));

app.get("*", (req, res, next) => {
  if(req.path.startsWith("/api/")) return next();
  const filePath = path.join(ROOT, req.path.replace(/^\//, ""));
  if(fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return next();
  res.status(404).send("Not found");
});

app.listen(PORT, HOST, () => {
  const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const paths = storage.getPaths();
  console.log(`MT大冒险 server listening on ${HOST}:${PORT}`);
  console.log(`Storage: ${storage.getBackend()}${storage.getBackend() === "redis" ? " (persistent)" : " (local files, ephemeral on Render free)"}`);
  console.log(`Game:  ${base}/`);
  console.log(`Stats: ${base}/src/stats.html`);
  if(storage.getBackend() === "file"){
    console.log(`Data dir: ${paths.dataDir}`);
  }
});
