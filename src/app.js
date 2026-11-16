import { FilesetResolver, FaceLandmarker, ObjectDetector } from './vendor/vision_bundle.mjs';

const $ = (id) => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const octx = overlay.getContext('2d');

// ---------------------------------------------------------------- Réglages
const DEFAULTS = {
  optPhone: true, optAway: true, optAbsent: true,
  optEdges: true, optBeep: true, optNotif: true,
  optTol: 3, optRep: 10, optSens: 35,
  baseYaw: 0, basePitch: 0, baseGx: 0, baseGy: 0,
};
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('soisFocus.settings') || '{}') }; } catch { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem('soisFocus.settings', JSON.stringify(settings)); } catch { /* ignore */ } };

for (const id of ['optPhone', 'optAway', 'optAbsent', 'optEdges', 'optBeep', 'optNotif']) {
  $(id).checked = settings[id];
  $(id).addEventListener('change', () => { settings[id] = $(id).checked; saveSettings(); });
}
const sliders = { optTol: 'tolVal', optRep: 'repVal', optSens: 'sensVal' };
for (const [id, out] of Object.entries(sliders)) {
  $(id).value = settings[id];
  $(out).textContent = settings[id];
  $(id).addEventListener('input', () => {
    settings[id] = Number($(id).value);
    $(out).textContent = settings[id];
    saveSettings();
  });
}
window.soisFocus?.getAutostart().then((v) => { $('optAutostart').checked = !!v; });
$('optAutostart').addEventListener('change', () => window.soisFocus?.setAutostart($('optAutostart').checked));

// ---------------------------------------------------------------- Alertes
const MESSAGES = {
  phone: ['Dépose ton tel !'],
  away: ['Sois focus ! Regarde ton écran.'],
  absent: ['Reviens à ton poste !'],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Bords de l'écran rouges (fenêtre transparente gérée par le processus principal)
let edgesOn = false;
function setEdges(on) {
  on = on && settings.optEdges;
  if (on === edgesOn) return;
  edgesOn = on;
  window.soisFocus?.setEdges(on);
}

let audioCtx = null;
function beep() {
  if (!settings.optBeep) return;
  try {
    audioCtx ??= new AudioContext();
    const t = audioCtx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.35, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.18);
    });
  } catch { /* audio indisponible */ }
}

let bannerTimer = 0;
function alertUser(kind) {
  const text = pick(MESSAGES[kind]);
  beep();
  if (settings.optNotif) window.soisFocus?.notify('Sois Focus', text);
  const b = $('alertBanner');
  b.textContent = text; b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.hidden = true; }, 3500);
}

// ---------------------------------------------------------------- Modèles IA
let faceLandmarker = null;
let objectDetector = null;

async function createWithFallback(factory) {
  try { return await factory('GPU'); } catch { return await factory('CPU'); }
}

async function loadModels() {
  const fileset = await FilesetResolver.forVisionTasks('./vendor/wasm');
  faceLandmarker = await createWithFallback((delegate) => FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: './vendor/models/face_landmarker.task', delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  }));
  objectDetector = await createWithFallback((delegate) => ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: './vendor/models/efficientdet_lite2.tflite', delegate },
    runningMode: 'VIDEO',
    scoreThreshold: 0.15, // bas : le filtrage « téléphone » se fait plus bas, et le debug montre tout
    maxResults: 10,
  }));
}

// ---------------------------------------------------------------- Détection
const rad2deg = (r) => (r * 180) / Math.PI;
const wrap180 = (a) => ((a + 540) % 360) - 180;

// Angles de la tête (matrice colonne-major 4x4 fournie par MediaPipe).
function headPose(m) {
  const d = m.data;
  const R = (r, c) => d[c * 4 + r];
  const sy = Math.hypot(R(0, 0), R(1, 0));
  return { yaw: rad2deg(Math.atan2(-R(2, 0), sy)), pitch: rad2deg(Math.atan2(R(2, 1), R(2, 2))) };
}

