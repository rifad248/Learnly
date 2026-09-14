/* ============================================================
   Typixel Learn — script.js
   Plain JS LMS: phone+password auth, courses → modules → lessons,
   progress, notes, bookmarks, announcements, admin panel, analytics.
   Works standalone in DEMO MODE (localStorage). To go live:
   1) supabase.com project → Auth → Providers → Email ON,
      disable "Confirm email" (we use <digits>@typixel.local aliases).
   2) SQL Editor → run the SETUP SQL at the bottom of this file.
   3) Paste URL + anon key into CONFIG. 4) Flag your admin (see SQL).
   ============================================================ */
const CONFIG = { url: "https://YOUR_PROJECT.supabase.co", anonKey: "YOUR_SUPABASE_ANON_KEY" };
const DEMO = CONFIG.url.includes("YOUR_PROJECT");
let sb = null;
if (!DEMO) sb = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const esc = s => (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmt(s){ s = Math.max(0, Math.floor(s||0)); const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60; return h?`${h}:${pad(m)}:${pad(x)}`:`${m}:${pad(x)}`; }
function fmtDur(sec){ sec=Math.round(sec||0); if(!sec) return '—'; const h=Math.floor(sec/3600),m=Math.round(sec%3600/60); return h?`${h}h ${m}m`:`${m||1}m`; }
function timeAgo(t){ if(!t) return '—'; const s=(Date.now()-new Date(t))/1000; if(s<90)return 'just now'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }
function maskedPhone(p){ const d=(p||'').replace(/\D/g,''); return d.length>=4 ? '•••• '+d.slice(-4) : (p||'—'); }
function normalizePhone(v){ let p=(v||'').replace(/[\s\-().]/g,''); if(p&&!p.startsWith('+')) p='+'+p; return p; }
function toast(msg,type='info',ms=3400){ const t=document.createElement('div'); t.className='toast '+type;
  t.innerHTML=`<span class="toast-dot"></span><span>${esc(msg)}</span>`; $('toasts').appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320);},ms); }
function setBusy(btn,on,label){ if(on){btn.dataset.label=btn.textContent;btn.textContent=label||'Working…';btn.disabled=true;} else {btn.textContent=btn.dataset.label||btn.textContent;btn.disabled=false;} }
function thumbHtml(url,extra=''){ return url?`<img src="${esc(url)}" alt="" loading="lazy">`:`<span class="thumb-fallback"><svg class="ic"><use href="#i-play"/></svg></span>`; }
const DAY = 864e5;
const isExpired = c => c && c.expires_at && new Date(c.expires_at) < new Date();

/* ---------- demo storage ---------- */
const LS = {
  get(k,d){ try{const v=localStorage.getItem('typixel_'+k); return v?JSON.parse(v):d;}catch(e){return d;} },
  set(k,v){ localStorage.setItem('typixel_'+k, JSON.stringify(v)); },
  del(k){ localStorage.removeItem('typixel_'+k); },
};

/* ---------- demo seed ---------- */
function seedDemo(){
  if (LS.get('seeded3')) return;
  const now = Date.now(), V='https://storage.googleapis.com/gtv-videos-bucket/sample/', T=s=>`https://picsum.photos/seed/${s}/640/360.jpg`;
  LS.set('users', {
    '+10000000000':{id:'u-admin',name:'Admin',phone:'+10000000000',password:'admin123',is_admin:true,last_active:now},
    '+10000000001':{id:'u-1',name:'Alex Rivera',phone:'+10000000001',password:'student123',last_active:now,photo_url:'https://i.pravatar.cc/100?img=12'},
    '+10000000002':{id:'u-2',name:'Priya Shah',phone:'+10000000002',password:'student123',last_active:now-2*DAY},
    '+10000000003':{id:'u-3',name:'John Mathew',phone:'+10000000003',password:'student123',last_active:now-20*DAY},
  });
  LS.set('courses',[
    {id:'c1',title:'Typography Fundamentals',category:'Typography',description:'A six-session foundation course — from letterform anatomy to setting complete pages.',thumbnail_url:T('typix'),is_featured:true,is_published:true,expires_at:'',created_at:now-21*DAY},
    {id:'c2',title:'Advanced Lettering',category:'Lettering',description:'Brush warm-ups, construction and vector letterform building.',thumbnail_url:T('letter'),is_featured:false,is_published:true,expires_at:'',created_at:now-9*DAY},
    {id:'c3',title:'Design Basics Sprint',category:'Design',description:'A two-week sprint through layout, contrast and hierarchy. Access expires.',thumbnail_url:T('design'),is_featured:false,is_published:true,expires_at:now+14*DAY,created_at:now-4*DAY},
  ]);
  const L=(id,c,m,t,d,pos,dur,pub,lock,vid)=>({id,course_id:c,module_id:m,title:t,description:d,video_url:vid||V+'BigBuckBunny.mp4',video_url_720:'',video_url_480:'',video_url_1080:'',video_url_360:'',thumbnail_url:T('lsn'+pos+c),duration_seconds:dur*60,position:pos,is_published:pub!==false,lock_prev:!!lock,created_at:now});
  LS.set('modules',[
    {id:'m1',course_id:'c1',title:'Foundations',position:1},{id:'m2',course_id:'c1',title:'Working with Type',position:2},{id:'m3',course_id:'c1',title:'Practice & Critique',position:3},
    {id:'m4',course_id:'c2',title:'Tools & Warm-ups',position:1},{id:'m5',course_id:'c2',title:'Letterform Construction',position:2},
    {id:'m6',course_id:'c3',title:'Sprint',position:1},
  ]);
  LS.set('lessons',[
    L('l1','c1','m1','What Is Typography, Really?','Why type is 90% of design and how to set up your environment.',1,14,false),
    L('l2','c1','m1','Anatomy of a Letterform','Baseline, x-height, counters, terminals — the core vocabulary.',2,11,false),
    L('l3','c1','m2','Spacing, Rhythm & Kerning','Why optical kerning beats metric, and drills to train your eye.',3,16,true),
    L('l4','c1','m2','Choosing & Pairing Typefaces','A framework for primary and secondary typefaces that don\u2019t fight.',4,13,true),
    L('l5','c1','m3','Type on Screens','Responsive sizes, line lengths and hierarchy down to a phone.',5,12,true),
    L('l6','c1','m3','Setting a Full Page','Typesetting a complete editorial page, step by step.',6,18,true),
    L('l7','c1','m3','Bonus: Live Type Critique','An unedited critique session — publish when ready.',7,22,false),
    L('la1','c2','m4','Brush Pen Warm-ups','Pressure, rhythm and muscle memory drills.',1,10),
    L('la2','c2','m4','Stroke Order & Flow','How pros keep letters alive at speed.',2,14),
    L('la3','c2','m5','Building a Blockbuster B','Grid construction for display letters.',3,17),
    L('la4','c2','m5','Vector Cleanup','From rough sketch to production-ready paths.',4,15),
    L('lb1','c3','m6','Contrast & Hierarchy','Making the eye land where you want.',1,9),
    L('lb2','c3','m6','Grid Systems in Practice','The invisible skeleton of every layout.',2,11),
  ]);
  LS.set('enrollments',[{s:'u-1',c:'c1'},{s:'u-2',c:'c1'},{s:'u-2',c:'c2'}]);
  LS.set('progress_u-1',{ l1:{pos:840,done:true,dur:840,at:now-5*DAY}, l2:{pos:660,done:true,dur:660,at:now-4*DAY}, l3:{pos:384,done:false,dur:960,at:now-3600e3} });
  LS.set('progress_u-2',{ l1:{pos:840,done:true,dur:840,at:now-2*DAY}, la1:{pos:120,done:false,dur:600,at:now-2*DAY} });
  LS.set('progress_u-admin',{});
  LS.set('notes',{ 'u-1|l2':'Remember: optical kerning > metric. Redo exercise 3.','u-2|l1':'' });
  LS.set('bookmarks',[{s:'u-1',l:'l3'},{s:'u-1',l:'la1'},{s:'u-2',l:'l1'}]);
  LS.set('announcements',[
    {id:'a1',audience:'all',course_id:'',student_id:'',title:'Welcome to the new semester',body:'Three courses are live and a lettering critique drops this Friday. Check your dashboard for your resume point.',created_at:now-2*DAY},
    {id:'a2',audience:'course',course_id:'c1',student_id:'',title:'Module 3 is live',body:'"Practice & Critique" is open. Finish Kerning first — the critique assumes it.',created_at:now-DAY},
    {id:'a3',audience:'student',course_id:'',student_id:'u-1',title:'Your critique slot',body:'Alex — your 1:1 critique is booked for Saturday 10:00. Bring page 2 of the exercise.',created_at:now-3600e3},
  ]);
  LS.set('seeded3',true);
}

/* ---------- api (Supabase | demo) ---------- */
function demoUser(id){ return Object.values(LS.get('users',{})).find(u=>u.id===id); }
function demoPubLessons(courseId){ return LS.get('lessons',[]).filter(l=>l.course_id===courseId&&l.is_published).sort((a,b)=>a.position-b.position); }

