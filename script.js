/* ============ Письмена степи — логика презентации ============ */
(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const total = slides.length;
  let current = 0;
  let busy = false;

  /* ---------- Split text into letters / words ---------- */
  document.querySelectorAll('[data-split]').forEach(el => {
    const mode = el.dataset.split;
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    if (mode === 'chars') {
      [...text].forEach((c, i) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        s.style.setProperty('--i', i);
        s.style.setProperty('--r1', Math.random().toFixed(3));
        s.style.setProperty('--r2', Math.random().toFixed(3));
        s.setAttribute('aria-hidden', 'true');
        el.appendChild(s);
      });
    } else {
      text.split(/\s+/).forEach((w, i) => {
        const s = document.createElement('span');
        s.className = 'wd';
        s.textContent = w;
        s.style.setProperty('--i', i);
        s.setAttribute('aria-hidden', 'true');
        el.appendChild(s);
      });
    }
  });

  /* Typewriter title (slide 2) */
  const typeEls = [...document.querySelectorAll('.title.type')];
  typeEls.forEach(el => {
    const t = el.dataset.type;
    el.textContent = '';
    el.setAttribute('aria-label', t);
    [...t].forEach(c => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      el.appendChild(s);
    });
  });
  let typeTimers = [];
  function runType(slide) {
    typeTimers.forEach(clearTimeout); typeTimers = [];
    slide.querySelectorAll('.title.type').forEach(el => {
      const chars = [...el.children];
      chars.forEach(c => c.classList.remove('on'));
      chars.forEach((c, i) => typeTimers.push(setTimeout(() => {
        c.classList.add('on');
        if (c.textContent.trim()) Sound.tick(i);
      }, 350 + i * 75)));
    });
  }

  /* ---------- Dots ---------- */
  const dotsBox = document.getElementById('dots');
  slides.forEach((_, i) => {
    const d = document.createElement('button');
    d.className = 'dot';
    d.setAttribute('aria-label', `Слайд ${i + 1}`);
    d.addEventListener('click', e => go(i, e));
    dotsBox.appendChild(d);
  });
  const dots = [...dotsBox.children];

  /* ================= SOUND (Web Audio, synthesized) ================= */
  const Sound = (() => {
    let ctx = null, master = null, muted = false, reverb = null;
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = .55;
      // small reverb made from decaying noise
      reverb = ctx.createConvolver();
      const len = ctx.sampleRate * 2.4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      reverb.buffer = buf;
      const wet = ctx.createGain(); wet.gain.value = .35;
      reverb.connect(wet).connect(ctx.destination);
      master.connect(ctx.destination);
      master.connect(reverb);
    }
    const ok = () => ctx && !muted;

    // Dombra-like pluck (Karplus–Strong)
    function pluck(freq, when = 0, vol = .5, decay = .996) {
      if (!ok()) return;
      const sr = ctx.sampleRate, dur = 2.2, N = Math.round(sr / freq);
      const buf = ctx.createBuffer(1, sr * dur, sr), d = buf.getChannelData(0);
      const ring = new Float32Array(N);
      for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
      let p = 0;
      for (let i = 0; i < d.length; i++) {
        const nx = (p + 1) % N;
        const v = (ring[p] + ring[nx]) * .5 * decay;
        d[i] = ring[p]; ring[p] = v; p = nx;
      }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = vol;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3800;
      src.connect(f).connect(g).connect(master);
      src.start(ctx.currentTime + when);
    }
    // Wind-like whoosh
    function whoosh(dir = 1, when = 0, vol = .28) {
      if (!ok()) return;
      const t = ctx.currentTime + when, dur = .9;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(dir > 0 ? 300 : 2400, t);
      f.frequency.exponentialRampToValueAtTime(dir > 0 ? 2600 : 280, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + .25);
      g.gain.exponentialRampToValueAtTime(.001, t + dur);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.setValueAtTime(-dir, t); pan.pan.linearRampToValueAtTime(dir, t + dur); src.connect(f).connect(g).connect(pan).connect(master); }
      else src.connect(f).connect(g).connect(master);
      src.start(t); src.stop(t + dur);
    }
    // Soft bell / chime
    function bell(freq, when = 0, vol = .18, dur = 2.5) {
      if (!ok()) return;
      const t = ctx.currentTime + when;
      [1, 2.76, 5.4].forEach((m, k) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol / (k + 1), t + .01);
        g.gain.exponentialRampToValueAtTime(.0001, t + dur / (k + 1));
        o.connect(g).connect(master); o.start(t); o.stop(t + dur);
      });
    }
    // Low drum (like a "dauylpaz")
    function drum(when = 0, vol = .5) {
      if (!ok()) return;
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .6);
      o.connect(g).connect(master); o.start(t); o.stop(t + .7);
    }

    // Kazakh-flavoured pentatonic (D minor pentatonic)
    const P = [146.8, 174.6, 196, 220, 261.6, 293.7, 349.2, 392, 440, 523.3, 587.3, 698.5];
    // Unique motif for each slide
    const motifs = [
      () => { drum(0, .4); [0, 3, 5, 8].forEach((n, i) => pluck(P[n], .05 + i * .11)); bell(P[8] * 2, .5, .1); },
      () => { [5, 4, 5, 7].forEach((n, i) => pluck(P[n], i * .09, .45)); bell(P[7] * 2, .4, .08); },
      () => { [2, 5, 6, 9].forEach((n, i) => pluck(P[n], i * .08, .4)); pluck(P[2] / 2, 0, .3); },
      () => { [8, 7, 5, 3].forEach((n, i) => pluck(P[n], i * .13, .45)); bell(P[3] * 2, .6, .09); },
      () => { [3, 5, 7, 10, 7].forEach((n, i) => pluck(P[n], i * .07, .38)); },
      () => { drum(0, .35); [0, 4, 7].forEach(n => pluck(P[n], .02, .3)); bell(P[9], .3, .1); },
      () => { // Finale: drum roll + rising arpeggio + bells
        [0, .14, .28].forEach(w => drum(w, .45));
        [0, 2, 3, 5, 7, 8, 9, 11].forEach((n, i) => pluck(P[n], .4 + i * .09, .42));
        [P[9] * 2, P[11] * 2, P[8] * 2].forEach((f, i) => bell(f, 1.2 + i * .25, .12, 3));
      }
    ];
    return {
      init,
      slide(i, dir) { if (!ok()) return; whoosh(dir); motifs[i] && motifs[i](); },
      tick(i) { if (!ok()) return; pluck(P[6 + (i % 5)] * 2, 0, .06, .99); },
      hover() { if (!ok()) return; bell(P[10] * 2, 0, .025, .6); },
      pop() { if (!ok()) return; bell(P[Math.floor(Math.random() * P.length)] * 2, 0, .05, 1.4); },
      toggle() { muted = !muted; return muted; },
      get muted() { return muted; }
    };
  })();

  /* ================= BACKGROUND CANVAS ================= */
  const cv = document.getElementById('sky');
  const cx = cv.getContext('2d');
  let W, H, DPR;
  const glyphs = 'ӘәҒғҚқҢңӨөҰұҮүҺһІіАБЖКТСЕ'.split('').concat(['ا', 'ب', 'ت', 'ج', 'د', 'ر', 'س', 'ق', 'ك', 'ن', 'و']);
  let stars = [], letters = [], sparks = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const area = W * H;
    stars = Array.from({ length: Math.round(area / 6000) }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + .2,
      tw: Math.random() * Math.PI * 2, sp: Math.random() * .02 + .005, z: Math.random()
    }));
    letters = Array.from({ length: Math.min(46, Math.round(area / 30000)) }, newLetter);
  }
  function newLetter() {
    return {
      ch: glyphs[Math.floor(Math.random() * glyphs.length)],
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .25, vy: -Math.random() * .3 - .05,
      s: Math.random() * 26 + 14, rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .004,
      a: Math.random() * .22 + .06, z: Math.random() * .8 + .2
    };
  }
  function accent() { return getComputedStyle(document.body).getPropertyValue('--a1').trim() || '#e8b85a'; }
  let acc = accent();

  function burst(x, y, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * 6 + 2;
      sparks.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 1,
        ch: Math.random() < .45 ? glyphs[Math.floor(Math.random() * glyphs.length)] : null,
        s: Math.random() * 14 + 10, hue: Math.random() * 60 + 20
      });
    }
  }

  let t = 0;
  function draw() {
    t++;
    mouse.x += (mouse.tx - mouse.x) * .05;
    mouse.y += (mouse.ty - mouse.y) * .05;
    cx.clearRect(0, 0, W, H);

    // stars
    for (const s of stars) {
      s.tw += s.sp;
      const a = .35 + Math.sin(s.tw) * .35;
      cx.globalAlpha = a;
      cx.fillStyle = '#fff6e0';
      cx.beginPath();
      cx.arc(s.x + mouse.x * s.z * 12, s.y + mouse.y * s.z * 12, s.r, 0, Math.PI * 2);
      cx.fill();
    }

    // drifting letters + constellation lines
    cx.font = '600 20px "Playfair Display", serif';
    for (const l of letters) {
      l.x += l.vx; l.y += l.vy; l.rot += l.vr;
      if (l.y < -40) { l.y = H + 40; l.x = Math.random() * W; }
      if (l.x < -40) l.x = W + 40; if (l.x > W + 40) l.x = -40;
    }
    cx.strokeStyle = acc; cx.lineWidth = .6;
    for (let i = 0; i < letters.length; i++) {
      for (let j = i + 1; j < letters.length; j++) {
        const a = letters[i], b = letters[j];
        const dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
        if (d < 22000) {
          cx.globalAlpha = (1 - d / 22000) * .18;
          cx.beginPath();
          cx.moveTo(a.x + mouse.x * a.z * 30, a.y + mouse.y * a.z * 30);
          cx.lineTo(b.x + mouse.x * b.z * 30, b.y + mouse.y * b.z * 30);
          cx.stroke();
        }
      }
    }
    cx.fillStyle = acc;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (const l of letters) {
      cx.save();
      cx.globalAlpha = l.a;
      cx.translate(l.x + mouse.x * l.z * 30, l.y + mouse.y * l.z * 30);
      cx.rotate(l.rot);
      cx.font = `600 ${l.s}px "Playfair Display", serif`;
      cx.fillText(l.ch, 0, 0);
      cx.restore();
    }

    // sparks (finale fireworks)
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += .08; p.vx *= .985; p.life -= .012;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      cx.globalAlpha = p.life;
      cx.fillStyle = `hsl(${p.hue}, 95%, ${60 + p.life * 20}%)`;
      if (p.ch) {
        cx.font = `700 ${p.s}px "Playfair Display", serif`;
        cx.fillText(p.ch, p.x, p.y);
      } else {
        cx.beginPath(); cx.arc(p.x, p.y, 2.2 * p.life + .5, 0, Math.PI * 2); cx.fill();
      }
    }
    cx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  let finaleTimer = null;
  function finale(on) {
    clearInterval(finaleTimer);
    if (!on) return;
    const fire = () => {
      burst(W * (.15 + Math.random() * .7), H * (.15 + Math.random() * .4), 46);
      Sound.pop();
    };
    setTimeout(fire, 700); setTimeout(fire, 1100); setTimeout(fire, 1500);
    finaleTimer = setInterval(fire, 1600);
  }

  /* ================= NAVIGATION ================= */
  const wipe = document.querySelector('.wipe');
  const bar = document.getElementById('bar');
  const cur = document.getElementById('cur');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  function updateUI() {
    dots.forEach((d, i) => d.classList.toggle('on', i === current));
    cur.textContent = String(current + 1).padStart(2, '0');
    bar.style.width = `${((current + 1) / total) * 100}%`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
    document.body.dataset.theme = current;
    setTimeout(() => { acc = accent(); }, 50);
  }

  function go(index, ev) {
    Sound.init();
    if (busy || index === current || index < 0 || index >= total) return;
    busy = true;
    const dir = index > current ? 1 : -1;
    const old = slides[current];
    const next = slides[index];

    // wipe from click point (or side)
    const x = ev && ev.clientX ? ev.clientX : (dir > 0 ? W * .85 : W * .15);
    const y = ev && ev.clientY ? ev.clientY : H * .5;
    wipe.style.setProperty('--wx', `${x}px`);
    wipe.style.setProperty('--wy', `${y}px`);
    wipe.classList.remove('go'); void wipe.offsetWidth; wipe.classList.add('go');

    // spray of letters along the wipe
    burst(x, y, 18);

    old.classList.remove('active');
    old.classList.add('leaving');
    if (dir < 0) old.classList.add('back');
    Sound.slide(index, dir);

    setTimeout(() => {
      old.classList.remove('leaving', 'back');
      next.classList.add('active');
      next.scrollTop = 0;
      current = index;
      updateUI();
      if (next.querySelector('.title.type')) runType(next);
      finale(index === total - 1);
      busy = false;
    }, 420);
  }
  const nextSlide = e => go(current + 1, e);
  const prevSlide = e => go(current - 1, e);

  nextBtn.addEventListener('click', nextSlide);
  prevBtn.addEventListener('click', prevSlide);
  document.getElementById('replayBtn').addEventListener('click', e => { e.stopPropagation(); go(0, e); });

  addEventListener('keydown', e => {
    Sound.init();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('a')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); nextSlide(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prevSlide(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(total - 1);
    else if (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'ь') toggleSound();
    else if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'а') toggleFs();
  });

  // click on empty area = next slide
  document.getElementById('deck').addEventListener('click', e => {
    Sound.init();
    if (e.target.closest('button, a, .card, .hex, .chip')) return;
    nextSlide(e);
  });

  // wheel
  let wheelLock = 0;
  addEventListener('wheel', e => {
    const s = slides[current];
    const scrollable = s.scrollHeight > s.clientHeight + 4;
    if (scrollable) {
      const atEnd = s.scrollTop + s.clientHeight >= s.scrollHeight - 2;
      const atTop = s.scrollTop <= 0;
      if ((e.deltaY > 0 && !atEnd) || (e.deltaY < 0 && !atTop)) return;
    }
    const now = Date.now();
    if (now - wheelLock < 1100 || Math.abs(e.deltaY) < 30) return;
    wheelLock = now;
    e.deltaY > 0 ? nextSlide() : prevSlide();
  }, { passive: true });

  // swipe
  let sx = 0, sy = 0;
  addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; Sound.init(); }, { passive: true });
  addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) dx < 0 ? nextSlide() : prevSlide();
  }, { passive: true });

  // parallax + card light
  addEventListener('pointermove', e => {
    mouse.tx = (e.clientX / W - .5);
    mouse.ty = (e.clientY / H - .5);
    const c = e.target.closest && e.target.closest('.card');
    if (c) {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
  });
  document.querySelectorAll('.card, .hex, .chip, .tl-item, .leg-card').forEach(el =>
    el.addEventListener('pointerenter', () => Sound.hover()));

  // sound & fullscreen
  const soundBtn = document.getElementById('soundBtn');
  function toggleSound() { Sound.init(); soundBtn.classList.toggle('muted', Sound.toggle()); }
  soundBtn.addEventListener('click', toggleSound);
  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  document.getElementById('fsBtn').addEventListener('click', toggleFs);

  /* ---------- Start ---------- */
  addEventListener('resize', resize);
  resize();
  updateUI();
  requestAnimationFrame(draw);
})();
