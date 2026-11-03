/* Buku Penghubung SD No. 3 Lukluk | no-build, Supabase v2 / demo local */
'use strict';
const SCHOOL = { name: 'SD No. 3 Lukluk', principal: 'Putu Ayu Hendra Wini Artati, S.Pd', nip: '19860102 201903 2 006', address:'Mengwi, Badung, Bali' };
const RULES = [
 'Buku penghubung ini digunakan sebagai alat komunikasi dan dokumentasi antara orang tua/wali siswa dengan guru di SD No. 3 Lukluk.',
 'Guru mengisi tanggal dan berita atau informasi perkembangan siswa melalui halaman khusus guru.',
 'Orang tua/wali siswa membaca berita pada halaman orang tua dan memberikan tanda tangan sebagai bukti telah mengetahui informasi.',
 'Orang tua/wali siswa tidak dapat mengubah isi berita yang ditulis guru. Jika diperlukan, komunikasi lanjutan dilakukan langsung dengan guru.',
 'Guru dan orang tua/wali siswa hendaknya memeriksa buku penghubung secara berkala agar setiap informasi dapat ditindaklanjuti.',
 'Jika siswa berhalangan hadir di sekolah, orang tua/wali siswa menyampaikan informasi kepada guru sesuai tata tertib sekolah.',
 'Dokumen pendukung, seperti surat keterangan sakit atau izin, dapat diserahkan kepada sekolah untuk dilampirkan bila diperlukan.',
 'Buku penghubung harus dijaga dengan baik dan tidak boleh dihilangkan atau disalahgunakan.',
 'Dokumentasi buku penghubung digunakan selama siswa bersekolah di SD No. 3 Lukluk dan dapat dicetak sebagai bukti administrasi sekolah.'
];
const CATEGORIES = ['Informasi','Perkembangan Belajar','Kedisiplinan','Kehadiran','Apresiasi','Lainnya'];
const DEMO_KEY='buku_sd3lukluk_demo_2026_v1';
const cfg=window.BUKU_CONFIG||{};
const isConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_URL.startsWith('https://'));
let sb=null;
let demo=!isConfigured;
let pad=null;
let toastTimer;
const state={user:null,profile:null,role:'parent',tab:'dashboard',mode:'login',loading:false,students:[],entries:[],acks:[],links:[],profiles:[],selectedStudent:null,bookStudent:null,editing:null,signing:null,filterStart:'',filterEnd:'',studentQuery:''};
const $=s=>document.querySelector(s);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attr=escapeHtml;
const today=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=k=>parts.find(p=>p.type===k)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;};
const dateLong=s=>{if(!s)return'-';const d=new Date(`${s}T12:00:00+08:00`);return isNaN(+d)?s:new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Makassar'}).format(d);};
const dateTime=s=>s?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Makassar'}).format(new Date(s)):'-';
const teacherMode=()=>state.role==='teacher'||state.role==='admin';
const currentStudent=()=>state.students.find(x=>x.id===state.bookStudent)||state.students[0]||null;
const currentRosterStudent=()=>state.students.find(x=>x.id===state.selectedStudent)||state.students[0]||null;
const entryAck=id=>state.acks.find(a=>a.entry_id===id);
const studentEntries=id=>state.entries.filter(e=>e.student_id===id).sort((a,b)=>(b.occurred_on||'').localeCompare(a.occurred_on||'')||(b.created_at||'').localeCompare(a.created_at||''));
const busy=async(fn)=>{try{state.loading=true;await fn();}catch(e){console.error(e);notify(e.message||'Terjadi kesalahan. Coba lagi.',true);}finally{state.loading=false;render();}};
const notify=(s,isError=false)=>{const el=$('#toast');if(!el)return;el.textContent=s;el.className='show'+(isError?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',5000);};
function demoDefault(){return {
 students:[{id:'demo-student-01',full_name:'Ni Luh Sari (Contoh)',class_name:'VI',nis:'1234',nisn:'',school_year:'2026/2027',teacher_id:'demo-teacher',active:true}],
 entries:[{id:'demo-entry-01',student_id:'demo-student-01',occurred_on:today(),category:'Perkembangan Belajar',message:'Ananda telah menunjukkan peningkatan dalam membaca. Mohon pendampingan membaca 15 menit di rumah setiap hari.',teacher_id:'demo-teacher',author_name:'Guru Kelas VI',teacher_signature:'',created_at:new Date().toISOString()}],
 acks:[], links:[{student_id:'demo-student-01',guardian_id:'demo-parent'}],profiles:[{id:'demo-teacher',full_name:'Guru Kelas VI',email:'guru@contoh.id',role:'teacher'},{id:'demo-parent',full_name:'Orang Tua Contoh',email:'wali@contoh.id',role:'parent'}]
};}
function getDemo(){try{return JSON.parse(localStorage.getItem(DEMO_KEY))||demoDefault();}catch{return demoDefault();}}
function saveDemo(){localStorage.setItem(DEMO_KEY,JSON.stringify({students:state.students,entries:state.entries,acks:state.acks,links:state.links,profiles:state.profiles}));}
function demoLogin(role='teacher'){
 const d=getDemo();Object.assign(state,d);state.role=role;state.user={id:role==='parent'?'demo-parent':'demo-teacher'};state.profile=state.profiles.find(p=>p.id===state.user.id)||{full_name:'Guru Kelas VI',role};state.selectedStudent=state.students[0]?.id||null;state.bookStudent=state.students[0]?.id||null;state.tab='dashboard';state.editing=null;state.signing=null;render();
}
async function hydrate(){
 if(!sb)return;
 const {data:userData,error:userErr}=await sb.auth.getUser();
 if(userErr||!userData.user){state.user=null;state.profile=null;render();return;}
 state.user=userData.user;
 const {data:p,error:pErr}=await sb.from('profiles').select('*').eq('id',state.user.id).single();
 if(pErr||!p)throw Error('Profil belum tersedia. Pastikan schema.sql sudah dijalankan.');
 state.profile=p;state.role=p.role;await loadData();
}
async function loadData(){
 if(demo){render();return;}
 const {data:students,error:sErr}=await sb.from('students').select('*').order('full_name');
 if(sErr)throw sErr;
 state.students=students||[];
 state.selectedStudent=state.students.some(s=>s.id===state.selectedStudent)?state.selectedStudent:state.students[0]?.id||null;
 state.bookStudent=state.students.some(s=>s.id===state.bookStudent)?state.bookStudent:state.students[0]?.id||null;
 const {data:links,error:linkErr}=await sb.from('guardian_links').select('student_id,guardian_id');
 if(linkErr)throw linkErr;state.links=links||[];
 // Fetch every page; Supabase limits large single responses to avoid overload.
 state.entries=[];
 for(let offset=0;offset<20000;offset+=500){
  const {data:rows,error}=await sb.from('entries').select('*').order('occurred_on',{ascending:false}).range(offset,offset+499);
  if(error)throw error;state.entries.push(...(rows||[]));if(!rows||rows.length<500)break;
 }
 state.acks=[];
 for(let i=0;i<state.entries.length;i+=80){
  const {data:rows,error}=await sb.from('acknowledgments').select('*').in('entry_id',state.entries.slice(i,i+80).map(e=>e.id));
  if(error)throw error;state.acks.push(...(rows||[]));
 }
 state.profiles=[];
 if(teacherMode() && state.links.length){
  const ids=[...new Set(state.links.map(l=>l.guardian_id))];
  const {data:p,error:pErr}=await sb.from('profiles').select('id,email,full_name,role').in('id',ids);
  if(pErr)throw pErr;state.profiles=p||[];
 }
 render();
}
function logo(){return './logo-sd3-lukluk.png';}
function topbar(){return `<header class="topbar"><div class="brand"><img src="${logo()}" alt="Logo SD No. 3 Lukluk"/><div><strong>BUKU PENGHUBUNG DIGITAL</strong><span>SD No. 3 Lukluk • Mengwi, Badung</span></div></div><div class="profile-chip"><div class="user"><strong>${escapeHtml(state.profile?.full_name||'')}</strong><small>${teacherMode()?(state.role==='admin'?'Administrator':'Guru Kelas'):'Orang Tua / Wali'}</small></div>${!demo?'<button class="btn btn-ghost btn-sm" data-action="logout">Keluar</button>':''}</div></header>`;}
function empty(icon,title,description){return `<div class="empty"><span class="symbol">${icon}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`;}
function selector(students,id,name='bookStudent'){return `<select id="${name}" data-change="${name}">${students.map(s=>`<option value="${attr(s.id)}" ${id===s.id?'selected':''}>${escapeHtml(s.full_name)} • ${escapeHtml(s.class_name)}</option>`).join('')}</select>`;}
function render(){
 const app=$('#app');if(!app)return;
 if(!state.user){app.innerHTML=authPage();return;}
 const n=teacherMode();const tabs=n?[
 ['dashboard','🏠','Ringkasan'],['students','🎓','Data Siswa'],['compose','✍️','Tulis Berita'],['book','📖','Buku & Cetak']
 ]:[['dashboard','🏠','Ringkasan'],['book','📖','Buku Anak Saya'],['profile','👤','Profil']];
 if(!tabs.some(t=>t[0]===state.tab))state.tab='dashboard';
 const html=state.tab==='dashboard'?dashboardPage():state.tab==='students'?studentsPage():state.tab==='compose'?composePage():state.tab==='book'?bookPage():profilePage();
 app.innerHTML=`<div class="app-shell">${topbar()}<main class="shell-inner">${demo?`<div class="demo-strip"><strong>⚠️ MODE DEMO — data hanya tersimpan di browser ini. Bukan akses aman atau arsip akreditasi resmi.</strong><div class="spacer"></div><span style="font-size:12px">Coba akses:</span><select data-change="demoRole"><option value="teacher" ${n?'selected':''}>👩‍🏫 Guru</option><option value="parent" ${!n?'selected':''}>👪 Orang Tua</option></select><button class="btn btn-outline btn-sm" data-action="reset-demo">Reset demo</button></div>`:''}
 <div class="hero"><div><div class="section-label">TAHUN AJARAN 2026 / 2027</div><h1>${n?'Ruang Kerja Guru':'Ruang Orang Tua / Wali'}</h1><p>${n?'Kelola komunikasi siswa, bukti tanda tangan, dan arsip cetak.':'Baca informasi perkembangan anak dan tanda tangani sebagai bukti mengetahui.'}</p></div>${n&&state.students.length?'<button class="btn btn-primary" data-action="new-entry">+ Tulis Berita</button>':''}</div>
 <nav class="nav-tabs" aria-label="Menu utama">${tabs.map(t=>`<button class="nav-btn ${state.tab===t[0]?'active':''}" data-action="tab" data-id="${t[0]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</nav>${html}
 <p class="footnote">SD No. 3 Lukluk • Buku penghubung digital untuk komunikasi guru dan orang tua. Tanda tangan digital merupakan bukti penerimaan informasi; pemanfaatannya sebagai arsip resmi mengikuti kebijakan sekolah.</p>
 </main></div>${state.signing?signatureModal():''}`;
 if(state.tab==='compose')initPad('teacherPad',state.editing?.teacher_signature||'');
 if(state.signing)initPad('guardianPad','');
}
function authPage(){
 const signup=state.mode==='signup';return `<main class="login-page"><section class="login-hero"><img src="${logo()}" alt="Logo SD No. 3 Lukluk"/><div class="section-label" style="color:#aacdf9">SD NO. 3 LUKLUK</div><h1>Komunikasi sekolah dan keluarga, dalam satu buku.</h1><p>Buku penghubung digital terstruktur dengan pencatatan berita, tanda tangan orang tua, serta format cetak untuk administrasi sekolah.</p><div class="login-benefits"><span><span class="tick">✓</span> Akses guru dan orang tua terpisah</span><span><span class="tick">✓</span> Tanda tangan langsung dari HP</span><span><span class="tick">✓</span> Cetak PDF / kertas A4 kapan saja</span></div></section>
 <section class="login-right"><div class="login-box"><div class="section-label">${signup?'DAFTAR AKUN WALI':'SELAMAT DATANG'}</div><h2>${signup?'Buat Akun Orang Tua':'Masuk ke Buku Penghubung'}</h2><p class="lead">${signup?'Daftarkan email orang tua. Guru kemudian menautkan akun ini dengan siswa.':'Gunakan email dan kata sandi yang sudah terdaftar di sekolah.'}</p>
 <form id="${signup?'signupForm':'loginForm'}">${signup?'<div class="field"><label>Nama lengkap</label><input type="text" name="name" maxlength="150" minlength="2" required placeholder="Nama orang tua / wali"/></div>':''}<div class="field"><label>Alamat email</label><input type="email" name="email" required autocomplete="email" placeholder="nama@email.com"/></div><div class="field"><label>Kata sandi</label><input type="password" name="password" required minlength="6" autocomplete="${signup?'new-password':'current-password'}" placeholder="Minimal 6 karakter"/></div><button class="btn btn-primary btn-full" type="submit">${signup?'Daftar sebagai Orang Tua':'Masuk ke Aplikasi'}</button></form>
 <div class="login-foot">${signup?'Sudah punya akun?':'Belum punya akun sebagai wali?'} <button class="switch-auth" data-action="toggle-auth">${signup?'Masuk di sini':'Daftar orang tua'}</button></div><div class="hint-box">Akun guru dibuat melalui pendaftaran biasa lalu ditetapkan sebagai <strong>teacher</strong> oleh administrator database sekolah. Orang tua tidak dapat memilih hak akses guru.</div></div></section></main>`;
}
function dashboardPage(){
 const count=state.entries.length, signed=state.entries.filter(e=>!!entryAck(e.id)).length, pending=count-signed;
 const list=teacherMode()?state.entries.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,6):state.entries.slice().filter(e=>!entryAck(e.id)).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,6);
 return `<div class="stats"><div class="stat"><span class="emoji">🎓</span><span class="value">${state.students.length}</span><span class="caption">${teacherMode()?'Siswa terdaftar':'Anak terhubung'}</span></div><div class="stat"><span class="emoji">📝</span><span class="value">${count}</span><span class="caption">Total berita</span></div><div class="stat"><span class="emoji">✅</span><span class="value">${signed}</span><span class="caption">Sudah ditandatangani</span></div><div class="stat"><span class="emoji">⏳</span><span class="value">${pending}</span><span class="caption">Menunggu tanda tangan</span></div></div>
 <div class="grid"><section class="card"><div class="between"><div><h2>${teacherMode()?'Berita Terbaru':'Perlu Ditandatangani'}</h2><p class="card-subtitle">${teacherMode()?'Pantau penyampaian informasi kepada keluarga siswa.':'Silakan baca berita dari guru lalu tanda tangani.'}</p></div><button class="btn btn-light btn-sm" data-action="tab" data-id="book">Lihat Buku</button></div>${list.length?list.map(e=>{const s=state.students.find(s=>s.id===e.student_id);return `<div class="entry-card"><div class="entry-top"><strong style="font-size:13px">${escapeHtml(s?.full_name||'Siswa')}</strong>${entryAck(e.id)?'<span class="status signed">✓ Diketahui</span>':'<span class="status">Belum ditandatangani</span>'}</div><div class="entry-meta">${escapeHtml(dateLong(e.occurred_on))} • ${escapeHtml(e.category)}</div><p class="entry-body">${escapeHtml(e.message)}</p>${!teacherMode()&&!entryAck(e.id)?`<button class="btn btn-primary btn-sm" data-action="sign" data-id="${attr(e.id)}">✍️ Tanda Tangani</button>`:''}</div>`;}).join(''):empty('🎉','Tidak ada berita tertunda',teacherMode()?'Mulai dengan menambahkan berita untuk seorang siswa.':'Semua berita sudah diketahui atau belum ada berita dari guru.')}</section>
 <section class="card"><h2>${teacherMode()?'Alur Buku Penghubung':'Cara Menggunakan'}</h2><p class="card-subtitle">Sesuai format buku komunikasi sekolah.</p><div class="hint-box" style="margin-top:0"><strong>1. ${teacherMode()?'Tambahkan siswa dan tautkan email wali.':'Daftar akun dan tunggu guru menghubungkan data anak.'}</strong><p style="margin-top:5px">${teacherMode()?'Gunakan menu Data Siswa untuk menambah data dan menghubungkan orang tua.':'Hanya berita anak yang terhubung dengan akun Anda yang akan tampil.'}</p></div><div class="hint-box"><strong>2. ${teacherMode()?'Tulis berita dan tanda tangani sebagai guru.':'Baca setiap berita dari guru.'}</strong><p style="margin-top:5px">${teacherMode()?'Guru menentukan tanggal, kategori dan isi berita dengan tanda tangan.' :'Pilih menu Buku Anak Saya untuk melihat tanggal dan berita.'}</p></div><div class="hint-box"><strong>3. ${teacherMode()?'Periksa konfirmasi dan cetak buku.':'Tanda tangani pada layar sentuh atau mouse.'}</strong><p style="margin-top:5px">${teacherMode()?'Simpan hasil dalam bentuk PDF atau cetak pada kertas A4 untuk arsip akreditasi.':'Tanda tangan yang sudah tersimpan tidak dapat diubah oleh orang tua.'}</p></div></section></div>`;
}
function studentsPage(){
 if(!teacherMode())return empty('🔒','Akses terbatas','Halaman ini hanya untuk guru.');
 const filtered=state.students.filter(s=>s.full_name.toLowerCase().includes(state.studentQuery.toLowerCase())||s.nis.includes(state.studentQuery));
 const s=currentRosterStudent();const linked=s?state.links.filter(l=>l.student_id===s.id):[];
 return `<div class="split"><section class="card"><div class="between"><h2>Daftar Siswa</h2><span class="pill">${state.students.length} siswa</span></div><div class="field"><input id="studentSearch" placeholder="Cari nama atau NIS..." value="${attr(state.studentQuery)}"/></div>
 <div id="rosterList">${filtered.length?filtered.map(st=>`<div class="student-card ${st.id===s?.id?'selected':''}" data-action="roster-student" data-id="${attr(st.id)}"><div class="student-line"><div class="avatar">${escapeHtml(st.full_name.slice(0,1).toUpperCase())}</div><div><strong>${escapeHtml(st.full_name)}</strong><small>Kelas ${escapeHtml(st.class_name)} • NIS ${escapeHtml(st.nis||'—')}</small></div></div><span class="pill">${state.links.filter(l=>l.student_id===st.id).length} wali</span></div>`).join(''):empty('🔎','Tidak ditemukan','Coba kata kunci lain atau tambahkan siswa.')}</div></section>
 <div><section class="card"><h2>Tambah Data Siswa</h2><p class="card-subtitle">Siswa disimpan dan dapat digunakan untuk menulis buku penghubung.</p><form id="studentForm"><div class="form-grid"><div class="field wide"><label>Nama lengkap siswa *</label><input name="full_name" minlength="2" maxlength="150" required placeholder="Contoh: I Made Putra"/></div><div class="field"><label>Kelas *</label><input name="class_name" required value="VI" maxlength="30"/></div><div class="field"><label>Tahun Ajaran</label><input name="school_year" value="2026/2027" maxlength="25"/></div><div class="field"><label>NIS</label><input name="nis" maxlength="30"/></div><div class="field"><label>NISN</label><input name="nisn" maxlength="30"/></div>${state.role==='admin'?`<div class="field wide"><label>ID Guru Wali Kelas (UUID, jika ingin menugaskan ke guru lain)</label><input name="teacher_id" placeholder="Kosongkan untuk diri sendiri"/></div>`:''}</div><button type="submit" class="btn btn-primary">+ Simpan Siswa</button></form></section>
 ${s?`<section class="card" style="margin-top:20px"><h2>Hubungkan Orang Tua</h2><p class="card-subtitle">Siswa: <strong>${escapeHtml(s.full_name)}</strong></p><div class="hint-box">Orang tua harus mendaftar akun terlebih dahulu. Masukkan email yang sama dengan email saat orang tua mendaftar. Guru tidak perlu mengetahui kata sandi orang tua.</div><form id="guardianForm"><input type="hidden" name="student_id" value="${attr(s.id)}"/><div class="field"><label>Email akun orang tua / wali</label><input type="email" name="email" placeholder="wali@email.com" required/></div><button class="btn btn-dark" type="submit">🔗 Tautkan Wali</button></form><div class="separator"></div><h3>Wali yang terhubung (${linked.length})</h3>${linked.length?linked.map(l=>{const p=state.profiles.find(p=>p.id===l.guardian_id);return `<div class="between" style="margin-bottom:11px"><div><strong style="font-size:13px">${escapeHtml(p?.full_name||'Orang tua / wali')}</strong><div class="mini-label">${escapeHtml(p?.email||'(akun tertaut)')}</div></div><button class="btn btn-danger btn-sm" data-action="unlink" data-id="${attr(l.guardian_id)}" data-student="${attr(s.id)}">Putuskan</button></div>`;}).join(''):'<p class="muted" style="font-size:13px">Belum ada wali terhubung.</p>'}</section>`:''}</div></div>`;
}
function composePage(){
 if(!teacherMode())return empty('🔒','Akses terbatas','Halaman ini hanya untuk guru.');
 if(!state.students.length)return `<section class="card">${empty('🎓','Belum ada siswa','Tambahkan siswa pada menu Data Siswa sebelum menulis berita.')}<button class="btn btn-primary" data-action="tab" data-id="students">Buka Data Siswa</button></section>`;
 const editing=state.editing;const e=editing||{};
 return `<div class="split"><section class="card"><h2>Catatan untuk Guru</h2><p class="card-subtitle">Informasi akan muncul di halaman orang tua setelah disimpan.</p><div class="hint-box"><strong>🔐 Hak akses</strong><p>Hanya guru atau administrator yang dapat menulis atau mengoreksi berita sebelum ditandatangani oleh wali.</p></div><div class="hint-box"><strong>✍️ Tanda tangan guru</strong><p>Gambarkan tanda tangan menggunakan mouse, touchpad, atau layar sentuh. Tanda tangan ditampilkan pada lembar cetak.</p></div><div class="hint-box"><strong>📁 Arsip sekolah</strong><p>Setelah ditandatangani orang tua, isi berita terkunci agar riwayat penerimaan informasi tetap konsisten.</p></div></section>
 <section class="card"><div class="between"><h2>${editing?'Edit Berita Guru':'Tulis Berita Baru'}</h2>${editing?'<button class="btn btn-outline btn-sm" data-action="cancel-edit">Batal Edit</button>':''}</div><form id="entryForm"><div class="form-grid"><div class="field wide"><label>Nama siswa *</label>${selector(state.students,editing?.student_id||state.selectedStudent||state.students[0].id,'composeStudent')}</div><div class="field"><label>Hari / tanggal *</label><input type="date" name="occurred_on" required value="${attr(e.occurred_on||today())}"/></div><div class="field"><label>Kategori berita</label><select name="category">${CATEGORIES.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field wide"><label>Berita / Informasi Siswa *</label><textarea name="message" required minlength="5" maxlength="800" placeholder="Tuliskan informasi perkembangan belajar, perilaku, kehadiran, atau komunikasi sekolah...">${escapeHtml(e.message||'')}</textarea><small>Maksimal 800 karakter. Buat berita yang jelas dan pantas diketahui orang tua.</small></div><div class="field wide"><label>Tanda tangan guru *</label><div class="signature"><canvas id="teacherPad" width="700" height="180" aria-label="Area tanda tangan guru"></canvas></div><div class="signature-foot"><small>Tanda tangan di kotak dengan mouse atau sentuhan.</small><button class="btn btn-outline btn-sm" type="button" data-action="clear-pad">Hapus Tanda Tangan</button></div></div></div><button class="btn btn-primary" type="submit">${editing?'💾 Simpan Perubahan':'📨 Simpan & Kirim ke Orang Tua'}</button></form></section></div>`;
}
function filters(){return state.entries.filter(e=>!state.filterStart||e.occurred_on>=state.filterStart).filter(e=>!state.filterEnd||e.occurred_on<=state.filterEnd);}
function bookPage(){
 if(!state.students.length)return `<section class="card">${empty('📚',teacherMode()?'Belum ada siswa':'Belum terhubung dengan anak',teacherMode()?'Tambahkan siswa melalui menu Data Siswa.':'Hubungi guru kelas agar email akun Anda dihubungkan dengan data siswa.')}</section>`;
 const s=currentStudent();const entries=filters().filter(e=>e.student_id===s.id);const signed=entries.filter(e=>entryAck(e.id)).length;
 return `<section class="card"><div class="between"><div><h2>${teacherMode()?'Arsip Buku Penghubung':'Buku Penghubung Anak'}</h2><p class="card-subtitle">Pilih siswa dan rentang tanggal, lalu lihat atau cetak bukunya.</p></div><span class="pill">${entries.length} berita</span></div><div class="filter-row"><div class="field grow"><label>Nama siswa</label>${selector(state.students,s.id,'bookStudent')}</div><div class="field"><label>Dari tanggal</label><input type="date" value="${attr(state.filterStart)}" data-change="filterStart"/></div><div class="field"><label>Sampai tanggal</label><input type="date" value="${attr(state.filterEnd)}" data-change="filterEnd"/></div>${teacherMode()?`<button class="btn btn-dark" data-action="print-book">🖨️ Cetak A4 / PDF</button><button class="btn btn-outline" data-action="csv">⬇ Rekap CSV</button>`:''}</div><div class="notice">${escapeHtml(s.full_name)} • Kelas ${escapeHtml(s.class_name)} • ${signed} dari ${entries.length} berita telah diketahui orang tua. ${teacherMode()?'Cetak mencakup cover, petunjuk penggunaan, dan lembar berita dengan tanda tangan.':'Tanda tangan dapat dilakukan langsung di bawah berita yang belum diketahui.'}</div></section>
 <div style="margin-top:18px">${entries.length?entries.map(e=>{const ack=entryAck(e.id);const signer=state.profiles.find(p=>p.id===ack?.guardian_id);return `<article class="entry-card"><div class="entry-top"><div><div class="entry-meta">${escapeHtml(dateLong(e.occurred_on))} · ${escapeHtml(e.category)}</div><strong>${escapeHtml(e.author_name||'Guru Kelas')}</strong></div>${ack?'<span class="status signed">✓ Ditandatangani</span>':'<span class="status">⏳ Menunggu tanda tangan</span>'}</div><p class="entry-body">${escapeHtml(e.message)}</p><div class="entry-bottom"><div><small>✍️ Guru: ${e.teacher_signature?'Sudah ditandatangani':'Tanda tangan belum tersedia'}${ack?`<br/>✅ Wali: ${escapeHtml(signer?.full_name||'Orang tua / wali')} · ${escapeHtml(dateTime(ack.signed_at))}`:''}</small></div><div class="action-row">${teacherMode()&&!ack?`<button class="btn btn-outline btn-sm" data-action="edit-entry" data-id="${attr(e.id)}">Edit</button><button class="btn btn-danger btn-sm" data-action="delete-entry" data-id="${attr(e.id)}">Hapus</button>`:''}${!teacherMode()&&!ack?`<button class="btn btn-primary" data-action="sign" data-id="${attr(e.id)}">✍️ Baca & Tanda Tangani</button>`:''}</div></div></article>`;}).join(''):empty('📝','Tidak ada berita pada rentang tanggal ini','Ubah filter tanggal atau tunggu guru menulis berita baru.')}</div>`;
}
function profilePage(){const p=state.profile;return `<section class="card"><h2>Profil Orang Tua / Wali</h2><p class="card-subtitle">Akun orang tua hanya dapat melihat berita anak yang terhubung dan menandatanganinya.</p><div class="mini-profile"><dl><dt>Nama akun</dt><dd>${escapeHtml(p.full_name)}</dd><dt>Email</dt><dd>${escapeHtml(p.email)}</dd><dt>Hak akses</dt><dd><span class="status blue">Orang Tua / Wali</span></dd><dt>Jumlah anak</dt><dd>${state.students.length}</dd></dl></div><div class="hint-box">Hubungi wali kelas jika nama anak belum muncul. Pastikan email yang guru tautkan sama persis dengan email akun orang tua.</div></section>`;}
function signatureModal(){const e=state.entries.find(e=>e.id===state.signing);const s=state.students.find(s=>s.id===e?.student_id);if(!e)return'';return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="signatureTitle"><section class="modal"><div class="between"><h2 id="signatureTitle">Tanda Tangan Orang Tua</h2><button class="btn btn-outline btn-sm" data-action="close-sign">✕</button></div><p class="card-subtitle">Siswa: <strong>${escapeHtml(s?.full_name||'')}</strong> • ${escapeHtml(dateLong(e.occurred_on))}</p><div class="quote">${escapeHtml(e.message)}</div><p class="mini-label">Dengan menandatangani, saya menyatakan telah membaca dan mengetahui berita dari guru di atas.</p><form id="signatureForm"><div class="field" style="margin-top:13px"><label>Gambar tanda tangan di kotak *</label><div class="signature"><canvas id="guardianPad" width="700" height="180" aria-label="Area tanda tangan orang tua"></canvas></div><div class="signature-foot"><small>Gunakan jari, mouse, atau stylus.</small><button class="btn btn-outline btn-sm" type="button" data-action="clear-pad">Hapus</button></div></div><div class="action-row"><button class="btn btn-primary" type="submit">✅ Setujui & Simpan Tanda Tangan</button><button class="btn btn-outline" type="button" data-action="close-sign">Batal</button></div></form><p class="toolbar-note">Waktu tanda tangan dicatat otomatis. Tanda tangan yang tersimpan tidak dapat diedit oleh orang tua.</p></section></div>`;}
function initPad(id,initial){
 const el=document.getElementById(id);if(!el)return;
 const context=el.getContext('2d');if(!context)return;
 const ink={el,context,hasInk:false};pad=ink;context.lineWidth=3.1;context.strokeStyle='#163f79';context.lineCap='round';context.lineJoin='round';
 if(initial&&initial.startsWith('data:image/png;base64,')){
  const img=new Image();img.onload=()=>{context.drawImage(img,0,0,el.width,el.height);ink.hasInk=true;};img.src=initial;
 }
 let drawing=false;
 const pos=ev=>{const r=el.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*el.width,y:(ev.clientY-r.top)/r.height*el.height};};
 el.addEventListener('pointerdown',ev=>{ev.preventDefault();drawing=true;ink.hasInk=true;el.setPointerCapture(ev.pointerId);const p=pos(ev);context.beginPath();context.moveTo(p.x,p.y);context.lineTo(p.x+.05,p.y+.05);context.stroke();});
 el.addEventListener('pointermove',ev=>{if(!drawing)return;ev.preventDefault();const p=pos(ev);context.lineTo(p.x,p.y);context.stroke();});
 const stop=()=>{drawing=false;};el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);
}
function signatureValue(){if(!pad||!pad.hasInk)throw Error('Silakan buat tanda tangan terlebih dahulu.');return pad.el.toDataURL('image/png');}
async function onSubmit(ev){
 if(!ev.target?.id)return;
 const form=ev.target;
 if(!['loginForm','signupForm','studentForm','guardianForm','entryForm','signatureForm'].includes(form.id))return;
 ev.preventDefault();const d=Object.fromEntries(new FormData(form).entries());
 await busy(async()=>{
 if(form.id==='loginForm'){
  if(demo)throw Error('Aktifkan Supabase untuk login sungguhan.');
  const {error}=await sb.auth.signInWithPassword({email:d.email.trim().toLowerCase(),password:d.password});if(error)throw error;
  await hydrate();notify('Berhasil masuk. Selamat datang!');return;
 }
 if(form.id==='signupForm'){
  if(demo)throw Error('Aktifkan Supabase untuk pendaftaran sungguhan.');
  const {data,error}=await sb.auth.signUp({email:d.email.trim().toLowerCase(),password:d.password,options:{data:{full_name:d.name.trim()}}});if(error)throw error;
  if(data.session){await hydrate();notify('Akun wali berhasil dibuat. Guru perlu menautkan anak Anda.');}
  else{state.mode='login';notify('Pendaftaran diterima. Cek email untuk verifikasi sebelum masuk.');}return;
 }
 if(form.id==='studentForm'){
  if(!teacherMode())throw Error('Hanya guru dapat menambah siswa.');
  const item={full_name:d.full_name.trim(),class_name:d.class_name.trim(),nis:(d.nis||'').trim(),nisn:(d.nisn||'').trim(),school_year:(d.school_year||'2026/2027').trim(),teacher_id:(d.teacher_id||state.user.id).trim()};
  if(demo){item.id='demo-student-'+Date.now();state.students.push(item);state.selectedStudent=item.id;saveDemo();}
  else{const {data,error}=await sb.from('students').insert(item).select('id').single();if(error)throw error;state.selectedStudent=data.id;await loadData();}
  notify('Siswa berhasil disimpan.');return;
 }
 if(form.id==='guardianForm'){
  if(!teacherMode())throw Error('Hanya guru dapat menautkan wali.');
  const email=d.email.trim().toLowerCase();
  if(demo){let p=state.profiles.find(p=>p.email===email);if(!p){p={id:'demo-parent-'+Date.now(),full_name:email.split('@')[0],email,role:'parent'};state.profiles.push(p);}if(!state.links.some(l=>l.student_id===d.student_id&&l.guardian_id===p.id))state.links.push({student_id:d.student_id,guardian_id:p.id});saveDemo();}
  else{const {data,error}=await sb.rpc('link_guardian_by_email',{p_student:d.student_id,p_email:email});if(error)throw error;if(!data)throw Error('Akun orang tua belum ditemukan. Minta wali mendaftar dan memverifikasi email terlebih dahulu.');await loadData();}
  notify('Email orang tua berhasil ditautkan.');return;
 }
 if(form.id==='entryForm'){
  if(!teacherMode())throw Error('Hanya guru dapat menulis berita.');
  const sig=signatureValue();const studentId=$('#composeStudent').value;
  if(!state.students.some(x=>x.id===studentId))throw Error('Pilih siswa yang benar.');
  const values={student_id:studentId,occurred_on:d.occurred_on,category:d.category,message:d.message.trim(),teacher_signature:sig,teacher_id:state.editing?.teacher_id||state.user.id,author_name:state.editing?.author_name||state.profile.full_name};
  if(state.editing){if(entryAck(state.editing.id))throw Error('Berita yang telah ditandatangani tidak dapat diubah.');if(demo){Object.assign(state.entries.find(x=>x.id===state.editing.id),values);}else{delete values.student_id;delete values.teacher_id;const {error}=await sb.from('entries').update(values).eq('id',state.editing.id);if(error)throw error;}}
  else if(demo)state.entries.unshift({...values,id:'demo-entry-'+Date.now(),created_at:new Date().toISOString()});
  else{const {error}=await sb.from('entries').insert(values);if(error)throw error;}
  if(demo)saveDemo();else await loadData();state.editing=null;state.bookStudent=studentId;state.tab='book';notify('Berita guru berhasil disimpan.');return;
 }
 if(form.id==='signatureForm'){
  if(teacherMode())throw Error('Tanda tangan wali harus dilakukan dari akun orang tua.');
  const item=state.entries.find(x=>x.id===state.signing);if(!item)throw Error('Berita tidak ditemukan.');
  if(entryAck(item.id))throw Error('Berita sudah pernah ditandatangani.');
  const sig=signatureValue();const a={entry_id:item.id,guardian_id:state.user.id,signature_data:sig,signed_at:new Date().toISOString()};
  if(demo){state.acks.push(a);saveDemo();}
  else{const {error}=await sb.from('acknowledgments').insert({entry_id:item.id,guardian_id:state.user.id,signature_data:sig});if(error)throw error;await loadData();}
  state.signing=null;notify('Terima kasih. Tanda tangan sudah tersimpan.');return;
 }
 });
}
async function onClick(ev){
 const btn=ev.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action;const id=btn.dataset.id;
 try{
 if(action==='tab'){state.tab=id;state.editing=null;state.signing=null;render();return;}
 if(action==='new-entry'){state.tab='compose';state.editing=null;render();return;}
 if(action==='roster-student'){state.selectedStudent=id;render();return;}
 if(action==='toggle-auth'){state.mode=state.mode==='login'?'signup':'login';render();return;}
 if(action==='close-sign'){state.signing=null;render();return;}
 if(action==='sign'){if(teacherMode())return;state.signing=id;render();return;}
 if(action==='clear-pad'){if(pad){pad.context.clearRect(0,0,pad.el.width,pad.el.height);pad.hasInk=false;}return;}
 if(action==='cancel-edit'){state.editing=null;state.tab='book';render();return;}
 if(action==='edit-entry'){
  const e=state.entries.find(e=>e.id===id);if(!e||entryAck(e.id))throw Error('Berita ini telah ditandatangani dan terkunci.');
  state.editing={...e};state.tab='compose';render();return;
 }
 if(action==='delete-entry'){
  const e=state.entries.find(e=>e.id===id);if(!e||entryAck(id))throw Error('Berita ini sudah ditandatangani dan tidak dapat dihapus.');
  if(!confirm('Yakin ingin menghapus berita yang belum ditandatangani ini?'))return;
  await busy(async()=>{if(demo){state.entries=state.entries.filter(e=>e.id!==id);saveDemo();}else{const {error}=await sb.from('entries').delete().eq('id',id);if(error)throw error;await loadData();}notify('Berita berhasil dihapus.');});return;
 }
 if(action==='unlink'){
  if(!confirm('Putuskan hubungan akun orang tua dengan siswa ini?'))return;
  await busy(async()=>{if(demo){state.links=state.links.filter(l=>!(l.student_id===btn.dataset.student&&l.guardian_id===id));saveDemo();}else{const {error}=await sb.from('guardian_links').delete().eq('student_id',btn.dataset.student).eq('guardian_id',id);if(error)throw error;await loadData();}notify('Akun wali berhasil dilepas.');});return;
 }
 if(action==='csv'){exportCsv();return;}
 if(action==='print-book'){printBook();return;}
 if(action==='reset-demo'){if(confirm('Hapus seluruh data percobaan pada browser ini?')){localStorage.removeItem(DEMO_KEY);demoLogin('teacher');notify('Mode demo telah direset.');}return;}
 if(action==='logout'){const {error}=await sb.auth.signOut();if(error)throw error;Object.assign(state,{user:null,profile:null,entries:[],students:[],acks:[],links:[],profiles:[]});render();return;}
 }catch(e){console.error(e);notify(e.message||'Aksi gagal.',true);}
}
function onChange(ev){const el=ev.target;if(el.dataset.change==='demoRole'){demoLogin(el.value);return;}if(el.dataset.change==='bookStudent'){state.bookStudent=el.value;render();return;}if(el.dataset.change==='filterStart'){state.filterStart=el.value;render();return;}if(el.dataset.change==='filterEnd'){state.filterEnd=el.value;render();return;}if(el.id==='studentSearch'){state.studentQuery=el.value; /* Keep cursor during typing */ const list=$('#rosterList');if(list){const results=state.students.filter(s=>s.full_name.toLowerCase().includes(state.studentQuery.toLowerCase())||s.nis.includes(state.studentQuery));list.innerHTML=results.map(st=>`<div class="student-card ${st.id===state.selectedStudent?'selected':''}" data-action="roster-student" data-id="${attr(st.id)}"><div class="student-line"><div class="avatar">${escapeHtml(st.full_name.slice(0,1))}</div><div><strong>${escapeHtml(st.full_name)}</strong><small>Kelas ${escapeHtml(st.class_name)}</small></div></div></div>`).join('')||'<p class="muted">Tidak ada siswa ditemukan.</p>';}}}
function csvCell(s){return '"'+String(s??'').replace(/"/g,'""').replace(/^[=+@\-\t\r]/,'\u0027$&')+'"';}
function exportCsv(){if(!teacherMode())return;const s=currentStudent();if(!s)return;const lines=[['Hari / Tanggal','Nama Siswa','Kelas','Kategori','Berita','Guru','Status Wali','Nama Wali','Waktu Tanda Tangan'],...filters().filter(e=>e.student_id===s.id).map(e=>{const ack=entryAck(e.id);const p=state.profiles.find(p=>p.id===ack?.guardian_id);return [e.occurred_on,s.full_name,s.class_name,e.category,e.message,e.author_name,ack?'Ditandatangani':'Belum',p?.full_name||'',ack?.signed_at||''];})];const csv='\uFEFF'+lines.map(r=>r.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Rekap_Buku_Penghubung_${s.full_name.replace(/[^a-zA-Z0-9]/g,'_')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Rekap CSV berhasil dibuat.');}
function printRow(e, height=20){if(!e)return `<tr style="height:${height}mm"><td></td><td></td><td></td><td></td></tr>`;
 const ack=entryAck(e.id);const guardian=state.profiles.find(p=>p.id===ack?.guardian_id);
 return `<tr style="height:${height}mm"><td>${escapeHtml(dateLong(e.occurred_on))}</td><td><span class="log-message">${escapeHtml(e.message)}</span></td><td class="sigcell">${ack?.signature_data?.startsWith('data:image/png;base64,')?`<img src="${attr(ack.signature_data)}" alt="Tanda tangan orang tua"/>`:''}${ack?`<small>${escapeHtml(guardian?.full_name||'Orang Tua / Wali')}<br/>${escapeHtml(dateTime(ack.signed_at))}</small>`:''}</td><td class="sigcell">${e.teacher_signature?.startsWith('data:image/png;base64,')?`<img src="${attr(e.teacher_signature)}" alt="Tanda tangan guru"/>`:''}<small>${escapeHtml(e.author_name)}</small></td></tr>`;
}
function bookPages(entries){
 const pages=[];let current=[],used=0;
 // Estimate row heights from character count, keeping the printed ledger legible.
 entries.forEach(e=>{const rowHeight=Math.min(70,Math.max(21,21+Math.ceil(e.message.length/85)*5));if(used+rowHeight>184&&current.length){pages.push(current);current=[];used=0;}current.push({e,height:rowHeight});used+=rowHeight;});
 if(current.length)pages.push(current);
 if(!pages.length)pages.push([]);
 if(pages.length===1){let blankHeight=22;while(used+blankHeight<=190&&pages[0].length<9){pages[0].push({e:null,height:blankHeight});used+=blankHeight;}}
 return pages;
}
function buildPrintPages(s,entries){
 const guardianNames=state.links.filter(l=>l.student_id===s.id).map(l=>state.profiles.find(p=>p.id===l.guardian_id)?.full_name).filter(Boolean).join(', ');
 const cover=`<section class="print-page print-cover"><div style="font-size:11pt;font-weight:bold;letter-spacing:2px">BUKU PENGHUBUNG SEKOLAH</div><img src="${logo()}" alt="Logo sekolah"/><div class="big">BUKU PENGHUBUNG</div><p style="margin:5mm 0">ORANG TUA / WALI SISWA DAN GURU</p><div class="med">${escapeHtml(SCHOOL.name.toUpperCase())}</div><div style="font-size:10pt">${escapeHtml(SCHOOL.address)}</div><div class="cover-form"><div><b>Nama Siswa</b><span>: ${escapeHtml(s.full_name)}</span></div><div><b>Kelas</b><span>: ${escapeHtml(s.class_name)}</span></div><div><b>NIS / NISN</b><span>: ${escapeHtml([s.nis,s.nisn].filter(Boolean).join(' / ')||'—')}</span></div><div><b>Nama Orang Tua</b><span>: ${escapeHtml(guardianNames||'........................................')}</span></div><div><b>Tahun Ajaran</b><span>: ${escapeHtml(s.school_year||'2026/2027')}</span></div></div><footer>Dokumentasi kerja sama sekolah dan keluarga<br/>Untuk administrasi dan akreditasi sekolah</footer></section>`;
 const rules=`<section class="print-page print-rules"><h1>PETUNJUK PENGGUNAAN</h1><ol>${RULES.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ol><div class="principal-block">Lukluk, ................................<br/>Kepala ${escapeHtml(SCHOOL.name)}<div class="principal-name">${escapeHtml(SCHOOL.principal)}</div>NIP ${escapeHtml(SCHOOL.nip)}</div></section>`;
 const all=bookPages(entries);const logs=all.map((rows,index)=>`<section class="print-page print-table-page"><h2>LEMBAR BERITA / INFORMASI SISWA</h2><div class="print-year">${escapeHtml(SCHOOL.name)} • Tahun Ajaran ${escapeHtml(s.school_year||'2026/2027')}</div><div class="print-student"><span>Nama Siswa: <strong>${escapeHtml(s.full_name)}</strong></span><span>Kelas: <strong>${escapeHtml(s.class_name)}</strong></span></div><table class="print-log"><thead><tr><th class="day-col">Hari / Tanggal</th><th class="news-col">Berita</th><th class="parent-col">Tanda Tangan<br/>Orang Tua / Wali Siswa</th><th class="teacher-col">Tanda Tangan<br/>Guru</th></tr></thead><tbody>${rows.map(r=>printRow(r.e,r.height)).join('')}</tbody></table><div class="print-footer"><span>Buku Penghubung ${escapeHtml(SCHOOL.name)}</span><span>Halaman ${index+3}</span></div></section>`).join('');
 return cover+rules+logs;
}
function printBook(){if(!teacherMode())return;const s=currentStudent();if(!s){notify('Pilih siswa terlebih dahulu.',true);return;}const arr=filters().filter(e=>e.student_id===s.id).sort((a,b)=>a.occurred_on.localeCompare(b.occurred_on));const area=$('#printArea');area.innerHTML=buildPrintPages(s,arr);area.setAttribute('aria-hidden','false');const imgs=Array.from(area.querySelectorAll('img'));Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;}))).then(()=>{window.print();});}
async function main(){document.addEventListener('submit',onSubmit);document.addEventListener('click',onClick);document.addEventListener('change',onChange);document.addEventListener('input',ev=>{if(ev.target.id==='studentSearch')onChange(ev);});
 if(demo){demoLogin('teacher');return;}
 if(!window.supabase?.createClient){$('#app').innerHTML='<div class="loading-app"><h2>Gagal memuat pustaka Supabase</h2><p>Pastikan perangkat terhubung ke internet dan CDN tidak diblokir. Coba muat ulang halaman.</p></div>';return;}
 try{sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);await hydrate();}catch(e){console.error(e);$('#app').innerHTML=`<div class="loading-app"><h2>Konfigurasi database perlu diperiksa</h2><p>${escapeHtml(e.message)}</p><p>Baca README.md dan jalankan supabase/schema.sql.</p></div>`;}
}
main();