const api = {
  async restoreSession(){
    if (DEMO){ const s=LS.get('session',null); if(!s) return null; const u=demoUser(s.id); if(!u||u.blocked){LS.del('session');return null;} return u; }
    const { data:{session} } = await sb.auth.getSession(); if(!session) return null;
    return api.profile(session.user.id, session.user.phone||'');
  },
  async profile(uid, phone){
    const { data, error } = await sb.from('profiles').select('*').eq('id',uid).single();
    if (error||!data) throw new Error('Profile missing — run the setup SQL');
    if (data.blocked) throw new Error('This account has been blocked.');
    return { id:uid, name:data.full_name||'Student', phone:data.phone||phone, photo_url:data.photo_url||'', is_admin:!!data.is_admin, blocked:false };
  },
  async signup(name, phone, password){
    if (DEMO){ const users=LS.get('users',{}); if(users[phone]) throw new Error('That phone is already registered');
      const u={id:'u-'+Date.now(),name,phone,password,is_admin:false,last_active:Date.now()}; users[phone]=u; LS.set('users',users);
      LS.set('session',{id:u.id}); return u; }
    const email = phone.replace(/\D/g,'')+'@typixel.local';
    const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ full_name:name, phone } } });
    if (error) throw error;
    await sb.from('profiles').upsert({ id:data.user.id, full_name:name, phone }, { onConflict:'id' });
    return api.profile(data.user.id, phone);
  },
  async login(phone, password){
    if (DEMO){ const u=LS.get('users',{})[phone]; if(!u||u.password!==password) throw new Error('Incorrect phone or password');
      if(u.blocked) throw new Error('This account has been blocked.');
      u.last_active=Date.now(); LS.set('users',{...LS.get('users',{}),[phone]:u}); LS.set('session',{id:u.id}); return u; }
    const email = phone.replace(/\D/g,'')+'@typixel.local';
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Incorrect phone or password');
    const p = await api.profile(data.user.id, phone);
    sb.from('profiles').update({ last_active:new Date().toISOString() }).eq('id',p.id).then(()=>{});
    return p;
  },
  async logout(){ DEMO ? LS.del('session') : await sb.auth.signOut(); },
  async updateProfile(uid, patch){
    if (DEMO){ const users=LS.get('users',{}); const k=Object.keys(users).find(k=>users[k].id===uid);
      if(k){ users[k]={...users[k],...patch}; LS.set('users',users); } return; }
    const { error } = await sb.from('profiles').update(patch).eq('id',uid); if(error) throw error;
  },
  async changePassword(phone, oldPass, newPass){
    if (DEMO){ const u=LS.get('users',{})[phone]; if(!u||u.password!==oldPass) throw new Error('Current password is incorrect');
      u.password=newPass; LS.set('users',{...LS.get('users',{}),[phone]:u}); return; }
    const email=phone.replace(/\D/g,'')+'@typixel.local';
    const { error:e1 } = await sb.auth.signInWithPassword({ email, password:oldPass });
    if (e1) throw new Error('Current password is incorrect');
    const { error } = await sb.auth.updateUser({ password:newPass }); if(error) throw error;
  },

  /* ----- student data ----- */
  async studentData(uid){
    if (DEMO){
      const myEnr=new Set(LS.get('enrollments',[]).filter(e=>e.s===uid).map(e=>e.c));
      const courses=LS.get('courses',[]).filter(c=>c.is_published);
      const allL=LS.get('lessons',[]), mods=LS.get('modules',[]).sort((a,b)=>a.position-b.position);
      const myCourses=courses.filter(c=>myEnr.has(c.id));
      const lessons=allL.filter(l=>l.is_published&&myEnr.has(l.course_id));
      const catalog=courses.map(c=>{ const ls=demoPubLessons(c.id);
        return {...c, lessons:ls.length, mins:ls.reduce((a,l)=>a+(l.duration_seconds||0),0),
          students:LS.get('enrollments',[]).filter(e=>e.c===c.id).length, enrolled:myEnr.has(c.id)}; });
      return { catalog, modules:mods.filter(m=>myEnr.has(m.course_id)),
        lessons, progress:LS.get('progress_'+uid,{}),
        bookmarks:LS.get('bookmarks',[]).filter(b=>b.s===uid).map(b=>b.l),
        notes:LS.get('notes',{}), announcements:LS.get('announcements',[])
          .filter(a=>a.audience==='all'||a.student_id===uid||myEnr.has(a.course_id))
          .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)) };
    }
    const [enr,courses,mods,prog,bms,anns] = await Promise.all([
      sb.from('enrollments').select('course_id').eq('student_id',uid),
      sb.from('courses').select('*').eq('is_published',true).order('created_at'),
      sb.from('modules').select('*').order('position'),
      sb.from('video_progress').select('*').eq('student_id',uid),
      sb.from('bookmarks').select('lesson_id').eq('student_id',uid),
      sb.from('announcements').select('*').order('created_at',{ascending:false}),
    ]);
    const myEnr=new Set((enr.data||[]).map(e=>e.course_id));
    const [lessons,allPub] = await Promise.all([
      sb.from('lessons').select('*').eq('is_published',true).order('position'),
      sb.from('course_stats').select('*'),
    ]);
    const lessonsOk=(lessons.data||[]).filter(l=>myEnr.has(l.course_id));
    const catalog=(courses.data||[]).map(c=>{ const st=(allPub.data||[]).find(s=>s.course_id===c.id);
      return {...c, lessons:st?st.lessons_count:0, mins:st?st.total_mins:0,
        students:st?st.students_count:0, enrolled:myEnr.has(c.id)}; });
    const progress={}; (prog.data||[]).forEach(p=>progress[p.lesson_id]={pos:+p.position_seconds||0,done:!!p.completed,dur:+p.duration_seconds||0,at:p.updated_at});
    return { catalog, modules:(mods.data||[]).filter(m=>myEnr.has(m.course_id)), lessons:lessonsOk, progress,
      bookmarks:(bms.data||[]).map(b=>b.lesson_id), notes:{},
      announcements:(anns.data||[]).filter(a=>a.audience==='all'||a.student_id===uid||myEnr.has(a.course_id)) };
  },
  async saveProgress(uid, lessonId, seconds, completed, duration){
    if (DEMO){ const k='progress_'+uid, p=LS.get(k,{}), prev=p[lessonId]||{};
      p[lessonId]={pos:seconds,done:completed||!!prev.done,dur:duration||prev.dur||0,at:Date.now()}; LS.set(k,p); return; }
    const row={ student_id:uid, lesson_id:lessonId, position_seconds:seconds, completed:!!completed, updated_at:new Date().toISOString() };
    if (duration>0) row.duration_seconds=duration;
    const { error } = await sb.from('video_progress').upsert(row,{onConflict:'student_id,lesson_id'});
    if (error) console.warn('progress save failed',error);
  },
  async getNote(uid, lessonId){
    if (DEMO) return LS.get('notes',{})[uid+'|'+lessonId]||'';
    const { data } = await sb.from('notes').select('body').eq('student_id',uid).eq('lesson_id',lessonId).maybeSingle();
    return (data&&data.body)||'';
  },
  async saveNote(uid, lessonId, body){
    if (DEMO){ const n=LS.get('notes',{}); n[uid+'|'+lessonId]=body; LS.set('notes',n); return; }
    await sb.from('notes').upsert({ student_id:uid, lesson_id:lessonId, body, updated_at:new Date().toISOString() },{onConflict:'student_id,lesson_id'});
  },
  async toggleBookmark(uid, lessonId){
    if (DEMO){ const list=LS.get('bookmarks',[]); const i=list.findIndex(b=>b.s===uid&&b.l===lessonId);
      if(i>-1) list.splice(i,1); else list.push({s:uid,l:lessonId}); LS.set('bookmarks',list); return i===-1; }
    const { data:ex } = await sb.from('bookmarks').select('lesson_id').eq('student_id',uid).eq('lesson_id',lessonId).maybeSingle();
    if (ex){ await sb.from('bookmarks').delete().eq('student_id',uid).eq('lesson_id',lessonId); return false; }
    await sb.from('bookmarks').insert({ student_id:uid, lesson_id:lessonId }); return true;
  },

  /* ----- admin ----- */
  async adminData(){
    if (DEMO){
      const users=Object.values(LS.get('users',{})), lessons=LS.get('lessons',[]), enr=LS.get('enrollments',[]), anns=LS.get('announcements',[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      const students=users.map(u=>{ const prog=LS.get('progress_'+u.id,{}); let done=0,watch=0,last=u.last_active||u.created_at||null;
        for(const id in prog){ if(prog[id].done)done++; watch+=prog[id].pos||0; if(prog[id].at&&prog[id].at>last)last=prog[id].at; }
        const pub=lessons.filter(l=>l.is_published);
        return {id:u.id,name:u.name,phone:u.phone,is_admin:!!u.is_admin,blocked:!!u.blocked,photo_url:u.photo_url||'',last_active:last,
          enrolled:enr.filter(e=>e.s===u.id).map(e=>e.c),done:pub.length?done:0,total:pub.length,watch}; });
      const courses=LS.get('courses',[]).map(c=>({...c, lessons:LS.get('lessons',[]).filter(l=>l.course_id===c.id).length,
        students:enr.filter(e=>e.c===c.id).length}));
      return { students, courses, announcements:anns };
    }
    const [profiles,enr,lessons,anns] = await Promise.all([
      sb.from('profiles').select('*').order('created_at'),
      sb.from('enrollments').select('student_id,course_id'),
      sb.from('lessons').select('id,course_id,is_published,duration_seconds'),
      sb.from('announcements').select('*').order('created_at',{ascending:false}),
    ]);
    const prog = await sb.from('video_progress').select('student_id,lesson_id,position_seconds,completed,updated_at');
    const students=(profiles.data||[]).map(u=>{ let done=0,watch=0,last=u.last_active;
      (prog.data||[]).forEach(p=>{ if(p.student_id===u.id){ if(p.completed)done++; watch+=+p.position_seconds||0; if(p.updated_at>last)last=p.updated_at; } });
      return {id:u.id,name:u.full_name,phone:u.phone,is_admin:!!u.is_admin,blocked:!!u.blocked,photo_url:u.photo_url||'',last_active:last,
        enrolled:(enr.data||[]).filter(e=>e.student_id===u.id).map(e=>e.course_id),done,total:(lessons.data||[]).filter(l=>l.is_published).length,watch}; });
    const courses=(await sb.from('courses').select('*').order('created_at')).data||[];
    return { students, courses:courses.map(c=>({...c, lessons:(lessons.data||[]).filter(l=>l.course_id===c.id).length,
      students:(enr.data||[]).filter(e=>e.course_id===c.id).length})), announcements:anns.data||[] };
  },
  async adminModules(courseId){
    if (DEMO) return LS.get('modules',[]).filter(m=>m.course_id===courseId).sort((a,b)=>a.position-b.position);
    const { data, error } = await sb.from('modules').select('*').eq('course_id',courseId).order('position'); if(error) throw error; return data||[];
  },
  async adminLessons(courseId){
    if (DEMO) return LS.get('lessons',[]).filter(l=>l.course_id===courseId).sort((a,b)=>a.position-b.position);
    const { data, error } = await sb.from('lessons').select('*').eq('course_id',courseId).order('position'); if(error) throw error; return data||[];
  },
  async saveCourse(row){
    if (DEMO){ const cs=LS.get('courses',[]); if(row.id){ const i=cs.findIndex(c=>c.id===row.id); cs[i]={...cs[i],...row}; }
      else cs.push({...row,id:'c-'+Date.now(),created_at:Date.now()}); LS.set('courses',cs); return; }
    const { id, ...patch } = row;
    if (id){ const { error } = await sb.from('courses').update(patch).eq('id',id); if(error) throw error; }
    else { const { error } = await sb.from('courses').insert(patch); if(error) throw error; }
  },
  async deleteCourse(id){
    if (DEMO){ LS.set('courses',LS.get('courses',[]).filter(c=>c.id!==id));
      LS.set('modules',LS.get('modules',[]).filter(m=>m.course_id!==id));
      LS.set('lessons',LS.get('lessons',[]).filter(l=>l.course_id!==id));
      LS.set('enrollments',LS.get('enrollments',[]).filter(e=>e.c!==id)); return; }
    const { error } = await sb.from('courses').delete().eq('id',id); if(error) throw error;
  },
  async saveModule(courseId, title){
    if (DEMO){ const ms=LS.get('modules',[]); ms.push({id:'m-'+Date.now(),course_id:courseId,title,position:ms.filter(m=>m.course_id===courseId).length+1}); LS.set('modules',ms); return; }
    const { count } = await sb.from('modules').select('*',{count:'exact',head:true}).eq('course_id',courseId);
    const { error } = await sb.from('modules').insert({course_id:courseId,title,position:(count||0)+1}); if(error) throw error;
  },
  async deleteModule(id){
    if (DEMO){ LS.set('modules',LS.get('modules',[]).filter(m=>m.id!==id)); LS.set('lessons',LS.get('lessons',[]).filter(l=>l.module_id!==id)); return; }
    const { error } = await sb.from('modules').delete().eq('id',id); if(error) throw error;
  },
  async saveLesson(row){
    if (DEMO){ const ls=LS.get('lessons',[]);
      if(row.id){ const i=ls.findIndex(l=>l.id===row.id); ls[i]={...ls[i],...row}; }
      else { const pos=ls.filter(l=>l.module_id===row.module_id).length+1;
        ls.push({...row,id:'l-'+Date.now(),position:pos,created_at:Date.now(),duration_seconds:(row.duration_seconds||0)*60}); }
      LS.set('lessons',ls); return; }
    const { id, duration_seconds, ...patch } = row;
    if (duration_seconds!=null) patch.duration_seconds=(+duration_seconds||0)*60;
    if (id){ const { error } = await sb.from('lessons').update(patch).eq('id',id); if(error) throw error; }
    else { const { count } = await sb.from('lessons').select('*',{count:'exact',head:true}).eq('module_id',patch.module_id);
      patch.position=(count||0)+1; const { error } = await sb.from('lessons').insert(patch); if(error) throw error; }
  },
  async deleteLesson(id){
    if (DEMO){ LS.set('lessons',LS.get('lessons',[]).filter(l=>l.id!==id)); return; }
    const { error } = await sb.from('lessons').delete().eq('id',id); if(error) throw error;
  },
  async swapLessons(idA, posA, idB, posB){
    if (DEMO){ const ls=LS.get('lessons',[]); const a=ls.find(l=>l.id===idA),b=ls.find(l=>l.id===idB); if(a)a.position=posB; if(b)b.position=posA; LS.set('lessons',ls); return; }
    await sb.from('lessons').update({position:posB}).eq('id',idA);
    await sb.from('lessons').update({position:posA}).eq('id',idB);
  },
  async setEnrollment(uid, courseId, on){
    if (DEMO){ const list=LS.get('enrollments',[]); const i=list.findIndex(e=>e.s===uid&&e.c===courseId);
      if(on&&i===-1) list.push({s:uid,c:courseId}); if(!on&&i>-1) list.splice(i,1); LS.set('enrollments',list); return; }
    if (on){ const { error } = await sb.from('enrollments').upsert({student_id:uid,course_id:courseId},{onConflict:'student_id,course_id'}); if(error) throw error; }
    else { const { error } = await sb.from('enrollments').delete().eq('student_id',uid).eq('course_id',courseId); if(error) throw error; }
  },
  async setBlock(uid, blocked){
    if (DEMO){ const users=LS.get('users',{}); const k=Object.keys(users).find(k=>users[k].id===uid); if(k){users[k].blocked=blocked;LS.set('users',users);} return; }
    const { error } = await sb.from('profiles').update({blocked}).eq('id',uid); if(error) throw error;
  },
  async saveAnnouncement(row){
    if (DEMO){ const a=LS.get('announcements',[]); a.unshift({...row,id:'a-'+Date.now(),created_at:Date.now()}); LS.set('announcements',a); return; }
    const { error } = await sb.from('announcements').insert(row); if(error) throw error;
  },
  async deleteAnnouncement(id){
    if (DEMO){ LS.set('announcements',LS.get('announcements',[]).filter(a=>a.id!==id)); return; }
    const { error } = await sb.from('announcements').delete().eq('id',id); if(error) throw error;
  },
};

/* ---------- state / navigation ---------- */
const state = { user:null, route:'dashboard', catalog:[], modules:[], lessons:[], byId:{}, flat:[],
  progress:{}, bookmarks:new Set(), announcements:[], annNew:false,
  admin:{ students:[], courses:[], announcements:[], selCourse:null, modules:[], lessons:[] },
  currentCourseId:null, editingLesson:null, editingCourse:null, confirmFn:null, search:'', cat:'All', sort:'newest', studentSearch:'' };

async function go(route){
  state.route=route;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  const el=$('page-'+route); if(el) el.classList.add('on');
  renderNav();
  try{
    if (['dashboard','courses','bookmarks','announcements','profile'].includes(route)) await loadStudentData();
    if (route==='dashboard') renderDashboard();
    if (route==='courses') renderCourses();
    if (route==='course') await renderCourseDetail();
    if (route==='bookmarks') renderBookmarks();
    if (route==='announcements') renderAnnouncements();
    if (route==='profile') renderProfile();
    if (route==='admin-dash') await renderAdminDash();
    if (route==='admin-students') await renderAdminStudents();
    if (route==='admin-courses') await renderAdminCourses();
    if (route==='editor') await renderEditor();
    if (route==='admin-ann') await renderAdminAnn();
  }catch(e){ toast(e.message||'Could not load','error'); console.warn(e); }
  window.scrollTo(0,0);
}
function renderNav(){
  const items = state.user.is_admin
    ? [['admin-dash','Dashboard','i-home'],['admin-students','Students','i-users'],['admin-courses','Courses','i-book'],['admin-ann','Announcements','i-mega']]
    : [['dashboard','Dashboard','i-home'],['courses','My Courses','i-book'],['bookmarks','Bookmarks','i-star'],['announcements','Announcements','i-mega'],['profile','Profile','i-user']];
  $('navList').innerHTML = items.map(([r,l,ic])=>{
    const dot = (r==='announcements'&&state.annNew)?'<span class="nav-dot"></span>':'';
    return `<button class="nav-item ${state.route===r?'on':''}" data-route="${r}"><svg class="ic"><use href="#${ic}"/></svg>${l}${dot}</button>`;
  }).join('');
  $('navList').querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.route)));
}
function avatarHtml(u,size){ return u.photo_url?`<img src="${esc(u.photo_url)}" alt="">`:esc((u.name||'?').trim().charAt(0).toUpperCase()); }

