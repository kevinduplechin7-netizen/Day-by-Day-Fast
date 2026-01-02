const KEY_ACTIVE='fb_active';const KEY_SESS='fb_sessions';const KEY_GOAL='fb_goal';
const el=id=>document.getElementById(id);
const stateLabel=el('stateLabel'),timerLabel=el('timerLabel'),weekTotal=el('weekTotal'),whats=el('whatsHappening');
const btnMain=el('btnMain'),toast=el('toast');
const modalBackdrop=el('modalBackdrop'),modalMore=el('modalMore'),modalAdd=el('modalAdd'),modalGoal=el('modalGoal'),
modalTips=el('modalTips'),modalStats=el('modalStats'),modalBackup=el('modalBackup'),modalInfo=el('modalInfo');
const startInput=el('startInput'),endInput=el('endInput'),manualDuration=el('manualDuration'),overlapWarning=el('overlapWarning');
const goalHoursInput=el('goalHoursInput'),progressFill=el('progressFill'),progressLabel=el('progressLabel'),
goalDone=el('goalDone'),goalTotal=el('goalTotal'),goalRemain=el('goalRemain');
const rangeTotal=el('rangeTotal'),rangeAvg=el('rangeAvg'),rangeMax=el('rangeMax'),rangeCount=el('rangeCount'),logList=el('logList');

const KEY_THEME='fb_theme';
const tips=[
"Drink water and pause for ten minutes.",
"Add a pinch of salt to water if appropriate.",
"Warm tea can take the edge off hunger.",
"Black coffee can help some people.",
"Remind yourself hunger often comes in waves.",
"Light movement can reduce restlessness.",
"Brush your teeth; it can reset cravings.",
"Focus on a task for fifteen minutes.",
"Electrolytes may help during longer fasts.",
"Sleep often makes fasting easier.",
"Stress can amplify hunger signals.",
"Deep breathing can calm the nervous system.",
"A short walk can help pass a hunger wave.",
"Cold or warm showers can change sensations.",
"Carbonated water can feel more filling.",
"Separate habit-hunger from need-hunger.",
"Check in: are you thirsty or tired?",
"Keep occupied during usual meal times.",
"Remember why you chose to fast today.",
"Short fasts still count.",
"You can end now and start again later.",
"Consistency matters more than perfection.",
"Protein sparing often improves with time.",
"Fat adaptation can take patience.",
"Hunger hormones fluctuate.",
"Routine cues can trigger appetite.",
"Salt, potassium, and magnesium matter.",
"Extended fasts are often supervised.",
"Non-exercise activity can help.",
"A warm mug in your hands can be grounding.",
"Mindful breathing for one minute.",
"Read or listen to something engaging.",
"Dim lighting can reduce food cues.",
"Change rooms to break association.",
"Hydration first, decision second.",
"Write down how you feel, briefly.",
"Set a small check-in time.",
"Delay does not equal denial.",
"Ending a fast is not failure.",
"Restarting is always allowed.",
"Your body is adaptable.",
"Time is cumulative.",
"Today does not define the week.",
"Weeks do not define the year.",
"Long-term habits beat single days.",
"Neutral observation reduces stress.",
"Calm decisions tend to be better.",
"Choose the gentlest next step."
];

function show(m){toast.textContent=m;toast.hidden=false;setTimeout(()=>toast.hidden=true,2200)}
function openModal(m){modalBackdrop.hidden=false;m.hidden=false}
function closeAll(){modalBackdrop.hidden=true;[modalMore,modalAdd,modalGoal,modalTips,modalStats,modalBackup,modalTheme,modalInfo].forEach(x=>x.hidden=true)}

function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}

function fmt(ms){
  const m=Math.max(0,Math.floor(ms/60000));
  const h=Math.floor(m/60),mi=m%60;
  if(!h&&!mi)return 'zero hours';
  if(!mi)return h+' hours';
  if(!h)return mi+' minutes';
  return h+' hours, '+mi+' minutes';
}

function fmtStopwatch(ms){
  const totalMinutes=Math.max(0,Math.floor(ms/60000));
  const days=Math.floor(totalMinutes/1440);
  const remMin=totalMinutes%1440;
  const hours=Math.floor(remMin/60);
  const minutes=remMin%60;

  const hh=String(hours).padStart(2,'0');
  const mm=String(minutes).padStart(2,'0');

  if(days>0){
    const dd=String(days).padStart(2,'0');
    return dd+'d '+hh+'h '+mm+'m';
  }
  return hh+'h '+mm+'m';
}

