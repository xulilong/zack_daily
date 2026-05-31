const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const EVENTS_FILE = path.join(DATA_DIR, "analytics.jsonl");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const LEVEL_NAMES = {
  1: "上班路上",
  2: "到公司了",
  3: "会议室",
  4: "食堂",
  5: "CEO办公室"
};

function ensureDataDir(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readEvents(){
  ensureDataDir();
  if(!fs.existsSync(EVENTS_FILE)) return [];
  const raw = fs.readFileSync(EVENTS_FILE, "utf8").trim();
  if(!raw) return [];
  return raw.split("\n").map(line => {
    try{ return JSON.parse(line); }catch(e){ return null; }
  }).filter(Boolean);
}

function appendEvent(event){
  ensureDataDir();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
}

function aggregateStats(events){
  const totals = {
    events: events.length,
    sessions: new Set(),
    visitors: new Set(),
    pageViews: 0
  };

  const levels = {};
  for(let id = 1; id <= 5; id++){
    levels[id] = {
      levelId: id,
      name: LEVEL_NAMES[id] || `关卡${id}`,
      starts: 0,
      wins: 0,
      fails: 0,
      retries: 0,
      coinContinues: 0,
      deaths: 0
    };
  }

  const eventCounts = {};
  const pages = {};
  const recent = events.slice(-100).reverse();

  for(const ev of events){
    if(ev.sessionId) totals.sessions.add(ev.sessionId);
    if(ev.visitorId) totals.visitors.add(ev.visitorId);
    if(ev.event === "page_view") totals.pageViews++;

    eventCounts[ev.event] = (eventCounts[ev.event] || 0) + 1;

    const page = ev.page || "unknown";
    pages[page] = (pages[page] || 0) + 1;

    const levelId = ev.levelId || ev.props?.levelId;
    const bucket = levelId && levels[levelId] ? levels[levelId] : null;

    if(bucket){
      if(ev.event === "level_start") bucket.starts++;
      if(ev.event === "level_win") bucket.wins++;
      if(ev.event === "level_fail") bucket.fails++;
      if(ev.event === "level_retry") bucket.retries++;
      if(ev.event === "coin_continue") bucket.coinContinues++;
      if(ev.event === "player_death") bucket.deaths++;
    }
  }

  const levelList = Object.values(levels).map(item => ({
    ...item,
    winRate: item.starts ? Number((item.wins / item.starts).toFixed(3)) : 0,
    failRate: item.starts ? Number((item.fails / item.starts).toFixed(3)) : 0
  }));

  const topEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([event, count]) => ({ event, count }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      events: totals.events,
      sessions: totals.sessions.size,
      visitors: totals.visitors.size,
      pageViews: totals.pageViews
    },
    levels: levelList,
    topEvents,
    pages,
    recent
  };
}

const app = express();

app.use((req, res, next) => {
  if(req.path.startsWith("/api/analytics")){
    res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if(req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "32kb" }));

app.post("/api/analytics/track", (req, res) => {
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

    appendEvent(event);
    res.json({ ok: true, id: event.id });
  }catch(err){
    console.error("[analytics] track failed:", err);
    res.status(500).json({ ok: false, error: "write failed" });
  }
});

app.get("/api/analytics/stats", (_req, res) => {
  try{
    const events = readEvents();
    res.json({ ok: true, data: aggregateStats(events) });
  }catch(err){
    console.error("[analytics] stats failed:", err);
    res.status(500).json({ ok: false, error: "read failed" });
  }
});

app.get("/api/analytics/health", (_req, res) => {
  res.json({ ok: true, eventsFile: path.basename(EVENTS_FILE) });
});

app.use(express.static(ROOT));

app.get("*", (req, res, next) => {
  if(req.path.startsWith("/api/")) return next();
  const filePath = path.join(ROOT, req.path.replace(/^\//, ""));
  if(fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return next();
  res.status(404).send("Not found");
});

ensureDataDir();
app.listen(PORT, HOST, () => {
  const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`MT大冒险 server listening on ${HOST}:${PORT}`);
  console.log(`Game:  ${base}/`);
  console.log(`Stats: ${base}/src/stats.html`);
  console.log(`Analytics file: ${EVENTS_FILE}`);
});