/* ---------- student data / rendering ---------- */
async function loadStudentData(){
  const d = await api.studentData(state.user.id);
  state.catalog=d.catalog; state.modules=d.modules; state.lessons=d.lessons;
  state.progress=d.progress; state.bookmarks=new Set(d.bookmarks); state.notes=d.notes; state.announcements=d.announcements;
  state.byId={}; state.lessons.forEach(l=>state.byId[l.id]=l);
  const mods=d.modules.slice().sort((a,b)=>a.position-b.position);
  state.flat=mods.flatMap(m=>d.lessons.filter(l=>l.module_id===m.id).sort((a,b)=>a.position-b.position));
  state.annNew=state.announcements.some(a=>Date.now()-new Date(a.created_at)<7*DAY);
  $('sideAvatar').innerHTML=avatarHtml(state.user);
  $('sideName').textContent=state.user.name||'Student';
  $('sidePhone').textContent=maskedPhone(state.user.phone);
}
function myEnrolled(){ return state.catalog.filter(c=>c.enrolled); }
function overallStats(){
  const en=myEnrolled(); let total=0,done=0,watch=0;
  state.lessons.forEach(l=>{ const p=state.progress[l.id]; if(p){ if(p.done)done++; watch+=p.pos||0; } total++; });
  const coursesDone=0; // per-course rollup handled in render
  return { courses:en.length, total, done, watch };
}
function continueTarget(){
  let best=null;
  for(const l of state.flat){ const p=state.progress[l.id]; if(p&&!p.done&&(p.pos||0)>5&&(!best||(p.at||0)>(state.progress[best.id].at||0))) best=l; }
  if (best) return best;
  return state.flat.find(l=>!(state.progress[l.id]&&state.progress[l.id].done))||null;
}
function renderDashboard(){
  const el=$('page-dashboard'), s=overallStats();
  const ct=continueTarget(), feat=state.catalog.filter(c=>c.is_featured&&!isExpired(c)).slice(0,3);
  const en=myEnrolled();
  const pct=s.total?Math.round(s.done/s.total*100):0;
  const head = state.user.is_admin?'':'';
  el.innerHTML = `
  <div class="page-head"><div><p class="mono-eyebrow">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p>
    <h2>Welcome back, ${esc((state.user.name||'Student').split(' ')[0])}</h2></div></div>
  <div class="stat-grid">
    <div class="stat-card"><span class="num">${en.length}</span><p class="mono-eyebrow">Enrolled courses</p></div>
    <div class="stat-card"><span class="num">${state.catalog.length}</span><p class="mono-eyebrow">Courses in library</p></div>
    <div class="stat-card hot"><span class="num">${pct}%</span><p class="mono-eyebrow">Overall progress</p></div>
    <div class="stat-card"><span class="num">${s.done}/${s.total}</span><p class="mono-eyebrow">Lessons completed</p></div>
  </div>
  ${!en.length ? `<div class="empty-panel"><svg class="ic"><use href="#i-lock"/></svg><h3>No enrollment yet</h3>
    <p>Your account is active, but no course has been assigned. Browse the library below — the admin can enroll you in any course.</p>
    <button class="btn btn-primary" style="margin-top:18px" data-go="courses">Browse courses</button></div>`
  : `<div class="hero-row">
      ${ct?`<div class="continue-card">
        <p class="mono-eyebrow" style="color:var(--red-hi)">Continue learning</p>
        <div><h3>${esc(ct.title)}</h3><p class="continue-sub">${esc(courseTitle(ct.course_id))} · ${ct.done?'Completed — replay':'Resume at '+fmt(state.progress[ct.id].pos||0)}</p></div>
        <div class="bar"><span style="width:${lessonPct(ct)}%"></span></div>
        <button class="btn btn-primary btn-lg" data-lesson="${ct.id}"><svg class="ic"><use href="#i-play"/></svg> ${state.progress[ct.id]&&state.progress[ct.id].pos>5&&!state.progress[ct.id].done?'Resume lesson':'Start lesson'}</button>
      </div>`
      :`<div class="continue-card"><p class="mono-eyebrow">All caught up</p><h3>You\u2019ve finished every session 🎉</h3><button class="btn btn-ghost" data-go="courses" style="align-self:flex-start">Browse courses</button></div>`}
      <div class="mini-stats">
        <div class="mini-stat"><span class="num">${fmtDur(s.watch)}</span><p class="mono-eyebrow">Watch time</p></div>
        <div class="mini-stat"><span class="num">${state.bookmarks.size}</span><p class="mono-eyebrow">Bookmarks</p></div>
        <div class="mini-stat" style="grid-column:1/-1"><p class="mono-eyebrow" style="margin-bottom:6px">Recently watched</p>
          ${ct?`<span class="student-name">${esc(ct.title)}</span><p class="continue-sub">${timeAgo(state.progress[ct.id].at)}</p>`:'<p class="continue-sub">Nothing yet</p>'}</div>
      </div>
    </div>`}
  ${feat.length?`<div class="panel-head" style="margin-bottom:12px"><h3 class="panel-title">Featured</h3></div>
    <div class="course-grid" style="margin-bottom:28px">${feat.map(courseCardHtml).join('')}</div>`:''}
  ${state.announcements.length?`<div class="panel-head" style="margin-bottom:12px"><h3 class="panel-title">Announcements</h3><button class="textbtn" data-go="announcements">View all</button></div>
    ${state.announcements.slice(0,3).map(annHtml).join('')}`:''}`;
  wireStudentCommon(el);
}
function courseTitle(id){ const c=state.catalog.find(c=>c.id===id); return c?c.title:''; }
function lessonPct(l){ const p=state.progress[l.id]; if(!p) return 0; if(p.done) return 100; if(p.dur) return Math.min(100,Math.round((p.pos||0)/p.dur*100)); return p.pos>5?15:0; }
function courseCardHtml(c){
  const st=state.lessons.filter(l=>l.course_id===c.id), done=st.filter(l=>state.progress[l.id]&&state.progress[l.id].done).length;
  const pct=st.length?Math.round(done/st.length*100):0;
  return `<button class="course-card" data-course="${c.id}">
    <span class="cc-thumb">${thumbHtml(c.thumbnail_url)}<span class="tag">${esc(c.category||'Course')}</span>
      ${c.is_featured?'<span class="cc-feat"><svg class="ic"><use href="#i-star-fill"/></svg>Featured</span>':''}</span>
    <span class="cc-body"><span class="cc-title">${esc(c.title)}</span>
      <span class="cc-meta">${c.enrolled?`${st.length} lessons · ${fmtDur(c.mins)}`:'Enrolled students only'}</span>
      ${isExpired(c)?'<span class="expire-tag">Access expired</span>':c.enrolled
        ?`<span class="cc-foot"><span class="bar"><span style="width:${pct}%"></span></span><span class="pct">${pct}%</span></span>`
        :'<span class="tag">Not enrolled</span>'}
    </span></button>`;
}
function annHtml(a){
  const tag = a.audience==='all'?'All':a.audience==='course'?courseTitle(a.course_id)||'Course':'Direct';
  const fresh = Date.now()-new Date(a.created_at)<7*DAY;
  return `<div class="ann-card"><div class="ann-top"><h4>${esc(a.title)}</h4><span class="tag ${fresh?'red':''}">${esc(tag)}</span><span class="mono-eyebrow">${timeAgo(a.created_at)}</span></div><p class="ann-body">${esc(a.body)}</p></div>`;
}
function wireStudentCommon(el){
  el.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  el.querySelectorAll('[data-course]').forEach(b=>b.addEventListener('click',()=>{ state.currentCourseId=b.dataset.course; go('course'); }));
  el.querySelectorAll('[data-lesson]').forEach(b=>b.addEventListener('click',()=>openLesson(b.dataset.lesson)));
}
function renderCourses(){
  const el=$('page-courses');
  const cats=['All',...new Set(state.catalog.map(c=>c.category||'General'))];
  let list=state.catalog.filter(c=>(state.cat==='All'||(c.category||'General')===state.cat)
    && c.title.toLowerCase().includes(state.search.toLowerCase()));
  if (state.sort==='newest') list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if (state.sort==='popular') list.sort((a,b)=>(b.students||0)-(a.students||0));
  if (state.sort==='az') list.sort((a,b)=>a.title.localeCompare(b.title));
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Library</p><h2>My Courses</h2></div></div>
  <div class="filters">
    <span class="search-box"><svg class="ic"><use href="#i-search"/></svg><input class="input" id="courseSearch" placeholder="Search courses…" value="${esc(state.search)}"></span>
    <div class="chip-row">${cats.map(c=>`<button class="chip ${state.cat===c?'on':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <select class="input sort-select" id="sortSel">
      <option value="newest" ${state.sort==='newest'?'selected':''}>Newest</option>
      <option value="popular" ${state.sort==='popular'?'selected':''}>Most popular</option>
      <option value="az" ${state.sort==='az'?'selected':''}>A – Z</option>
    </select>
  </div>
  ${list.length?`<div class="course-grid">${list.map(courseCardHtml).join('')}</div>`:'<p class="list-empty">No courses match your search.</p>'}`;
  $('courseSearch').addEventListener('input',e=>{ state.search=e.target.value;
    clearTimeout(state._st); state._st=setTimeout(renderCourses,200); });
  el.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{ state.cat=b.dataset.cat; renderCourses(); }));
  $('sortSel').addEventListener('change',e=>{ state.sort=e.target.value; renderCourses(); });
  wireStudentCommon(el);
}
async function renderCourseDetail(){
  const el=$('page-course'), cid=state.currentCourseId;
  const c=state.catalog.find(x=>x.id===cid);
  if(!c){ el.innerHTML='<div class="empty-panel"><h3>Course not found</h3></div>'; return; }
  const expired=isExpired(c);
  const mods=state.modules.filter(m=>m.course_id===cid).sort((a,b)=>a.position-b.position);
  const cls=state.lessons.filter(l=>l.course_id===cid);
  const done=cls.filter(l=>state.progress[l.id]&&state.progress[l.id].done).length;
  const pct=cls.length?Math.round(done/cls.length*100):0;
  let prevDone=true;
  const moduleHtml=mods.map((m,mi)=>{
    const rows=m.lessons=m.lessons||cls.filter(l=>l.module_id===m.id).sort((a,b)=>a.position-b.position);
    const mins=rows.reduce((a,l)=>a+(l.duration_seconds||0),0);
    return `<div class="module-block">
      <div class="module-head"><span class="mono-eyebrow">MODULE ${pad(mi+1)}</span><h3>${esc(m.title)}</h3>
        <span class="mono-eyebrow">${rows.length} lessons · ${fmtDur(mins)}</span></div>
      ${rows.map(l=>{
        const locked=c.enrolled&&!expired&&l.lock_prev&&!prevDone;
        prevDone=!!(state.progress[l.id]&&state.progress[l.id].done);
        const p=state.progress[l.id]||{}, status=p.done?'Completed ✓':(p.pos||0)>20?'Resume · '+fmt(p.pos):'Not started';
        return `<button class="lesson-row ${p.done?'done':''}" data-lesson="${l.id}" ${(!c.enrolled||expired||locked)?'disabled':''}>
          <span class="lesson-idx mono-eyebrow">${pad(cls.indexOf(l)+1)}</span>
          <span class="lesson-thumb">${thumbHtml(l.thumbnail_url)}${(!locked&&c.enrolled&&!expired)?`<span class="thumb-play"><svg class="ic"><use href="#i-play"/></svg></span>`:''}</span>
          <span class="lesson-info"><span class="lesson-title">${esc(l.title)}</span>
            <span class="lesson-status mono-eyebrow">${!c.enrolled?'Enroll to watch':expired?'Access expired':locked?'Complete the previous lesson to unlock':status+' · '+fmt(l.duration_seconds||0)}</span></span>
          <span class="lesson-tools">
            <button class="star-btn ${state.bookmarks.has(l.id)?'on':''}" data-bm="${l.id}" title="Bookmark"><svg class="ic"><use href="#${state.bookmarks.has(l.id)?'i-star-fill':'i-star'}"/></svg></button>
            ${p.done?'<svg class="ic" style="color:var(--red-hi)"><use href="#i-check"/></svg>':locked?'<svg class="ic"><use href="#i-lock"/></svg>':''}</span>
          <span class="lesson-bar" style="width:${lessonPct(l)}%"></span></button>`;
      }).join('')}</div>`;
  }).join('');
  el.innerHTML=`<button class="crumb" data-go="courses"><svg class="ic" style="width:14px;height:14px"><use href="#i-back"/></svg> All courses</button>
  <div class="course-hero">
    ${thumbHtml(c.thumbnail_url)}
    <div><span class="tag ${c.enrolled?'red':''}">${esc(c.category||'Course')}</span>
      <h2>${esc(c.title)}</h2><p class="desc">${esc(c.description||'')}</p>
      <p class="cc-meta" style="margin-top:8px">${mods.length} modules · ${cls.length} published lessons · ${fmtDur(cls.reduce((a,l)=>a+(l.duration_seconds||0),0))}
      ${c.expires_at?` · access until ${new Date(c.expires_at).toLocaleDateString()}`:''}</p></div>
    ${c.enrolled?`<div class="hero-progress"><span class="pct">${pct}%</span><div class="bar"><span style="width:${pct}%"></span></div><span class="mono-eyebrow">${done} of ${cls.length} completed</span></div>`:''}
  </div>
  ${!c.enrolled?`<div class="banner"><svg class="ic"><use href="#i-lock"/></svg>You\u2019re not enrolled in this course yet. Contact the Typixel admin to get access.</div>`:''}
  ${expired?`<div class="banner"><svg class="ic"><use href="#i-lock"/></svg>Your access to this course expired on ${new Date(c.expires_at).toLocaleDateString()}.</div>`:''}
  ${moduleHtml||'<p class="list-empty">No lessons published yet.</p>'}`;
  wireStudentCommon(el);
  el.querySelectorAll('[data-bm]').forEach(b=>b.addEventListener('click',async e=>{
    e.stopPropagation(); const on=await api.toggleBookmark(state.user.id,b.dataset.bm);
    on?state.bookmarks.add(b.dataset.bm):state.bookmarks.delete(b.dataset.bm);
    renderCourseDetail(); toast(on?'Bookmarked':'Bookmark removed');
  }));
}
function renderBookmarks(){
  const el=$('page-bookmarks');
  const rows=state.flat.filter(l=>state.bookmarks.has(l.id));
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Saved</p><h2>My Bookmarks</h2></div></div>
  ${rows.length?rows.map(l=>{
    const p=state.progress[l.id]||{};
    return `<button class="lesson-row" data-lesson="${l.id}">
      <span class="lesson-idx mono-eyebrow"><svg class="ic" style="width:15px;height:15px;color:var(--red-hi)"><use href="#i-star-fill"/></svg></span>
      <span class="lesson-thumb">${thumbHtml(l.thumbnail_url)}</span>
      <span class="lesson-info"><span class="bm-course">${esc(courseTitle(l.course_id))}</span>
        <span class="lesson-title">${esc(l.title)}</span>
        <span class="lesson-status mono-eyebrow">${p.done?'Completed ✓':(p.pos||0)>5?'Resume · '+fmt(p.pos):fmt(l.duration_seconds||0)}</span></span>
      <span class="lesson-tools"><span class="thumb-play"><svg class="ic"><use href="#i-play"/></svg></span></span>
      <span class="lesson-bar" style="width:${lessonPct(l)}%"></span></button>`;
  }).join(''):'<p class="list-empty">No bookmarks yet — tap the star on any lesson to save it here.</p>'}`;
  wireStudentCommon(el);
}
function renderAnnouncements(){
  const el=$('page-announcements');
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Updates</p><h2>Announcements</h2></div></div>
  ${state.announcements.length?state.announcements.map(annHtml).join(''):'<p class="list-empty">No announcements yet.</p>'}`;
}
async function renderProfile(){
  const el=$('page-profile'), s=overallStats();
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Account</p><h2>Profile</h2></div></div>
  <div class="profile-grid">
    <div class="card">
      <div class="avatar-edit"><span class="user-avatar">${avatarHtml(state.user)}</span>
        <div><h3 style="font:600 18px var(--fd)">${esc(state.user.name||'')}</h3><p class="mono-eyebrow">${maskedPhone(state.user.phone)}</p></div></div>
      <form id="profileForm" novalidate>
        <label class="field-label mono-eyebrow" for="pfName">Full name</label>
        <input id="pfName" class="input" value="${esc(state.user.name||'')}">
        <label class="field-label mono-eyebrow" for="pfPhoto">Profile photo URL</label>
        <input id="pfPhoto" class="input" type="url" value="${esc(state.user.photo_url||'')}" placeholder="https://…/me.jpg">
        <button class="btn btn-primary" id="pfSave" type="submit">Save profile</button>
      </form>
    </div>
    <div class="card">
      <h3 style="font:600 18px var(--fd);margin-bottom:16px">Change password</h3>
      <form id="passForm" novalidate>
        <label class="field-label mono-eyebrow" for="pfOld">Current password</label>
        <input id="pfOld" class="input" type="password" autocomplete="current-password">
        <label class="field-label mono-eyebrow" for="pfNew">New password (min 8)</label>
        <input id="pfNew" class="input" type="password" autocomplete="new-password">
        <button class="btn btn-ghost" id="pfPassBtn" type="submit">Update password</button>
      </form>
      <h3 style="font:600 18px var(--fd);margin:24px 0 12px">Learning statistics</h3>
      <div class="stat-grid" style="margin:0;grid-template-columns:1fr 1fr">
        <div class="stat-card"><span class="num">${fmtDur(s.watch)}</span><p class="mono-eyebrow">Total watch time</p></div>
        <div class="stat-card"><span class="num">${s.done}</span><p class="mono-eyebrow">Lessons completed</p></div>
        <div class="stat-card"><span class="num">${s.courses}</span><p class="mono-eyebrow">Enrolled courses</p></div>
        <div class="stat-card"><span class="num">${state.bookmarks.size}</span><p class="mono-eyebrow">Bookmarks</p></div>
      </div>
    </div>
  </div>`;
  $('profileForm').addEventListener('submit',async e=>{ e.preventDefault();
    const btn=$('pfSave'); setBusy(btn,true,'Saving…');
    try{ const name=$('pfName').value.trim(), photo_url=$('pfPhoto').value.trim();
      await api.updateProfile(state.user.id,{full_name:name,photo_url});
      state.user.name=name; state.user.photo_url=photo_url;
      $('sideAvatar').innerHTML=avatarHtml(state.user); $('sideName').textContent=name;
      setWatermark(); toast('Profile updated'); }catch(err){ toast(err.message,'error'); }
    finally{ setBusy(btn,false); } });
  $('passForm').addEventListener('submit',async e=>{ e.preventDefault();
    const btn=$('pfPassBtn'); setBusy(btn,true,'Updating…');
    try{ const np=$('pfNew').value; if(np.length<8) throw new Error('New password must be at least 8 characters');
      await api.changePassword(state.user.phone,$('pfOld').value,np);
      $('pfOld').value='';$('pfNew').value=''; toast('Password updated'); }catch(err){ toast(err.message||'Failed','error'); }
    finally{ setBusy(btn,false); } });
}

/* ---------- player ---------- */
const SPEEDS=[0.5,0.75,1,1.25,1.5,2];
const fmtSpeed=s=>(s%1===0?String(+s):String(s))+'×';
const videoEl=$('video'), playerBox=$('playerBox');
function buildQualities(l){
  const q=[{key:'source',label:'Source',url:l.video_url}];
  [['video_url_1080','1080p'],['video_url_720','720p'],['video_url_480','480p'],['video_url_360','360p']]
    .forEach(([k,lab])=>{ if(l[k]) q.push({key:k,label:lab,url:l[k]}); });
  return q;
}
function openLesson(lessonId){
  const i=state.flat.findIndex(l=>l.id===lessonId); if(i<0) return;
  const l=state.flat[i], c=state.catalog.find(x=>x.id===l.course_id);
  if (isExpired(c)) return toast('Your access to this course has expired','error');
  if (l.lock_prev&&i>0&&!(state.progress[state.flat[i-1].id]&&state.progress[state.flat[i-1].id].done))
    return toast('Complete the previous lesson to unlock this one','error');
  loadIntoPlayer(i,true);
}
async function loadIntoPlayer(i, navigate){
  const l=state.flat[i]; if(!l) return;
  await saveCurrentProgress();
  state.switching=true;
  Object.assign(state,{ pIdx:i, qualities:buildQualities(l), quality:'source' });
  renderQualityPop(); $('btnQuality').textContent=state.qualities[0].label;
  const p=state.progress[l.id];
  state.resumeTo=p&&!p.done&&(p.pos||0)>8?p.pos:0; state.pendingSeek=null;
  videoEl.src=state.qualities[0].url; videoEl.load();
  $('metaCrumb').textContent=`Session ${pad(i+1)} of ${pad(state.flat.length)}`;
  $('playerCrumb').textContent=`${courseTitle(l.course_id)} · ${pad(i+1)} / ${pad(state.flat.length)}`;
  $('lessonTitle').textContent=l.title; $('lessonDesc').textContent=l.description||'';
  $('bmUse').setAttribute('href',state.bookmarks.has(l.id)?'#i-star-fill':'#i-star');
  $('navPrev').disabled=i===0; $('navNext').disabled=i===state.flat.length-1;
  document.title=l.title+' — Typixel Learn';
  renderPlaylist();
  api.getNote(state.user.id,l.id).then(t=>{ $('noteBox').value=t; });
  if (navigate){ switchView('player'); showControls(); }
}
function renderPlaylist(){
  $('playlistList').innerHTML=state.flat.map((l,i)=>{
    const done=state.progress[l.id]&&state.progress[l.id].done;
    const locked=l.lock_prev&&i>0&&!(state.progress[state.flat[i-1].id]&&state.progress[state.flat[i-1].id].done);
    return `<button class="pl-item ${i===state.pIdx?'current':''}" data-i="${i}">
      <span class="pl-num mono-eyebrow">${pad(i+1)}</span><span class="pl-title">${esc(l.title)}</span>
      ${done?'<svg class="ic pl-check"><use href="#i-check"/></svg>':locked?'<svg class="ic pl-lock"><use href="#i-lock"/></svg>':''}</button>`;
  }).join('');
}
function renderSpeedPop(){ $('speedPop').innerHTML=SPEEDS.map(s=>`<button class="pop-item ${s===state.speed?'on':''}" data-s="${s}"><span>${fmtSpeed(s)}</span><svg class="ic"><use href="#i-check"/></svg></button>`).join(''); }
function renderQualityPop(){ $('qualityPop').innerHTML=state.qualities.map(q=>`<button class="pop-item ${q.key===state.quality?'on':''}" data-q="${q.key}"><span>${q.label}</span><svg class="ic"><use href="#i-check"/></svg></button>`).join(''); }
async function saveCurrentProgress(force){
  const l=state.flat[state.pIdx]; if(!l||!state.user||state.user.is_admin) return;
  const c=videoEl.currentTime||0, d=videoEl.duration||0, prev=state.progress[l.id]||{};
  const completed=force===true||(d>0&&c>=d-8)||!!prev.done;
  if (!c&&!completed) return;
  state.progress[l.id]={pos:c,done:completed,dur:d||prev.dur||0,at:Date.now()};
  await api.saveProgress(state.user.id,l.id,c,completed,state.progress[l.id].dur).catch(()=>{});
}
function togglePlay(){ if(!videoEl.src) return; videoEl.paused?videoEl.play().catch(()=>{}):videoEl.pause(); }
function setQuality(key,force){
  const q=state.qualities.find(x=>x.key===key); if(!q||(!force&&q.key===state.quality)) return;
  state.quality=key; $('btnQuality').textContent=q.label; renderQualityPop(); closePops();
  state.pendingSeek=videoEl.currentTime||null;
  state.resumeAfter=!videoEl.paused&&videoEl.readyState>2; state.switching=true;
  videoEl.src=q.url; videoEl.load();
}
function toggleFullscreen(){ document.fullscreenElement?document.exitFullscreen():(playerBox.requestFullscreen?playerBox.requestFullscreen():videoEl.webkitEnterFullscreen&&videoEl.webkitEnterFullscreen()); }
async function togglePip(){ try{ document.pictureInPictureElement?await document.exitPictureInPicture():await videoEl.requestPictureInPicture(); }catch(e){ toast('Picture-in-picture isn\u2019t available here','error'); } }
function goPrev(){ state.pIdx>0?loadIntoPlayer(state.pIdx-1,true):toast('This is the first session'); }
function goNext(){ state.pIdx<state.flat.length-1?loadIntoPlayer(state.pIdx+1,true):toast('This is the last session'); }
let hideTimer=null,seeking=false;
function showControls(){ playerBox.classList.add('ctrl-on'); clearTimeout(hideTimer);
  hideTimer=setTimeout(()=>{ if(!videoEl.paused&&!document.querySelector('.pop-wrap.open')&&!seeking) playerBox.classList.remove('ctrl-on'); },2600); }
function flash(icon){ $('playerFlash').querySelector('use').setAttribute('href','#'+icon);
  const f=$('playerFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function updateVolUI(){ const v=videoEl.muted?0:videoEl.volume;
  $('muteUse').setAttribute('href',v===0?'#i-mute':'#i-vol'); $('volSlider').value=v;
  const p=v*100+'%'; $('volSlider').style.background=`linear-gradient(to right,#fff ${p},rgba(255,255,255,.25) ${p})`; }
function switchView(name){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $('view-'+name).classList.add('active'); closePops(); window.scrollTo(0,0); }
function wirePlayer(){
  videoEl.addEventListener('loadedmetadata',()=>{ $('playerSpinner').classList.remove('show');
    const d=videoEl.duration;
    if (state.pendingSeek!=null){ videoEl.currentTime=state.pendingSeek; state.pendingSeek=null; }
    else if (state.resumeTo){ if(d&&state.resumeTo<d-12){ videoEl.currentTime=state.resumeTo; toast('Resumed at '+fmt(state.resumeTo)); } state.resumeTo=0; }
    videoEl.playbackRate=state.speed;
    if (state.resumeAfter){ videoEl.play().catch(()=>{}); state.resumeAfter=false; }
    // auto-learn duration if admin didn't set one
    const l=state.flat[state.pIdx];
    if (l&&d&&Math.abs((l.duration_seconds||0)-d)>1){ l.duration_seconds=d; api.saveLesson({id:l.id,duration_seconds:d/60}).catch(()=>{}); }
    state.switching=false; $('timeLabel').textContent=fmt(videoEl.currentTime)+' / '+fmt(d);
  });
  let lastSave=0;
  videoEl.addEventListener('timeupdate',()=>{ const d=videoEl.duration||0,c=videoEl.currentTime;
    if(!seeking) $('seekFill').style.width=d?(c/d*100)+'%':'0%';
    $('timeLabel').textContent=fmt(c)+' / '+fmt(d);
    if(d&&Math.abs(c-lastSave)>5){ lastSave=c; saveCurrentProgress(); } });
  videoEl.addEventListener('progress',()=>{ try{ if(videoEl.buffered.length&&videoEl.duration){
    $('seekBuffer').style.width=(videoEl.buffered.end(videoEl.buffered.length-1)/videoEl.duration*100)+'%'; } }catch(e){} });
  videoEl.addEventListener('play',()=>{ playerBox.classList.remove('paused'); $('playUse').setAttribute('href','#i-pause'); flash('i-pause'); showControls(); });
  videoEl.addEventListener('pause',()=>{ playerBox.classList.add('paused'); $('playUse').setAttribute('href','#i-play'); flash('i-play'); showControls(); clearTimeout(hideTimer); if(!state.switching) saveCurrentProgress(); });
  videoEl.addEventListener('ended',()=>{ playerBox.classList.add('paused');
    saveCurrentProgress(true).then(()=>{ const nx=state.flat[state.pIdx+1];
      if(nx){ toast('Session complete — next: '+nx.title); setTimeout(()=>loadIntoPlayer(state.pIdx+1,true),1400); }
      else toast('Session complete — course finished!'); }); });
  videoEl.addEventListener('waiting',()=>$('playerSpinner').classList.add('show'));
  ['playing','canplay'].forEach(ev=>videoEl.addEventListener(ev,()=>$('playerSpinner').classList.remove('show')));
  videoEl.addEventListener('volumechange',updateVolUI);
  videoEl.addEventListener('error',()=>{ $('playerSpinner').classList.remove('show'); state.switching=false;
    if(state.qualities.length>1&&state.quality!=='source'){ toast('That quality failed — back to source','error'); setQuality('source',true); }
    else if($('view-player').classList.contains('active')) toast('This video could not be loaded','error'); });
  let clickTimer=null;
  videoEl.addEventListener('click',()=>{ if(clickTimer){ clearTimeout(clickTimer); clickTimer=null; toggleFullscreen(); }
    else clickTimer=setTimeout(()=>{ clickTimer=null; togglePlay(); },230); });
  playerBox.addEventListener('contextmenu',e=>e.preventDefault());
  playerBox.addEventListener('mousemove',showControls);
  playerBox.addEventListener('touchstart',showControls,{passive:true});
  playerBox.addEventListener('mouseleave',()=>{ if(!videoEl.paused) playerBox.classList.remove('ctrl-on'); });
  const seek=$('seekBar');
  const seekPct=e=>{ const r=seek.getBoundingClientRect(); return r.width?Math.min(Math.max((e.clientX-r.left)/r.width,0),1):0; };
  seek.addEventListener('pointerdown',e=>{ if(!videoEl.duration) return; e.preventDefault();
    try{seek.setPointerCapture(e.pointerId);}catch(err){} seeking=true; seek.classList.add('hovering');
    const p=seekPct(e); videoEl.currentTime=p*videoEl.duration; $('seekFill').style.width=p*100+'%'; });
  seek.addEventListener('pointermove',e=>{ const p=seekPct(e);
    $('seekTip').style.left=p*100+'%'; $('seekTip').textContent=fmt(p*(videoEl.duration||0)); seek.classList.add('hovering');
    if(seeking&&videoEl.duration){ videoEl.currentTime=p*videoEl.duration; $('seekFill').style.width=p*100+'%'; } });
  seek.addEventListener('pointerleave',()=>{ if(!seeking) seek.classList.remove('hovering'); });
  seek.addEventListener('pointerup',()=>{ seeking=false; seek.classList.remove('hovering'); showControls(); });
  $('btnPlay').addEventListener('click',togglePlay);
  $('btnPrev').addEventListener('click',goPrev); $('btnNext').addEventListener('click',goNext);
  $('navPrev').addEventListener('click',goPrev); $('navNext').addEventListener('click',goNext);
  $('btnMute').addEventListener('click',()=>{ videoEl.muted=!videoEl.muted; });
  $('volSlider').addEventListener('input',e=>{ const v=parseFloat(e.target.value); videoEl.muted=v===0; videoEl.volume=v; });
  $('btnFull').addEventListener('click',toggleFullscreen);
  $('btnPip').addEventListener('click',togglePip);
  document.addEventListener('fullscreenchange',()=>$('fullUse').setAttribute('href',document.fullscreenElement?'#i-compress':'#i-expand'));
  const togglePop=btn=>{ const w=btn.closest('.pop-wrap'),was=w.classList.contains('open'); closePops(); if(!was) w.classList.add('open'); };
  $('btnSpeed').addEventListener('click',e=>{ e.stopPropagation(); togglePop(e.currentTarget); });
  $('btnQuality').addEventListener('click',e=>{ e.stopPropagation(); togglePop(e.currentTarget); });
  $('speedPop').addEventListener('click',e=>{ const b=e.target.closest('[data-s]'); if(!b) return;
    state.speed=parseFloat(b.dataset.s); videoEl.playbackRate=state.speed; $('btnSpeed').textContent=fmtSpeed(state.speed); renderSpeedPop(); closePops(); });
  $('qualityPop').addEventListener('click',e=>{ const b=e.target.closest('[data-q]'); if(b) setQuality(b.dataset.q); });
  document.addEventListener('click',e=>{ if(!e.target.closest('.pop-wrap')) closePops(); });
  renderSpeedPop();
  $('playlistList').addEventListener('click',e=>{ const b=e.target.closest('.pl-item'); if(b) loadIntoPlayer(+b.dataset.i,true); });
  $('bmStar').addEventListener('click',async()=>{ const l=state.flat[state.pIdx]; if(!l) return;
    const on=await api.toggleBookmark(state.user.id,l.id);
    on?state.bookmarks.add(l.id):state.bookmarks.delete(l.id);
    $('bmUse').setAttribute('href',on?'#i-star-fill':'#i-star'); toast(on?'Bookmarked':'Bookmark removed'); });
  let noteTimer=null;
  $('noteBox').addEventListener('input',()=>{ clearTimeout(noteTimer);
    noteTimer=setTimeout(()=>{ const l=state.flat[state.pIdx];
      if(l){ api.saveNote(state.user.id,l.id,$('noteBox').value).then(()=>toast('Note saved')); } },800); });
  $('playerBack').addEventListener('click',async()=>{ await saveCurrentProgress(); switchView('app'); go(state.currentCourseId?'course':'dashboard'); });
  const corners=['wm-tr','wm-br','wm-bl','wm-tl']; let wi=0;
  setInterval(()=>{ if(!$('view-player').classList.contains('active')) return; wi=(wi+1)%4; $('watermark').className='wm '+corners[wi]; },18000);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ closePops(); return; }
    if(!$('view-player').classList.contains('active')) return;
    if(e.target.closest('input,textarea,select')) return;
    switch(e.key){
      case ' ': if(e.target.closest('button')) return; e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': e.preventDefault(); if(videoEl.duration) videoEl.currentTime=Math.min(videoEl.duration,videoEl.currentTime+5); break;
      case 'ArrowLeft': e.preventDefault(); if(videoEl.duration) videoEl.currentTime=Math.max(0,videoEl.currentTime-5); break;
      case 'ArrowUp': e.preventDefault(); videoEl.muted=false; videoEl.volume=Math.min(1,videoEl.volume+.1); break;
      case 'ArrowDown': e.preventDefault(); videoEl.volume=Math.max(0,videoEl.volume-.1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'm': case 'M': videoEl.muted=!videoEl.muted; break;
    }});
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&$('view-player').classList.contains('active')) saveCurrentProgress(); });
  window.addEventListener('beforeunload',()=>{ if($('view-player').classList.contains('active')) saveCurrentProgress(); });
}
function closePops(){ document.querySelectorAll('.pop-wrap.open').forEach(w=>w.classList.remove('open')); }