function render(){
 const theme=load(KEY_THEME,'evergreen');
 if(document.documentElement.dataset.theme!==theme){
  document.documentElement.dataset.theme=theme;
  const chips=document.querySelectorAll('.themeChip');
  chips.forEach(c=>c.classList.toggle('isOn', c.dataset.theme===theme));
 }

 const active=load(KEY_ACTIVE,null); const sess=load(KEY_SESS,[]);
 stateLabel.textContent=active?'Fasting':'Not fasting';
 btnMain.textContent=active?'End fast':'Start fast';
 timerLabel.textContent=active?fmtStopwatch(Date.now()-active):'00h 00m';
 const weekStart=(()=>{const d=new Date();const day=d.getDay()||7;d.setDate(d.getDate()-day+1);d.setHours(0,0,0,0);return d.getTime()})();
 const weekMs=sess.filter(s=>s.e>=weekStart).reduce((a,s)=>a+s.d,0);
 weekTotal.textContent=fmt(weekMs);
 whats.textContent=active?'Fat is becoming the main fuel source.':'Start whenever it fits your day.';
 const goal=load(KEY_GOAL,5000); const doneH=Math.floor(sess.reduce((a,s)=>a+s.d,0)/3600000);
 goalDone.textContent=doneH+' hours'; goalTotal.textContent=goal+' hours'; goalRemain.textContent=Math.max(0,goal-doneH)+' hours';
 const pct=goal?Math.min(100,Math.round(doneH/goal*100)):0; progressFill.style.width=pct+'%'; progressLabel.textContent=pct+' percent';
}

btnMain.onclick=()=>{const active=load(KEY_ACTIVE,null);
 if(!active){save(KEY_ACTIVE,Date.now());show('Started.');render();return}
 const ms=Date.now()-active; if(!confirm('End fast?\n\nDuration: '+fmt(ms)+'\nYou can always start again.'))return;
 const sess=load(KEY_SESS,[]); sess.unshift({s:active,e:Date.now(),d:ms}); save(KEY_SESS,sess); save(KEY_ACTIVE,null);
 show('Logged. Start again whenever you’re ready.'); render();
};

el('btnMore').onclick=()=>openModal(modalMore);
el('btnCloseMore').onclick=closeAll;
el('btnAddMissed').onclick=()=>{openModal(modalAdd); const now=Date.now(); startInput.value=new Date(now-16*3600000).toISOString().slice(0,16); endInput.value=new Date(now).toISOString().slice(0,16)}
el('btnCloseAdd').onclick=closeAll; el('btnCancelManual').onclick=closeAll;
el('btnSaveManual').onclick=()=>{const s=new Date(startInput.value).getTime(),e=new Date(endInput.value).getTime();
 if(!(e>s))return alert('End needs to be after start.'); const sess=load(KEY_SESS,[]); sess.unshift({s,e,d:e-s}); save(KEY_SESS,sess); closeAll(); show('Logged.'); render();}
el('btnGoal').onclick=()=>openModal(modalGoal); el('btnCloseGoal').onclick=closeAll; el('btnCancelGoal').onclick=closeAll;
el('btnSaveGoal').onclick=()=>{save(KEY_GOAL,Number(goalHoursInput.value||5000)); closeAll(); show('Updated.'); render();}
el('btnTips').onclick=()=>{const list=el('tipsList'); list.innerHTML=''; tips.forEach(t=>{const li=document.createElement('li'); li.textContent=t; list.appendChild(li)}); openModal(modalTips)}
el('btnCloseTips').onclick=closeAll;
el('btnStats').onclick=()=>openModal(modalStats); el('btnCloseStats').onclick=closeAll;
el('btnBackup').onclick=()=>openModal(modalBackup); el('btnCloseBackup').onclick=closeAll;
el('btnTheme').onclick=()=>{openModal(modalTheme)};
el('btnCloseTheme').onclick=closeAll;

function applyTheme(name){
  const t = name || 'evergreen';
  document.documentElement.dataset.theme = t;
  save(KEY_THEME, t);
  // highlight selected chip if present
  const chips = document.querySelectorAll('.themeChip');
  chips.forEach(c=>c.classList.toggle('isOn', c.dataset.theme===t));
}

document.addEventListener('click', (e)=>{
  const btn = e.target && e.target.closest && e.target.closest('.themeChip');
  if(!btn) return;
  applyTheme(btn.dataset.theme);
  show('Theme updated.');
  closeAll();
});

el('btnDisclaimer').onclick=()=>openModal(modalInfo); el('btnCloseInfo').onclick=closeAll;

render(); setInterval(render,1000);

modalBackdrop.onclick=closeAll;
