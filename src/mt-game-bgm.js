/* MT大冒险 · 循环合成背景音乐（来自 platform.html） */
window.MTBGM = (function(){
  let actx = null;
  let bgmOn = true;
  let soundOn = true;
  let bgmTimer = null;
  let bgmStep = 0;

  const MEL = [523,659,784,659, 698,880,784,659, 587,698,880,698, 784,659,523,0];
  const BASS = [131,0,165,0, 175,0,165,0, 196,0,165,0, 131,0,196,0];

  function bgmNote(f, dur, type, vol){
    if(!actx || !f) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function tick(){
    if(!bgmOn || !soundOn || !actx) return;
    bgmNote(MEL[bgmStep], 0.17, "triangle", 0.045);
    if(bgmStep % 2 === 0) bgmNote(BASS[bgmStep], 0.24, "square", 0.032);
    bgmStep = (bgmStep + 1) % MEL.length;
  }

  function start(){
    if(bgmTimer || !bgmOn || !soundOn || !actx) return;
    bgmStep = 0;
    bgmTimer = setInterval(tick, 205);
  }

  function stop(){
    if(bgmTimer){
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
  }

  function attach(ctx){
    actx = ctx;
    if(actx && actx.state === "suspended") actx.resume();
    if(bgmOn && soundOn) start();
  }

  return {
    attach,
    setSoundOn(on){
      soundOn = on;
      if(!on) stop();
      else if(bgmOn) start();
    },
    toggleBgm(){
      bgmOn = !bgmOn;
      if(bgmOn && soundOn) start();
      else stop();
      return bgmOn;
    },
    isBgmOn(){ return bgmOn; }
  };
})();
