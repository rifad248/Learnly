/* ============================================================
   Typixel Learn — script.js
   Plain JS. Supabase for auth + data, with a built-in DEMO MODE
   (localStorage) so the site works the moment you open it.

   ── GO LIVE WITH SUPABASE (once) ────────────────────────────
   1) Create a project at supabase.com
   2) Authentication → Providers → Phone → enable (needs Twilio
      Verify credentials; Supabase's free tier includes a test
      phone provider for development).
   3) SQL Editor → run the SQL block at the BOTTOM of this file.
   4) Paste your Project URL + anon key into CONFIG below.
   5) Make yourself an admin (SQL Editor):
        update public.profiles set is_admin = true
        where phone = '+14155552671';   -- your phone, E.164
      Then give that user an email+password in
      Authentication → Users, and sign in on the "Admin" tab.
   6) Enroll a student (SQL Editor):
        insert into public.enrollments (student_id, course_id)
        select p.id, c.id from public.profiles p, public.courses c
        where p.phone = '+15551234567' and c.title = 'Your course';

   NOTE ON PIRACY: the player adds a per-student watermark and
   disables the download button, but no web player can fully
   prevent screen recording. We don't claim otherwise.
   ============================================================ */

/* ================= CONFIG ================= */
const CONFIG = {
  url:     "https://YOUR_PROJECT.supabase.co",   // ← paste yours
  anonKey: "YOUR_SUPABASE_ANON_KEY",             // ← paste yours
};
const DEMO = CONFIG.url.includes("YOUR_PROJECT");

let sb = null;
if (!DEMO) {
  if (!window.supabase) toast('Supabase library failed to load — check your connection', 'error');
  else sb = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
}

