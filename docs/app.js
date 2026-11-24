(function(){
"use strict";
/* «Таверна»: английский для чтения романтического фэнтези.
   Карточки с интервальным повторением, уроки (слова → упражнения → глава истории → вопросы), читалка с переводом по щелчку,
   свои книги (EPUB). Данные — таблицы t_* в общем Supabase (supabase/001_tavern.sql). Уроки и словарь — файлы lessons/, data/. */
const $=s=>document.querySelector(s);
const main=$("#main"),sheet=$("#sheet");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls={get(k,d){try{const v=localStorage.getItem("tav:"+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem("tav:"+k,JSON.stringify(v))}catch(e){}}};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};

/* ---------- даты: строки 'YYYY-MM-DD' в местном времени ---------- */
const pad=n=>String(n).padStart(2,"0");
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const today=()=>iso(new Date());
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const daysBetween=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
function plural(n,a,b,c){const m=Math.abs(n)%10,h=Math.abs(n)%100;return n+" "+(m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c)}
const ivlLabel=n=>n<=0?"сегодня":n===1?"завтра":n<30?plural(n,"день","дня","дней"):n<365?Math.round(n/30)+" мес.":Math.round(n/36.5)/10+" г.";
function dueLabel(d){const n=daysBetween(today(),d);return n<0?"ждёт "+plural(-n,"день","дня","дней"):n===0?"сегодня":n===1?"завтра":"через "+plural(n,"день","дня","дней")}

/* ---------- словарь и уроки (файлы) ---------- */
let LESSONS=[],PICS={},BIG=null,IRR={};const L={},DICT=new Map(),LWORDS=new Set();
async function loadContent(){
  const [core,idx,pics,irr]=await Promise.all([fetch("data/core.json").then(r=>r.json()),fetch("lessons/index.json").then(r=>r.json()),fetch("data/pics.json").then(r=>r.json()).catch(()=>({})),fetch("data/irr.json").then(r=>r.json()).catch(()=>({}))]);
  PICS=pics;IRR=irr;
  for(const [k,v] of Object.entries(core))DICT.set(k,v);
  LESSONS=idx;
  const all=await Promise.all(idx.map(x=>fetch(`lessons/${x.id}.json`).then(r=>r.json())));
  for(const l of all){
    L[l.id]=l;
    for(const w of l.words){DICT.set(w.w,w.tr);LWORDS.add(w.w)}
    for(const [k,v] of Object.entries(l.gloss||{}))if(!DICT.has(k))DICT.set(k,v);
  }
}
// возможные начальные формы: looked → look, smiled → smile, stepped → step, enemies → enemy, Mira's → mira
function forms(w){
  w=w.toLowerCase().replace(/’/g,"'");
  const r=[w],add=x=>{if(x&&x.length>1&&!r.includes(x))r.push(x)};
  if(/'s$/.test(w)){w=w.slice(0,-2);add(w)}
  if(/ies$/.test(w))add(w.slice(0,-3)+"y");
  if(/(s|x|z|ch|sh)es$/.test(w))add(w.slice(0,-2));
  if(/s$/.test(w)&&!/ss$/.test(w))add(w.slice(0,-1));
  if(/ied$/.test(w))add(w.slice(0,-3)+"y");
  if(/ed$/.test(w)){const b=w.slice(0,-2);add(b);add(b+"e");if(/(.)\1$/.test(b))add(b.slice(0,-1))}
  if(/ing$/.test(w)){const b=w.slice(0,-3);add(b);add(b+"e");if(/(.)\1$/.test(b))add(b.slice(0,-1))}
  if(/ly$/.test(w)){add(w.slice(0,-2));if(/ily$/.test(w))add(w.slice(0,-3)+"y")}
  if(/er$/.test(w)){add(w.slice(0,-2));add(w.slice(0,-1))}
  if(/est$/.test(w)){add(w.slice(0,-3));add(w.slice(0,-2))}
  return r;
}
// большой словарь (Викисловарь, ~1 МБ) — грузится один раз, когда понадобится в читалке
let bigP=null;
function loadBig(){return bigP||(bigP=fetch("data/dict.json").then(r=>r.json()).then(d=>{BIG=d}).catch(()=>{bigP=null}))}
const cardOf=w=>S&&S.cards.find(c=>c.word===w);
// начальное слово неправильной формы: IRR (data/irr.json: форма → [начальное, перевод формы, перевод начального]) — для форм,
// которые в большом словаре значатся отдельным словом (lit — «освещённый»), остальные — из самого словаря
const baseOf=t=>IRR[t]?IRR[t][0]:BIG&&BIG.f[t]||null;
// {key, tr, card, base}: сначала её карточки, потом словарь уроков, потом большой словарь (с неправильными формами: went → go).
// Форма есть в словаре уроков сама по себе (went — «пошёл») — перевод показать её, а карточка — на начальное слово (base — его перевод)
function lookup(w){
  const fs=forms(w),raw=fs[0],b0=!LWORDS.has(raw)&&baseOf(raw),ir=b0&&IRR[raw];
  for(const f of fs){const c=cardOf(f);if(c)return {key:f,tr:c.tr,card:c}}
  if(b0){
    const c=cardOf(b0),t=ir&&ir[2]||DICT.get(b0),big=BIG&&BIG.w[b0],here=DICT.get(raw)||ir&&ir[1];
    if(c)return here&&here!==c.tr?{key:b0,tr:here,card:c,show:c.tr}:{key:b0,tr:c.tr,card:c};
    // в большом словаре часто другая часть речи (step — «ступенька»), поэтому перевод из текста — первым
    if(here&&(t||big))return {key:b0,tr:here,card:null,base:t||(ir?big:here+"; "+big),show:t||ir&&big};
  }
  for(const f of fs)if(DICT.has(f))return {key:f,tr:DICT.get(f),card:null};
  if(BIG){
    for(const f of fs)if(BIG.w[f])return {key:f,tr:BIG.w[f],card:null};
    for(const f of fs){const b=BIG.f[f];if(b){const c=cardOf(b);if(c)return {key:b,tr:c.tr,card:c};const t=DICT.get(b)||BIG.w[b];if(t)return {key:b,tr:t,card:null}}}
  }
  return {key:fs[0].replace(/'s$/,""),tr:"",card:null};
}
// картинка слова (нарисованная) или смайлик
const pic=(word,emoji)=>PICS[word]?`<span class="pic">${PICS[word]}</span>`:esc(emoji||"");

/* ---------- база ---------- */
const sb=supabase.createClient(CONFIG.url,CONFIG.key);
let S=null,user=null,tab=ls.get("tab","today"),mode=null;
const ok=r=>{if(r.error)throw r.error;return r.data};
// таблица целиком: база отдаёт не больше 1000 строк за раз, поэтому порциями, в постоянном порядке (key), пока не наберётся count
async function all(t,key="id",more=q=>q){
  const rows=[];
  for(;;){
    const r=await more(sb.from(t).select("*",{count:"exact"})).order(key).range(rows.length,rows.length+999);
    if(r.error)throw r.error;
    rows.push(...r.data);
    if(!r.data.length||rows.length>=r.count)break;
  }
  const seen=new Set();return rows.filter(x=>!seen.has(x[key])&&seen.add(x[key])); // строка, добавленная во время загрузки, могла прийти дважды
}
const noTable=e=>/^(42P01|PGRST205)$/.test(e&&e.code||""); // таблиц правда нет — SQL ещё не запускали
async function load(){
  try{
    const [cards,texts,lessons,books,log]=await Promise.all([all("t_cards"),all("t_texts"),all("t_lessons","lesson"),all("t_books"),all("t_log","id",q=>q.gte("day",addDays(today(),-30)))]);
    S={cards,texts,lessons,books,log};
    render();loadBig();
  }catch(e){
    console.error(e);
    if(S){toast("Не удалось обновить: "+(noTable(e)?e.message:"нет связи"));return} // загруженное раньше остаётся на экране
    main.innerHTML=noTable(e)
      ?`<div class="empty"><b>База ещё не готова</b>Supabase → SQL Editor → <code>001_tavern.sql</code><br><small>${esc(e.message||"")}</small></div>`
      :`<div class="empty"><b>Нет связи</b><small>${esc(e.message||"")}</small><button class="btn" id="again" style="align-self:center">Повторить</button></div>`;
    if($("#again"))$("#again").onclick=()=>{$("#again").disabled=true;load()};
  }
}
async function W(p){try{return ok(await p)}catch(e){console.error(e);toast(/duplicate key/i.test(e&&e.message||"")?"Такое уже есть":"Не удалось сохранить"+(e&&e.message?": "+e.message:" — проверь интернет"));throw e}}
async function addCards(rows){if(!rows.length)return[];const r=await W(sb.from("t_cards").insert(rows).select());S.cards.push(...r);return r}
async function updCard(c,patch){await W(sb.from("t_cards").update(patch).eq("id",c.id));Object.assign(c,patch);return c}
async function delCard(c){await W(sb.from("t_cards").delete().eq("id",c.id));S.cards=S.cards.filter(x=>x.id!==c.id)}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user&&!mode)load()});

/* ---------- интервальное повторение ----------
   0 не помню → завтра снова, 1 трудно → чуть дольше, 2 помню → промежуток × лёгкость, 3 легко → ещё больше.
   Если карточка пришла позже срока и всё равно помнится — половина опоздания идёт в зачёт. */
function nextCard(c,g,day=today()){
  const reps=c.reps||0;let ease=+c.ease||2.5,ivl=c.ivl||0;
  const late=c.last_seen?Math.max(0,daysBetween(c.last_seen,day)-ivl):0;
  if(g===0)return {ivl:1,ease:Math.max(1.3,Math.round((ease-.2)*100)/100),due:addDays(day,1),reps:reps+1,lapses:(c.lapses||0)+1,last_seen:day};
  if(!reps||!ivl)ivl=[0,1,3,5][g];
  else if(g===1){ivl=Math.max(ivl+1,Math.round(ivl*1.2));ease=Math.max(1.3,ease-.15)}
  else{
    const good=Math.max(ivl+1,Math.round((ivl+late/2)*ease));
    if(g===2)ivl=good;
    else{ivl=Math.max(good+1,Math.round((ivl+late/2)*ease*1.3));ease=Math.min(3.5,ease+.15)}
  }
  ivl=Math.min(365,ivl);
  return {ivl,ease:Math.round(ease*100)/100,due:addDays(day,ivl),reps:reps+1,last_seen:day};
}
// «не понимаю» в тексте: карточка снова часто
const forgot=c=>({ivl:1,due:addDays(today(),1),lapses:(c.lapses||0)+1,ease:Math.max(1.3,Math.round(((+c.ease||2.5)-.2)*100)/100)});
const dueCards=()=>S.cards.filter(c=>c.due<=today());
// тексты: не поняла → завтра, частично → через 3 дня, понятно → 7 дней, потом ×2,5
function nextText(t,r){const p=t&&t.ivl||0;const ivl=r==="no"?1:r==="part"?3:Math.min(180,p>=7?Math.round(p*2.5):7);return {ivl,due:addDays(today(),ivl)}}
const dueTexts=()=>S.texts.filter(t=>t.due&&t.due<=today()&&(!t.ref.startsWith("book:")||S.books.some(b=>b.id===t.ref.split(":")[1]))); // книги уже нет — перечитывать нечего
async function rateText(ref,title,r){
  const t=S.texts.find(x=>x.ref===ref),n=nextText(t,r);
  const row={ref,title,rating:r,...n,reads:(t?t.reads:0)+1,last_read:today()};
  if(t){await W(sb.from("t_texts").update(row).eq("id",t.id));Object.assign(t,row)}
  else S.texts.push(await W(sb.from("t_texts").insert(row).select().single()));
  toast("Текст вернётся "+dueLabel(n.due));
}

/* ---------- вход: тот же аккаунт, что в «Задачах» ---------- */
let lastEmail="";
function renderLogin(msg="",err=false){
  $("#top").hidden=true;
  main.innerHTML=`<form class="acard" id="login">
    <h2>🍺 Таверна</h2>
    <div class="fld"><label for="email">Почта</label><input id="email" type="email" autocomplete="email" required value="${esc(lastEmail)}"></div>
    <div class="fld"><label for="pass">Пароль</label><input id="pass" type="password" autocomplete="current-password" required></div>
    <div class="lrow"><button class="btn pri" type="submit">Войти</button><button class="btn" type="button" id="signup">Зарегистрироваться</button></div>
    <p class="meta" style="margin:0;min-height:2.8em;${err?"color:var(--danger)":""}">${esc(msg)}</p>
  </form>`;
  const creds=()=>{lastEmail=$("#email").value.trim();return {email:lastEmail,password:$("#pass").value}};
  $("#login").addEventListener("submit",async e=>{
    e.preventDefault();
    const {error}=await sb.auth.signInWithPassword(creds());
    if(error)renderLogin(authErr(error.message),true);
  });
  $("#signup").onclick=async()=>{
    const c=creds();
    if(!$("#login").reportValidity())return;
    if(c.password.length<6)return renderLogin("Пароль — минимум 6 символов",true);
    const {data,error}=await sb.auth.signUp({...c,options:{emailRedirectTo:location.origin+location.pathname}});
    if(error)return renderLogin(authErr(error.message),true);
    if(data&&data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length)return renderLogin("Такая почта уже зарегистрирована — просто войди",true);
    if(!data.session)renderLogin(`✉ Письмо отправлено на ${c.email}. Открой его, подтверди почту и войди.`);
  };
}
function authErr(m){
  if(/invalid login/i.test(m))return "Неверная почта или пароль";
  if(/not confirmed/i.test(m))return "Почта ещё не подтверждена — открой письмо";
  if(/already registered/i.test(m))return "Такая почта уже зарегистрирована — просто войди";
  if(/signups? not allowed|disabled/i.test(m))return "Регистрация сейчас закрыта";
  if(/rate limit/i.test(m))return "Слишком много попыток, подожди немного";
  return m;
}

/* ---------- отрисовка ---------- */
function render(){
  if(!S)return;
  closeSheet();
  const n=dueCards().length,cnt=$("#cntDue");cnt.hidden=!n;cnt.textContent=n;
  $("#tabs").hidden=!!mode;
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tab===tab));
  if(mode)return ({review:vReview,lesson:vLesson,read:vRead,book:vBook})[mode.k]();
  ({today:vToday,lessons:vLessons,words:vWords,books:vBooks})[tab]();
}
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;ls.set("tab",tab);if(tab!=="words")wq="";render();scrollTo(0,0)});
// второе нажатие сразу после смены экрана не считается: на месте нажатой кнопки уже другая (двойной щелчок «Показать» оценивал слово)
let freezeTill=0;
const freeze=(ms=500)=>{freezeTill=performance.now()+ms},frozen=()=>performance.now()<freezeTill;
main.addEventListener("click",e=>{if(frozen()){e.preventDefault();e.stopPropagation()}},true);
const go=(m)=>{mode=m;freeze();render();scrollTo(0,0)};
const quit=()=>{mode=null;freeze();render();scrollTo(0,0)};
const lessonDone=id=>S.lessons.find(x=>x.lesson===id);
const nextLesson=()=>LESSONS.find(x=>!lessonDone(x.id));
const textTitle=t=>t.title||t.ref;

