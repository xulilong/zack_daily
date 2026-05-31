const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const EVENTS_FILE = path.join(DATA_DIR, "analytics.jsonl");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const ANALYTICS_KEY = "mt:analytics";
const LEADERBOARD_KEY = "mt:leaderboard";
const MAX_EVENTS = 50000;
const MAX_LEADERBOARD = 100;

let redis = null;
let backend = "file";

function initRedis(){
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url || !token) return;
  try{
    const { Redis } = require("@upstash/redis");
    redis = new Redis({ url, token });
    backend = "redis";
  }catch(err){
    console.warn("[storage] Redis init failed, using local files:", err.message);
  }
}

initRedis();

function ensureDataDir(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readEventsFile(){
  ensureDataDir();
  if(!fs.existsSync(EVENTS_FILE)) return [];
  const raw = fs.readFileSync(EVENTS_FILE, "utf8").trim();
  if(!raw) return [];
  return raw.split("\n").map(line => {
    try{ return JSON.parse(line); }catch(e){ return null; }
  }).filter(Boolean);
}

function appendEventFile(event){
  ensureDataDir();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
}

function readLeaderboardFile(){
  ensureDataDir();
  if(!fs.existsSync(LEADERBOARD_FILE)) return [];
  try{
    const list = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf8"));
    return Array.isArray(list) ? list : [];
  }catch(e){
    return [];
  }
}

function writeLeaderboardFile(list){
  ensureDataDir();
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(list, null, 2), "utf8");
}

async function readEvents(){
  if(!redis) return readEventsFile();
  const rows = await redis.lrange(ANALYTICS_KEY, 0, -1);
  return (rows || []).map(row => {
    if(row && typeof row === "object") return row;
    try{ return JSON.parse(row); }catch(e){ return null; }
  }).filter(Boolean);
}

async function appendEvent(event){
  if(!redis){
    appendEventFile(event);
    return;
  }
  await redis.rpush(ANALYTICS_KEY, event);
  const len = await redis.llen(ANALYTICS_KEY);
  if(len > MAX_EVENTS){
    await redis.ltrim(ANALYTICS_KEY, len - MAX_EVENTS, -1);
  }
}

async function readLeaderboard(){
  if(!redis) return readLeaderboardFile();
  const list = await redis.get(LEADERBOARD_KEY);
  return Array.isArray(list) ? list : [];
}

async function writeLeaderboard(list){
  const trimmed = list.slice(0, MAX_LEADERBOARD);
  if(!redis){
    writeLeaderboardFile(trimmed);
    return trimmed;
  }
  await redis.set(LEADERBOARD_KEY, trimmed);
  return trimmed;
}

function getBackend(){
  return backend;
}

function getPaths(){
  return { dataDir: DATA_DIR, eventsFile: EVENTS_FILE, leaderboardFile: LEADERBOARD_FILE };
}

module.exports = {
  getBackend,
  getPaths,
  readEvents,
  appendEvent,
  readLeaderboard,
  writeLeaderboard,
  MAX_LEADERBOARD
};