/* ================= tiny helpers ================= */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const esc = s => (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmt(s){ s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; }
function maskedPhone(p){ const d = (p||'').replace(/\D/g,'');
  return d.length >= 4 ? '•••• ' + d.slice(-4) : (p || '—'); }
function normalizePhone(v){ let p = (v||'').replace(/[\s\-().]/g,'');
  if (p && !p.startsWith('+')) p = '+' + p; return p; }
function toast(msg, type = 'info', ms = 3400){
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span class="toast-dot"></span><span>${esc(msg)}</span>`;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
}
function setBusy(btn, on, label){
  if (on){ btn.dataset.label = btn.textContent; btn.textContent = label || 'Working…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

/* ================= demo storage ================= */
const LS = {
  get(k, d){ try{ const v = localStorage.getItem('typixel_' + k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ localStorage.setItem('typixel_' + k, JSON.stringify(v)); },
  del(k){ localStorage.removeItem('typixel_' + k); },
};
function seedDemo(){
  if (LS.get('seeded')) return;
  const V = 'https://storage.googleapis.com/gtv-videos-bucket/sample/';
  const T = s => `https://picsum.photos/seed/${s}/640/360.jpg`;
  const base = [
    ['What Is Typography, Really?', 'Why type is 90% of design, what it actually does for a product, and how to set up your working environment.', V+'BigBuckBunny.mp4'],
    ['Anatomy of a Letterform', 'Baseline, x-height, counters, terminals — the vocabulary you need before you can control a typeface.', V+'ElephantsDream.mp4'],
    ['Spacing, Rhythm & Kerning', 'How letterspacing creates rhythm, why optical kerning beats metric, and drills to train your eye.', V+'ForBiggerBlazes.mp4'],
    ['Choosing & Pairing Typefaces', 'A practical framework for picking primary and secondary typefaces that don\u2019t fight each other.', V+'ForBiggerEscapes.mp4'],
    ['Type on Screens', 'Responsive sizes, line lengths and hierarchy that hold up from a 4K monitor down to a phone.', V+'ForBiggerFun.mp4'],
    ['Setting a Full Page', 'We put everything together and typeset a complete editorial page, step by step.', V+'ForBiggerJoyrides.mp4'],
    ['Bonus: Live Type Critique', 'An unedited critique session. Publish it when you\u2019re ready — students won\u2019t see drafts.', V+'ForBiggerMeltdowns.mp4'],
  ];
  const lessons = base.map(([title, description, video_url], i) => ({
    id: 'demo-l' + (i+1), course_id: 'demo-course',
    title, description, video_url,
    video_url_720: i === 0 ? 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4' : '',
    video_url_480: i === 0 ? 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4' : '',
    thumbnail_url: T('typixel' + i),
    position: i + 1,
    is_published: i < 6,               // last one ships as a draft
    created_at: new Date().toISOString(),
  }));
  LS.set('lessons', lessons);
  LS.set('course', { id:'demo-course', title:'Typography Fundamentals — From Pixel to Page',
    description:'A six-session foundation course on practical typography, from letterform anatomy to setting complete pages. Enrolled students only.' });
  LS.set('seeded', true);
}

/* ================= api layer (Supabase | demo) ================= */
function demoSendOtp(phone){
  const students = LS.get('students', {});
  if (!students[phone]) students[phone] = { id:'demo-u-' + phone, name:'Student ' + phone.slice(-4), phone };
  students[phone].otp = '123456';
  LS.set('students', students);
}
function demoVerifyOtp(phone, token){
  const s = LS.get('students', {})[phone];
  if (!s || token !== s.otp) throw new Error('Incorrect code');
  LS.set('session', { role:'student', id:s.id, name:s.name, phone });
  return { id:s.id, name:s.name, phone, is_admin:false };
}
function demoAdminLogin(email, password){
  if (email !== 'admin@typixel.com' || password !== 'admin123') throw new Error('Invalid admin credentials');
  LS.set('session', { role:'admin', id:'demo-admin', name:'Admin', phone:'', is_admin:true });
  return { id:'demo-admin', name:'Admin', phone:'', is_admin:true };
}
function demoLoadStudent(userId){
  return {
    course: LS.get('course', null),
    lessons: LS.get('lessons', []).filter(l => l.is_published).sort((a,b) => a.position - b.position),
    progress: LS.get('progress_' + userId, {}),
  };
}

const api = {
  async restoreSession(){
    if (DEMO) return LS.get('session', null);
    const { data:{ session } } = await sb.auth.getSession();
    if (!session) return null;
    return api.profile(session.user.id, session.user.phone || '');
  },
  async profile(uid, phone){
    const { data, error } = await sb.from('profiles').select('*').eq('id', uid).single();
    if (error || !data) throw new Error('Profile not found — did you run the setup SQL?');
    return { id: uid, name: data.full_name || 'Student', phone: data.phone || phone, is_admin: !!data.is_admin };
  },
  async sendOtp(phone){
    if (DEMO) return demoSendOtp(phone);
    const { error } = await sb.auth.signInWithOtp({ phone });
    if (error) throw error;
  },
  async verifyOtp(phone, token){
    if (DEMO) return demoVerifyOtp(phone, token);
    const { data, error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
    return api.profile(data.user.id, data.user.phone || phone);
  },
  async adminLogin(email, password){
    if (DEMO) return demoAdminLogin(email, password);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const p = await api.profile(data.user.id, '');
    if (!p.is_admin) throw new Error('This account is not an admin.');
    return p;
  },
  async logout(){ DEMO ? LS.del('session') : await sb.auth.signOut(); },

  async loadStudent(userId){
    if (DEMO) return demoLoadStudent(userId);
    const { data: enr, error: e1 } = await sb.from('enrollments')
      .select('course_id, courses(title, description)').eq('student_id', userId).limit(1);
    if (e1) throw e1;
    if (!enr || !enr.length || !enr[0].courses) return { course:null, lessons:[], progress:{} };
    const course = { id: enr[0].course_id, title: enr[0].courses.title, description: enr[0].courses.description || '' };
    const [{ data: lessons }, { data: prog }] = await Promise.all([
      sb.from('lessons').select('*').eq('course_id', course.id).eq('is_published', true).order('position'),
      sb.from('video_progress').select('lesson_id, position_seconds, completed, duration_seconds').eq('student_id', userId),
    ]);
    const progress = {};
    (prog || []).forEach(r => progress[r.lesson_id] = {
      position_seconds: +r.position_seconds || 0, completed: !!r.completed, duration_seconds: +r.duration_seconds || 0 });
    return { course, lessons: lessons || [], progress };
  },
  async saveProgress(userId, lessonId, seconds, completed, duration){
    if (DEMO){
      const key = 'progress_' + userId, p = LS.get(key, {}), prev = p[lessonId] || {};
      p[lessonId] = { position_seconds: seconds, completed: completed || !!prev.completed,
        duration_seconds: duration || prev.duration_seconds || 0 };
      LS.set(key, p); return;
    }
    const row = { student_id: userId, lesson_id: lessonId, position_seconds: seconds,
      completed: !!completed, updated_at: new Date().toISOString() };
    if (duration > 0) row.duration_seconds = duration;
    const { error } = await sb.from('video_progress').upsert(row, { onConflict: 'student_id,lesson_id' });
    if (error) console.warn('progress save failed', error);
  },

  /* ---- admin ---- */
  async adminLoad(){
    if (DEMO) return { course: LS.get('course', null), lessons: LS.get('lessons', []).sort((a,b) => a.position - b.position) };
    const { data: courses } = await sb.from('courses').select('*').order('created_at').limit(1);
    if (!courses || !courses.length) return { course:null, lessons:[] };
    const { data: lessons } = await sb.from('lessons').select('*').eq('course_id', courses[0].id).order('position');
    return { course: courses[0], lessons: lessons || [] };
  },
  async createCourse(title, description){
    if (DEMO){ const c = { id:'demo-course', title, description }; LS.set('course', c); return c; }
    const { data, error } = await sb.from('courses').insert({ title, description }).select().single();
    if (error) throw error; return data;
  },
  async createLesson(row){
    if (DEMO){
      const lessons = LS.get('lessons', []);
      const full = { ...row, id:'demo-l' + Date.now(), position: lessons.length + 1, created_at: new Date().toISOString() };
      lessons.push(full); LS.set('lessons', lessons); return full;
    }
    const { data: max } = await sb.from('lessons').select('position').order('position', { ascending:false }).limit(1);
    const full = { ...row, position: (max && max.length ? +max[0].position : 0) + 1 };
    const { data, error } = await sb.from('lessons').insert(full).select().single();
    if (error) throw error; return data;
  },
  async updateLesson(id, patch){
    if (DEMO){ const l = LS.get('lessons', []); const i = l.findIndex(x => x.id === id);
      if (i > -1){ l[i] = { ...l[i], ...patch }; LS.set('lessons', l); } return; }
    const { error } = await sb.from('lessons').update(patch).eq('id', id);
    if (error) throw error;
  },
  async deleteLesson(id){
    if (DEMO){ LS.set('lessons', LS.get('lessons', []).filter(l => l.id !== id)); return; }
    const { error } = await sb.from('lessons').delete().eq('id', id);
    if (error) throw error;
  },
  async reorderLessons(orderedIds){
    if (DEMO){
      const lessons = LS.get('lessons', []);
      orderedIds.forEach((id, i) => { const l = lessons.find(x => x.id === id); if (l) l.position = i + 1; });
      LS.set('lessons', lessons); return;
    }
    for (let i = 0; i < orderedIds.length; i++){
      const { error } = await sb.from('lessons').update({ position: i + 1 }).eq('id', orderedIds[i]);
      if (error) throw error;
    }
  },
};

/* ================= state & views ================= */
const state = {
  user:null, course:null, lessons:[], progress:{}, idx:0,
  qualities:[], quality:'source', speed:1,
  pendingSeek:null, resumeTo:0, resumeAfter:false, switching:false,
};
const videoEl = $('video'), playerBox = $('playerBox');

function switchView(name){
  const wasPlayer = $('view-player').classList.contains('active');
  if (wasPlayer && name !== 'player'){ saveCurrentProgress(); videoEl.pause(); }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + name).classList.add('active');
  closePops();
  window.scrollTo(0, 0);
}

/* ================= student dashboard ================= */
function continueIndex(){
  for (let i = 0; i < state.lessons.length; i++){
    const p = state.progress[state.lessons[i].id];
    if (p && !p.completed && p.position_seconds > 5) return i;
  }
  const open = state.lessons.findIndex(l => !(state.progress[l.id] && state.progress[l.id].completed));
  return open === -1 ? 0 : open;
}
function lessonRowHtml(l, i){
  const p = state.progress[l.id] || {};
  const done = !!p.completed, pos = +p.position_seconds || 0, dur = +p.duration_seconds || 0;
  const pct = dur ? Math.min(100, pos / dur * 100) : 0;
  const status = done ? 'Completed' : pos > 20 ? 'Resume · ' + fmt(pos) : 'Not started';
  const thumb = l.thumbnail_url
    ? `<img src="${esc(l.thumbnail_url)}" alt="" loading="lazy">`
    : `<span class="thumb-fallback"><svg class="ic"><use href="#i-play"/></svg></span>`;
  return `<button class="lesson-row ${done ? 'done' : ''}" data-i="${i}">
    <span class="lesson-idx mono-eyebrow">${pad(i+1)}</span>
    <span class="lesson-thumb">${thumb}<span class="thumb-play"><svg class="ic"><use href="#i-play"/></svg></span></span>
    <span class="lesson-info">
      <span class="lesson-title">${esc(l.title)}</span>
      <span class="lesson-status mono-eyebrow">${status}</span>
    </span>
    <span class="lesson-state">${done
      ? '<svg class="ic state-check"><use href="#i-check"/></svg>'
      : '<svg class="ic state-go"><use href="#i-chev-r"/></svg>'}</span>
    <span class="lesson-bar" style="width:${pct}%"></span>
  </button>`;
}
function renderDashboard(){
  const u = state.user;
  $('userAvatar').textContent = (u.name || 'S').trim().charAt(0).toUpperCase();
  $('userName').textContent = u.name || 'Student';
  $('userPhone').textContent = maskedPhone(u.phone);
  if (!state.course){ $('notEnrolled').hidden = false; $('dashContent').hidden = true; return; }
  $('notEnrolled').hidden = true; $('dashContent').hidden = false;
  $('courseTitle').textContent = state.course.title;
  $('courseDesc').textContent = state.course.description || '';
  const total = state.lessons.length;
  const done = state.lessons.filter(l => state.progress[l.id] && state.progress[l.id].completed).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('statDone').textContent = done; $('statTotal').textContent = total;
  $('ringPct').textContent = pct + '%';
  $('ringFill').style.strokeDashoffset = 226.2 * (1 - pct / 100);
  $('lessonsCount').textContent = total ? `${total} session${total > 1 ? 's' : ''}` : '';
  $('lessonList').innerHTML = total
    ? state.lessons.map(lessonRowHtml).join('')
    : '<p class="list-empty">No sessions published yet — check back soon.</p>';
  document.title = 'Typixel Learn — Online Courses';
}

/* ================= player ================= */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const fmtSpeed = s => (s % 1 === 0 ? String(+s) : String(s)) + '×';

function buildQualities(l){
  const q = [{ key:'source', label:'Source', url:l.video_url }];
  if (l.video_url_720) q.push({ key:'720', label:'720p', url:l.video_url_720 });
  if (l.video_url_480) q.push({ key:'480', label:'480p', url:l.video_url_480 });
  return q;
}
async function openLesson(i){
  const lesson = state.lessons[i]; if (!lesson) return;
  await saveCurrentProgress();               // persist the previous session first
  state.switching = true;
  state.idx = i;
  state.qualities = buildQualities(lesson);
  state.quality = 'source';
  renderQualityPop();
  $('btnQuality').textContent = state.qualities[0].label;
  const p = state.progress[lesson.id];
  state.resumeTo = p && !p.completed ? (+p.position_seconds || 0) : 0;
  if (state.resumeTo < 8) state.resumeTo = 0;
  state.pendingSeek = null;
  videoEl.src = state.qualities[0].url;
  videoEl.load();
  updatePlayerMeta();
  renderPlaylist();
  switchView('player');
  showControls();
}
function updatePlayerMeta(){
  const l = state.lessons[state.idx], n = state.lessons.length;
  $('metaCrumb').textContent = `Session ${pad(state.idx + 1)} of ${pad(n)}`;
  $('playerCrumb').textContent = `${state.course ? state.course.title : ''}  ·  ${pad(state.idx + 1)} / ${pad(n)}`;
  $('lessonTitle').textContent = l.title;
  $('lessonDesc').textContent = l.description || '';
  $('lessonDesc').hidden = !l.description;
  $('navPrev').disabled = state.idx === 0;
  $('navNext').disabled = state.idx === n - 1;
  document.title = l.title + ' — Typixel Learn';
}
function renderPlaylist(){
  $('playlistList').innerHTML = state.lessons.map((l, i) => {
    const done = state.progress[l.id] && state.progress[l.id].completed;
    return `<button class="pl-item ${i === state.idx ? 'current' : ''}" data-i="${i}">
      <span class="pl-num mono-eyebrow">${pad(i+1)}</span>
      <span class="pl-title">${esc(l.title)}</span>
      ${done ? '<svg class="ic pl-check"><use href="#i-check"/></svg>' : ''}
    </button>`;
  }).join('');
}
function renderSpeedPop(){
  $('speedPop').innerHTML = SPEEDS.map(s =>
    `<button class="pop-item ${s === state.speed ? 'on' : ''}" data-s="${s}"><span>${fmtSpeed(s)}</span><svg class="ic"><use href="#i-check"/></svg></button>`).join('');
}
function renderQualityPop(){
  $('qualityPop').innerHTML = state.qualities.map(q =>
    `<button class="pop-item ${q.key === state.quality ? 'on' : ''}" data-q="${q.key}"><span>${q.label}</span><svg class="ic"><use href="#i-check"/></svg></button>`).join('');
}
async function saveCurrentProgress(force){
  const l = state.lessons[state.idx];
  if (!l || !state.user || state.user.is_admin) return;
  const c = videoEl.currentTime || 0, d = videoEl.duration || 0;
  const prev = state.progress[l.id] || {};
  const completed = force === true || (d > 0 && c >= d - 8) || !!prev.completed;
  if (!c && !completed) return;
  const rec = { position_seconds: c, completed, duration_seconds: d || prev.duration_seconds || 0 };
  state.progress[l.id] = rec;
  try{ await api.saveProgress(state.user.id, l.id, c, completed, rec.duration_seconds); }catch(e){}
}
function togglePlay(){
  if (!videoEl.src) return;
  if (videoEl.paused) videoEl.play().catch(() => {});
  else videoEl.pause();
}
function setQuality(key, force){
  const q = state.qualities.find(x => x.key === key); if (!q) return;
  if (!force && q.key === state.quality) return;
  state.quality = key;
  $('btnQuality').textContent = q.label;
  renderQualityPop();
  state.pendingSeek = videoEl.currentTime || null;
  state.resumeAfter = !videoEl.paused && videoEl.readyState > 2;
  state.switching = true;
  videoEl.src = q.url; videoEl.load();
  closePops();
}
function toggleFullscreen(){
  if (document.fullscreenElement){ document.exitFullscreen(); return; }
  if (playerBox.requestFullscreen) playerBox.requestFullscreen();
  else if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen(); // iPhone Safari
}
function goPrev(){ state.idx > 0 ? openLesson(state.idx - 1) : toast('This is the first session'); }
function goNext(){ state.idx < state.lessons.length - 1 ? openLesson(state.idx + 1) : toast('This is the last session'); }

/* ---- player events ---- */
let hideTimer = null, seeking = false;
function showControls(){
  playerBox.classList.add('ctrl-on');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!videoEl.paused && !document.querySelector('.pop-wrap.open') && !seeking)
      playerBox.classList.remove('ctrl-on');
  }, 2600);
}
function hideControls(){ if (!videoEl.paused) playerBox.classList.remove('ctrl-on'); }
const flashEl = $('playerFlash');
function flash(icon){
  flashEl.querySelector('use').setAttribute('href', '#' + icon);
  flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
}
function updateTimeLabel(){
  $('timeLabel').textContent = fmt(videoEl.currentTime) + ' / ' + fmt(videoEl.duration || 0);
}
function updateVolUI(){
  const v = videoEl.muted ? 0 : videoEl.volume;
  $('muteUse').setAttribute('href', v === 0 ? '#i-mute' : '#i-vol');
  $('volSlider').value = v;
  const p = (v * 100) + '%';
  $('volSlider').style.background = `linear-gradient(to right,#fff ${p},rgba(255,255,255,.25) ${p})`;
}