function vToday(){
  const due=dueCards(),tx=dueTexts(),nl=nextLesson();
  const tomorrow=S.cards.filter(c=>c.due===addDays(today(),1)).length;
  const learned=S.cards.filter(c=>c.ivl>=21).length;
  const todayLog=S.log.filter(l=>l.day===today()).length;
  main.innerHTML=`
  <section class="hero">
    <div class="hnum">${due.length||"✓"}</div>
    <div class="htx"><b>${due.length?plural(due.length,"слово","слова","слов"):"На сегодня всё"}</b><span class="meta">${due.length?"на повторение":`завтра: ${tomorrow}`}</span></div>
    <div class="hbtns"><button class="btn pri" id="goReview" ${due.length?"":"disabled"}>Повторить</button><button class="btn" id="goTrain" title="Тренировка" ${S.cards.length?"":"disabled"}>🎴</button></div>
  </section>
  <div class="stats"><span>🗝️ ${S.cards.length}<small>слов</small></span><span>⭐ ${learned}<small>выучено</small></span><span>✔ ${todayLog}<small>сегодня</small></span></div>
  ${tx.length?`<section class="sec"><h2>📖 Перечитать</h2><div class="list">${tx.map(t=>`<button class="row" data-text="${esc(t.ref)}"><span class="ic">${t.rating==="no"?"😕":t.rating==="part"?"🤔":"😊"}</span><span class="tx"><span class="nm">${esc(textTitle(t))}</span><span class="meta">прочитано ${plural(t.reads,"раз","раза","раз")}</span></span></button>`).join("")}</div></section>`:""}
  ${nl?`<section class="sec"><h2>📜 Следующий урок</h2><div class="list">${lessonRow(nl)}</div></section>`:""}`;
  $("#goReview").onclick=startReview;
  $("#goTrain").onclick=()=>startTrain(S.cards);
  bindRows();
}
function lessonRow(x){
  const d=lessonDone(x.id),t=d&&S.texts.find(t=>t.ref===`lesson:${x.id}`),p=!d&&savedLesson(x.id);
  return `<button class="row" data-lesson="${x.id}"><span class="ic">${x.emoji}</span><span class="tx"><span class="nm">${x.n}. ${esc(x.title)}</span><span class="meta"><span class="en">${esc(x.en)}</span>${t&&t.due?` · <span title="Перечитать">📖 ${dueLabel(t.due)}</span>`:""}</span></span>${d?`<span class="badge b-ok">✓</span>`:p?`<span class="badge b-now" title="Продолжить">▶ ${p.step===1?exProg(p.ex,p.xi).join("/"):STEPS[p.step]}</span>`:""}</button>`;
}
function bindRows(){
  main.querySelectorAll("[data-lesson]").forEach(b=>b.onclick=()=>startLesson(b.dataset.lesson));
  main.querySelectorAll("[data-text]").forEach(b=>b.onclick=()=>openText(b.dataset.text));
}
function vLessons(){
  main.innerHTML=`<section class="sec"><h2>📜 The Lantern and the Thorn <span class="meta sp">${S.lessons.length} / ${LESSONS.length}</span></h2>
    <div class="list">${LESSONS.map(lessonRow).join("")}</div></section>`;
  bindRows();
}
let wq="";
function vWords(){
  main.innerHTML=`<div class="toolbar"><input id="wq" type="search" placeholder="🔍" value="${esc(wq)}" aria-label="Поиск"><button class="btn" id="trainW" title="Тренировка">🎴</button><button class="btn" id="addW" title="Добавить слово">＋</button></div>
    <section class="sec"><h2 id="wcount"></h2><div class="list" id="wlist"></div></section>`;
  const draw=()=>{
    const q=wq.trim().toLowerCase();
    const rows=S.cards.filter(c=>!q||c.word.includes(q)||(c.tr||"").toLowerCase().includes(q)).sort((a,b)=>a.word.localeCompare(b.word));
    $("#wcount").textContent=`🗝️ ${rows.length}`;
    $("#wlist").innerHTML=rows.length?rows.map(c=>`<button class="row" data-card="${c.id}"><span class="ic">${pic(c.word,c.emoji)||"·"}</span><span class="tx"><span class="nm en">${esc(c.word)}</span><span class="meta">${esc(c.tr||"—")}</span></span><span class="badge ${c.due<=today()?"b-now":"b-date"}">${dueLabel(c.due)}</span></button>`).join(""):`<div class="row meta">—</div>`;
    $("#wlist").querySelectorAll("[data-card]").forEach(b=>b.onclick=()=>editCard(S.cards.find(c=>c.id===b.dataset.card)));
  };
  $("#wq").oninput=e=>{wq=e.target.value;draw()};
  $("#addW").onclick=()=>{const q=wq.trim();editCard(null,null,q&&!$("#wlist [data-card]")?(/[а-яё]/i.test(q)?{tr:q}:{word:q}):{})}; // не нашлось — сразу в новое слово
  $("#trainW").onclick=()=>{const q=wq.trim().toLowerCase();startTrain(S.cards.filter(c=>!q||c.word.includes(q)||(c.tr||"").toLowerCase().includes(q)))};
  draw();
}