const PHONE_MIN_SCORE = 0.25;
const debug = { objects: [], face: '?', fps: 0, error: '' };
let lastPose = { yaw: 0, pitch: 0 };
let lastGaze = { gx: 0, gy: 0 };
let phoneSeenAt = -1e9;
let phoneBoxes = [];
let faceSeenAt = performance.now();
let personSeenAt = performance.now();
let frameCount = 0;

// Retourne le type de distraction courant : 'phone' | 'away' | 'absent' | null
function analyse(now) {
  let away = false;
  let cropped = false;
  const fr = faceLandmarker.detectForVideo(video, now);
  if (fr.faceLandmarks?.length) {
    faceSeenAt = now;
    // Visage coupé par le bord de l'image : les angles et le regard sont alors faux → on ne juge pas.
    const pts = fr.faceLandmarks[0];
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    const M = 0.03;
    cropped = minX < M || maxX > 1 - M || minY < M || maxY > 1 - M;
    const mat = cropped ? null : fr.facialTransformationMatrixes?.[0];
    if (mat) {
      lastPose = headPose(mat);
      const dyaw = wrap180(lastPose.yaw - settings.baseYaw);
      const dpitch = wrap180(lastPose.pitch - settings.basePitch);
      if (Math.abs(dyaw) > settings.optSens * 0.8 || Math.abs(dpitch) > settings.optSens * 0.6) away = true;
    }
    // Direction des yeux (blendshapes) : gx = horizontal, gy = vertical (négatif = vers le bas)
    const bs = cropped ? null : fr.faceBlendshapes?.[0]?.categories;
    if (bs) {
      const get = (n) => bs.find((c) => c.categoryName === n)?.score ?? 0;
      const gx = (get('eyeLookOutLeft') + get('eyeLookInRight') - get('eyeLookInLeft') - get('eyeLookOutRight')) / 2;
      const gy = (get('eyeLookUpLeft') + get('eyeLookUpRight') - get('eyeLookDownLeft') - get('eyeLookDownRight')) / 2;
      lastGaze = { gx, gy };
      const thr = 0.3 * (settings.optSens / 35); // le curseur de sensibilité règle aussi le regard
      if (Math.abs(gx - settings.baseGx) > thr || gy - settings.baseGy < -thr || gy - settings.baseGy > thr * 1.3) away = true;
    }
  }

  if (frameCount % 2 === 0) { // l'objet-détecteur est plus lourd : 1 image sur 2
    const od = objectDetector.detectForVideo(video, now);
    debug.objects = od.detections.map((d) => `${d.categories[0].categoryName} ${Math.round(d.categories[0].score * 100)}%`);
    // Une silhouette (épaules, buste) suffit à dire « il est là », même si la tête sort du cadre.
    if (od.detections.some((d) => d.categories[0].categoryName === 'person' && d.categories[0].score >= 0.35)) personSeenAt = now;
    // « cell phone » = téléphone ; on accepte aussi « remote » (télécommande), souvent confondue avec un smartphone tenu à plat
    const hits = od.detections.filter((d) => {
      const c = d.categories[0];
      return (c.categoryName === 'cell phone' && c.score >= PHONE_MIN_SCORE) || (c.categoryName === 'remote' && c.score >= 0.4);
    });
    phoneBoxes = hits.map((d) => d.boundingBox);
    if (phoneBoxes.length) phoneSeenAt = now;
  }
  debug.face = !fr.faceLandmarks?.length ? 'non' : cropped ? 'coupé (non jugé)' : 'oui';
  debug.person = now - personSeenAt < 3000 ? 'oui' : 'non';
  // Absent = ni visage depuis 4 s, ni silhouette depuis 4 s.
  const absent = now - faceSeenAt > 4000 && now - personSeenAt > 4000;
  const phone = now - phoneSeenAt < 1200;

  if (settings.optPhone && phone) return 'phone';
  if (settings.optAbsent && absent) return 'absent';
  if (settings.optAway && away && !absent) return 'away';
  return null;
}