function wirePlayer(){
  videoEl.addEventListener('loadedmetadata', () => {
    $('playerSpinner').classList.remove('show');
    const d = videoEl.duration;
    if (state.pendingSeek != null){ videoEl.currentTime = state.pendingSeek; state.pendingSeek = null; }
    else if (state.resumeTo){
      if (d && state.resumeTo < d - 12){ videoEl.currentTime = state.resumeTo; toast('Resumed at ' + fmt(state.resumeTo)); }
      state.resumeTo = 0;
    }
    videoEl.playbackRate = state.speed;
    if (state.resumeAfter){ videoEl.play().catch(() => {}); state.resumeAfter = false; }
    state.switching = false;
    updateTimeLabel();
  });
  let lastSave = 0;
  videoEl.addEventListener('timeupdate', () => {
    const d = videoEl.duration || 0, c = videoEl.currentTime;
    if (!seeking) $('seekFill').style.width = d ? (c / d * 100) + '%' : '0%';
    updateTimeLabel();
    if (d && Math.abs(c - lastSave) > 5){ lastSave = c; saveCurrentProgress(); }
  });
  videoEl.addEventListener('progress', () => {
    try{
      if (videoEl.buffered.length && videoEl.duration){
        const end = videoEl.buffered.end(videoEl.buffered.length - 1);
        $('seekBuffer').style.width = (end / videoEl.duration * 100) + '%';
      }
    }catch(e){}
  });
  videoEl.addEventListener('play', () => {
    playerBox.classList.remove('paused');
    $('playUse').setAttribute('href', '#i-pause');
    flash('i-pause'); showControls();
  });
  videoEl.addEventListener('pause', () => {
    playerBox.classList.add('paused');
    $('playUse').setAttribute('href', '#i-play');
    flash('i-play'); showControls(); clearTimeout(hideTimer);
    if (!state.switching) saveCurrentProgress();
  });
  videoEl.addEventListener('ended', () => {
    playerBox.classList.add('paused');
    saveCurrentProgress(true).then(() => {
      const nx = state.lessons[state.idx + 1];
      toast(nx ? 'Session complete — up next: ' + nx.title : 'Session complete');
    });
  });
  videoEl.addEventListener('waiting', () => $('playerSpinner').classList.add('show'));
  videoEl.addEventListener('playing', () => $('playerSpinner').classList.remove('show'));
  videoEl.addEventListener('canplay', () => $('playerSpinner').classList.remove('show'));
  videoEl.addEventListener('volumechange', updateVolUI);
  videoEl.addEventListener('error', () => {
    $('playerSpinner').classList.remove('show');
    state.switching = false;
    if (state.qualities.length > 1 && state.quality !== 'source'){
      toast('That quality failed to load — back to source', 'error');
      setQuality('source', true);
    } else if ($('view-player').classList.contains('active')){
      toast('This video could not be loaded', 'error');
    }
  });

  /* click = play/pause, double-click = fullscreen */
  let clickTimer = null;
  videoEl.addEventListener('click', () => {
    if (clickTimer){ clearTimeout(clickTimer); clickTimer = null; toggleFullscreen(); }
    else clickTimer = setTimeout(() => { clickTimer = null; togglePlay(); }, 230);
  });
  playerBox.addEventListener('contextmenu', e => e.preventDefault());
  playerBox.addEventListener('mousemove', showControls);
  playerBox.addEventListener('touchstart', showControls, { passive:true });
  playerBox.addEventListener('mouseleave', hideControls);

  /* seek bar */
  const seek = $('seekBar');
  const seekPct = e => {
    const r = seek.getBoundingClientRect();
    return r.width ? Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) : 0;
  };
  seek.addEventListener('pointerdown', e => {
    if (!videoEl.duration) return;
    e.preventDefault();
    try{ seek.setPointerCapture(e.pointerId); }catch(err){}
    seeking = true; seek.classList.add('hovering');
    const p = seekPct(e);
    videoEl.currentTime = p * videoEl.duration;
    $('seekFill').style.width = p * 100 + '%';
  });
  seek.addEventListener('pointermove', e => {
    const p = seekPct(e);
    $('seekTip').style.left = (p * 100) + '%';
    $('seekTip').textContent = fmt(p * (videoEl.duration || 0));
    seek.classList.add('hovering');
    if (seeking && videoEl.duration){
      videoEl.currentTime = p * videoEl.duration;
      $('seekFill').style.width = p * 100 + '%';
    }
  });
  seek.addEventListener('pointerleave', () => { if (!seeking) seek.classList.remove('hovering'); });
  seek.addEventListener('pointerup', () => { seeking = false; seek.classList.remove('hovering'); showControls(); });

  /* control buttons */
  $('btnPlay').addEventListener('click', togglePlay);
  $('btnPrev').addEventListener('click', goPrev);
  $('btnNext').addEventListener('click', goNext);
  $('navPrev').addEventListener('click', goPrev);
  $('navNext').addEventListener('click', goNext);
  $('btnMute').addEventListener('click', () => { videoEl.muted = !videoEl.muted; });
  $('volSlider').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    videoEl.muted = v === 0; videoEl.volume = v;
  });
  $('btnFull').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    $('fullUse').setAttribute('href', document.fullscreenElement ? '#i-compress' : '#i-expand');
  });

  /* speed & quality pops */
  const togglePop = btn => {
    const w = btn.closest('.pop-wrap'), was = w.classList.contains('open');
    closePops(); if (!was) w.classList.add('open');
  };
  $('btnSpeed').addEventListener('click', e => { e.stopPropagation(); togglePop(e.currentTarget); });
  $('btnQuality').addEventListener('click', e => { e.stopPropagation(); togglePop(e.currentTarget); });
  $('speedPop').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    state.speed = parseFloat(b.dataset.s);
    videoEl.playbackRate = state.speed;
    $('btnSpeed').textContent = fmtSpeed(state.speed);
    renderSpeedPop(); closePops();
  });
  $('qualityPop').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    setQuality(b.dataset.q);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.pop-wrap')) closePops(); });
  renderSpeedPop();

  /* playlist & dashboard navigation */
  $('playlistList').addEventListener('click', e => {
    const b = e.target.closest('.pl-item'); if (b) openLesson(+b.dataset.i);
  });
  $('lessonList').addEventListener('click', e => {
    const b = e.target.closest('.lesson-row'); if (b) openLesson(+b.dataset.i);
  });
  $('continueBtn').addEventListener('click', () => {
    if (!state.lessons.length) return toast('No sessions published yet', 'error');
    const done = state.lessons.filter(l => state.progress[l.id] && state.progress[l.id].completed).length;
    if (done === state.lessons.length) toast('Course complete — replay any session');
    openLesson(continueIndex());
  });
  $('playerBack').addEventListener('click', async () => {
    await saveCurrentProgress();
    renderDashboard();
    switchView('dashboard');
  });

  /* watermark drifts between corners */
  const corners = ['wm-tr', 'wm-br', 'wm-bl', 'wm-tl'];
  let wi = 0;
  setInterval(() => {
    if (!$('view-player').classList.contains('active')) return;
    wi = (wi + 1) % 4;
    $('watermark').className = 'wm ' + corners[wi];
  }, 18000);

  /* keyboard */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape'){
      closePops();
      if (!$('lessonModal').hidden) closeLessonModal();
      if (!$('confirmModal').hidden){ $('confirmModal').hidden = true; confirmAction = null; }
      return;
    }
    if (!$('view-player').classList.contains('active')) return;
    if (e.target.closest('input,textarea,select')) return;
    switch (e.key){
      case ' ': if (e.target.closest('button')) return; e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': e.preventDefault(); if (videoEl.duration) videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 5); break;
      case 'ArrowLeft':  e.preventDefault(); if (videoEl.duration) videoEl.currentTime = Math.max(0, videoEl.currentTime - 5); break;
      case 'ArrowUp':    e.preventDefault(); videoEl.muted = false; videoEl.volume = Math.min(1, videoEl.volume + .1); break;
      case 'ArrowDown':  e.preventDefault(); videoEl.volume = Math.max(0, videoEl.volume - .1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'm': case 'M': videoEl.muted = !videoEl.muted; break;
    }
  });

  /* save when the tab hides / closes */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && $('view-player').classList.contains('active')) saveCurrentProgress();
  });
  window.addEventListener('beforeunload', () => {
    if ($('view-player').classList.contains('active')) saveCurrentProgress();
  });
}
function closePops(){ document.querySelectorAll('.pop-wrap.open').forEach(w => w.classList.remove('open')); }