/* ---------- повторение ---------- */
function startReview(){
  const q=shuffle(dueCards()).sort((a,b)=>a.due.localeCompare(b.due)).map(c=>c.id);
  if(q.length)go({k:"review",q,i:0,shown:false,total:q.length,again:new Set()});
}
// тренировка в любой момент: сроки не меняются, только «не помню» делает слово чаще
function startTrain(list){
  if(!list.length)return toast("Нет слов");
  const weak=[...list].sort((a,b)=>(b.lapses-a.lapses)||(a.ivl-b.ivl)||(Math.random()-.5)).slice(0,20);
  const q=shuffle(weak).map(c=>c.id);
  go({k:"review",practice:true,q,i:0,shown:false,total:q.length,again:new Set()});
}
const GR=[["Не помню","g0"],["Трудно","g1"],["Помню","g2"],["Легко","g3"]];
const GT=[["Не помню","g0",0],["Помню","g2",2]];
function hl(text,word){ // выделить слово в примере
  return esc(text).replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g,t=>forms(t).includes(word)||baseOf(t.toLowerCase())===word?`<b>${t}</b>`:t);
}
function vReview(){
  const m=mode;
  if(m.i>=m.q.length){
    main.innerHTML=`<div class="topbar"><button class="icon" id="rx" title="Закрыть">✕</button><div class="bar"><i style="width:100%"></i></div><span class="meta">${m.practice?"🎴 ":""}${m.total} / ${m.total}</span></div>
      <section class="rcard done"><div class="rword">✓</div><div class="meta">${plural(m.total,"слово","слова","слов")}</div></section>
      <div class="rbtns one"><button class="btn pri" id="rq">Готово</button></div>`;
    $("#rq").onclick=quit;$("#rx").onclick=quit;return;
  }
  const c=S.cards.find(x=>x.id===m.q[m.i]);if(!c){m.i++;return vReview()}
  const prog=Math.max(0,Math.min(m.i-m.again.size,m.total)); // слово пройдено, когда оценено не «Не помню» или показано второй раз
  main.innerHTML=`<div class="topbar"><button class="icon" id="rx" title="Закрыть">✕</button><div class="bar"><i style="width:${prog/m.total*100}%"></i></div><span class="meta">${m.practice?"🎴 ":""}${prog} / ${m.total}</span></div>
  <section class="rcard">
    <div class="rword en">${esc(c.word)}</div>
    <div class="rback" ${m.shown?"":"style=visibility:hidden"}>
      <div class="remo">${pic(c.word,c.emoji)}</div>
      <div class="rtr">${esc(c.tr)||`<span class="meta">—</span>`}</div>
      ${c.ex?`<div class="rex en">${hl(c.ex,c.word)}</div>`:""}
      ${c.ex_ru?`<div class="meta">${esc(c.ex_ru)}</div>`:""}
      <button class="rnote" id="rnote" title="Изменить">${c.note?`💭 ${esc(c.note)}`:"💭 ✎"}</button>
    </div>
  </section>
  <div class="rbtns${m.practice&&m.shown?" two":""}">${m.shown&&m.practice?GT.map(([t,cl,g])=>`<button class="btn ${cl}" data-g="${g}">${t}<small></small></button>`).join(""):m.shown?GR.map(([t,cl],g)=>`<button class="btn ${cl}" data-g="${g}">${t}<small>${m.again.has(c.id)?"":ivlLabel(nextCard(c,g).ivl)}</small></button>`).join(""):`<button class="btn pri wide" id="show">Показать</button>`}</div>`;
  $("#rx").onclick=quit;
  $("#rnote").onclick=()=>editCard(c,()=>vReview());
  if(!m.shown)$("#show").onclick=()=>{m.shown=true;freeze();vReview()};
  else main.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>grade(c,+b.dataset.g));
}
async function grade(c,g){
  const m=mode;
  if(m.practice){if(g===0&&!m.again.has(c.id))updCard(c,forgot(c)).catch(()=>{})}
  else if(!m.again.has(c.id)){ // второй показ «не помню» в той же сессии — только тренировка
    const patch=nextCard(c,g);
    updCard(c,patch).catch(()=>{});
    sb.from("t_log").insert({card_id:c.id,grade:g}).then(r=>{if(!r.error)S.log.push({day:today(),card_id:c.id,grade:g})});
  }
  if(g===0&&!m.again.has(c.id)){m.again.add(c.id);m.q.push(c.id)}
  m.i++;m.shown=false;freeze(350);vReview(); // меньше, чем после «Показать»: здесь быстрое нажатие бывает нарочно
}
document.addEventListener("keydown",e=>{
  if(!mode||mode.k!=="review"||$(".modal")||/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;
  if((e.repeat||frozen())&&/^([ 1-4]|Enter)$/.test(e.key))return e.preventDefault();
  if(e.key===" "||e.key==="Enter"){if(!mode.shown&&mode.i<mode.q.length){e.preventDefault();mode.shown=true;freeze();vReview()}}
  else if(mode.shown&&/^[1-4]$/.test(e.key)){const c=S.cards.find(x=>x.id===mode.q[mode.i]);let g=+e.key-1;if(mode.practice){if(g>1)return;g=g?2:0}if(c)grade(c,g)}
});

/* ---------- урок: слова → упражнения → история → вопросы → оценка ---------- */
const STEPS=["Слова","Практика","История","Вопросы","Итог"];
function startLesson(id){
  const l=L[id];if(!l)return;
  const done=!!lessonDone(id);
  const saved=!done&&restoreLesson(l);
  go(saved||{k:"lesson",id,step:done?2:0,max:done?4:0,done,unk:new Map()}); // пройденный — сразу с истории
  if(saved&&saved.step===2)toPar(saved.par);
}
// место в истории урока: номер абзаца и доля его высоты у верхнего края текста (точки экрана зависят от ширины и размера шрифта)
const parTop=()=>{const b=main.querySelector(".topbar");return b?b.getBoundingClientRect().bottom+8:100};
function parNow(){
  const top=parTop(),ps=[...main.querySelectorAll(".reader p")],i=scrollY<10?-1:ps.findIndex(p=>p.getBoundingClientRect().bottom>top);
  if(i<0)return scrollY<10||!ps.length?null:[ps.length-1,1];
  const r=ps[i].getBoundingClientRect();return [i,Math.round(Math.max(-1,(top-r.top)/r.height)*100)/100];
}
function toPar(v){
  const p=v&&main.querySelectorAll(".reader p")[v[0]];if(!p)return;
  // панель с ✕ прилипает при прокрутке: сначала прокрутить, потом мерить от её настоящего места
  for(let k=0;k<2;k++){const r=p.getBoundingClientRect();scrollTo(0,scrollY+r.top+v[1]*r.height-parTop())}
}
let parT;
const keepPar=()=>{const m=mode;if(m&&m.k==="lesson"&&m.step===2&&main.querySelector(".reader")){m.par=parNow();saveLesson()}};
addEventListener("scroll",()=>{clearTimeout(parT);const m=mode;if(m&&m.k==="lesson"&&m.step===2)parT=setTimeout(()=>{if(mode===m)keepPar()},300)},{passive:true});
addEventListener("pagehide",keepPar);
document.addEventListener("visibilitychange",()=>{if(document.hidden)keepPar()});
// ход непройденного урока — на устройстве (tav:les:<пользователь>), чтобы обновление страницы его не теряло
const lesKey=()=>"les:"+(user?user.id:"");
const savedLesson=id=>ls.get(lesKey(),{})[id]||null;
function putLesson(id,v){const a=ls.get(lesKey(),{});if(v)a[id]=v;else delete a[id];ls.set(lesKey(),a)}
function saveLesson(){
  const m=mode;if(!m||m.k!=="lesson"||m.done||!m.max)return;
  putLesson(m.id,{step:m.step,max:m.max,xi:m.xi||0,late:!!m.late,par:m.par||null,
    ex:(m.ex||[]).map(x=>({t:x.t,w:x.w.w,o:x.opts.map(o=>o.w),p:x.pick?x.pick.w:null,r:x.redo})),
    qs:m.qs?m.qs.map(q=>({q:q.q,ord:q.ord,pick:q.pick})):null,
    unk:[...m.unk].map(([k,u])=>[k,{id:u.card.id,created:!!u.created,prev:u.prev||null}])});
}
function restoreLesson(l){
  const s=savedLesson(l.id);if(!s)return null;
  try{
    const own=w=>{const x=l.words.find(x=>x.w===w);if(!x)throw new Error("урок изменился");return x};
    const by=w=>l.words.find(x=>x.w===w)||poolOf(l).find(x=>x.w===w)||own(w); // неверные варианты бывают из пройденных уроков
    const m={k:"lesson",id:l.id,step:s.step,max:s.max,xi:s.xi,late:s.late,par:s.par||null,unk:new Map()};
    m.ex=s.ex.map(x=>({t:x.t,w:own(x.w),opts:x.o.map(by),pick:x.p?by(x.p):null,redo:x.r}));
    if(m.step===1&&!m.ex.length)throw new Error("нет упражнений");
    if(m.ex[m.xi]&&m.ex[m.xi].pick===m.ex[m.xi].w)m.xi++; // ответила верно, а следующее показать не успели
    if(s.qs)m.qs=l.questions.map((q,i)=>{const z=s.qs[i];if(!z||z.q!==q.q||z.ord.length!==q.o.length)throw new Error("урок изменился");return {...q,ord:z.ord,pick:z.pick}});
    if(m.step>=3&&!m.qs)throw new Error("нет вопросов");
    for(const [k,u] of s.unk){const c=S.cards.find(c=>c.id===u.id);if(c)m.unk.set(k,{card:c,created:u.created,prev:u.prev})}
    return m;
  }catch(e){console.warn(e);putLesson(l.id,null);return null}
}
// шаги вверху: к уже открытым можно вернуться
function stepsBar(m){return `<div class="steps">${STEPS.map((s,j)=>`<button type="button" data-step="${j}" class="${j===m.step?"cur":j<=m.max?"on":""}" ${j>m.max||j===m.step?"disabled":""}>${s}</button>`).join("")}</div>`}
function toStep(n){
  const m=mode,l=L[m.id];
  keepPar(); // место в истории — до смены экрана
  if(n===1){
    if(!m.ex||m.xi>=m.ex.length){m.ex=buildEx(l);m.xi=0}
    else if(m.ex[m.xi].pick===m.ex[m.xi].w)m.xi++; // ответила верно и ушла раньше, чем вопрос сменился сам
  }
  if(n>=3&&!m.qs)m.qs=l.questions.map(q=>({...q,ord:shuffle(q.o.map((_,i)=>i)),pick:null}));
  m.step=n;m.max=Math.max(m.max,n);
  closeSheet();freeze();vLesson();scrollTo(0,0);
  if(m.step===2)toPar(m.par);
}
function vLesson(){
  const m=mode,l=L[m.id];
  saveLesson();
  const top=`<div class="topbar"><button class="icon" id="lx" title="Закрыть">✕</button><span class="tt">${l.emoji} ${esc(l.title)}</span>${m.max&&!m.done?`<button class="icon" id="lr" title="Начать сначала">↺</button>`:""}</div>${stepsBar(m)}`;
  if(m.step===0){
    main.innerHTML=top+`<div class="list">${l.words.map(w=>`<div class="row wrow"><span class="ic">${pic(w.w,w.e)}</span><span class="tx"><span class="nm en">${esc(w.w)} <span class="tr">— ${esc(w.tr)}</span></span><span class="meta en">${hl(w.ex,w.w)}</span><span class="meta">${esc(w.ex_ru)}</span></span></div>`).join("")}</div>
      <div class="foot"><button class="btn pri" id="next">Дальше</button></div>`;
    $("#next").onclick=()=>toStep(1);
  }else if(m.step===1){if(!vExercise(top))return}
  else if(m.step===2){
    main.innerHTML=top+`<h1 class="story-t en">${esc(l.en)}</h1>${reader(l.story,{words:l.words.map(w=>w.w)})}
      <details class="gram"><summary>📖 ${esc(l.grammar.title)}</summary><div>${l.grammar.text}</div></details>
      <div class="foot"><button class="btn pri" id="next">Дальше</button></div>`;
    bindReader(`lesson:${l.id}`);
    $("#next").onclick=()=>toStep(3);
  }else if(m.step===3){
    const done=m.qs.every(q=>q.pick!=null),right=m.qs.filter(q=>q.pick===q.a).length;
    main.innerHTML=top+m.qs.map((q,qi)=>`<section class="qbox"><div class="q en">${esc(q.q)}</div>${q.ord.map(i=>`<button class="opt en ${q.pick==null?"":i===q.a?"ok":i===q.pick?"bad":""}" data-q="${qi}" data-i="${i}" ${q.pick!=null?"disabled":""}>${esc(q.o[i])}</button>`).join("")}</section>`).join("")
      +`<div class="foot"><span class="meta">${done?`✔ ${right} / ${m.qs.length}`:""}</span><button class="btn pri" id="next" ${done?"":"disabled"}>Дальше</button></div>`;
    main.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{m.qs[+b.dataset.q].pick=+b.dataset.i;const y=scrollY;vLesson();scrollTo(0,y)});
    $("#next").onclick=()=>toStep(4);
  }else{
    main.innerHTML=top+rateBox(m.unk.size);
    bindRate(async r=>{
      if(m.late){await lessonCards(l);m.late=false} // после упражнений карточки не записались (не было связи)
      await rateText(`lesson:${l.id}`,`${l.n}. ${l.title}`,r);
      if(!lessonDone(l.id)){const row=await W(sb.from("t_lessons").upsert({lesson:l.id},{onConflict:"user_id,lesson"}).select().single());S.lessons.push(row)}
      putLesson(l.id,null);quit();
    });
  }
  $("#lx").onclick=quit;
  if($("#lr"))$("#lr").onclick=()=>{if(confirm("Начать урок сначала?")){putLesson(l.id,null);go({k:"lesson",id:l.id,step:0,max:0,unk:new Map()})}};
  main.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>toStep(+b.dataset.step));
}
function rateBox(unk){
  return `<section class="rate"><div class="q">Как понятен текст?</div>
    ${unk?`<div class="meta">❓ ${plural(unk,"слово","слова","слов")} → 🗝️</div>`:""}
    <div class="rbtns three"><button class="btn g0" data-r="no">😕<small>не поняла</small></button><button class="btn g1" data-r="part">🤔<small>частично</small></button><button class="btn g2" data-r="yes">😊<small>понятно</small></button></div></section>`;
}
function bindRate(fn){main.querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{main.querySelectorAll("[data-r]").forEach(x=>x.disabled=true);try{await fn(b.dataset.r)}catch(e){main.querySelectorAll("[data-r]").forEach(x=>x.disabled=false)}})}

