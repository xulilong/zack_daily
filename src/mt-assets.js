/* MT大冒险 · 图片资源加载（优先 WebP，PNG 回退） */
(function(){
  const IMG = "../assets/images/";
  const bgImages = {};
  const sprites = { idle: null, jump: null, run: null };
  const enemySprites = { walk: null };

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

  function loadBg(id, alt){
    const tryLoad = (name, onFail) => {
      loadImage(name, img => { bgImages[id] = img; }, onFail || (() => {
        console.warn("[bg] 加载失败:", IMG + name);
      }));
    };
    tryLoad(id, alt ? () => tryLoad(alt) : undefined);
  }

  window.IMG = IMG;
  window.bgImages = bgImages;
  window.sprites = sprites;
  window.enemySprites = enemySprites;
  window.loadBg = loadBg;
  window.loadSprite = function(src, key, bucket){
    const name = String(src).replace(/^.*\//, "").replace(/\.(png|webp)$/i, "");
    loadSprite(name, key, bucket);
  };
  window.MTAssets = { IMG, bgImages, sprites, enemySprites, loadBg, loadSprite, makeSprite };
})();