/* ================= admin ================= */
let editingLesson = null, confirmAction = null;
function renderAdmin(){
  const has = !!state.course;
  $('adminCourseTitle').textContent = has ? state.course.title : 'No course yet';
  const pub = state.lessons.filter(l => l.is_published).length;
  $('adminStats').textContent = has
    ? `${state.lessons.length} lesson${state.lessons.length === 1 ? '' : 's'} · ${pub} published`
    : 'Create a course to add lessons';
  $('noCourse').hidden = has;
  $('addLessonBtn').hidden = !has;
  $('adminList').innerHTML = has
    ? (state.lessons.map(adminRowHtml).join('') || '<p class="list-empty">No lessons yet — add your first one.</p>')
    : '';
}
function adminRowHtml(l, i){
  const thumb = l.thumbnail_url
    ? `<img src="${esc(l.thumbnail_url)}" alt="">`
    : '<span class="thumb-fallback"><svg class="ic"><use href="#i-play"/></svg></span>';
  return `<div class="admin-row" data-id="${l.id}">
    <div class="row-order">
      <button class="obtn" data-act="up" title="Move up" ${i === 0 ? 'disabled' : ''}><svg class="ic"><use href="#i-up"/></svg></button>
      <button class="obtn" data-act="down" title="Move down" ${i === state.lessons.length - 1 ? 'disabled' : ''}><svg class="ic"><use href="#i-down"/></svg></button>
    </div>
    <span class="admin-pos mono-eyebrow">${pad(i+1)}</span>
    <div class="admin-thumb">${thumb}</div>
    <div class="admin-info">
      <span class="admin-title">${esc(l.title)}${l.is_published ? '' : '<span class="unpub-tag mono-eyebrow">Draft</span>'}</span>
      <span class="admin-url mono-eyebrow">${esc(l.video_url)}</span>
    </div>
    <label class="switch" title="Published">
      <input type="checkbox" data-act="publish" ${l.is_published ? 'checked' : ''}><span class="switch-track"></span>
    </label>
    <div class="row-actions">
      <button class="btn btn-ghost btn-icon" data-act="edit" title="Edit"><svg class="ic"><use href="#i-edit"/></svg></button>
      <button class="btn btn-ghost btn-icon danger" data-act="delete" title="Delete"><svg class="ic"><use href="#i-trash"/></svg></button>
    </div>
  </div>`;
}
async function refreshAdmin(){
  const { course, lessons } = await api.adminLoad();
  state.course = course; state.lessons = lessons;
  renderAdmin();
}
async function moveLesson(i, dir){
  const j = i + (dir === 'up' ? -1 : 1);
  if (j < 0 || j >= state.lessons.length) return;
  const arr = state.lessons.slice();
  [arr[i], arr[j]] = [arr[j], arr[i]];
  try{
    await api.reorderLessons(arr.map(x => x.id));
    state.lessons = arr.map((x, k) => ({ ...x, position: k + 1 }));
    renderAdmin();
  }catch(err){ toast(err.message || 'Reorder failed', 'error'); }
}
function openLessonModal(l){
  editingLesson = l || null;
  $('lessonModalTitle').textContent = l ? 'Edit lesson' : 'Add lesson';
  $('lessonSaveBtn').textContent = l ? 'Save changes' : 'Add lesson';
  $('fTitle').value = l ? l.title : '';
  $('fDesc').value = l ? (l.description || '') : '';
  $('fVideo').value = l ? l.video_url : '';
  $('fThumb').value = l ? (l.thumbnail_url || '') : '';
  $('f720').value = l ? (l.video_url_720 || '') : '';
  $('f480').value = l ? (l.video_url_480 || '') : '';
  $('fPublish').checked = l ? !!l.is_published : true;
  $('lessonModal').hidden = false;
  setTimeout(() => $('fTitle').focus(), 50);
}
function closeLessonModal(){ $('lessonModal').hidden = true; editingLesson = null; }
function askConfirm(title, text, okLabel, fn){
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  $('confirmOk').textContent = okLabel;
  confirmAction = fn;
  $('confirmModal').hidden = false;
}
function wireAdmin(){
  $('addLessonBtn').addEventListener('click', () => openLessonModal(null));
  $('lessonModalClose').addEventListener('click', closeLessonModal);
  $('lessonModalCancel').addEventListener('click', closeLessonModal);
  $('lessonModal').addEventListener('click', e => { if (e.target === $('lessonModal')) closeLessonModal(); });
  $('confirmCancel').addEventListener('click', () => { $('confirmModal').hidden = true; confirmAction = null; });
  $('confirmOk').addEventListener('click', async () => {
    $('confirmModal').hidden = true;
    if (confirmAction){ try{ await confirmAction(); }catch(e){ toast(e.message || 'Action failed', 'error'); } confirmAction = null; }
  });

  $('lessonForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      course_id: state.course.id,
      title: $('fTitle').value.trim(),
      description: $('fDesc').value.trim(),
      video_url: $('fVideo').value.trim(),
      thumbnail_url: $('fThumb').value.trim(),
      video_url_720: $('f720').value.trim(),
      video_url_480: $('f480').value.trim(),
      is_published: $('fPublish').checked,
    };
    if (!payload.title || !payload.video_url) return toast('Title and video URL are required', 'error');
    const btn = $('lessonSaveBtn'); setBusy(btn, true, 'Saving…');
    try{
      if (editingLesson){ await api.updateLesson(editingLesson.id, payload); toast('Lesson updated'); }
      else { await api.createLesson(payload); toast('Lesson added'); }
      closeLessonModal();
      await refreshAdmin();
    }catch(err){ toast(err.message || 'Save failed', 'error'); }
    finally{ setBusy(btn, false); }
  });

  $('adminList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const row = btn.closest('.admin-row'); const id = row && row.dataset.id; if (!id) return;
    const l = state.lessons.find(x => x.id === id); if (!l) return;
    const i = state.lessons.indexOf(l);
    if (btn.dataset.act === 'edit') return openLessonModal(l);
    if (btn.dataset.act === 'delete') return askConfirm('Delete lesson?',
      `“${l.title}” will be removed permanently. This can't be undone.`, 'Delete',
      async () => { await api.deleteLesson(id); await refreshAdmin(); toast('Lesson deleted'); });
    if (btn.dataset.act === 'up' || btn.dataset.act === 'down') return moveLesson(i, btn.dataset.act);
  });
  $('adminList').addEventListener('change', async e => {
    if (e.target.dataset.act !== 'publish') return;
    const id = e.target.closest('.admin-row').dataset.id;
    const checked = e.target.checked;
    try{
      await api.updateLesson(id, { is_published: checked });
      const l = state.lessons.find(x => x.id === id); if (l) l.is_published = checked;
      renderAdmin();
      toast(checked ? 'Lesson published' : 'Lesson unpublished');
    }catch(err){ e.target.checked = !checked; toast(err.message || 'Update failed', 'error'); }
  });

  $('courseForm').addEventListener('submit', async e => {
    e.preventDefault();
    try{
      await api.createCourse($('courseTitleInput').value.trim(), $('courseDescInput').value.trim());
      toast('Course created'); await refreshAdmin();
    }catch(err){ toast(err.message || 'Could not create course', 'error'); }
  });
}