// упражнения: перевод слова и пропуск в предложении; ошибки возвращаются в конец
function buildEx(l){
  const ws=l.words;
  return [...shuffle(ws).map(w=>({t:"tr",w})),...shuffle(ws).map(w=>({t:"gap",w}))].map(x=>{
    const others=x.t==="gap"?gapOthers(x.w,l.words,poolOf(l)):shuffle(ws.filter(o=>o!==x.w)).slice(0,3);
    return {...x,opts:shuffle([x.w,...others]),pick:null,redo:false};
  });
}
const isWord=(t,word)=>forms(t).includes(word)||t.toLowerCase().startsWith(word);
function gapped(ex,word,shown){ // shown — уже ответила: в пропуске стоит верное слово
  let done=false;
  return esc(ex).replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g,t=>{if(!done&&isWord(t,word)){done=true;return `<span class="gap">${shown?t:"_____"}</span>`}return t});
}
// слово в той форме, в какой оно стоит в своём предложении (warn → warned); в пропусках так показаны все варианты
const formIn=w=>((w.ex.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)||[]).find(t=>isWord(t,w.w))||w.w).toLowerCase();
// неверные варианты пропуска — в той же форме, что верный ответ, чтобы он не угадывался по окончанию: сначала слова той же
// части речи, у которых эта форма стоит в примере, потом те же слова с окончанием по правилам. Слова — из этого и пройденных уроков
const IRRV=new Set(["kneel","bleed","forgive","wolf","prove"]); // окончание по правилам не подходит (сверяет tools/check_lessons.js)
const VERBY=new Set(["trick","crown","bargain","guard","lock","curse","poison","mask","chain","cage","vow"]); // в уроке существительное, но бывает и глаголом
const NOPL=new Set(["midnight","moonlight","iron","ale","wine","stew","mercy","revenge","breath","truth"]); // без множественного числа и без a/an
const isV=s=>/(ть|ться|ти|чь)$/.test(s.split(" ")[0])&&!/([ео]сть|ночь)$/.test(s.split(" ")[0]); // «встать на колени» — глагол, «месть» и «полночь» — нет
const senses=w=>w.tr.replace(/\(.*?\)/g,"").split(/[,;]/).map(s=>s.trim());
// форма слова в его примере: "" — начальная, s, ed (и неправильное причастие), ing
function formType(w){const f=formIn(w);return f===w.w?(/[^su]s$/.test(f)?"s":""):/ing$/.test(f)?"ing":/s$/.test(f)?"s":"ed"}
function wPos(w){const t=formType(w),s=senses(w)[0];return t==="ed"||t==="ing"||isV(s)?"v":/^\S+(ый|ий|ой)$/.test(s)?"a":"n"}
const canBe=(w,p)=>p==="v"?wPos(w)==="v"||VERBY.has(w.w)||senses(w).some(isV):wPos(w)===p;
function inflect(w,t){
  const cvc=/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w)?w+w.slice(-1):w;
  if(t==="s")return /(s|x|z|ch|sh)$/.test(w)?w+"es":/[^aeiou]y$/.test(w)?w.slice(0,-1)+"ies":w+"s";
  if(t==="ed")return /e$/.test(w)?w+"d":/[^aeiou]y$/.test(w)?w.slice(0,-1)+"ied":cvc+"ed";
  return /ie$/.test(w)?w.slice(0,-2)+"ying":/[^e]e$/.test(w)?w.slice(0,-1)+"ing":cvc+"ing";
}
// как показать слово o среди вариантов, когда верный ответ — w
function optText(o,w){
  const t=formType(w);
  if(o===w||t&&formType(o)===t)return formIn(o);
  if(!t)return o.w;
  return canBe(o,wPos(w))&&!IRRV.has(o.w)&&!/[^su]s$/.test(o.w)?inflect(o.w,t):o.w;
}
// 0 — та же форма и часть речи, 1 — та же форма, 2 — форма другая
const optTier=(o,w)=>{const t=formType(w),ok=t?formType(o)===t||optText(o,w)!==o.w:!/[^su]s$/.test(o.w);return !ok?2:canBe(o,wPos(w))?0:1};
function gapOthers(w,own,pool){
  const r=[],seen=new Set([formIn(w)]);
  // хуже всех: слово уже стоит в этом предложении или отсекается артиклем (a ale, a iron)
  const toks=w.ex.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)||[],art=(toks[toks.findIndex(t=>isWord(t,w.w))-1]||"").toLowerCase();
  const odd=o=>toks.some(t=>isWord(t,o.w))||NOPL.has(o.w)&&(formType(w)==="s"||/^an?$/.test(art))||art==="a"&&/^[aeiou]/.test(o.w)||art==="an"&&/^[^aeiou]/.test(o.w);
  const rank=o=>optTier(o,w)*4+(odd(o)?2:0)+(own.includes(o)?0:1);
  for(const o of shuffle(pool.filter(o=>o!==w)).sort((a,b)=>rank(a)-rank(b))){
    const t=optText(o,w);if(seen.has(t))continue;
    seen.add(t);r.push(o);if(r.length===3)break;
  }
  return r;
}
const poolOf=l=>LESSONS.slice(0,LESSONS.findIndex(x=>x.id===l.id)+1).flatMap(x=>L[x.id].words);
// пройдено / всего, как в повторении: ошибка общее число не увеличивает и полосу не двигает
function exProg(ex,xi){
  const total=ex.filter(x=>!(x.redo||x.r)).length,now=ex[xi],ans=now&&(now.pick||now.p)?1:0;
  return [Math.max(0,Math.min(total,xi+ans-(ex.length-total))),total];
}
function vExercise(top){
  const m=mode,l=L[m.id];
  if(m.xi>=m.ex.length){finishEx(l);return false}
  const x=m.ex[m.xi],answered=x.pick!=null,right=answered&&x.pick===x.w,[done,total]=exProg(m.ex,m.xi);
  const prompt=x.t==="tr"
    ?`<div class="xw en">${esc(x.w.w)}</div><div class="xe" ${answered?"":"style=visibility:hidden"}>${pic(x.w.w,x.w.e)}</div>`
    :`<div class="xs en">${gapped(x.w.ex,x.w.w,answered)}</div><div class="meta">${esc(x.w.ex_ru)}</div>`;
  main.innerHTML=top+`<div class="xbar"><div class="bar"><i style="width:${done/total*100}%"></i></div><span class="meta">${done} / ${total}</span></div>
    <section class="xbox">${prompt}</section>
    <div class="opts">${x.opts.map((o,i)=>`<button class="opt ${x.t==="gap"?"en":""} ${!answered?"":o===x.w?"ok":o===x.pick?"bad":""}" data-o="${i}" ${answered?"disabled":""}>${esc(x.t==="tr"?o.tr:optText(o,x.w))}</button>`).join("")}</div>
    <div class="foot"><span class="meta">${answered&&!right?`<span title="Вернётся в конце">↻</span>`:""}</span><button class="btn pri" id="next" style="visibility:${answered&&!right?"visible":"hidden"}">Дальше</button></div>`;
  main.querySelectorAll("[data-o]").forEach(b=>b.onclick=()=>{
    x.pick=x.opts[+b.dataset.o];
    if(x.pick!==x.w)m.ex.push({...x,pick:null,redo:true,opts:shuffle(x.opts)});
    vLesson();
    if(x.pick===x.w)setTimeout(()=>{if(mode===m&&m.step===1&&m.ex[m.xi]===x){m.xi++;vLesson()}},650);
  });
  $("#next").onclick=()=>{m.xi++;vLesson()};
  return true;
}
// на компьютере: 1–4 — вариант, Enter или пробел — «Дальше» (на словах и в упражнениях; в истории Enter не пролистывает главу)
document.addEventListener("keydown",e=>{
  const m=mode;
  if(!m||m.k!=="lesson"||m.step>1||$(".modal")||e.ctrlKey||e.altKey||e.metaKey)return;
  let b=null;
  if(e.key==="Enter"||e.key===" ")b=$("#next");
  else if(m.step===1&&/^[1-4]$/.test(e.key))b=main.querySelector(`[data-o="${e.key-1}"]`);
  else return;
  if(e.target.closest&&e.target.closest("button")&&e.target!==b&&!/^[1-4]$/.test(e.key))return; // Enter на другой кнопке — её нажатие
  e.preventDefault();
  if(b&&!b.disabled&&!e.repeat&&!frozen()&&b.style.visibility!=="hidden")b.click();
});
async function lessonCards(l){
  const rows=l.words.filter(w=>!cardOf(w.w)).map(w=>({word:w.w,tr:w.tr,emoji:w.e,ex:w.ex,ex_ru:w.ex_ru,src:`lesson:${l.id}`,due:addDays(today(),1)}));
  await addCards(rows);if(rows.length)toast(`🗝️ +${rows.length}`);
}
async function finishEx(l){
  const m=mode;if(m.fin)return;m.fin=true;
  try{await lessonCards(l)}catch(e){m.late=true}
  m.fin=false;if(mode===m)toStep(2);
}

