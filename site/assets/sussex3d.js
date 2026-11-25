// Aisle & Acre: Sussex in 3D. Loaded only on desktop, only when the map scrolls into view.
import * as THREE from './three.module.min.js';

export async function mount(box, terrainUrl) {
  const T = await (await fetch(terrainUrl)).json();
  const W = T.w, H = T.h, GW = T.gw, GH = T.gh;
  const raw = Uint8Array.from(atob(T.heights), (c) => c.charCodeAt(0));
  const EXAG = 46;
  const hAt = (x, z) => { // x,z in map units (0..W, 0..H)
    const i = Math.max(0, Math.min(GW - 1, Math.round(x / W * (GW - 1)))), j = Math.max(0, Math.min(GH - 1, Math.round(z / H * (GH - 1))));
    return raw[j * GW + i] / 200 * EXAG;
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement; canvas.setAttribute('aria-hidden', 'true');
  box.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xeef0ea, 650, 1600);

  // terrain
  const geo = new THREE.PlaneGeometry(W, H, GW - 1, GH - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const sea = new THREE.Color(0xbcd3d8), low = new THREE.Color(0x93a97b), mid = new THREE.Color(0x6f8c5c), high = new THREE.Color(0x9db27c), chalk = new THREE.Color(0xcdd3a8), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const i = k % GW, j = Math.floor(k / GW), v = raw[j * GW + i];
    pos.setY(k, v ? v / 200 * EXAG : -2);
    const t = v / 200;
    if (!v) c.copy(sea);
    else if (t < 0.25) c.copy(low).lerp(mid, t / 0.25);
    else if (t < 0.6) c.copy(mid).lerp(high, (t - 0.25) / 0.35);
    else c.copy(high).lerp(chalk, Math.min(1, (t - 0.6) / 0.4));
    cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W * 4, H * 6), new THREE.MeshStandardMaterial({ color: 0xb7cfd6, roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.95 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.4; scene.add(water);

  scene.add(new THREE.HemisphereLight(0xfff3df, 0x4f5f45, 1.1));
  const sun = new THREE.DirectionalLight(0xffdcb4, 2.0); sun.position.set(-420, 260, 380); scene.add(sun);

  // venue pins
  const pins = [], group = new THREE.Group(); scene.add(group);
  const stemGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6), headGeo = new THREE.SphereGeometry(6, 20, 14), ringGeo = new THREE.RingGeometry(4, 7, 28);
  for (const v of T.venues) {
    const g = new THREE.Group(), y = Math.max(0, hAt(v.x, v.z)), col = new THREE.Color(v.color);
    const stem = new THREE.Mesh(stemGeo, new THREE.MeshBasicMaterial({ color: 0x2c332e, transparent: true, opacity: 0.55 })); stem.scale.y = 30; stem.position.y = y + 15;
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, roughness: 0.4 })); head.position.y = y + 33;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = y + 0.6;
    g.add(stem, head, ring); g.position.set(v.x - W / 2, 0, v.z - H / 2);
    head.userData = v; g.userData = v; group.add(g); pins.push(head);
  }

  // town labels as HTML, positioned each frame
  const labels = T.towns.filter((t) => ['Chichester', 'Worthing', 'Brighton', 'Lewes', 'Eastbourne', 'Hastings', 'Horsham', 'Crawley', 'Midhurst', 'Uckfield', 'Rye'].includes(t.name)).map((t) => {
    const el = document.createElement('span'); el.className = 'm3-town'; el.textContent = t.name; box.appendChild(el);
    return { el, p: new THREE.Vector3(t.x - W / 2, hAt(t.x, t.z) + 6, t.z - H / 2) };
  });
  const tip = document.createElement('div'); tip.className = 'map-tip m3-tip'; tip.hidden = true; box.appendChild(tip);

  const camera = new THREE.PerspectiveCamera(32, 2, 1, 4000);
  const target = new THREE.Vector3(0, 0, -20);
  let az = 0, pol = 0.95, dist = 720, dragging = false, lastX = 0, lastY = 0, idle = 0;
  const place = () => {
    camera.position.set(target.x + dist * Math.sin(pol) * Math.sin(az), target.y + dist * Math.cos(pol), target.z + dist * Math.sin(pol) * Math.cos(az));
    camera.lookAt(target);
  };
  const size = () => {
    const w = box.clientWidth, h = box.clientHeight || Math.round(w / 2.2);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(size).observe(box); size();

  // interaction: drag to turn, hover for the name, click to open the venue
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let hover = null, downAt = null;
  const pick = (e) => {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(pins.filter((p) => p.parent.visible), false)[0];
    return hit ? hit.object : null;
  };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) { const h = pick(e); if (h) location.href = box.dataset.base + 'venues/' + h.userData.slug + '.html'; }
    downAt = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) { az -= (e.clientX - lastX) * 0.005; pol = Math.min(1.25, Math.max(0.55, pol - (e.clientY - lastY) * 0.003)); lastX = e.clientX; lastY = e.clientY; idle = 0; return; }
    const h = pick(e); canvas.style.cursor = h ? 'pointer' : 'grab';
    if (h !== hover) { if (hover) hover.scale.setScalar(1); hover = h; if (h) h.scale.setScalar(1.35); }
    if (h) {
      const r = box.getBoundingClientRect(), v = h.userData;
      tip.innerHTML = ''; const b = document.createElement('b'); b.textContent = v.name; const s = document.createElement('span'); s.textContent = v.town + ' · ' + v.label; tip.append(b, s);
      tip.style.left = Math.min(Math.max(e.clientX - r.left, 130), r.width - 130) + 'px'; tip.style.top = (e.clientY - r.top - 14) + 'px'; tip.hidden = false;
    } else tip.hidden = true;
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; if (hover) { hover.scale.setScalar(1); hover = null; } });

  // style filter from the existing chips
  window.LL3D = { filter(type) { group.children.forEach((g) => { g.visible = !type || g.userData.type === type; }); } };

  // render only while visible
  let running = false, t0 = performance.now();
  const v3 = new THREE.Vector3();
  const frame = (t) => {
    if (!running) return;
    const dt = Math.min(0.05, (t - t0) / 1000); t0 = t; idle += dt;
    if (!reduce && !dragging && idle > 2) az += dt * 0.035;
    place(); renderer.render(scene, camera);
    const r = box.clientWidth, h = box.clientHeight;
    for (const l of labels) { v3.copy(l.p).project(camera); l.el.style.transform = `translate(${((v3.x + 1) / 2 * r).toFixed(1)}px, ${((1 - v3.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`; l.el.style.opacity = v3.z < 1 ? '1' : '0'; }
    requestAnimationFrame(frame);
  };
  new IntersectionObserver((es) => {
    const vis = es[0].isIntersecting;
    if (vis && !running) { running = true; t0 = performance.now(); requestAnimationFrame(frame); }
    if (!vis) running = false;
  }).observe(box);
  return true;
}