/* ================= auth ================= */
let pendingPhone = '', cooldownIv = null;
const otpInputs = () => [...document.querySelectorAll('.otp-input')];
function showOtpStep(code){ $('otpStepPhone').hidden = code; $('otpStepCode').hidden = !code; }
function startCooldown(){
  let s = 30; const b = $('resendBtn');
  b.disabled = true; b.textContent = `Resend code (${s}s)`;
  clearInterval(cooldownIv);
  cooldownIv = setInterval(() => {
    s--;
    if (s <= 0){ clearInterval(cooldownIv); b.disabled = false; b.textContent = 'Resend code'; }
    else b.textContent = `Resend code (${s}s)`;
  }, 1000);
}
function resetAuth(){
  showOtpStep(false);
  document.querySelectorAll('.auth-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === 'student'));
  $('pane-student').classList.add('active'); $('pane-admin').classList.remove('active');
  $('phoneInput').value = ''; otpInputs().forEach(i => i.value = '');
  clearInterval(cooldownIv);
  $('resendBtn').disabled = false; $('resendBtn').textContent = 'Resend code';
}
function setWatermark(){
  const u = state.user || {};
  const first = (u.name || 'Student').split(' ')[0];
  $('watermark').textContent = u.phone ? `${first} · ${maskedPhone(u.phone)}` : first;
}
async function enterApp(user){
  state.user = user;
  setWatermark();
  if (user.is_admin){ await refreshAdmin(); switchView('admin'); return; }
  const data = await api.loadStudent(user.id);
  state.course = data.course; state.lessons = data.lessons || []; state.progress = data.progress || {};
  renderDashboard();
  switchView('dashboard');
}
function wireAuth(){
  document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(x => x.classList.toggle('active', x === t));
    $('pane-student').classList.toggle('active', t.dataset.tab === 'student');
    $('pane-admin').classList.toggle('active', t.dataset.tab === 'admin');
  }));

  $('phoneForm').addEventListener('submit', async e => {
    e.preventDefault();
    const phone = normalizePhone($('phoneInput').value);
    if (!/^\+\d{8,15}$/.test(phone)) return toast('Enter a valid number with country code, e.g. +14155552671', 'error');
    const btn = $('sendOtpBtn'); setBusy(btn, true, 'Sending…');
    try{
      await api.sendOtp(phone);
      pendingPhone = phone;
      $('otpPhoneLabel').textContent = phone;
      showOtpStep(true);
      otpInputs()[0].focus();
      startCooldown();
      toast(DEMO ? 'Demo mode — your OTP is 123456' : 'Code sent to ' + phone);
    }catch(err){ toast(err.message || 'Could not send code', 'error'); }
    finally{ setBusy(btn, false); }
  });

  $('backToPhone').addEventListener('click', () => { clearInterval(cooldownIv); showOtpStep(false); });
  $('resendBtn').addEventListener('click', async () => {
    if ($('resendBtn').disabled) return;
    try{
      await api.sendOtp(pendingPhone); startCooldown();
      toast(DEMO ? 'Demo mode — your OTP is 123456' : 'Code resent');
    }catch(err){ toast(err.message || 'Could not resend', 'error'); }
  });

  otpInputs().forEach((inp, idx, arr) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      if (inp.value && arr[idx + 1]) arr[idx + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && arr[idx - 1]){ arr[idx - 1].focus(); arr[idx - 1].value = ''; e.preventDefault(); }
      if (e.key === 'ArrowLeft' && arr[idx - 1]) arr[idx - 1].focus();
      if (e.key === 'ArrowRight' && arr[idx + 1]) arr[idx + 1].focus();
    });
  });
  $('otpRow').addEventListener('paste', e => {
    e.preventDefault();
    const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!d) return;
    const arr = otpInputs();
    arr.forEach((inp, i) => inp.value = d[i] || '');
    arr[Math.min(d.length, 5)].focus();
  });

  $('otpForm').addEventListener('submit', async e => {
    e.preventDefault();
    const token = otpInputs().map(i => i.value).join('');
    if (token.length !== 6) return toast('Enter the 6-digit code', 'error');
    const btn = $('verifyBtn'); setBusy(btn, true, 'Verifying…');
    try{
      const user = await api.verifyOtp(pendingPhone, token);
      otpInputs().forEach(i => i.value = '');
      await enterApp(user);
    }catch(err){ toast(err.message || 'Verification failed', 'error'); }
    finally{ setBusy(btn, false); }
  });

  $('adminForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('adminLoginBtn'); setBusy(btn, true, 'Signing in…');
    try{
      const u = await api.adminLogin($('adminEmail').value.trim(), $('adminPass').value);
      await enterApp(u);
    }catch(err){ toast(err.message || 'Login failed', 'error'); }
    finally{ setBusy(btn, false); }
  });

  document.querySelectorAll('.js-logout').forEach(b => b.addEventListener('click', async () => {
    await api.logout();
    state.user = null; state.course = null; state.lessons = []; state.progress = {};
    videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load();
    document.title = 'Typixel Learn — Online Courses';
    resetAuth();
    switchView('auth');
    toast('Signed out');
  }));
}