// ---------------------------------------------------------------- Session & stats
const stats = { focusMs: 0, totalMs: 0, phone: 0, away: 0, absent: 0 };
let current = null;      // distraction candidate
let currentSince = 0;
let alerting = false;    // distraction confirmée en cours
let lastAlertAt = 0;
let lastTick = 0;

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function renderStats() {
  $('statFocus').textContent = fmt(stats.focusMs);
  $('statTotal').textContent = fmt(stats.totalMs);
  // La note sur 20 : la part du temps passée concentré
  $('statScore').textContent = `${stats.totalMs ? Math.round((stats.focusMs / stats.totalMs) * 20) : 20}/20`;
  $('statPhone').textContent = stats.phone;
  $('statAway').textContent = stats.away;
  $('statAbsent').textContent = stats.absent;
}

function setStatus(text, cls) {
  $('statusText').textContent = text;
  // L'état (idle | ok | warn | bad) pilote la marge, le cadre vidéo et le message via CSS.
  document.body.dataset.state = ['ok', 'warn', 'bad'].includes(cls) ? cls : 'idle';
}

// Remarques du correcteur : une ligne par distraction confirmée
const NOTE_LABEL = { phone: 'Téléphone en main', away: 'Regard parti ailleurs', absent: 'Parti du poste' };
function addRemark(kind) {
  const ol = $('annotations');
  ol.querySelector('.vide')?.remove();
  const li = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  li.append(time, document.createTextNode(NOTE_LABEL[kind]));
  ol.prepend(li);
  while (ol.children.length > 20) ol.lastChild.remove();
}
function resetRemarks() {
  $('annotations').innerHTML = '<li class="vide">Rien à signaler pour l\'instant.</li>';
}

const LABEL = { phone: 'Téléphone détecté', away: 'Regard ailleurs', absent: 'Absent du poste' };

function step(now) {
  const dt = lastTick ? Math.min(now - lastTick, 500) : 0;
  lastTick = now;
  frameCount++;

  const state = analyse(now);
  stats.totalMs += dt;

  if (state !== current) {
    current = state;
    currentSince = now;
    alerting = false;
  }

  if (!state) {
    stats.focusMs += dt;
    setStatus('Focus', 'ok');
  } else if (now - currentSince >= settings.optTol * 1000) {
    if (!alerting) {
      alerting = true;
      stats[state]++;
      addRemark(state);
      lastAlertAt = 0;
    }
    if (now - lastAlertAt >= settings.optRep * 1000) {
      lastAlertAt = now;
      alertUser(state);
    }
    setStatus(LABEL[state], 'bad');
  } else {
    stats.focusMs += dt; // période de tolérance : pas encore une distraction
    setStatus(`${LABEL[state]}… (tolérance)`, 'warn');
  }

  setEdges(alerting);
  drawOverlay();
  renderStats();
  renderDebug(dt);
}

let fpsEma = 0;
function renderDebug(dt) {
  if (dt > 0) fpsEma = fpsEma ? fpsEma * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
  const dyaw = Math.round(wrap180(lastPose.yaw - settings.baseYaw));
  const dpitch = Math.round(wrap180(lastPose.pitch - settings.basePitch));
  const gx = (lastGaze.gx - settings.baseGx).toFixed(2);
  const gy = (lastGaze.gy - settings.baseGy).toFixed(2);
  $('debug').textContent =
    `analyses/s : ${fpsEma.toFixed(1)} · visage : ${debug.face} · silhouette : ${debug.person ?? '?'} · tête yaw ${dyaw}° pitch ${dpitch}° · yeux x ${gx} y ${gy}\n` +
    `objets vus : ${debug.objects.length ? debug.objects.join(', ') : '(aucun)'}` +
    (debug.error ? `\nERREUR : ${debug.error}` : '');
}