/* ---------- admin rendering ---------- */
function computeOverview(students, courses){
  const real=students.filter(u=>!u.is_admin);
  const enrolled=real.filter(u=>u.enrolled.length);
  const total=enrolled.reduce((a,u)=>a+u.total,0), done=enrolled.reduce((a,u)=>a+u.done,0);
  const byCourse={}, byLesson={};
  students.forEach(u=>{ /* watch already aggregated per student; detail below needs lesson map — compute per course from watch share */ });
  return { students:real.length, active:real.filter(u=>u.last_active&&Date.now()-new Date(u.last_active)<7*DAY).length,
    courses:courses.filter(c=>c.is_published!==false).length, lessons:courses.reduce((a,c)=>a+c.lessons,0),
    enrollments:real.reduce((a,u)=>a+u.enrolled.length,0),
    completion:total?Math.round(done/total*100):0, blocked:real.filter(u=>u.blocked).length };
}
async function renderAdminDash(){
  const { students, courses } = state.admin._loaded&&state.admin._fresh?state.admin:await (async()=>{ const d=await api.adminData(); Object.assign(state.admin,d,{_fresh:true}); return state.admin; })();
  const o=computeOverview(students,courses);
  // most watched: recompute from raw progress
  let topC=[], topL=[];
  if (DEMO){
    const lessons=LS.get('lessons',[]);
    const wC={},wL={};
    Object.values(LS.get('users',{})).forEach(u=>{ const p=LS.get('progress_'+u.id,{});
      for(const lid in p){ const l=lessons.find(x=>x.id===lid); if(!l) continue;
        wL[lid]=(wL[lid]||0)+(p[lid].pos||0); wC[l.course_id]=(wC[l.course_id]||0)+(p[lid].pos||0); } });
    topC=Object.entries(wC).map(([id,sec])=>({title:(courses.find(c=>c.id===id)||{}).title||id,sec})).sort((a,b)=>b.sec-a.sec).slice(0,4);
    topL=Object.entries(wL).map(([id,sec])=>({title:(lessons.find(l=>l.id===id)||{}).title||id,sec})).sort((a,b)=>b.sec-a.sec).slice(0,4);
  }
  const el=$('page-admin-dash');
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Admin</p><h2>Dashboard</h2></div>
    <button class="btn btn-ghost" id="refreshAdmin"><svg class="ic"><use href="#i-up"/></svg> Refresh</button></div>
  <div class="stat-grid">
    <div class="stat-card"><span class="num">${o.students}</span><p class="mono-eyebrow">Students</p></div>
    <div class="stat-card hot"><span class="num">${o.active}</span><p class="mono-eyebrow">Active · 7 days</p></div>
    <div class="stat-card"><span class="num">${o.courses}</span><p class="mono-eyebrow">Courses</p></div>
    <div class="stat-card"><span class="num">${o.lessons}</span><p class="mono-eyebrow">Lessons</p></div>
    <div class="stat-card"><span class="num">${o.enrollments}</span><p class="mono-eyebrow">Enrollments</p></div>
    <div class="stat-card hot"><span class="num">${o.completion}%</span><p class="mono-eyebrow">Completion rate</p></div>
  </div>
  ${o.blocked?`<div class="banner"><svg class="ic"><use href="#i-lock"/></svg>${o.blocked} blocked account${o.blocked>1?'s':''} — manage them in Students.</div>`:''}
  <div class="profile-grid">
    <div class="card"><h3 style="font:600 17px var(--fd);margin-bottom:14px">Most watched courses</h3>
      <div class="top-list">${topC.length?topC.map(t=>{ const max=topC[0].sec||1;
        return `<div class="top-row"><span class="tl-name"><span>${esc(t.title)}</span><span>${fmtDur(t.sec)}</span></span><div class="bar"><span style="width:${Math.round(t.sec/max*100)}%"></span></div></div>`; }).join('')
        :'<p class="continue-sub">No watch data yet.</p>'}</div></div>
    <div class="card"><h3 style="font:600 17px var(--fd);margin-bottom:14px">Most watched lessons</h3>
      <div class="top-list">${topL.length?topL.map(t=>{ const max=topL[0].sec||1;
        return `<div class="top-row"><span class="tl-name"><span>${esc(t.title)}</span><span>${fmtDur(t.sec)}</span></span><div class="bar"><span style="width:${Math.round(t.sec/max*100)}%"></span></div></div>`; }).join('')
        :'<p class="continue-sub">No watch data yet.</p>'}</div></div>
  </div>`;
  $('refreshAdmin').addEventListener('click',()=>go('admin-dash'));
}
async function renderAdminStudents(){
  if(!state.admin._fresh){ Object.assign(state.admin,await api.adminData()); }
  const el=$('page-admin-students'), q=state.studentSearch.toLowerCase();
  const rows=state.admin.students.filter(u=>!q||u.name.toLowerCase().includes(q)||(u.phone||'').includes(q));
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Admin</p><h2>Students</h2>
    <p class="mono-eyebrow">${state.admin.students.length} users</p></div></div>
  <div class="filters"><span class="search-box"><svg class="ic"><use href="#i-search"/></svg>
    <input class="input" id="stSearch" placeholder="Search by name or phone…" value="${esc(state.studentSearch)}"></span></div>
  <div class="admin-list">${rows.map(u=>{
    const pct=u.total?Math.round(u.done/u.total*100):0;
    const badge=u.is_admin?'<span class="student-badge admin">Admin</span>'
      :u.blocked?'<span class="student-badge blocked">Blocked</span>'
      :u.enrolled.length?'<span class="student-badge enrolled">Enrolled</span>':'<span class="student-badge">Not enrolled</span>';
    return `<div class="student-row" data-id="${u.id}">
      <span class="student-avatar">${avatarHtml(u)}</span>
      <span class="student-info"><span class="student-name">${esc(u.name||'—')}</span><span class="student-phone">${esc(u.phone||'')}</span></span>
      ${badge}
      <span class="student-progress"><span class="bar"><span style="width:${pct}%"></span></span>${u.done}/${u.total}</span>
      <span class="row-actions">
        <button class="btn btn-ghost btn-sm" data-act="manage">Manage</button>
        ${u.is_admin?'':`<button class="btn btn-ghost btn-sm ${u.blocked?'':'danger'}" data-act="block">${u.blocked?'Unblock':'Block'}</button>`}
      </span></div>`;
  }).join('')||'<p class="list-empty">No users match.</p>'}</div>`;
  $('stSearch').addEventListener('input',e=>{ state.studentSearch=e.target.value; clearTimeout(state._st2); state._st2=setTimeout(renderAdminStudents,200); });
  el.querySelectorAll('[data-act="block"]').forEach(b=>b.addEventListener('click',async()=>{
    const row=b.closest('.student-row'); const u=state.admin.students.find(x=>x.id===row.dataset.id);
    try{ await api.setBlock(u.id,!u.blocked); u.blocked=!u.blocked; toast(u.blocked?'Account blocked':'Account unblocked'); renderAdminStudents(); }
    catch(e){ toast(e.message||'Failed','error'); } }));
  el.querySelectorAll('[data-act="manage"]').forEach(b=>b.addEventListener('click',()=>openStudentModal(b.closest('.student-row').dataset.id)));
}
function openStudentModal(uid){
  const u=state.admin.students.find(x=>x.id===uid); if(!u) return;
  $('studentModalTitle').textContent=u.name||u.phone;
  $('studentModalBody').innerHTML=`
    <div class="stat-block"><p>Phone · last active · watch time</p>
      <h4>${esc(u.phone||'—')}</h4><p>Last active ${timeAgo(u.last_active)} · ${fmtDur(u.watch)} watched · ${u.done}/${u.total} lessons completed</p></div>
    <h4 style="font:600 15px var(--fd);margin:16px 0 8px">Enrollment</h4>
    ${state.admin.courses.map(c=>{
      const on=u.enrolled.includes(c.id);
      // per-course progress (demo computes from raw progress)
      let done=0,total=0,last='—';
      if (DEMO){ const ls=demoPubLessons(c.id); total=ls.length;
        const p=LS.get('progress_'+u.id,{});
        ls.forEach(l=>{ if(p[l.id]&&p[l.id].done)done++; });
        const ats=ls.map(l=>p[l.id]&&p[l.id].at).filter(Boolean); if(ats.length) last=timeAgo(Math.max(...ats));
      } else { total=c.lessons; }
      return `<label class="check-line"><input type="checkbox" data-course="${c.id}" ${on?'checked':''}>
        <span style="flex:1">${esc(c.title)}</span><span class="mono-eyebrow">${done}/${total} · ${last}</span></label>`;
    }).join('')||'<p class="continue-sub">Create a course first.</p>'}
    <div class="modal-actions"><button class="btn btn-primary" id="stSave" type="button">Save enrollment</button></div>`;
  $('studentModal').hidden=false;
  $('stSave').addEventListener('click',async()=>{
    const btn=$('stSave'); setBusy(btn,true,'Saving…');
    try{
      for(const cb of $('studentModalBody').querySelectorAll('input[data-course]')){
        const on=cb.checked, was=u.enrolled.includes(cb.dataset.course);
        if(on!==was){ await api.setEnrollment(u.id,cb.dataset.course,on); }
      }
      toast('Enrollment updated'); $('studentModal').hidden=true;
      Object.assign(state.admin,{_fresh:false}); await renderAdminStudents();
    }catch(e){ toast(e.message||'Failed','error'); }
    finally{ setBusy(btn,false); }
  });
}
async function renderAdminCourses(){
  if(!state.admin._fresh){ Object.assign(state.admin,await api.adminData()); }
  const el=$('page-admin-courses');
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Admin</p><h2>Courses</h2>
    <p class="mono-eyebrow">${state.admin.courses.length} courses</p></div>
    <button class="btn btn-primary" id="newCourseBtn"><svg class="ic"><use href="#i-plus"/></svg> New course</button></div>
  <div class="admin-list">${state.admin.courses.map(c=>`
    <div class="admin-row" data-id="${c.id}">
      <div class="admin-thumb">${thumbHtml(c.thumbnail_url)}</div>
      <div class="admin-info">
        <span class="admin-title">${esc(c.title)}${c.is_published?'':'<span class="unpub-tag mono-eyebrow">Draft</span>'}${c.is_featured?'<span class="unpub-tag mono-eyebrow" style="color:var(--red-hi)">Featured</span>':''}${isExpired(c)?'<span class="unpub-tag mono-eyebrow">Expired</span>':''}</span>
        <span class="admin-url mono-eyebrow">${esc(c.category||'General')} · ${c.lessons} lessons · ${c.students} enrolled${c.expires_at?' · expires '+new Date(c.expires_at).toLocaleDateString():''}</span>
      </div>
      <label class="switch" title="Featured"><input type="checkbox" data-act="feat" ${c.is_featured?'checked':''}><span class="switch-track"></span></label>
      <label class="switch" title="Published"><input type="checkbox" data-act="pub" ${c.is_published?'checked':''}><span class="switch-track"></span></label>
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-act="manage">Lessons</button>
        <button class="btn btn-ghost btn-icon" data-act="edit" title="Edit"><svg class="ic"><use href="#i-edit"/></svg></button>
        <button class="btn btn-ghost btn-icon danger" data-act="delete" title="Delete"><svg class="ic"><use href="#i-trash"/></svg></button>
      </div></div>`).join('')||'<p class="list-empty">No courses yet — create your first one.</p>'}</div>`;
  $('newCourseBtn').addEventListener('click',()=>openCourseModal(null));
  el.querySelectorAll('.admin-row').forEach(row=>{
    const c=state.admin.courses.find(x=>x.id===row.dataset.id);
    row.querySelectorAll('button[data-act]').forEach(b=>b.addEventListener('click',()=>{
      const act=b.dataset.act;
      if(act==='edit') return openCourseModal(c);
      if(act==='manage'){ state.admin.selCourse=c.id; return go('editor'); }
      if(act==='delete') return askConfirm('Delete course?',`“${c.title}” and all its modules, lessons and enrollments will be removed permanently.`,'Delete',async()=>{
        await api.deleteCourse(c.id); Object.assign(state.admin,{_fresh:false}); await renderAdminCourses(); toast('Course deleted'); });
    }));
    row.querySelectorAll('input[data-act]').forEach(inp=>inp.addEventListener('change',async()=>{
      const patch=inp.dataset.act==='feat'?{is_featured:inp.checked}:{is_published:inp.checked};
      try{ await api.saveCourse({id:c.id,...patch}); Object.assign(c,patch); toast(patch.is_featured!=null?(c.is_featured?'Marked as featured':'Removed from featured'):(c.is_published?'Published':'Unpublished')); }
      catch(e){ inp.checked=!inp.checked; toast(e.message||'Failed','error'); } }));
  });
}
function openCourseModal(c){
  state.editingCourse=c||null;
  $('courseModalTitle').textContent=c?'Edit course':'New course';
  $('fCId').value=c?c.id:''; $('fCTitle').value=c?c.title:''; $('fCCategory').value=c?(c.category||''):'';
  $('fCDesc').value=c?(c.description||'):':''; $('fCThumb').value=c?(c.thumbnail_url||''):'';
  $('fCExpiry').value=c&&c.expires_at?new Date(c.expires_at).toISOString().slice(0,10):'';
  $('fCPublish').checked=c?!!c.is_published:true; $('fCFeatured').checked=c?!!c.is_featured:false;
  $('courseModal').hidden=false; setTimeout(()=>$('fCTitle').focus(),50);
}
async function renderEditor(){
  const el=$('page-editor'), cid=state.admin.selCourse;
  const c=state.admin.courses.find(x=>x.id===cid);
  if(!c){ el.innerHTML='<div class="empty-panel"><h3>Course not found</h3><button class="btn btn-ghost" data-go="admin-courses">Back to courses</button></div>'; wireAdminGo(el); return; }
  const [mods,lessons]=await Promise.all([api.adminModules(cid),api.adminLessons(cid)]);
  el.innerHTML=`<button class="crumb" id="backCourses"><svg class="ic" style="width:14px;height:14px"><use href="#i-back"/></svg> All courses</button>
  <div class="page-head"><div><p class="mono-eyebrow">${esc(c.category||'General')} · ${c.students} enrolled</p><h2>${esc(c.title)}</h2></div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost" id="editCourseBtn"><svg class="ic"><use href="#i-edit"/></svg> Edit course</button>
      <button class="btn btn-primary" id="addLessonBtn"><svg class="ic"><use href="#i-plus"/></svg> Add lesson</button></div></div>
  ${mods.map((m,mi)=>{
    const rows=lessons.filter(l=>l.module_id===m.id).sort((a,b)=>a.position-b.position);
    return `<div class="module-edit" data-module="${m.id}">
      <div class="module-edit-head"><h4>${pad(mi+1)} · ${esc(m.title)}</h4>
        <span class="mono-eyebrow">${rows.length} lessons</span>
        <button class="btn btn-ghost btn-sm" data-act="addHere"><svg class="ic"><use href="#i-plus"/></svg> Lesson</button>
        <button class="btn btn-ghost btn-icon danger" data-act="delModule" title="Delete module"><svg class="ic"><use href="#i-trash"/></svg></button></div>
      ${rows.map((l,i)=>`<div class="admin-row" data-id="${l.id}" style="margin-bottom:8px">
        <div class="row-order">
          <button class="obtn" data-act="up" ${i===0?'disabled':''}><svg class="ic"><use href="#i-up"/></svg></button>
          <button class="obtn" data-act="down" ${i===rows.length-1?'disabled':''}><svg class="ic"><use href="#i-down"/></svg></button></div>
        <span class="admin-pos mono-eyebrow">${pad(i+1)}</span>
        <div class="admin-thumb">${thumbHtml(l.thumbnail_url)}</div>
        <div class="admin-info"><span class="admin-title">${esc(l.title)}${l.is_published?'':'<span class="unpub-tag mono-eyebrow">Draft</span>'}${l.lock_prev?'<span class="unpub-tag mono-eyebrow">Locked</span>':''}</span>
          <span class="admin-url mono-eyebrow">${esc(l.video_url)}${l.duration_seconds?' · '+fmt(l.duration_seconds):''}</span></div>
        <label class="switch" title="Published"><input type="checkbox" data-act="pub" ${l.is_published?'checked':''}><span class="switch-track"></span></label>
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon" data-act="edit" title="Edit"><svg class="ic"><use href="#i-edit"/></svg></button>
          <button class="btn btn-ghost btn-icon danger" data-act="delete" title="Delete"><svg class="ic"><use href="#i-trash"/></svg></button></div>
      </div>`).join('')||'<p class="continue-sub" style="padding:6px 2px">No lessons in this module yet.</p>'}
    </div>`;
  }).join('')}
  <div class="module-add"><input class="input" id="newModuleName" placeholder="New module title"><button class="btn btn-primary" id="addModuleBtn">Add module</button></div>`;
  $('backCourses').addEventListener('click',()=>go('admin-courses'));
  $('editCourseBtn').addEventListener('click',()=>openCourseModal(c));
  $('addLessonBtn').addEventListener('click',()=>openLessonModal(mods[0]&&mods[0].id));
  $('addModuleBtn').addEventListener('click',async()=>{ const t=$('newModuleName').value.trim(); if(!t) return toast('Enter a module title','error');
    try{ await api.saveModule(cid,t); renderEditor(); toast('Module added'); }catch(e){ toast(e.message||'Failed','error'); } });
  el.querySelectorAll('.module-edit').forEach(mod=>{
    const mid=mod.dataset.module;
    mod.querySelector('[data-act="addHere"]').addEventListener('click',()=>openLessonModal(mid));
    mod.querySelector('[data-act="delModule"]').addEventListener('click',()=>askConfirm('Delete module?','Its lessons will be removed too.','Delete',async()=>{
      await api.deleteModule(mid); renderEditor(); toast('Module deleted'); }));
    mod.querySelectorAll('.admin-row').forEach(row=>{
      const l=lessons.find(x=>x.id===row.dataset.id);
      const rows=lessons.filter(x=>x.module_id===mid).sort((a,b)=>a.position-b.position);
      const i=rows.indexOf(l);
      row.querySelectorAll('button[data-act]').forEach(b=>b.addEventListener('click',async()=>{
        const act=b.dataset.act;
        if(act==='edit') return openLessonModal(mid,l);
        if(act==='delete') return askConfirm('Delete lesson?',`“${l.title}” will be removed permanently.`,'Delete',async()=>{
          await api.deleteLesson(l.id); renderEditor(); toast('Lesson deleted'); });
        if(act==='up'||act==='down'){
          const j=act==='up'?i-1:i+1; if(j<0||j>=rows.length) return;
          try{ await api.swapLessons(rows[i].id,rows[i].position,rows[j].id,rows[j].position); renderEditor(); }catch(e){ toast(e.message||'Failed','error'); }
        }
      }));
      row.querySelector('input[data-act="pub"]').addEventListener('change',async inp=>{
        try{ await api.saveLesson({id:l.id,is_published:inp.checked}); l.is_published=inp.checked; toast(inp.checked?'Lesson published':'Lesson unpublished'); }
        catch(e){ inp.checked=!inp.checked; toast(e.message||'Failed','error'); } });
    });
  });
}
function wireAdminGo(el){ el.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go))); }
async function renderAdminAnn(){
  if(!state.admin._fresh){ Object.assign(state.admin,await api.adminData()); }
  const el=$('page-admin-ann');
  el.innerHTML=`<div class="page-head"><div><p class="mono-eyebrow">Admin</p><h2>Announcements</h2></div>
    <button class="btn btn-primary" id="newAnnBtn"><svg class="ic"><use href="#i-plus"/></svg> New announcement</button></div>
  <div class="admin-list">${state.admin.announcements.map(a=>{
    const tag=a.audience==='all'?'All students':a.audience==='course'?('Course · '+((state.admin.courses.find(c=>c.id===a.course_id)||{}).title||'')):('Student · '+((state.admin.students.find(s=>s.id===a.student_id)||{}).name||''));
    return `<div class="ann-card"><div class="ann-top"><h4>${esc(a.title)}</h4><span class="tag red">${esc(tag)}</span>
      <span class="mono-eyebrow">${timeAgo(a.created_at)}</span>
      <button class="btn btn-ghost btn-icon danger" data-del="${a.id}" title="Delete"><svg class="ic"><use href="#i-trash"/></svg></button></div>
      <p class="ann-body">${esc(a.body)}</p></div>`;
  }).join('')||'<p class="list-empty">No announcements yet.</p>'}</div>`;
  $('newAnnBtn').addEventListener('click',()=>{
    $('announceModalTitle').textContent='New announcement';
    $('fAAudience').value='all'; $('fATargetWrap').hidden=true; $('fATitle').value=''; $('fABody').value='';
    $('announceModal').hidden=false;
  });
  el.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>askConfirm('Delete announcement?','Students will no longer see it.','Delete',async()=>{
    await api.deleteAnnouncement(b.dataset.del); renderAdminAnn(); toast('Announcement deleted'); })));
}
function askConfirm(title,text,okLabel,fn){
  $('confirmTitle').textContent=title; $('confirmText').textContent=text; $('confirmOk').textContent=okLabel;
  state.confirmFn=fn; $('confirmModal').hidden=false;
}

/* ---------- auth ---------- */
function setWatermark(){ const u=state.user||{};
  $('watermark').textContent=u.phone?`${(u.name||'Student').split(' ')[0]} · ${maskedPhone(u.phone)}`:(u.name||'Student'); }
async function enterApp(user){
  state.user=user; setWatermark();
  if (user.is_admin){ Object.assign(state.admin,{_fresh:false}); await go('admin-dash'); switchView('app'); return; }
  await go('dashboard'); switchView('app');
}
function wireAuth(){
  document.querySelectorAll('.auth-tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.auth-tab').forEach(x=>x.classList.toggle('active',x===t));
    $('pane-login').classList.toggle('active',t.dataset.tab==='login');
    $('pane-signup').classList.toggle('active',t.dataset.tab==='signup');
  }));
  $('loginForm').addEventListener('submit',async e=>{ e.preventDefault();
    const phone=normalizePhone($('loginPhone').value), pass=$('loginPass').value;
    if(!/^\+\d{8,15}$/.test(phone)) return toast('Enter a valid phone with country code','error');
    if(pass.length<6) return toast('Password must be at least 6 characters','error');
    const btn=$('loginBtn'); setBusy(btn,true,'Signing in…');
    try{ const u=await api.login(phone,pass); await enterApp(u); toast('Welcome back, '+(u.name||'student').split(' ')[0]); }
    catch(err){ toast(err.message||'Login failed','error'); } finally{ setBusy(btn,false); } });
  $('signupForm').addEventListener('submit',async e=>{ e.preventDefault();
    const name=$('suName').value.trim(), phone=normalizePhone($('suPhone').value), pass=$('suPass').value;
    if(!name) return toast('Please enter your name','error');
    if(!/^\+\d{8,15}$/.test(phone)) return toast('Enter a valid phone with country code','error');
    if(pass.length<8) return toast('Password must be at least 8 characters','error');
    const btn=$('signupBtn'); setBusy(btn,true,'Creating…');
    try{ const u=await api.signup(name,phone,pass); await enterApp(u);
      toast('Account created — the admin can now enroll you'); }catch(err){ toast(err.message||'Signup failed','error'); }
    finally{ setBusy(btn,false); } });
  document.querySelectorAll('.js-logout').forEach(b=>b.addEventListener('click',async()=>{
    await api.logout(); state.user=null; videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load();
    document.title='Typixel Learn — Online Courses'; switchView('auth'); toast('Signed out'); }));
}
function wireModals(){
  $('courseModalClose').addEventListener('click',()=>$('courseModal').hidden=true);
  $('courseModalCancel').addEventListener('click',()=>$('courseModal').hidden=true);
  $('courseForm').addEventListener('submit',async e=>{ e.preventDefault();
    const payload={ title:$('fCTitle').value.trim(), category:$('fCCategory').value.trim()||'General',
      description:$('fCDesc').value.trim(), thumbnail_url:$('fCThumb').value.trim(),
      expires_at:$('fCExpiry').value?new Date($('fCExpiry').value).toISOString():'',
      is_published:$('fCPublish').checked, is_featured:$('fCFeatured').checked };
    if(!payload.title) return toast('Course title is required','error');
    if(state.editingCourse) payload.id=state.editingCourse.id;
    const btn=$('courseSaveBtn'); setBusy(btn,true,'Saving…');
    try{ await api.saveCourse(payload); $('courseModal').hidden=true;
      Object.assign(state.admin,{_fresh:false}); toast('Course saved'); if(state.route==='admin-courses') renderAdminCourses(); }
    catch(err){ toast(err.message||'Save failed','error'); } finally{ setBusy(btn,false); } });

  $('lessonModalClose').addEventListener('click',()=>$('lessonModal').hidden=true);
  $('lessonModalCancel').addEventListener('click',()=>$('lessonModal').hidden=true);
  $('lessonForm').addEventListener('submit',async e=>{ e.preventDefault();
    const payload={ course_id:state.admin.selCourse, module_id:$('fLModule').value,
      title:$('fLTitle').value.trim(), description:$('fLDesc').value.trim(),
      video_url:$('fLVideo').value.trim(), video_url_1080:$('fL1080').value.trim(),
      video_url_720:$('fL720').value.trim(), video_url_480:$('fL480').value.trim(), video_url_360:$('fL360').value.trim(),
      thumbnail_url:$('fLThumb').value.trim(), duration_seconds:+$('fLDuration').value||0,
      is_published:$('fLPublish').checked, lock_prev:$('fLLock').checked };
    if(!payload.title||!payload.video_url) return toast('Title and video URL are required','error');
    if(state.editingLesson) payload.id=state.editingLesson.id;
    const btn=$('lessonSaveBtn'); setBusy(btn,true,'Saving…');
    try{ await api.saveLesson(payload); $('lessonModal').hidden=true; toast('Lesson saved'); renderEditor(); }
    catch(err){ toast(err.message||'Save failed','error'); } finally{ setBusy(btn,false); } });

  $('fAAudience').addEventListener('change',()=>{
    const aud=$('fAAudience').value, wrap=$('fATargetWrap'); wrap.hidden=aud==='all';
    if(aud!=='all'){ $('fATarget').innerHTML=(aud==='course'?state.admin.courses:state.admin.students.filter(s=>!s.is_admin))
      .map(t=>`<option value="${t.id}">${esc(t.title||t.name)}</option>`).join(''); } });
  $('announceModalClose').addEventListener('click',()=>$('announceModal').hidden=true);
  $('announceModalCancel').addEventListener('click',()=>$('announceModal').hidden=true);
  $('announceForm').addEventListener('submit',async e=>{ e.preventDefault();
    const aud=$('fAAudience').value;
    const payload={ audience:aud, course_id:aud==='course'?$('fATarget').value:'',
      student_id:aud==='student'?$('fATarget').value:'', title:$('fATitle').value.trim(), body:$('fABody').value.trim() };
    if(!payload.title||!payload.body) return toast('Title and message are required','error');
    const btn=$('announceSaveBtn'); setBusy(btn,true,'Sending…');
    try{ await api.saveAnnouncement(payload); $('announceModal').hidden=true; toast('Announcement sent'); renderAdminAnn(); }
    catch(err){ toast(err.message||'Failed','error'); } finally{ setBusy(btn,false); } });

  $('studentModalClose').addEventListener('click',()=>$('studentModal').hidden=true);
  $('confirmCancel').addEventListener('click',()=>{ $('confirmModal').hidden=true; state.confirmFn=null; });
  $('confirmOk').addEventListener('click',async()=>{ $('confirmModal').hidden=true;
    if(state.confirmFn){ try{ await state.confirmFn(); }catch(e){ toast(e.message||'Action failed','error'); } state.confirmFn=null; } });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape')
    ['courseModal','lessonModal','announceModal','studentModal','confirmModal'].forEach(id=>$(id).hidden=true); });
  [ 'courseModal','lessonModal','announceModal','studentModal' ].forEach(id=>$(id).addEventListener('click',e=>{ if(e.target===$(id)) $(id).hidden=true; }));
}
function openLessonModal(moduleId, l){
  state.editingLesson=l||null;
  const mods=state.admin._modsCache||[]; // filled in renderEditor below
  const sel=$('fLModule');
  // rebuild options from DOM: we can query current module list
  const modTitles=[...document.querySelectorAll('.module-edit')].map(m=>({id:m.dataset.module,title:m.querySelector('h4').textContent.replace(/^\d+ · /,'')}));
  sel.innerHTML=modTitles.map(m=>`<option value="${m.id}">${esc(m.title)}</option>`).join('');
  $('lessonModalTitle').textContent=l?'Edit lesson':'Add lesson';
  $('lessonSaveBtn').textContent=l?'Save changes':'Add lesson';
  $('fLModule').value=moduleId&&sel.querySelector(`option[value="${moduleId}"]`)?moduleId:(sel.firstElementChild&&sel.firstElementChild.value||'');
  $('fLId').value=l?l.id:''; $('fLTitle').value=l?l.title:''; $('fLDesc').value=l?(l.description||''):'';
  $('fLVideo').value=l?l.video_url:''; $('fL1080').value=l?(l.video_url_1080||'):'):''; $('fL720').value=l?(l.video_url_720||''):'';
  $('fL480').value=l?(l.video_url_480||''):''; $('fL360').value=l?(l.video_url_360||''):'';
  $('fLThumb').value=l?(l.thumbnail_url||''):'';
  $('fLDuration').value=l&&l.duration_seconds?Math.round(l.duration_seconds/60):'';
  $('fLPublish').checked=l?!!l.is_published:true; $('fLLock').checked=l?!!l.lock_prev:false;
  $('lessonModal').hidden=false; setTimeout(()=>$('fLTitle').focus(),50);
}

/* ---------- pixel canvas (auth brand) ---------- */
function startPixelCanvas(){
  const cv=$('pixelCanvas'), ctx=cv.getContext('2d'); const CW=22,GAP=7; let cells=[];
  function resize(){ const r=cv.parentElement.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=r.width*dpr; cv.height=r.height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); cells=[];
    const cols=Math.ceil(r.width/(CW+GAP)),rows=Math.ceil(r.height/(CW+GAP));
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)cells.push({px:x*(CW+GAP),py:y*(CW+GAP),col:0,a:0,ta:0,next:performance.now()+Math.random()*5000}); }
  function tick(t){ if($('view-auth').classList.contains('active')){
    const W=cv.width/Math.min(window.devicePixelRatio||1,2),H=cv.height/Math.min(window.devicePixelRatio||1,2);
    ctx.clearRect(0,0,W,H);
    for(const c of cells){ if(t>c.next){ const r=Math.random(); c.col=r<.78?0:r<.96?1:2; c.ta=c.col===0?0:c.col===1?.14:.85; c.next=t+1400+Math.random()*7000; }
      c.a+=(c.ta-c.a)*.07; if(c.a<.015) continue; ctx.globalAlpha=c.a; ctx.fillStyle=c.col===2?'#D9232E':'#F4F3F1'; ctx.fillRect(c.px,c.py,CW,CW); }
    ctx.globalAlpha=1; } requestAnimationFrame(tick); }
  resize(); window.addEventListener('resize',resize); requestAnimationFrame(tick);
}

/* ---------- boot ---------- */
(async function init(){
  seedDemo();
  $('demoNote').hidden=!DEMO;
  $('yearNow').textContent=new Date().getFullYear();
  wireAuth(); wirePlayer(); wireModals();
  startPixelCanvas();
  try{ const u=await api.restoreSession(); if(u){ await enterApp(u); return; } }
  catch(err){ console.warn(err); try{ await api.logout(); }catch(e){} toast(err.message||'Session expired — sign in again','error'); }
  switchView('auth');
})();

/* ============================================================
   SUPABASE SETUP SQL — run once in the SQL Editor
   (Auth → Providers → Email ON, "Confirm email" OFF)

  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default 'Student',
    phone text, photo_url text default '',
    is_admin boolean not null default false,
    blocked boolean not null default false,
    last_active timestamptz default now(),
    created_at timestamptz not null default now()
  );
  create table public.courses (
    id uuid primary key default gen_random_uuid(),
    title text not null, description text default '',
    category text default 'General', thumbnail_url text default '',
    is_featured boolean not null default false,
    is_published boolean not null default true,
    expires_at timestamptz, created_at timestamptz not null default now()
  );
  create table public.modules (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null, position int not null default 0
  );
  create table public.lessons (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    module_id uuid not null references public.modules(id) on delete cascade,
    title text not null, description text default '',
    video_url text not null,
    video_url_1080 text default '', video_url_720 text default '',
    video_url_480 text default '', video_url_360 text default '',
    thumbnail_url text default '', duration_seconds int not null default 0,
    position int not null default 0,
    is_published boolean not null default true,
    lock_prev boolean not null default false,
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
  create table public.notes (
    student_id uuid not null references public.profiles(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    body text not null default '', updated_at timestamptz not null default now(),
    primary key (student_id, lesson_id)
  );
  create table public.bookmarks (
    student_id uuid not null references public.profiles(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (student_id, lesson_id)
  );
  create table public.announcements (
    id uuid primary key default gen_random_uuid(),
    audience text not null check (audience in ('all','course','student')),
    course_id uuid references public.courses(id) on delete cascade,
    student_id uuid references public.profiles(id) on delete cascade,
    title text not null, body text not null,
    created_at timestamptz not null default now()
  );

  -- light counts for course cards (RLS-safe: no video urls leak)
  create or replace view public.course_stats as
  select c.id as course_id,
    count(l.id) filter (where l.is_published) as lessons_count,
    coalesce(sum(l.duration_seconds) filter (where l.is_published),0)/60 as total_mins,
    (select count(*) from enrollments e where e.course_id = c.id) as students_count
  from courses c left join lessons l on l.course_id = c.id group by c.id;

  alter table public.profiles enable row level security;
  alter table public.courses enable row level security;
  alter table public.modules enable row level security;
  alter table public.lessons enable row level security;
  alter table public.enrollments enable row level security;
  alter table public.video_progress enable row level security;
  alter table public.notes enable row level security;
  alter table public.bookmarks enable row level security;
  alter table public.announcements enable row level security;

  create or replace function public.is_admin()
  returns boolean language sql stable security definer set search_path = public as $$     select exists (select 1 from profiles where id = auth.uid() and is_admin); $$;

  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$   begin
    insert into public.profiles (id, phone, full_name)
    values (new.id, coalesce(new.phone, new.raw_user_meta_data->>'phone'),
            coalesce(new.raw_user_meta_data->>'full_name','Student'))
    on conflict (id) do update set phone = excluded.phone, full_name = excluded.full_name;
    return new;
  end; $$;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_user();

  create policy "profiles_select" on public.profiles for select
    using (auth.uid() = id or public.is_admin());
  create policy "profiles_update" on public.profiles for update
    using (auth.uid() = id) with check (auth.uid() = id);
  create policy "profiles_insert" on public.profiles for insert
    with check (auth.uid() = id);
  create policy "profiles_admin" on public.profiles for all
    using (public.is_admin()) with check (public.is_admin());

  create policy "courses_select" on public.courses for select
    using (is_published or public.is_admin());
  create policy "courses_admin" on public.courses for all
    using (public.is_admin()) with check (public.is_admin());

  create policy "modules_select" on public.modules for select
    using (exists (select 1 from courses c where c.id = modules.course_id
      and (c.is_published or public.is_admin())));
  create policy "modules_admin" on public.modules for all
    using (public.is_admin()) with check (public.is_admin());

  -- students: only PUBLISHED lessons of ENROLLED courses
  create policy "lessons_select" on public.lessons for select using (
    public.is_admin()
    or (is_published and exists (
      select 1 from public.enrollments e
      where e.course_id = lessons.course_id and e.student_id = auth.uid()))
  );
  create policy "lessons_admin" on public.lessons for all
    using (public.is_admin()) with check (public.is_admin());

  create policy "enroll_select" on public.enrollments for select
    using (auth.uid() = student_id or public.is_admin());
  create policy "enroll_admin" on public.enrollments for all
    using (public.is_admin()) with check (public.is_admin());

  create policy "prog_select" on public.video_progress for select using (auth.uid() = student_id or public.is_admin());
  create policy "prog_write"  on public.video_progress for insert with check (auth.uid() = student_id);
  create policy "prog_update" on public.video_progress for update using (auth.uid() = student_id);
  create policy "notes_all" on public.notes for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
  create policy "bm_all"    on public.bookmarks for all using (auth.uid() = student_id) with check (auth.uid() = student_id);

  create policy "ann_select" on public.announcements for select using (
    public.is_admin() or audience = 'all' or student_id = auth.uid()
    or (audience = 'course' and exists (
      select 1 from enrollments e where e.course_id = announcements.course_id and e.student_id = auth.uid()))
  );
  create policy "ann_admin" on public.announcements for all
    using (public.is_admin()) with check (public.is_admin());

  grant select on public.course_stats to authenticated;

  -- make yourself admin, then create your first course:
  -- update public.profiles set is_admin = true where phone = '+14150000000';
   ============================================================ */
