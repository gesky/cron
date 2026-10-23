// Cron Web Studio · Globo do hero
// Topo de um globo de pontos (como foto da Terra vista do espaço), com conexões
// em arco viajando entre cidades. Canvas 2D puro, sem bibliotecas.
// No desktop, passar o mouse inclina o globo e acelera as conexões.

(function () {
  var wrap = document.getElementById('globe');
  if (!wrap) return;
  var canvas = wrap.querySelector('canvas');
  var ctx = canvas.getContext('2d');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var LIME = '198, 255, 2';
  var MIST = '230, 230, 230';
  var DEG = Math.PI / 180;

  // Câmera apontada para o Brasil: gira até a longitude dele ficar de frente
  // e inclina até ele ficar no meio da parte visível do globo, com o norte para cima
  var CENTER = { lat: -10, lon: -40 };   // Brasil à esquerda, África aparecendo à direita   // um pouco a oeste: o Brasil fica à direita, longe do card
  var BASE_SPIN = (90 + CENTER.lon) * DEG;
  var TILT = (CENTER.lat - 42) * DEG;

  // lat/lon -> esfera (z invertido para o leste ficar à direita, como num mapa)
  function fromLatLon(lat, lon) {
    lat *= DEG; lon *= DEG;
    return { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: -Math.cos(lat) * Math.sin(lon) };
  }

  // ---------- Máscaras (terra e Brasil), em linhas codificadas por trechos ----------
  var GEO = window.CRON_GEO;
  function decode(str) {
    return str.split('|').map(function (row) {
      var out = [], v = 0;
      row.split('.').forEach(function (n) {
        n = parseInt(n, 36);
        for (var i = 0; i < n; i++) out.push(v);
        v = 1 - v;
      });
      return out;
    });
  }
  var LAND = GEO ? decode(GEO.L) : null;
  var BR = GEO ? decode(GEO.B) : null;
  function lookup(mask, lat, lon) {
    if (!mask) return 0;
    var r = Math.floor((90 - lat) / GEO.RES), c = Math.floor((lon + 180) / GEO.RES);
    r = Math.max(0, Math.min(GEO.H - 1, r)); c = ((c % GEO.W) + GEO.W) % GEO.W;
    return mask[r][c];
  }

  // ---------- Pontos da superfície (esfera de Fibonacci, só a região visível) ----------
  var DOTS = 100000;
  var pts = [];
  var golden = Math.PI * (3 - Math.sqrt(5));
  var C = fromLatLon(CENTER.lat, CENTER.lon);
  for (var i = 0; i < DOTS; i++) {
    var y = 1 - (i / (DOTS - 1)) * 2;
    var r = Math.sqrt(1 - y * y);
    var th = golden * i;
    var x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (x * C.x + y * C.y + z * C.z < 0.05) continue;      // lado de trás do globo: nunca aparece
    var lat = Math.asin(y) / DEG, lon = Math.atan2(-z, x) / DEG;
    var land = lookup(LAND, lat, lon);
    var br = land && lookup(BR, lat, lon);
    if (!land && i % 4) continue;                          // oceano bem mais ralo
    pts.push({ x: x, y: y, z: z, land: !!land, br: !!br });
  }

  // ---------- Cidades e conexões pelo Brasil ----------
  var CITIES = [
    ['São Paulo', -23.55, -46.63], ['Rio de Janeiro', -22.91, -43.17],
    ['Belo Horizonte', -19.92, -43.94], ['Brasília', -15.79, -47.88], ['Curitiba', -25.43, -49.27],
    ['Porto Alegre', -30.03, -51.23], ['Florianópolis', -27.59, -48.55], ['Salvador', -12.97, -38.5],
    ['Recife', -8.05, -34.88], ['Fortaleza', -3.73, -38.52], ['Manaus', -3.12, -60.02],
    ['Belém', -1.46, -48.5], ['Goiânia', -16.69, -49.25], ['Campo Grande', -20.47, -54.62],
    ['Cuiabá', -15.6, -56.1], ['Ribeirão Preto', -21.18, -47.81], ['Natal', -5.79, -35.21],
    ['Vitória', -20.32, -40.34], ['Londrina', -23.31, -51.16], ['Porto Velho', -8.76, -63.9],
    ['Palmas', -10.18, -48.33]
  ];
  var nodes = CITIES.map(function (c, idx) {
    return Object.assign(fromLatLon(c[1], c[2]), { name: c[0], ring: 0 });
  });
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  var arcs = [];
  function link(A, B) {
    var dot = A.x * B.x + A.y * B.y + A.z * B.z;
    var ang = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (ang < 0.03) return;
    arcs.push({ a: A, b: B, ang: ang, alt: 0.01 + ang * 0.42, t: rnd(), speed: 0.22 + rnd() * 0.16, wait: rnd() * 1.6 });
  }
  // cada cidade se liga às 2 mais próximas, e algumas rotas longas cruzam o país
  var seen = {};
  function linkOnce(i, k) {
    var key = Math.min(i, k) + '-' + Math.max(i, k);
    if (seen[key]) return; seen[key] = 1; link(nodes[i], nodes[k]);
  }
  nodes.forEach(function (A, i) {
    nodes.map(function (B, k) { return { k: k, d: A.x * B.x + A.y * B.y + A.z * B.z }; })
      .filter(function (o) { return o.k !== i; })
      .sort(function (a, b) { return b.d - a.d; })
      .slice(0, 2)
      .forEach(function (o) { linkOnce(i, o.k); });
  });
  [[0, 10], [0, 3], [1, 11], [5, 9], [2, 7], [3, 14], [13, 16], [6, 19], [12, 20]].forEach(function (p) { linkOnce(p[0], p[1]); });

  // ponto do arco (interpolação esférica + altura)
  function arcPoint(arc, t) {
    var s = Math.sin(arc.ang);
    var w1 = Math.sin((1 - t) * arc.ang) / s, w2 = Math.sin(t * arc.ang) / s;
    var h = 1 + arc.alt * Math.sin(Math.PI * t);
    return {
      x: (arc.a.x * w1 + arc.b.x * w2) * h,
      y: (arc.a.y * w1 + arc.b.y * w2) * h,
      z: (arc.a.z * w1 + arc.b.z * w2) * h
    };
  }

  // ---------- Câmera ----------
  var W = 0, H = 0, R = 0, CX = 0, CY = 0, dpr = 1;
  var clock = 0, spin = BASE_SPIN, yaw = 0, pitch = 0, tYaw = 0, tPitch = 0;
  var speed = 1, tSpeed = 1;

  function resize() {
    var rect = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = W * 0.74;
    CX = W / 2;
    CY = H * 0.16 + R;
  }

  // gira (spin + yaw no eixo Y), depois inclina (eixo X)
  var cs, sn, ct, st;
  function setAngles() {
    var ay = spin + yaw, ax = TILT + pitch;
    cs = Math.cos(ay); sn = Math.sin(ay); ct = Math.cos(ax); st = Math.sin(ax);
  }
  function project(p) {
    var x = p.x * cs - p.z * sn;
    var z1 = p.x * sn + p.z * cs;
    var y = p.y * ct - z1 * st;
    var z = p.y * st + z1 * ct;
    return { x: CX + x * R, y: CY - y * R, z: z, ux: x, uy: y };
  }
  // visível se está na frente da esfera ou fora da silhueta dela
  function visible(q) { return q.z >= 0 || (q.ux * q.ux + q.uy * q.uy) > 1; }

  // ---------- Desenho ----------
  function draw(dt) {
    speed += (tSpeed - speed) * Math.min(1, dt * 3);
    yaw += (tYaw - yaw) * Math.min(1, dt * 4);
    pitch += (tPitch - pitch) * Math.min(1, dt * 4);
    clock += dt * speed;
    spin = BASE_SPIN + Math.sin(clock * 0.12) * 0.12;
    setAngles();

    ctx.clearRect(0, 0, W, H);

    // brilho da atmosfera na borda do globo
    var g = ctx.createRadialGradient(CX, CY, R * 0.97, CX, CY, R * 1.07);
    g.addColorStop(0, 'rgba(' + LIME + ', 0)');
    g.addColorStop(0.3, 'rgba(' + LIME + ', .10)');
    g.addColorStop(1, 'rgba(' + LIME + ', 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.07, 0, Math.PI * 2); ctx.fill();

    // superfície
    var sg = ctx.createRadialGradient(CX, CY - R * 0.9, R * 0.1, CX, CY, R);
    sg.addColorStop(0, '#242424');
    sg.addColorStop(1, '#151515');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();

    // pontos (agrupados por intensidade: poucas trocas de cor = mais leve)
    var LB = 8, OB = 3, land = [], sea = [], brz = [], b;
    for (b = 0; b < LB; b++) { land.push(new Path2D()); brz.push(new Path2D()); }
    for (b = 0; b < OB; b++) sea.push(new Path2D());
    for (var i = 0; i < pts.length; i++) {
      var pt = pts[i];
      var q = project(pt);
      if (q.z < 0.02 || q.y < -4 || q.y > H + 4 || q.x < -4 || q.x > W + 4) continue;
      var d = Math.min(1, q.z * 1.6);
      var bi = Math.min(LB - 1, (d * LB) | 0);
      if (pt.land) {
        var s = 0.7 + d * 0.9;
        (pt.br ? brz : land)[bi].rect(q.x - s / 2, q.y - s / 2, s, s);
      } else {
        sea[Math.min(OB - 1, (d * OB) | 0)].rect(q.x - 0.4, q.y - 0.4, 0.8, 0.8);
      }
    }
    for (b = 0; b < OB; b++) {
      ctx.fillStyle = 'rgba(' + MIST + ',' + (0.04 + ((b + 0.5) / OB) * 0.07).toFixed(3) + ')';
      ctx.fill(sea[b]);
    }
    for (b = 0; b < LB; b++) {
      var lv = (b + 0.5) / LB;
      ctx.fillStyle = 'rgba(' + MIST + ',' + (0.2 + lv * 0.45).toFixed(3) + ')';
      ctx.fill(land[b]);
      ctx.fillStyle = 'rgba(' + LIME + ',' + (0.22 + lv * 0.5).toFixed(3) + ')';
      ctx.fill(brz[b]);
    }

    // conexões
    ctx.lineCap = 'round';
    var STEPS = 40;
    for (var a = 0; a < arcs.length; a++) {
      var arc = arcs[a];
      if (arc.wait > 0) arc.wait -= dt * speed;
      else {
        arc.t += dt * arc.speed * speed;
        if (arc.t >= 1.25) { arc.t = 0; arc.wait = 0.3 + Math.random() * 1.2; arc.b.ring = 1; }
      }

      // trilho do arco (bem fraco)
      var prev = null;
      ctx.lineWidth = 1;
      for (var s2 = 0; s2 <= STEPS; s2++) {
        var p = project(arcPoint(arc, s2 / STEPS));
        var ok = visible(p) && p.y < H + 2;
        if (prev && ok && prev.ok) {
          ctx.strokeStyle = 'rgba(' + LIME + ',' + (0.1 + 0.08 * speed / 3).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        p.ok = ok; prev = p;
      }

      // pulso viajando: cabeça forte, rastro que some
      if (arc.wait <= 0 && arc.t <= 1.25) {
        var head = Math.min(arc.t, 1), tail = Math.max(0, arc.t - 0.28);
        if (head > tail) {
          var segs = 14, last = null;
          for (var j = 0; j <= segs; j++) {
            var tt = tail + (head - tail) * (j / segs);
            var pp = project(arcPoint(arc, tt));
            pp.ok = visible(pp);
            if (last && pp.ok && last.ok) {
              var f = j / segs;
              ctx.strokeStyle = 'rgba(' + LIME + ',' + (f * 0.95).toFixed(3) + ')';
              ctx.lineWidth = 0.6 + f * 1.9;
              ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pp.x, pp.y); ctx.stroke();
            }
            last = pp;
          }
          if (arc.t < 1 && last && last.ok) {
            ctx.fillStyle = 'rgba(' + LIME + ', 1)';
            ctx.beginPath(); ctx.arc(last.x, last.y, 2.2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    // cidades
    for (var k = 0; k < nodes.length; k++) {
      var nd = nodes[k], qn = project(nd);
      if (nd.ring > 0) nd.ring -= dt * 1.1;
      if (qn.z < 0.03 || qn.y > H + 10) continue;
      var dn = Math.min(1, qn.z * 1.8);
      ctx.fillStyle = 'rgba(' + LIME + ',' + (0.45 + dn * 0.55).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(qn.x, qn.y, 1.6 + dn * 1.3, 0, Math.PI * 2); ctx.fill();
      if (nd.ring > 0) {
        var rr = (1 - nd.ring) * 16 + 3;
        ctx.strokeStyle = 'rgba(' + LIME + ',' + (nd.ring * 0.7 * dn).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(qn.x, qn.y, rr, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // ---------- Loop (pausa fora da tela) ----------
  var running = false, last = 0, onScreen = true;
  function loop(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    draw(dt);
    requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduced || !onScreen || document.hidden) return;
    running = true; last = performance.now(); requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  resize();
  setAngles();
  draw(0.016);
  window.addEventListener('resize', function () { resize(); if (!running) draw(0); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      onScreen = e[0].isIntersecting;
      onScreen ? start() : stop();
    }).observe(wrap);
  }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  start();

  // ---------- Interação (só desktop) ----------
  if (fine && !reduced) {
    wrap.addEventListener('mouseenter', function () { tSpeed = 3.2; wrap.classList.add('is-active'); });
    wrap.addEventListener('mouseleave', function () { tSpeed = 1; tYaw = 0; tPitch = 0; wrap.classList.remove('is-active'); });
    wrap.addEventListener('mousemove', function (e) {
      var r = wrap.getBoundingClientRect();
      var mx = (e.clientX - r.left) / r.width - 0.5;
      var my = (e.clientY - r.top) / r.height - 0.5;
      tYaw = mx * 0.5;
      tPitch = my * 0.16;
    });
  }
})();