/* ---------- читалка: щелчок по слову → перевод, «не понимаю» → карточка ---------- */
function reader(paras,o={}){
  const lw=new Set(o.words||[]);
  return `<article class="reader en">${paras.map(p=>`<p>${esc(p).replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g,t=>{
    const fs=forms(t),cls=fs.some(f=>lw.has(f))?" lw":"";
    return `<span class="w${cls}" data-w="${esc(t)}">${t}</span>`})}</p>`).join("")}</article>`;
}
function bindReader(src){
  const art=main.querySelector(".reader");
  // уже отмеченные в этом чтении
  for(const k of mode.unk.keys())art.querySelectorAll(".w").forEach(s=>{if(lookup(s.dataset.w).key===k)s.classList.add("unk")});
  art.onclick=e=>{const s=e.target.closest(".w");if(s)openWord(s,src)};
}
function sentenceOf(span){
  const p=span.closest("p"),txt=p.textContent;let pos=0;
  for(const n of p.childNodes){if(n===span)break;pos+=n.textContent.length}
  const parts=txt.split(/(?<=[.!?…][”"’]?)\s+/);let acc=0;
  for(const s of parts){const i=txt.indexOf(s,acc);if(pos>=i&&pos<i+s.length)return s.trim();acc=i+s.length}
  return txt.slice(0,200);
}
function openWord(span,src){
  if(!BIG&&!lookup(span.dataset.w).tr){loadBig().then(()=>{if(BIG)openWord(span,src)})}
  main.querySelectorAll(".w.sel").forEach(x=>x.classList.remove("sel"));span.classList.add("sel");
  const raw=span.dataset.w,f=lookup(raw),marked=mode.unk.has(f.key),c=f.card||cardOf(f.key);
  sheet.innerHTML=`<div class="wrap sh-in">
    <div class="sw"><b class="en">${esc(raw)}</b>${f.key!==raw.toLowerCase()?`<span class="meta en">→ ${esc(f.key)}${f.show?` — ${esc(f.show)}`:""}</span>`:""}<span class="semo">${c?pic(c.word,c.emoji):""}</span><button class="icon" id="sx" title="Закрыть">✕</button></div>
    ${f.tr?`<div class="str">${esc(f.tr)}</div>`:`<input id="str" class="str-in" placeholder="перевод" value="">`}
    <div class="meta smeta">${c?`🗝️ ${dueLabel(c.due)}`:""}</div>
    <div class="srow"><a class="btn" target="_blank" rel="noopener" href="https://translate.google.com/?sl=en&tl=ru&op=translate&text=${encodeURIComponent(raw)}" title="Переводчик">🌐</a>
      <button class="btn ${marked?"on":""}" id="unk">❓ Не понимаю</button></div></div>`;
  sheet.hidden=false;document.body.classList.add("has-sheet");
  $("#sx").onclick=closeSheet;
  $("#unk").onclick=async()=>{
    $("#unk").disabled=true;
    try{
      if(marked){ // снять отметку: вернуть как было
        const u=mode.unk.get(f.key);
        if(u.created)await delCard(u.card);else await updCard(u.card,u.prev);
        mode.unk.delete(f.key);
      }else if(c){
        const prev={ivl:c.ivl,due:c.due,lapses:c.lapses,ease:c.ease};
        await updCard(c,forgot(c));mode.unk.set(f.key,{card:c,prev});
      }else{
        const tr=f.base||f.tr||($("#str")&&$("#str").value.trim())||"";
        const [nc]=await addCards([{word:f.key,tr,ex:sentenceOf(span),src,due:addDays(today(),1)}]);
        mode.unk.set(f.key,{card:nc,created:true});
      }
      saveLesson();
      main.querySelectorAll(".w").forEach(s=>{if(lookup(s.dataset.w).key===f.key)s.classList.toggle("unk",mode.unk.has(f.key))});
      openWord(span,src);
    }catch(e){$("#unk").disabled=false}
  };
}
function closeSheet(){sheet.hidden=true;sheet.innerHTML="";document.body.classList.remove("has-sheet");main.querySelectorAll(".w.sel").forEach(x=>x.classList.remove("sel"))}

/* ---------- перечитать текст ---------- */
function openText(ref){
  if(ref.startsWith("lesson:"))return go({k:"read",ref,unk:new Map()});
  const [,id,n,p]=ref.split(":");openBook(id,+n,+(p||0));
}
function vRead(){
  const m=mode,l=L[m.ref.slice(7)];if(!l)return quit();
  main.innerHTML=`<div class="topbar"><button class="icon" id="lx" title="Закрыть">✕</button><span class="tt">${l.emoji} ${esc(l.title)}</span></div>
    <h1 class="story-t en">${esc(l.en)}</h1>${reader(l.story,{words:l.words.map(w=>w.w)})}${rateBox(0)}`;
  bindReader(m.ref);
  $("#lx").onclick=quit;
  bindRate(async r=>{await rateText(m.ref,`${l.n}. ${l.title}`,r);quit()});
}

/* ---------- книги (EPUB) ---------- */
function vBooks(){
  const bs=[...S.books].sort((a,b)=>b.created_at.localeCompare(a.created_at));
  main.innerHTML=`<div class="toolbar"><span class="meta" style="margin-right:auto">📚 ${bs.length}</span><button class="btn" id="addB">＋ EPUB</button></div>
    <div class="list">${bs.length?bs.map(b=>`<button class="row" data-book="${b.id}"><span class="ic">📖</span><span class="tx"><span class="nm en">${esc(b.title)}</span><span class="meta">${esc(b.author||"")}</span></span><span class="badge b-date">${posOf(b).n+1} / ${b.chapters}</span></button>`).join(""):`<div class="row meta">—</div>`}</div>`;
  $("#addB").onclick=()=>$("#epub").click();
  main.querySelectorAll("[data-book]").forEach(x=>x.onclick=()=>{const b=S.books.find(b=>b.id===x.dataset.book);const q=posOf(b);openBook(b.id,q.n,q.p)});
}
$("#epub").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(f)try{await importEpub(f)}catch(err){console.error(err);toast("Не удалось открыть книгу: "+(err.message||err))}};

const normPath=p=>{const out=[];for(const s of p.split("/")){if(s==="..")out.pop();else if(s&&s!==".")out.push(s)}return out.join("/")};
function parseX(text){
  let d=new DOMParser().parseFromString(text,"application/xhtml+xml");
  if(d.getElementsByTagName("parsererror").length)d=new DOMParser().parseFromString(text,"text/html");
  return d;
}
// абзацы файла; head — похоже на заголовок главы (h1–h3, класс chapter/title, «Chapter 5», «Prologue», «12»)
const HEADRX=/^(chapter|prologue|epilogue|part|book|interlude)\b[^.!?]{0,40}$|^\d{1,3}\.?$/i;
function blocks(doc){
  const body=doc.body||doc.getElementsByTagName("body")[0];if(!body)return[];
  const clean=s=>s.replace(/\s+/g," ").trim();
  const bl=[...body.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,blockquote")].filter(el=>!el.querySelector("p"));
  if(!bl.length)return body.textContent.split(/\n\s*\n/).map(clean).filter(Boolean).map(t=>({t,head:false}));
  return bl.map(el=>{const t=clean(el.textContent);
    return {t,head:t.length<80&&(/^h[1-3]$/i.test(el.tagName)||/chapter|title/i.test(el.className)||HEADRX.test(t))}}).filter(b=>b.t);
}
// главы: новая — с каждого заголовка и каждого файла; оглавление и пустые страницы выбросить, короткое — приклеить к следующей
function chapters(files){
  const raw=[];let cur=null;
  const flush=()=>{if(cur&&(cur.title||cur.paras.length))raw.push(cur);cur={title:"",paras:[]}};
  for(const bs of files){flush();for(const b of bs){if(b.head){flush();cur.title=b.t}else cur.paras.push(b.t)}}
  flush();
  const len=c=>c.paras.join(" ").length,out=[];
  for(let i=0;i<raw.length;i++){
    const c=raw[i],nx=raw[i+1];
    if(/^(contents|table of contents|document outline)$/i.test(c.title||c.paras[0]||""))continue;
    const shortP=c.paras.filter(p=>p.length<30||HEADRX.test(p)).length;
    if(c.paras.length>=5&&shortP/c.paras.length>.6)continue; // список коротких строк — оглавление
    if(len(c)<400){
      if(nx&&!c.paras.length&&!nx.title){nx.title=c.title;continue} // «Глава 1» отдельным файлом
      if(c.paras.every(p=>p.length<40))continue;                    // оглавление, карта, посвящение
      if(nx){nx.paras.unshift(...(c.title?[c.title]:[]),...c.paras);if(!nx.title)nx.title=c.title;continue}
    }
    out.push(c);
  }
  // слишком длинные куски (глав нет в разметке) — делить по ~25 тыс. знаков
  const res=[];
  for(const c of out){
    let part=[],n=0,k=1;const total=len(c),t=c.title||(c.paras[0]&&c.paras[0].length<=40?c.paras[0]:"");
    if(total<=40000){res.push({title:t,body:c.paras.join("\n")});continue}
    for(const p of c.paras){part.push(p);n+=p.length;if(n>=25000){res.push({title:`${t||"…"} (${k++})`,body:part.join("\n")});part=[];n=0}}
    if(part.length)res.push({title:`${t||"…"} (${k})`,body:part.join("\n")});
  }
  res.forEach((c,i)=>{if(!c.title)c.title=String(i+1)});
  return res;
}
async function importEpub(file){
  toast("📖 …");
  const zip=await JSZip.loadAsync(file);
  const cont=await zip.file("META-INF/container.xml").async("text");
  const opfPath=/full-path="([^"]+)"/.exec(cont)[1],base=opfPath.includes("/")?opfPath.replace(/[^/]+$/,""):"";
  const opf=new DOMParser().parseFromString(await zip.file(opfPath).async("text"),"application/xml");
  const meta=n=>{const el=opf.getElementsByTagNameNS("*",n)[0];return el?el.textContent.trim():""};
  const title=meta("title")||file.name.replace(/\.epub$/i,""),author=meta("creator"),lang=meta("language");
  if(lang&&!/^en/i.test(lang)&&!confirm(`Язык книги: ${lang}. Всё равно добавить?`))return;
  const man={};for(const it of opf.getElementsByTagNameNS("*","item"))man[it.getAttribute("id")]=it.getAttribute("href");
  const spine=[...opf.getElementsByTagNameNS("*","itemref")].map(r=>man[r.getAttribute("idref")]).filter(Boolean);
  const files=[];
  for(const href of spine){
    const f=zip.file(normPath(base+decodeURIComponent(href.split("#")[0])));if(!f)continue;
    files.push(blocks(parseX(await f.async("text"))));
  }
  const chs=chapters(files);
  if(!chs.length)throw new Error("в файле не нашлось текста");
  const words=chs.reduce((s,c)=>s+c.body.split(/\s+/).length,0);
  const start=Math.max(0,chs.findIndex(c=>/^(prologue|chapter (1|one)\b)/i.test(c.title)));
  const b=await W(sb.from("t_books").insert({title,author,chapters:chs.length,pos:start}).select().single());
  try{
    for(let i=0;i<chs.length;i+=8){
      toast(`📖 ${Math.min(i+8,chs.length)} / ${chs.length}`);
      await W(sb.from("t_chapters").insert(chs.slice(i,i+8).map((c,j)=>({book_id:b.id,n:i+j,title:c.title.slice(0,200),body:c.body}))));
    }
  }catch(e){await sb.from("t_books").delete().eq("id",b.id);throw e}
  S.books.push(b);render();toast(`📖 ${title}: ${plural(chs.length,"глава","главы","глав")}, ~${Math.round(words/1000)} тыс. слов`);
}
// главы делятся на части ~5 минут чтения (~450 слов) по границам абзацев; короткий хвост приклеивается
const PART_WORDS=450;
function partsOf(body){
  const ps=body.split("\n"),out=[];let cur=[],n=0;
  for(const p of ps){cur.push(p);n+=p.split(/\s+/).length;if(n>=PART_WORDS){out.push({ps:cur,w:n});cur=[];n=0}}
  if(cur.length){if(out.length&&n<PART_WORDS/3){const l=out[out.length-1];l.ps.push(...cur);l.w+=n}else out.push({ps:cur,w:n})}
  return out.length?out:[{ps:[""],w:0}];
}
// место в книге: старое pos = номер главы; новое = 1e6 + глава*1000 + часть
const posOf=b=>b.pos>=1e6?{n:Math.floor((b.pos-1e6)/1000),p:(b.pos-1e6)%1000}:{n:b.pos||0,p:0};
async function openBook(id,n,p=0){
  const b=S.books.find(x=>x.id===id);if(!b)return toast("Книга не найдена");
  n=Math.max(0,Math.min(b.chapters-1,n||0));
  const keep=mode&&mode.k==="book"&&mode.id===id&&mode.n===n&&mode.ch?mode.ch:null;
  mode={k:"book",id,n,p,ch:keep,parts:keep?partsOf(keep.body):null,unk:new Map()};
  if(keep){fixPart();render();scrollTo(0,0);savePos(b);return}
  render();
  const ch=await W(sb.from("t_chapters").select("*").eq("book_id",id).eq("n",n).single()).catch(()=>null);
  if(!mode||mode.k!=="book"||mode.n!==n)return;
  mode.ch=ch;if(ch){mode.parts=partsOf(ch.body);fixPart()}
  render();scrollTo(0,0);savePos(b);
}
function fixPart(){const m=mode;if(m.p<0)m.p=m.parts.length-1;m.p=Math.max(0,Math.min(m.parts.length-1,m.p))}
function savePos(b){const v=1e6+mode.n*1000+mode.p;if(b.pos!==v){b.pos=v;sb.from("t_books").update({pos:v}).eq("id",b.id).then(()=>{})}}
function bookGo(d){
  const m=mode,b=S.books.find(x=>x.id===m.id),np=m.p+d;
  if(m.parts&&np>=0&&np<m.parts.length)return openBook(m.id,m.n,np);
  if(d<0&&m.n>0)return openBook(m.id,m.n-1,-1);
  if(d>0&&m.n<b.chapters-1)return openBook(m.id,m.n+1,0);
  if(d>0)quit();
}
function vBook(){
  const m=mode,b=S.books.find(x=>x.id===m.id),P=m.parts,part=P&&P[m.p];
  const first=m.n===0&&m.p===0,last=P&&m.n===b.chapters-1&&m.p===P.length-1;
  const top=`<div class="topbar"><button class="icon" id="lx" title="Закрыть">✕</button><span class="tt en">${esc(b.title)}</span>
    <button class="icon" id="bp" title="Назад" ${first?"disabled":""}>‹</button><span class="meta">${m.n+1}${P?`.${m.p+1}`:""} / ${b.chapters}</span><button class="icon" id="bn" title="Дальше" ${last?"disabled":""}>›</button></div>`;
  main.innerHTML=top+(m.ch?`<h1 class="story-t en">${esc(m.ch.title)}</h1>
    <div class="partbar"><span class="meta">${P.length>1?`${m.p+1} / ${P.length}`:""}</span><span class="meta">≈ ${Math.max(1,Math.round(part.w/90))} мин</span></div>
    ${reader(part.ps)}${rateBox(m.unk.size)}
    <div class="foot"><button class="btn danger" id="bdel" title="Удалить книгу">🗑</button></div>`:`<div class="empty"><b>Загружаю…</b></div>`);
  $("#lx").onclick=quit;
  $("#bp").onclick=()=>bookGo(-1);
  $("#bn").onclick=()=>bookGo(1);
  if(!m.ch)return;
  bindReader(`book:${m.id}`);
  bindRate(async r=>{
    await rateText(`book:${m.id}:${m.n}:${m.p}`,`${b.title} — ${m.ch.title}${P.length>1?` (${m.p+1}/${P.length})`:""}`.slice(0,200),r);
    freeze();bookGo(1);
  });
  $("#bdel").onclick=async()=>{
    if(!confirm(`Удалить «${b.title}» из Таверны? Карточки слов останутся.`))return;
    const pre=`book:${b.id}:`; // оценки частей — одним условием (список номеров у длинной книги не влезал в адрес) и раньше книги: оборвалось — можно повторить
    $("#bdel").disabled=true;
    try{
      await W(sb.from("t_texts").delete().like("ref",pre+"%"));
      S.texts=S.texts.filter(t=>!t.ref.startsWith(pre));
      await W(sb.from("t_books").delete().eq("id",b.id));
    }catch(e){if($("#bdel"))$("#bdel").disabled=false;return}
    S.books=S.books.filter(x=>x.id!==b.id);quit();
  };
}

/* ---------- карточка: изменить / добавить ---------- */
const EMOJI="🍺 🍻 🍷 🍞 🧀 🍖 🍲 🍎 🔥 🕯️ 🏰 🏛️ 🛖 🏠 🚪 🛏️ 🪑 👑 💍 💎 🪙 💰 📜 🗝️ 🗡️ ⚔️ 🏹 🛡️ 🪓 🧪 🔮 ✨ 🌙 ⭐ ☀️ 🌧️ ❄️ 🌲 🌹 🥀 🌿 🍂 🌊 ⛰️ 🐺 🐉 🦉 🐍 🐎 🦌 🐈‍⬛ 🐦‍⬛ 🦋 🧚 🧝 🧙 👸 🤴 💂 🧍 👁️ 👄 ✋ 🤝 🙇 🤫 💋 ❤️ 💔 😠 😢 😨 😊 😳 😏 🗣️ 👂 🎭 🃏 ⚠️ ☠️ 🩸 ⛓️ 🧭 📖 ✉️ 🎶 💃 🏃 🚶 👀 ⏳ 🐾".split(" ");
function editCard(c,after,pre){
  const v=c||{word:"",tr:"",emoji:"",ex:"",ex_ru:"",note:"",...pre};
  const vals=()=>["#cw","#ce","#ct","#cx","#cxr","#cn"].map(s=>$(s).value.trim()).join("\n");let was="";
  openModal(`<h2>${c?"🗝️ "+esc(c.word):"＋"}</h2>
    <div class="grid2"><div class="fld"><label>English</label><input id="cw" class="en" value="${esc(v.word)}" ${c||v.word?"":"autofocus"}></div>
    <div class="fld"><label>Смайлик</label><input id="ce" value="${esc(v.emoji||"")}" maxlength="8"></div></div>
    <div class="emos" id="emos">${PICS[v.word]?`<span class="emo-pic" title="Картинка">${PICS[v.word]}</span>`:""}${EMOJI.map(e=>`<button type="button" data-e="${e}">${e}</button>`).join("")}</div>
    <div class="fld"><label>Перевод</label><input id="ct" value="${esc(v.tr)}" ${!c&&v.word?"autofocus":""}></div>
    <div class="fld"><label>Пример</label><textarea id="cx" class="en" rows="2">${esc(v.ex||"")}</textarea></div>
    <div class="fld"><label>Перевод примера</label><input id="cxr" value="${esc(v.ex_ru||"")}"></div>
    <div class="fld"><label>💭 Ассоциация</label><textarea id="cn" rows="2">${esc(v.note||"")}</textarea></div>
    <p class="meta mmeta">${c?`🔁 ${c.reps} · ✗ ${c.lapses} · ${dueLabel(c.due)}`:""}</p>
    <div class="mfoot">${c?`<button class="btn danger" id="cdel" title="Удалить">🗑</button>`:""}<span class="sp"></span><button class="btn" id="cc">Отмена</button><button class="btn pri" id="cs">Сохранить</button></div>`,"",()=>vals()!==was);
  was=vals();
  $("#cc").onclick=closeModal;
  $("#emos").onclick=e=>{const b=e.target.closest("[data-e]");if(b)$("#ce").value=b.dataset.e};
  $("#cs").onclick=async()=>{
    const btn=$("#cs");if(btn.disabled)return;
    const row={word:$("#cw").value.trim().toLowerCase(),tr:$("#ct").value.trim(),emoji:$("#ce").value.trim()||null,ex:$("#cx").value.trim()||null,ex_ru:$("#cxr").value.trim()||null,note:$("#cn").value.trim()||null};
    if(!row.word){toast("Слово пустое");return $("#cw").focus()}
    const dup=cardOf(row.word);if(dup&&dup!==c)return toast("Такое слово уже есть");
    if(!row.tr&&!(c&&!c.tr)&&!confirm("Сохранить без перевода?"))return $("#ct").focus();
    btn.disabled=true;
    try{if(c)await updCard(c,row);else await addCards([{...row,src:"manual",due:addDays(today(),1)}]);if(btn.isConnected)closeModal();after?after():render()}catch(e){btn.disabled=false}
  };
  if(c)$("#cdel").onclick=async()=>{if(!confirm(`Удалить «${c.word}»?`))return;try{await delCard(c);closeModal();if(mode&&mode.k==="review"){const m=mode;m.i-=m.q.slice(0,m.i).filter(id=>id===c.id).length;m.q=m.q.filter(id=>id!==c.id);m.total--;m.again.delete(c.id);m.shown=false;freeze()}render()}catch(e){}};
}

/* ---------- справка ---------- */
const HELP=[
["Как устроен урок","Урок — 10 новых слов на одну тему и глава общей истории «The Lantern and the Thorn». Сначала смотришь слова с примерами, потом упражнения: выбрать перевод и вставить слово в предложение. Ошибки возвращаются в конец, пока не ответишь верно, — об этом говорит значок ↻ внизу слева. В пропуск после ответа встаёт верное слово. Счётчик и полоса — сколько вопросов пройдено, ошибка их не двигает. На компьютере: 1–4 — вариант, Enter или пробел — «Дальше», Esc — выйти. После упражнений слова становятся карточками, а дальше — глава истории, где встречаются все эти слова, вопросы по смыслу и оценка, насколько текст понятен.<br>Урок можно прервать: он запоминается на этом устройстве, в списке будет «▶ 7/20» — продолжишь с того же места, в истории — с того же абзаца. ↺ вверху — начать сначала. Шаги вверху нажимаются: можно вернуться к уже открытым, например из «Вопросов» к истории — она откроется там, где остановилась. Пройденный урок (✓) открывается сразу с истории; 📖 рядом — когда текст вернётся на перечитывание."],
["Повторение слов","Каждый день на «Сегодня» — только слова, у которых подошёл срок. Посмотри на слово, вспомни перевод, нажми «Показать» и честно оцени:<br>• <b>Не помню</b> — слово вернётся в конце этого же повторения и завтра;<br>• <b>Трудно</b> — промежуток чуть растёт;<br>• <b>Помню</b> — промежуток растёт в 2–2,5 раза;<br>• <b>Легко</b> — ещё сильнее.<br>Под кнопками видно, когда слово придёт снова. Новое слово: завтра → через несколько дней → неделя → месяц… Если пропустила день и всё равно помнишь, часть опоздания засчитывается. Полоса вверху растёт, когда слово пройдено; «Не помню» её не двигает. На компьютере: пробел — показать, 1–4 — оценки, Esc — выйти."],
["Читалка","Щёлкни на любое слово — внизу появится перевод (если слово есть в словаре или в твоих карточках) и кнопка 🌐 переводчика. <b>❓ Не понимаю</b>: если слова ещё нет в карточках, оно станет карточкой вместе с предложением из текста (перевод можно вписать сразу или потом в «Слова»); если уже есть — начнёт приходить чаще. Повторный щелчок по «Не понимаю» снимает отметку. Если слово стоит в изменённой форме (went), видно и начальное («→ go — идти»), карточка будет на него. Подчёркнутые слова — слова урока."],
["Перечитывание текстов","После каждого текста ты отмечаешь, насколько он понятен. 😕 не поняла — текст вернётся завтра, 🤔 частично — через 3 дня, 😊 понятно — через неделю, потом всё реже. Тексты, которые пора перечитать, — на «Сегодня» в разделе «Перечитать». Как с песней: раз за разом понятно всё больше."],
["Ассоциация 💭","У каждой карточки есть поле «Ассоциация»: что тебе напоминает это слово — строчка из песни, сцена из игры или книги, картинка в голове. Она видна после «Показать». Изменить — щёлкнуть на 💭 или открыть слово в «Слова»."],
["Книги","＋ EPUB — загрузить книгу на английском (файл EPUB). Книга раскладывается по главам и хранится только в твоей базе. Читать — как в уроке: перевод по щелчку, ❓ не понимаю. Длинные главы поделены на части примерно по 5 минут чтения (около 450 слов): вверху видно «часть 2 / 5» и примерное время. ‹ › — листать части и главы. В конце части — оценка, и открывается следующая; каждая часть возвращается на перечитывание отдельно. Место, где остановилась, запоминается. 🗑 внизу главы — удалить книгу (карточки слов останутся)."],
["Тренировка 🎴","Кнопка 🎴 на «Сегодня» — повторить слова в любой момент, не дожидаясь срока: до 20 слов, сначала те, что чаще забываешь. В «Слова» 🎴 тренирует найденные поиском слова (например, набери «fae»). Тренировка не сдвигает сроки, только «Не помню» делает слово чаще."],
["Картинки и смайлики","У слов из уроков — нарисованные картинки. Для остальных можно выбрать смайлик в окне слова (полоска под полем «Смайлик») или вписать любой свой."],
["Словарь","Перевод по щелчку берётся из твоих карточек, словаря уроков и большого словаря (~18 тыс. слов) из открытого Викисловаря (kaikki.org, Wiktionary, лицензия CC-BY-SA) с частотным списком FrequencyWords (Hermit Dave, CC-BY-SA). Переводы там бывают неточными — свой перевод можно вписать в карточку."],
["Настройки ⚙","Размер текста меняет только английские тексты: главы уроков, книги, вопросы и грамматику. Кнопки и меню остаются как были. На телефоне и компьютере размер свой. ↺ — вернуть обычный."],
["Слова","Все твои карточки: поиск, ＋ добавить своё слово, щелчок — изменить перевод, пример, смайлик, ассоциацию или удалить. Справа — когда слово придёт на повторение («ждёт 2 дня» — срок прошёл). Слово не нашлось — ＋ подставит его в новую карточку. «Выучено» на «Сегодня» — слова, которые помнишь дольше трёх недель."],
  ["Версия","Номер версии — внизу этой справки (дата и время выкладки). Если приложение давно открыто, а на сайте вышла новая версия, вверху появится «Есть новая версия» — нажми «Обновить»."],
];
$("#help").onclick=()=>openModal(`<h2>Справка</h2><div class="help">${HELP.map(([t,x])=>`<details><summary>${t}</summary><p>${x}</p></details>`).join("")}</div><div class="mfoot"><span class="ver">${verText()}</span><span class="sp"></span><button class="btn" id="hc">Закрыть</button></div>`,"help");
document.addEventListener("click",e=>{if(e.target.id==="hc")closeModal()});

/* ---------- настройки: размер текста для чтения (только тексты, не интерфейс; на каждом устройстве свой) ---------- */
const FS_MIN=14,FS_MAX=28;
function applyFs(){const v=ls.get("fs",null);if(v)document.documentElement.style.setProperty("--read-fs",v+"px");else document.documentElement.style.removeProperty("--read-fs")}
applyFs();
$("#gear").onclick=()=>{
  const cur=()=>ls.get("fs",null)||parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--read-fs"))||(innerWidth<=420?17.5:18.5);
  openModal(`<h2>⚙ Настройки</h2>
    <div class="fld"><label>Размер текста</label>
      <div class="fsrow"><button class="btn" id="fsm" title="Меньше">A−</button><b id="fsv"></b><button class="btn" id="fsp" title="Больше">A+</button><button class="btn" id="fsr" title="Как было">↺</button></div></div>
    <article class="reader en fsdemo"><p>The Crooked Lantern was a small tavern at the edge of the Thornwood. Nobody went into the forest after dark.</p></article>
    <div class="mfoot"><span class="sp"></span><button class="btn" id="hc">Закрыть</button></div>`);
  const show=()=>{$("#fsv").textContent=Math.round(cur())+" px"};
  const set=v=>{v=Math.max(FS_MIN,Math.min(FS_MAX,v));ls.set("fs",v);applyFs();show()};
  $("#fsm").onclick=()=>set(cur()-1);$("#fsp").onclick=()=>set(cur()+1);
  $("#fsr").onclick=()=>{try{localStorage.removeItem("tav:fs")}catch(e){}applyFs();show()};
  show();
};

/* ---------- окна, сообщения ---------- */
let modalDirty=null; // есть ли несохранённое: тогда Esc и щелчок мимо сначала спрашивают
function openModal(html,cls="",dirty=null){
  modalDirty=dirty;
  if(document.activeElement)document.activeElement.blur(); // иначе после закрытия Enter нажимает ту же кнопку ещё раз
  $("#modalRoot").innerHTML=`<div class="back"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  $("#modalRoot .back").addEventListener("mousedown",e=>{if(e.target.classList.contains("back")){e.preventDefault();leaveModal()}});
  const f=$("#modalRoot [autofocus]");if(f)f.focus();
}
function closeModal(){modalDirty=null;$("#modalRoot").innerHTML=""}
function leaveModal(){if(modalDirty&&modalDirty()&&!confirm("Закрыть без сохранения?"))return;closeModal()}
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape"||e.repeat)return;
  if($(".modal"))leaveModal();else if(!sheet.hidden)closeSheet();else if(mode)quit();
});
let tt;
function toast(msg){let el=$(".toast");if(!el){el=document.createElement("div");el.className="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=msg;clearTimeout(tt);tt=setTimeout(()=>el.remove(),/^Не удалось/.test(msg)?7000:2600)}

/* ---------- старт ---------- */
(async()=>{
  try{await loadContent()}catch(e){main.innerHTML=`<div class="empty"><b>Не загрузились уроки</b>${esc(e.message)}</div>`;return}
  sb.auth.onAuthStateChange((ev,session)=>{
    const was=user&&user.id;user=session?session.user:null;
    if(!user){S=null;mode=null;renderLogin();return}
    $("#top").hidden=false;
    if(was!==user.id)setTimeout(load,0);
  });
})();
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js");
window.__tav={S:()=>S,buildEx,optText,formIn,L,forms,lookup,nextCard,nextText,DICT,importEpub}; // для проверки
})();

// Версия на экране и сверка с сайтом (ревизия 22.11.2026). Номер — в version.js: каждая выкладка ставит новый
// (крючок перед коммитом не пустит изменение docs/ без него). На сайте новее — полоска «Есть новая версия».
const verText=()=>"Версия "+(window.APP_VERSION||"?");
async function checkVersion(){
  if(!window.APP_VERSION||document.getElementById("updBar"))return;
  try{
    const m=(await (await fetch("version.js",{cache:"no-cache"})).text()).match(/APP_VERSION\s*=\s*"([^"]+)"/);
    if(!m||m[1]===window.APP_VERSION)return;
    const b=document.createElement("div");b.id="updBar";b.className="upd-bar";
    b.innerHTML='Есть новая версия <button type="button">Обновить</button>';
    b.querySelector("button").onclick=()=>location.reload();
    document.body.appendChild(b);
  }catch(e){}
}
checkVersion();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkVersion()});
