/* MT大冒险 · 图片资源加载（优先 WebP，PNG 回退） */
(function(){
  const IMG = "../assets/images/";
  const bgImages = {};
  const sprites = { idle: null, jump: null, run: null };
  const enemySprites = { walk: null };
  const dreamSprites = {};
  const propSprites = {};
  const effectSprites = {};

  function loadImage(name, onload, onerror){
    const img = new Image();
    let fallback = false;
    img.onload = () => onload(img);
    img.onerror = () => {
      if(!fallback){
        fallback = true;
        img.src = IMG + name + ".png";
      } else if(onerror) onerror();
    };
    img.src = IMG + name + ".webp";
  }

  function makeSprite(img){
    const max = 340, scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    const isBg = i => d[i] > 175 && d[i + 1] > 175 && d[i + 2] > 175;
    const vis = new Uint8Array(w * h), st = [];
    const push = (x, y) => {
      if(x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x;
      if(vis[p]) return;
      if(!isBg(p * 4)) return;
      vis[p] = 1; st.push(p);
    };
    for(let x = 0; x < w; x++){ push(x, 0); push(x, h - 1); }
    for(let y = 0; y < h; y++){ push(0, y); push(w - 1, y); }
    while(st.length){
      const p = st.pop(), x = p % w, y = (p / w) | 0;
      d[p * 4 + 3] = 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    g.putImageData(id, 0, 0);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      if(d[(y * w + x) * 4 + 3] > 10){
        if(x < minX) minX = x; if(x > maxX) maxX = x;
        if(y < minY) minY = y; if(y > maxY) maxY = y;
      }
    }
    if(maxX < minX) return c;
    const tw = maxX - minX + 1, th = maxY - minY + 1;
    const t = document.createElement("canvas"); t.width = tw; t.height = th;
    t.getContext("2d").drawImage(c, minX, minY, tw, th, 0, 0, tw, th);
    return t;
  }

  function loadSprite(name, key, bucket){
    bucket = bucket || sprites;
    loadImage(name, img => {
      try{ bucket[key] = makeSprite(img); }catch(e){ bucket[key] = img; }
    }, () => console.warn("[sprite] 加载失败:", name));
  }

  function loadBg(id, alt, key){
    const cacheKey = key || id;
    const tryLoad = (name, onFail) => {
      loadImage(name, img => { bgImages[cacheKey] = img; }, onFail || (() => {
        console.warn("[bg] 加载失败:", IMG + name);
      }));
    };
    tryLoad(id, alt ? () => tryLoad(alt) : undefined);
  }

  function drawSpriteFit(ctx, img, cx, cy, maxW, maxH, alpha){
    if(!img) return false;
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.save();
    if(alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    return true;
  }

  function drawSoftPlatform(ctx, e, opts){
    opts = opts || {};
    const r = e.ground ? 0 : 6;
    const fill = opts.fill || (e.ground ? "#eadfca" : "#f8ead0");
    const stroke = opts.stroke || "rgba(54,45,36,.72)";
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if(!e.ground){
      ctx.fillStyle = "rgba(60,42,25,.12)";
      ctx.beginPath();
      ctx.ellipse(e.x + e.w / 2, e.y + e.h + 5, e.w / 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = e.ground ? 1.8 : 1.7;
    ctx.beginPath();
    ctx.moveTo(e.x + r, e.y);
    ctx.lineTo(e.x + e.w - r, e.y);
    ctx.quadraticCurveTo(e.x + e.w, e.y, e.x + e.w, e.y + r);
    ctx.lineTo(e.x + e.w, e.y + e.h - r);
    ctx.quadraticCurveTo(e.x + e.w, e.y + e.h, e.x + e.w - r, e.y + e.h);
    ctx.lineTo(e.x + r, e.y + e.h);
    ctx.quadraticCurveTo(e.x, e.y + e.h, e.x, e.y + e.h - r);
    ctx.lineTo(e.x, e.y + r);
    ctx.quadraticCurveTo(e.x, e.y, e.x + r, e.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const top = ctx.createLinearGradient(0, e.y, 0, e.y + Math.min(22, e.h));
    top.addColorStop(0, "rgba(255,255,255,.44)");
    top.addColorStop(.55, "rgba(255,255,255,.14)");
    top.addColorStop(1, "rgba(121,83,42,.08)");
    ctx.fillStyle = top;
    ctx.fillRect(e.x + 2, e.y + 2, Math.max(0, e.w - 4), Math.max(0, e.h - 4));
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.x + 8, e.y + 3);
    ctx.lineTo(e.x + e.w - 8, e.y + 3);
    ctx.stroke();
    if(opts.danger){
      ctx.fillStyle = "rgba(199,64,64,.12)";
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
    ctx.restore();
    return true;
  }

  function drawPitMarker(ctx, e, label){
    const y = e.y + e.h;
    ctx.save();
    ctx.fillStyle = "rgba(40,34,28,.18)";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "rgba(40,34,28,.34)";
    ctx.beginPath();
    ctx.ellipse(e.x + e.w / 2, y - 2, e.w / 2, Math.max(8, e.h * .38), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(42,42,42,.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(e.x + 5, e.y + 2);
    ctx.lineTo(e.x + e.w - 5, e.y + 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(122,48,45,.92)";
    const stripeW = 14;
    for(let x = e.x + 8; x < e.x + e.w - 8; x += stripeW * 2){
      ctx.beginPath();
      ctx.moveTo(x, e.y + 3);
      ctx.lineTo(x + stripeW, e.y + 3);
      ctx.lineTo(x + stripeW - 5, e.y + 9);
      ctx.lineTo(x - 5, e.y + 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return true;
  }

  function drawSceneDepth(ctx, worldW, ground, opts){
    opts = opts || {};
    const top = opts.top || 190;
    const wall2 = opts.wall2 || "#e3d9ca";
    const floor = opts.floor || "#e6d7bf";
    ctx.save();
    const wg = ctx.createLinearGradient(0, top, 0, ground);
    wg.addColorStop(0, "rgba(255,255,255,0)");
    wg.addColorStop(.72, "rgba(255,255,255,0)");
    wg.addColorStop(1, wall2);
    ctx.fillStyle = wg;
    ctx.fillRect(0, top, worldW, ground - top);

    ctx.fillStyle = floor;
    ctx.fillRect(0, ground, worldW, 100);
    const fg = ctx.createLinearGradient(0, ground, 0, ground + 82);
    fg.addColorStop(0, "rgba(255,255,255,.36)");
    fg.addColorStop(.25, "rgba(255,255,255,.1)");
    fg.addColorStop(1, "rgba(92,62,32,.08)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, ground, worldW, 100);
    ctx.strokeStyle = "rgba(80,56,32,.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    ctx.lineTo(worldW, ground);
    ctx.stroke();

    ctx.fillStyle = "rgba(70,48,30,.06)";
    ctx.fillRect(0, ground + 4, worldW, 10);
    ctx.restore();
  }

  window.IMG = IMG;
  window.bgImages = bgImages;
  window.sprites = sprites;
  window.enemySprites = enemySprites;
  window.dreamSprites = dreamSprites;
  window.propSprites = propSprites;
  window.effectSprites = effectSprites;
  window.loadBg = loadBg;
  window.loadSprite = function(src, key, bucket){
    const name = String(src)
      .replace(IMG, "")
      .replace(/^(\.\.\/)?assets\/images\//, "")
      .replace(/\.(png|webp)$/i, "");
    loadSprite(name, key, bucket);
  };
  window.drawSpriteFit = drawSpriteFit;
  window.drawSoftPlatform = drawSoftPlatform;
  window.drawPitMarker = drawPitMarker;
  window.drawSceneDepth = drawSceneDepth;
  window.MTAssets = { IMG, bgImages, sprites, enemySprites, dreamSprites, propSprites, effectSprites, loadBg, loadSprite, makeSprite, drawSpriteFit, drawSoftPlatform, drawPitMarker, drawSceneDepth };
})();