function drawOverlay() {
  if (overlay.width !== video.videoWidth) { overlay.width = video.videoWidth; overlay.height = video.videoHeight; }
  octx.clearRect(0, 0, overlay.width, overlay.height);
  octx.lineWidth = 4;
  octx.strokeStyle = '#f87171';
  octx.fillStyle = '#f87171';
  octx.font = '22px sans-serif';
  for (const b of phoneBoxes) {
    if (performance.now() - phoneSeenAt > 400) break;
    octx.strokeRect(b.originX, b.originY, b.width, b.height);
    // le canvas est miroité en CSS : on retourne le texte pour qu'il reste lisible
    octx.save();
    octx.translate(b.originX + b.width, b.originY - 8);
    octx.scale(-1, 1);
    octx.fillText('téléphone', 0, 0);
    octx.restore();
  }
}

// ---------------------------------------------------------------- Boucle & caméra
let running = false;
let paused = false;
let rafId = 0;
let stream = null;
let lastRun = 0;
const FRAME_INTERVAL = 1000 / 8; // ~8 analyses par seconde, suffisant et léger pour le CPU

function loop() {
  if (!running) return;
  rafId = requestAnimationFrame(loop);
  const now = performance.now();
  if (paused || now - lastRun < FRAME_INTERVAL || video.readyState < 2) return;
  lastRun = now;
  try { step(now); debug.error = ''; } catch (e) { console.error(e); debug.error = String(e?.message ?? e); renderDebug(0); }
}

async function start() {
  $('btnStart').disabled = true;
  setStatus('Chargement des modèles…', 'warn');
  try {
    if (!faceLandmarker) await loadModels();
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    console.error(e);
    setStatus(e?.name === 'NotAllowedError' ? 'Accès caméra refusé' : `Erreur : ${e?.message ?? e}`, 'bad');
    $('btnStart').disabled = false;
    return;
  }
  $('placeholder').hidden = true;
  Object.assign(stats, { focusMs: 0, totalMs: 0, phone: 0, away: 0, absent: 0 });
  resetRemarks();
  current = null; alerting = false; lastTick = 0; faceSeenAt = performance.now(); personSeenAt = performance.now(); phoneSeenAt = -1e9;
  running = true; paused = false;
  $('btnStart').textContent = 'Arrêter';
  $('btnStart').disabled = false;
  $('btnPause').disabled = false;
  $('btnCalibrate').disabled = false;
  speechSynthesis?.getVoices(); // précharge les voix
  rafId = requestAnimationFrame(loop);
}

function stop() {
  running = false;
  setEdges(false);
  cancelAnimationFrame(rafId);
  stream?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  octx.clearRect(0, 0, overlay.width, overlay.height);
  $('placeholder').hidden = false;
  $('btnStart').textContent = 'Démarrer la surveillance';
  $('btnPause').disabled = true;
  $('btnCalibrate').disabled = true;
  $('btnPause').textContent = 'Pause';
  $('alertBanner').hidden = true;
  setStatus('Arrêté', '');
}

$('btnStart').addEventListener('click', () => (running ? stop() : start()));
$('btnPause').addEventListener('click', () => {
  paused = !paused;
  lastTick = 0; current = null; alerting = false;
  $('btnPause').textContent = paused ? 'Reprendre' : 'Pause';
  if (paused) { setEdges(false); setStatus('En pause', ''); }
});
$('btnCalibrate').addEventListener('click', () => {
  settings.baseYaw = lastPose.yaw;
  settings.basePitch = lastPose.pitch;
  settings.baseGx = lastGaze.gx;
  settings.baseGy = lastGaze.gy;
  saveSettings();
  setStatus('Position calibrée', 'ok');
});
$('btnTest').addEventListener('click', () => {
  alertUser('phone');
  setEdges(true);
  setTimeout(() => setEdges(alerting), 2500);
});

setStatus('Prêt', '');