/* ================= pixel field (auth brand panel) ================= */
function startPixelCanvas(){
  const cv = $('pixelCanvas'), ctx = cv.getContext('2d');
  const CW = 22, GAP = 7;
  let cells = [];
  function resize(){
    const r = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cells = [];
    const cols = Math.ceil(r.width / (CW + GAP)), rows = Math.ceil(r.height / (CW + GAP));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
      cells.push({ px: x * (CW + GAP), py: y * (CW + GAP), col: 0, a: 0, ta: 0, next: performance.now() + Math.random() * 5000 });
  }
  function tick(t){
    if ($('view-auth').classList.contains('active')){
      const W = cv.width / Math.min(window.devicePixelRatio || 1, 2);
      const H = cv.height / Math.min(window.devicePixelRatio || 1, 2);
      ctx.clearRect(0, 0, W, H);
      for (const c of cells){
        if (t > c.next){
          const r = Math.random();
          c.col = r < .78 ? 0 : r < .96 ? 1 : 2;      // off / white / red
          c.ta = c.col === 0 ? 0 : c.col === 1 ? .14 : .85;
          c.next = t + 1400 + Math.random() * 7000;
        }
        c.a += (c.ta - c.a) * .07;
        if (c.a < .015) continue;
        ctx.globalAlpha = c.a;
        ctx.fillStyle = c.col === 2 ? '#D9232E' : '#F4F3F1';
        ctx.fillRect(c.px, c.py, CW, CW);
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(tick);
  }
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
}

/* ================= boot ================= */
(async function init(){
  seedDemo();
  $('demoNote').hidden = !DEMO;
  $('demoAdminHint').hidden = !DEMO;
  $('yearNow').textContent = new Date().getFullYear();
  wireAuth(); wirePlayer(); wireAdmin();
  startPixelCanvas();
  try{
    const u = await api.restoreSession();
    if (u){ await enterApp(u); return; }
  }catch(err){
    console.warn(err);
    try{ await api.logout(); }catch(e){}
    toast('Session expired — please sign in again', 'error');
  }
  switchView('auth');
})();

/* ============================================================
   SUPABASE SETUP SQL — paste into the Supabase SQL Editor
   ============================================================

  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default 'Student',
    phone text,
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
  );
  create table public.courses (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text default '',
    created_at timestamptz not null default now()
  );
  create table public.lessons (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null,
    description text default '',
    video_url text not null,
    video_url_720 text default '',
    video_url_480 text default '',
    thumbnail_url text default '',
    position int not null default 0,
    is_published boolean not null default true,
    created_at timestamptz not null default now()
  );
  create table public.enrollments (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.profiles(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (student_id, course_id)
  );
  create table public.video_progress (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.profiles(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    position_seconds numeric not null default 0,
    duration_seconds numeric not null default 0,
    completed boolean not null default false,
    updated_at timestamptz not null default now(),
    unique (student_id, lesson_id)
  );

  alter table public.profiles       enable row level security;
  alter table public.courses        enable row level security;
  alter table public.lessons        enable row level security;
  alter table public.enrollments    enable row level security;
  alter table public.video_progress enable row level security;

  -- admin check (security definer avoids RLS recursion on profiles)
  create or replace function public.is_admin()
  returns boolean language sql stable security definer set search_path = public as $$     select exists (select 1 from profiles where id = auth.uid() and is_admin);
  $$;

  -- auto-create a profile row for every new auth user
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$   begin
    insert into public.profiles (id, phone, full_name)
    values (new.id, new.phone, coalesce(new.raw_user_meta_data->>'full_name', 'Student'));
    return new;
  end;
  $$;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

  -- profiles: read your own (admins read all), update your own
  create policy "profiles_select" on public.profiles for select
    using (auth.uid() = id or public.is_admin());
  create policy "profiles_update" on public.profiles for update
    using (auth.uid() = id);

  -- courses: any signed-in user reads; only admins write
  create policy "courses_select" on public.courses for select
    using (auth.role() = 'authenticated');
  create policy "courses_admin" on public.courses for all
    using (public.is_admin()) with check (public.is_admin());

  -- lessons: admins see everything; students only see PUBLISHED
  -- lessons of courses they are ENROLLED in (enforced by the DB)
  create policy "lessons_select" on public.lessons for select using (
    public.is_admin()
    or (
      is_published
      and exists (
        select 1 from public.enrollments e
        where e.course_id = lessons.course_id and e.student_id = auth.uid()
      )
    )
  );
  create policy "lessons_admin" on public.lessons for all
    using (public.is_admin()) with check (public.is_admin());

  -- enrollments: read your own; admins manage rows to enrol students
  create policy "enrollments_select" on public.enrollments for select
    using (auth.uid() = student_id or public.is_admin());
  create policy "enrollments_admin" on public.enrollments for all
    using (public.is_admin()) with check (public.is_admin());

  -- progress: every student owns only their own rows
  create policy "progress_select" on public.video_progress for select
    using (auth.uid() = student_id);
  create policy "progress_insert" on public.video_progress for insert
    with check (auth.uid() = student_id);
  create policy "progress_update" on public.video_progress for update
    using (auth.uid() = student_id);

  -- Optional starter course (run after creating your admin):
  -- insert into public.courses (title, description)
  -- values ('Typography Fundamentals — From Pixel to Page', 'A six-session foundation course on practical typography.');
   ============================================================ */
