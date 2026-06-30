const { useState, useCallback, useRef, useEffect } = React;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const EXERCISE_DB = {
  "🏋️ Груди": ["Жим лежачи штангою","Жим лежачи гантелями","Жим під кутом вгору штангою","Жим під кутом вниз","Розведення гантелей лежачи","Розведення в кросовері","Зведення пек-дек","Віджимання на брусах","Пулловер"],
  "🔙 Спина": ["Підтягування широким хватом","Підтягування вузьким хватом","Тяга штанги в нахилі","Тяга гантелі однією рукою","Тяга горизонтального блоку","Тяга вертикального блоку","Тяга Т-штанги","Станова тяга","Румунська тяга","Шраги зі штангою"],
  "💪 Біцепс": ["Підйом штанги на біцепс","Підйом гантелей на біцепс","Молоткові згинання","Концентроване згинання","Згинання на лавці Скотта","Підйом на біцепс у кросовері"],
  "🔱 Трицепс": ["Жим вузьким хватом","Французький жим лежачи","Розгинання на блоці вниз","Розгинання однією рукою","Відведення руки назад","Розгинання над головою","Відмивання від лавки"],
  "🦵 Квадрицепс": ["Присідання зі штангою","Присідання в Сміті","Жим ногами","Розгинання ніг","Гак-присідання","Випади з гантелями","Болгарські випади","Присідання сумо"],
  "🍑 Задня поверхня": ["Румунська тяга","Станова тяга на прямих ногах","Згинання ніг лежачи","Згинання ніг сидячи","Глютеовий місток","Гіпертрасти"],
  "🔰 Плечі": ["Жим штанги стоячи","Жим гантелей сидячи","Жим Арнольда","Підйом через сторони","Підйом перед собою","Тяга до підборіддя","Зворотні розведення"],
  "🦵 Ікри": ["Підйом на носки стоячи","Підйом на носки сидячи","Підйом на носки в тренажері"],
  "🧱 Прес": ["Скручування","Підйом ніг лежачи","Планка","Бічна планка","Русський твіст","Ролик для преса","Підйом колін у висі"],
  "🤜 Передпліччя": ["Згинання зап'ясть зі штангою","Розгинання зап'ясть","Стиск еспандера","Молоткові згинання","Підйом зворотним хватом"],
};
const ALL_EX = Object.values(EXERCISE_DB).flat();

const SPLIT_TYPES = [
  { id:"fullbody", label:"Фулбоді", icon:"⚡" },
  { id:"upper",    label:"Верх",    icon:"💪" },
  { id:"lower",    label:"Низ",     icon:"🦵" },
  { id:"push",     label:"Поштовх", icon:"🔱" },
  { id:"pull",     label:"Тяга",    icon:"🔙" },
  { id:"chest",    label:"День грудей",  icon:"🏋️" },
  { id:"back",     label:"День спини",   icon:"🔙" },
  { id:"legs",     label:"День ніг",     icon:"🦵" },
  { id:"shoulders",label:"День плечей",  icon:"🔰" },
  { id:"arms",     label:"День рук",     icon:"💪" },
  { id:"glutes",   label:"День сідниць", icon:"🍑" },
  { id:"custom",   label:"Інше",         icon:"🔧" },
];

const CYCLE_DAYS = [
  {id:1,label:"Об'ємне 1", short:"О1", color:"#FF6B1A",type:"volume"},
  {id:2,label:"Об'ємне 2", short:"О2", color:"#FF6B1A",type:"volume"},
  {id:3,label:"Силове",    short:"СИЛ",color:"#E63946",type:"strength"},
  {id:4,label:"Розвантаж.",short:"РОЗ",color:"#4CAF50",type:"deload"},
];

const ENERGY_LABELS = ["","💀 Труп","😞 Погано","😕 Нижче норми","😐 Посередньо","🙂 Нормально","😊 Добре","😄 Відмінно","⚡ Енергійно","🔥 Заряджений","🚀 Максимум"];
const STORAGE_KEY = "bb_diary_v5";

// ─── UTILS ───────────────────────────────────────────────────────────────────
const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
const save = d => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const calcTon = exs => exs.reduce((s,ex) => s+ex.sets.reduce((s2,st) => s2+(parseFloat(st.w)||0)*(parseInt(st.r)||0),0),0);
const fmtDate = ds => ds ? new Date(ds).toLocaleDateString("uk-UA",{day:"2-digit",month:"long",year:"numeric"}) : "";
const fmtDateShort = ds => ds ? new Date(ds).toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit"}) : "";
const today = () => new Date().toISOString().split("T")[0];
const calc1RM = (w,r) => { w=parseFloat(w); r=parseInt(r); if(!w||!r||r<1) return 0; return r===1?w:Math.round(w*(1+r/30)*10)/10; };
const newSet = () => ({w:"",r:"",rpe:"",rir:""});
const newEx  = () => ({id:Date.now()+Math.random(),name:"",sets:[newSet(),newSet(),newSet()],rest:"90",notes:""});
const newSess = (type) => ({
  id:Date.now(), date:today(),
  dayType:type||"volume",
  dayLabel:CYCLE_DAYS.find(d=>d.type===(type||"volume"))?.label||"",
  splitType:"",
  bodyweight:"", sleep:"", energy:7,
  exercises:[newEx()], prs:"", summary:"", tonnage:0,
});

// Compute sequential training-week number relative to the very first session.
// This fixes the old bug where ISO calendar week was used, causing numbers
// to jump or collide across year boundaries / gaps in training.
function attachSeqWeeks(sessions) {
  if (!sessions.length) return [];
  const sorted = [...sessions].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const firstDate = new Date(sorted[0].date);
  // Normalize to start of that week (Monday) so partial first weeks don't skew numbering
  const day = firstDate.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const anchor = new Date(firstDate);
  anchor.setDate(anchor.getDate() - diffToMonday);
  anchor.setHours(0,0,0,0);
  return sessions.map(s => {
    const d = new Date(s.date);
    d.setHours(0,0,0,0);
    const seqWeek = Math.floor((d - anchor) / (7*86400000)) + 1;
    return { ...s, seqWeek };
  });
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  card: {background:"#1A1D27",borderRadius:"12px",padding:"14px",border:"1px solid #2A2E3A",marginBottom:"12px"},
  inp: {background:"#0D0F14",border:"1px solid #2A2E3A",borderRadius:"8px",color:"#E8E4DC",padding:"8px 10px",fontSize:"14px",fontFamily:"Inter,sans-serif",outline:"none",width:"100%",boxSizing:"border-box"},
  label: {fontSize:"11px",color:"#8890A4",marginBottom:"4px",fontFamily:"Inter,sans-serif"},
  btn: (bg="#2A2E3A",color="#E8E4DC") => ({background:bg,border:"none",cursor:"pointer",borderRadius:"8px",color,padding:"8px 14px",fontSize:"13px",fontWeight:600,fontFamily:"Inter,sans-serif"}),
  accentBtn: {background:"linear-gradient(135deg,#FF6B1A,#E63946)",border:"none",cursor:"pointer",borderRadius:"10px",color:"#fff",padding:"12px",fontSize:"14px",fontWeight:700,fontFamily:"Inter,sans-serif",width:"100%"},
  sectionLabel: {fontSize:"11px",color:"#FF6B1A",fontWeight:700,letterSpacing:"0.1em",marginBottom:"10px",fontFamily:"Inter,sans-serif"},
};

// ─── REST TIMER ───────────────────────────────────────────────────────────────
function RestTimer({seconds, onClose}) {
  const [left,setLeft]   = useState(seconds);
  const [running,setRun] = useState(true);
  const [done,setDone]   = useState(false);
  const ref = useRef();

  useEffect(()=>{setLeft(seconds);setRun(true);setDone(false);},[seconds]);
  useEffect(()=>{
    if(running && left>0){
      ref.current=setInterval(()=>setLeft(t=>{
        if(t<=1){clearInterval(ref.current);setRun(false);setDone(true);if("vibrate" in navigator)navigator.vibrate([200,100,300]);return 0;}
        return t-1;
      }),1000);
    }
    return()=>clearInterval(ref.current);
  },[running,seconds]);

  const pct=left/seconds, r=26, circ=2*Math.PI*r, col=left>seconds*0.5?"#4CAF50":left>seconds*0.25?"#FF6B1A":"#E63946";
  const mm=Math.floor(left/60), ss=left%60;

  return (
    <div style={{position:"fixed",bottom:"80px",right:"16px",zIndex:9999,background:"#1A1D27",border:`1px solid ${done?"#4CAF50":"#2A2E3A"}`,borderRadius:"16px",padding:"14px 16px",boxShadow:"0 8px 32px #000c",display:"flex",alignItems:"center",gap:"12px",minWidth:"210px"}}>
      <div style={{position:"relative",flexShrink:0}}>
        <svg width="64" height="64" style={{transform:"rotate(-90deg)"}}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="#2A2E3A" strokeWidth="4"/>
          <circle cx="32" cy="32" r={r} fill="none" stroke={done?"#4CAF50":col} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
            style={{transition:"stroke-dashoffset .9s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?"14px":"16px",fontWeight:700,color:done?"#4CAF50":col,fontFamily:"Inter,sans-serif"}}>
          {done?"✓":`${mm}:${String(ss).padStart(2,"0")}`}
        </div>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginBottom:"3px"}}>ВІДПОЧИНОК</div>
        {done
          ? <div style={{fontSize:"13px",fontWeight:700,color:"#4CAF50",fontFamily:"Inter,sans-serif"}}>Час наступного!</div>
          : <div style={{fontSize:"12px",color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>з {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</div>
        }
        <div style={{display:"flex",gap:"6px",marginTop:"8px",alignItems:"center"}}>
          <button onClick={()=>setRun(x=>!x)} style={{...S.btn(),padding:"4px 10px",fontSize:"12px"}}>{running?"⏸":"▶️"}</button>
          <button onClick={()=>{setLeft(seconds);setRun(true);setDone(false);}} style={{...S.btn(),padding:"4px 10px",fontSize:"12px"}}>↺</button>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#8890A4",fontSize:"16px",marginLeft:"auto"}}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── EXERCISE PICKER ─────────────────────────────────────────────────────────
function ExPicker({onSelect, recent}) {
  const [q,setQ]=useState(""), [grp,setGrp]=useState(null);
  const filtered = q.trim() ? ALL_EX.filter(e=>e.toLowerCase().includes(q.toLowerCase())) : null;
  return (
    <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:999,background:"#1A1D27",border:"1px solid #3A3E4A",borderRadius:"12px",boxShadow:"0 8px 32px #000c",maxHeight:"300px",overflow:"auto"}}>
      <div style={{padding:"8px",borderBottom:"1px solid #2A2E3A",position:"sticky",top:0,background:"#1A1D27"}}>
        <input autoFocus placeholder="🔍 Пошук..." value={q} onChange={e=>setQ(e.target.value)}
          style={{...S.inp,padding:"6px 10px",fontSize:"13px"}}/>
      </div>
      {!q && recent.length>0 && (
        <div style={{padding:"6px 10px"}}>
          <div style={{fontSize:"10px",color:"#FF6B1A",fontWeight:700,marginBottom:"4px",fontFamily:"Inter,sans-serif"}}>🕐 НЕЩОДАВНІ</div>
          {recent.slice(0,5).map(n=><button key={n} onClick={()=>onSelect(n)} style={{display:"block",width:"100%",textAlign:"left",padding:"5px 8px",background:"none",border:"none",cursor:"pointer",color:"#C8C4BC",fontSize:"13px",fontFamily:"Inter,sans-serif"}}>{n}</button>)}
          <div style={{borderTop:"1px solid #2A2E3A33",marginTop:"4px"}}/>
        </div>
      )}
      {filtered ? (
        <div style={{padding:"4px 10px"}}>
          {filtered.length===0
            ? <div style={{color:"#8890A4",fontSize:"13px",padding:"8px",fontFamily:"Inter,sans-serif"}}>Не знайдено</div>
            : filtered.map(n=><button key={n} onClick={()=>onSelect(n)} style={{display:"block",width:"100%",textAlign:"left",padding:"6px 8px",background:"none",border:"none",cursor:"pointer",color:"#E8E4DC",fontSize:"13px",fontFamily:"Inter,sans-serif"}}>{n}</button>)
          }
        </div>
      ) : (
        Object.entries(EXERCISE_DB).map(([g,exs])=>(
          <div key={g}>
            <button onClick={()=>setGrp(grp===g?null:g)} style={{display:"flex",justifyContent:"space-between",width:"100%",textAlign:"left",padding:"8px 12px",background:"none",border:"none",cursor:"pointer",color:"#E8E4DC",fontSize:"13px",fontWeight:600,fontFamily:"Inter,sans-serif",borderBottom:"1px solid #2A2E3A22"}}>
              <span>{g}</span><span style={{color:"#8890A4",fontSize:"10px"}}>{grp===g?"▲":"▼"}</span>
            </button>
            {grp===g && exs.map(n=><button key={n} onClick={()=>onSelect(n)} style={{display:"block",width:"100%",textAlign:"left",padding:"6px 24px",background:"none",border:"none",cursor:"pointer",color:"#C8C4BC",fontSize:"13px",fontFamily:"Inter,sans-serif"}}>{n}</button>)}
          </div>
        ))
      )}
    </div>
  );
}

// ─── TAB BAR ─────────────────────────────────────────────────────────────────
function TabBar({active,onChange}) {
  const tabs=[["log","🏋️","Журнал"],["records","🏆","Рекорди"],["history","📊","Історія"],["body","📏","Тіло"],["nutrition","🥗","КБЖУ"],["progression","📈","Прогрес"]];
  return (
    <div style={{display:"flex",borderBottom:"1px solid #2A2E3A",background:"#0D0F14",position:"sticky",top:0,zIndex:100,overflowX:"auto"}}>
      {tabs.map(([id,icon,label])=>(
        <button key={id} onClick={()=>onChange(id)} style={{flex:"1 0 auto",minWidth:"58px",padding:"10px 2px",border:"none",cursor:"pointer",background:active===id?"#1A1D27":"transparent",color:active===id?"#FF6B1A":"#8890A4",borderBottom:active===id?"2px solid #FF6B1A":"2px solid transparent",fontSize:"9px",fontFamily:"Inter,sans-serif",fontWeight:600,transition:"all .15s"}}>
          <div style={{fontSize:"16px",marginBottom:"2px"}}>{icon}</div>{label}
        </button>
      ))}
    </div>
  );
}

// ─── SET ROW ─────────────────────────────────────────────────────────────────
function SetRow({set,idx,onChange,onRemove,onCopyPrev,onTimer}) {
  const inp=(f,w,ph)=>(
    <input placeholder={ph} value={set[f]} onChange={e=>onChange(f,e.target.value)}
      style={{width:w,background:"#1A1D27",border:"1px solid #2A2E3A",borderRadius:"6px",color:"#E8E4DC",padding:"5px 6px",fontSize:"14px",fontFamily:"Inter,sans-serif",outline:"none",textAlign:"center"}}/>
  );
  const orm = calc1RM(set.w,set.r);
  return (
    <div style={{marginBottom:"6px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
        <span style={{minWidth:"22px",height:"22px",borderRadius:"50%",background:"#2A2E3A",color:"#8890A4",fontSize:"10px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{idx+1}</span>
        {inp("w","66px","кг")}
        <span style={{color:"#8890A4",fontSize:"11px"}}>×</span>
        {inp("r","54px","повт")}
        {inp("rpe","46px","RPE")}
        {inp("rir","46px","RIR")}
        {idx>0&&<button onClick={onCopyPrev} style={{...S.btn(),padding:"3px 7px",fontSize:"11px",flexShrink:0}}>↑</button>}
        <button onClick={onTimer} style={{background:"#FF6B1A22",border:"1px solid #FF6B1A44",cursor:"pointer",color:"#FF6B1A",fontSize:"12px",borderRadius:"5px",padding:"3px 7px",lineHeight:1,flexShrink:0}}>⏱</button>
        <button onClick={onRemove} style={{background:"none",border:"none",cursor:"pointer",color:"#E63946",fontSize:"15px",padding:"0 2px",lineHeight:1,flexShrink:0}}>×</button>
      </div>
      {orm>0&&<div style={{marginLeft:"26px",marginTop:"2px",fontSize:"10px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>1ПМ≈<span style={{color:"#FF6B1A",fontWeight:600}}>{orm}кг</span></div>}
    </div>
  );
}

// ─── EXERCISE BLOCK ───────────────────────────────────────────────────────────
function ExBlock({ex,onChange,onRemove,recent,onTimer}) {
  const [open,setOpen]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    if(open)document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[open]);
  const updSet=(i,f,v)=>onChange({...ex,sets:ex.sets.map((s,j)=>j===i?{...s,[f]:v}:s)});
  const addSet=()=>onChange({...ex,sets:[...ex.sets,newSet()]});
  const remSet=i=>onChange({...ex,sets:ex.sets.filter((_,j)=>j!==i)});
  const cpPrev=i=>{if(i<1)return;onChange({...ex,sets:ex.sets.map((s,j)=>j===i?{...ex.sets[i-1]}:s)});};
  const ton=ex.sets.reduce((s,st)=>s+(parseFloat(st.w)||0)*(parseInt(st.r)||0),0);
  const bestRM=Math.max(0,...ex.sets.map(st=>calc1RM(st.w,st.r)));
  return (
    <div style={{...S.card}}>
      <div style={{display:"flex",gap:"8px",marginBottom:"10px",position:"relative"}} ref={ref}>
        <div style={{flex:1,position:"relative"}}>
          <input placeholder="Назва вправи 📋" value={ex.name} onChange={e=>onChange({...ex,name:e.target.value})} onFocus={()=>setOpen(true)}
            style={{...S.inp,border:`1px solid ${open?"#FF6B1A":"#3A3E4A"}`,fontSize:"14px",fontWeight:600,padding:"7px 10px"}}/>
          {open&&<ExPicker recent={recent} onSelect={n=>{onChange({...ex,name:n});setOpen(false);}}/>}
        </div>
        <button onClick={onRemove} style={{...S.btn(),padding:"7px 10px",flexShrink:0}}>✕</button>
      </div>
      <div style={{display:"flex",gap:"4px",marginBottom:"4px",paddingLeft:"26px"}}>
        {["кг","повт","RPE","RIR"].map(l=><span key={l} style={{flex:"1 1 0",textAlign:"center",fontSize:"9px",color:"#8890A4",fontFamily:"Inter,sans-serif",fontWeight:600}}>{l}</span>)}
        <span style={{width:"34px"}}></span><span style={{width:"28px"}}></span><span style={{width:"18px"}}></span>
      </div>
      {ex.sets.map((st,i)=><SetRow key={i} set={st} idx={i} onChange={(f,v)=>updSet(i,f,v)} onRemove={()=>remSet(i)} onCopyPrev={()=>cpPrev(i)} onTimer={()=>onTimer(parseInt(ex.rest)||90)}/>)}
      <div style={{display:"flex",gap:"6px",marginTop:"8px",alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={addSet} style={{...S.btn("#2A2E3A","#FF6B1A"),padding:"5px 12px"}}>+ Підхід</button>
        <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
          <span style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>⏱</span>
          <input value={ex.rest} onChange={e=>onChange({...ex,rest:e.target.value})} placeholder="90"
            style={{...S.inp,width:"52px",textAlign:"center",padding:"4px 6px",fontSize:"13px"}}/>
          <span style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>сек</span>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:"8px"}}>
          {bestRM>0&&<span style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>1ПМ<span style={{color:"#FF6B1A",fontWeight:700}}>{bestRM}кг</span></span>}
          {ton>0&&<span style={{fontSize:"11px",color:"#FF6B1A",fontWeight:700,fontFamily:"Inter,sans-serif"}}>⚖{ton.toLocaleString()}</span>}
        </div>
      </div>
      <textarea placeholder="Нотатки: техніка, відчуття, біль..." value={ex.notes} onChange={e=>onChange({...ex,notes:e.target.value})} rows={2}
        style={{...S.inp,marginTop:"8px",color:"#8890A4",resize:"vertical",padding:"7px 10px",fontSize:"13px"}}/>
    </div>
  );
}

// ─── LOG TAB ─────────────────────────────────────────────────────────────────
function LogTab({sessions,onSave,onTimer}) {
  const [sess,setSess]=useState(()=>newSess("volume"));
  const [saved,setSaved]=useState(false);
  const [timerSecs,setTimerSecs]=useState("90");

  const recentAll=[...new Set(sessions.slice(-8).flatMap(s=>s.exercises.map(e=>e.name)).filter(Boolean))];

  const frequentForSplit = (splitType) => {
    if(!splitType) return [];
    const relevant = sessions.filter(s=>s.splitType===splitType);
    const counts = {};
    relevant.forEach(s=>s.exercises.forEach(ex=>{if(ex.name){counts[ex.name]=(counts[ex.name]||0)+1;}}));
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e[0]);
  };
  const frequent = frequentForSplit(sess.splitType);

  useEffect(()=>{setSess(s=>({...s,tonnage:calcTon(s.exercises)}));},[sess.exercises]);

  const updEx=(i,ex)=>setSess({...sess,exercises:sess.exercises.map((e,j)=>j===i?ex:e)});
  const remEx=i=>setSess({...sess,exercises:sess.exercises.filter((_,j)=>j!==i)});
  const addEx=()=>setSess({...sess,exercises:[...sess.exercises,newEx()]});
  const handleSave=()=>{onSave({...sess,tonnage:calcTon(sess.exercises)});setSaved(true);setTimeout(()=>setSaved(false),2000);setSess(newSess("volume"));};

  const iField=(field,ph,type="text",extra={})=>(
    <input type={type} placeholder={ph} value={sess[field]} onChange={e=>setSess({...sess,[field]:e.target.value})}
      style={{...S.inp,...extra}}/>
  );

  return (
    <div style={{padding:"14px",maxWidth:"680px",margin:"0 auto"}}>
      <div style={{...S.card}}>
        <div style={{...S.sectionLabel}}>🗓 ШАПКА ТРЕНУВАННЯ</div>
        <div style={{marginBottom:"10px"}}><div style={S.label}>Дата</div>{iField("date","","date")}</div>

        <div style={{marginBottom:"10px"}}>
          <div style={S.label}>Тип дня циклу</div>
          <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
            {CYCLE_DAYS.map(d=>(
              <button key={d.id} onClick={()=>setSess({...sess,dayType:d.type,dayLabel:d.label})} style={{padding:"5px 12px",borderRadius:"20px",border:`1px solid ${sess.dayType===d.type?d.color:"#2A2E3A"}`,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:"11px",fontWeight:600,background:sess.dayType===d.type?d.color+"22":"transparent",color:sess.dayType===d.type?d.color:"#8890A4"}}>{d.short} {d.label}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:"10px"}}>
          <div style={S.label}>Тип сплітупрограми</div>
          <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
            {SPLIT_TYPES.map(sp=>(
              <button key={sp.id} onClick={()=>setSess({...sess,splitType:sp.id})} style={{padding:"5px 11px",borderRadius:"20px",border:`1px solid ${sess.splitType===sp.id?"#A78BFA":"#2A2E3A"}`,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:"11px",fontWeight:600,background:sess.splitType===sp.id?"#A78BFA22":"transparent",color:sess.splitType===sp.id?"#A78BFA":"#8890A4"}}>{sp.icon} {sp.label}</button>
            ))}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
          <div><div style={S.label}>Вага тіла (кг)</div>{iField("bodyweight","0.0","number")}</div>
          <div><div style={S.label}>Години сну</div>{iField("sleep","0.0","number")}</div>
        </div>
        <div>
          <div style={S.label}>Рівень енергії — {ENERGY_LABELS[sess.energy]}</div>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"4px"}}>
            <input type="range" min={1} max={10} value={sess.energy} onChange={e=>setSess({...sess,energy:+e.target.value})} style={{flex:1,accentColor:"#FF6B1A"}}/>
            <span style={{minWidth:"30px",height:"30px",borderRadius:"50%",background:`hsl(${(sess.energy-1)*12},80%,45%)`,color:"#fff",fontWeight:700,fontSize:"14px",display:"flex",alignItems:"center",justifyContent:"center"}}>{sess.energy}</span>
          </div>
        </div>
      </div>

      {frequent.length>0&&(
        <div style={{...S.card,background:"#141720"}}>
          <div style={{...S.sectionLabel,marginBottom:"8px"}}>🔁 ЧАСТІ ВПРАВИ ДЛЯ ЦЬОГО ДНЯ</div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {frequent.map(n=>(
              <button key={n} onClick={()=>setSess({...sess,exercises:[...sess.exercises,{...newEx(),name:n}]})}
                style={{padding:"5px 12px",borderRadius:"20px",background:"#A78BFA22",border:"1px solid #A78BFA44",color:"#A78BFA",fontSize:"12px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
                + {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{...S.card,display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>⏱ Таймер за замовч.:</span>
        <input type="number" value={timerSecs} onChange={e=>setTimerSecs(e.target.value)} style={{...S.inp,width:"70px",textAlign:"center",padding:"5px 8px"}}/>
        <span style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>сек</span>
        <div style={{marginLeft:"auto",display:"flex",gap:"4px"}}>
          {[60,90,120,180].map(s=><button key={s} onClick={()=>setTimerSecs(String(s))} style={{...S.btn(timerSecs===String(s)?"#FF6B1A22":"#2A2E3A",timerSecs===String(s)?"#FF6B1A":"#8890A4"),padding:"4px 8px",fontSize:"11px",border:`1px solid ${timerSecs===String(s)?"#FF6B1A44":"transparent"}`}}>{s}"</button>)}
        </div>
      </div>

      <div style={S.sectionLabel}>💪 ЖУРНАЛ ВПРАВ</div>
      {sess.exercises.map((ex,i)=>(
        <ExBlock key={ex.id} ex={ex} recent={recentAll}
          onChange={e=>updEx(i,e)} onRemove={()=>remEx(i)}
          onTimer={secs=>onTimer(secs||parseInt(timerSecs)||90)}/>
      ))}
      <button onClick={addEx} style={{width:"100%",padding:"10px",background:"transparent",border:"2px dashed #2A2E3A",borderRadius:"12px",cursor:"pointer",color:"#FF6B1A",fontSize:"14px",fontWeight:600,marginBottom:"12px",fontFamily:"Inter,sans-serif"}}>+ Додати вправу</button>

      <div style={{...S.card}}>
        <div style={S.sectionLabel}>📋 ПІДСУМОК</div>
        <div style={{background:"#FF6B1A11",border:"1px solid #FF6B1A33",borderRadius:"10px",padding:"12px",marginBottom:"10px",textAlign:"center"}}>
          <div style={{fontSize:"10px",color:"#FF6B1A",fontWeight:700,fontFamily:"Inter,sans-serif",marginBottom:"2px"}}>ТОННАЖ</div>
          <div style={{fontSize:"34px",fontWeight:800,color:"#FF6B1A",fontFamily:"Inter,sans-serif",lineHeight:1}}>{calcTon(sess.exercises).toLocaleString()}</div>
          <div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>кг</div>
        </div>
        <div style={{marginBottom:"8px"}}><div style={S.label}>🏆 Рекорди (PR)</div><input value={sess.prs} onChange={e=>setSess({...sess,prs:e.target.value})} placeholder="Запиши рекорди..." style={S.inp}/></div>
        <div><div style={S.label}>💬 Висновок</div><textarea value={sess.summary} onChange={e=>setSess({...sess,summary:e.target.value})} placeholder="Що спрацювало? Що змінити?" rows={3} style={{...S.inp,resize:"vertical"}}/></div>
      </div>
      <button onClick={handleSave} style={{...S.accentBtn,background:saved?"#4CAF50":undefined,boxShadow:saved?"0 4px 20px #4CAF5066":"0 4px 20px #FF6B1A33"}}>
        {saved?"✅ Збережено!":"💾 Зберегти тренування"}
      </button>
    </div>
  );
}

// ─── EXERCISE GROWTH CHART (inline, used inside Records tab) ─────────────────
function GrowthChart({entries, metric}) {
  if (entries.length < 2) return (
    <div style={{textAlign:"center",padding:"16px",color:"#4A4E5A",fontSize:"11px",fontFamily:"Inter,sans-serif"}}>
      Потрібно мінімум 2 записи для графіку росту
    </div>
  );
  const vals = entries.map(e => metric==="oneRM"?e.orm : metric==="vol"?e.vol : e.maxW);
  const W=300,H=100,pad=12;
  const minV=Math.min(...vals), maxV=Math.max(...vals), range=(maxV-minV)||1;
  const pts = entries.map((e,i)=>({
    x: pad+(i/(entries.length-1||1))*(W-2*pad),
    y: H-pad-((vals[i]-minV)/range)*(H-2*pad),
    ...e
  }));
  const pathD = pts.map((p,i)=>(i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`)).join(" ");
  const areaD = `M${pts[0].x},${H-pad} ${pts.map(p=>`L${p.x},${p.y}`).join(" ")} L${pts[pts.length-1].x},${H-pad} Z`;
  return (
    <div style={{background:"#0D0F14",borderRadius:"10px",padding:"10px",marginTop:"4px"}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{height:"100px",display:"block"}}>
        <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4CAF50" stopOpacity=".3"/><stop offset="100%" stopColor="#4CAF50" stopOpacity="0"/></linearGradient></defs>
        {[.25,.5,.75].map(f=><line key={f} x1={pad} y1={pad+(1-f)*(H-2*pad)} x2={W-pad} y2={pad+(1-f)*(H-2*pad)} stroke="#2A2E3A" strokeWidth="1"/>)}
        <path d={areaD} fill="url(#gg)"/>
        <path d={pathD} fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
        {pts.map((p,i)=>{const di=CYCLE_DAYS.find(d=>d.type===p.dayType)||CYCLE_DAYS[0];return <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={di.color} stroke="#1A1D27" strokeWidth="1.5"/>;})}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:"2px"}}>
        <span style={{fontSize:"9px",color:"#4A4E5A",fontFamily:"Inter,sans-serif"}}>{fmtDateShort(entries[0].date)}</span>
        <span style={{fontSize:"9px",color:"#4A4E5A",fontFamily:"Inter,sans-serif"}}>{fmtDateShort(entries[entries.length-1].date)}</span>
      </div>
    </div>
  );
}

// ─── RECORDS TAB ─────────────────────────────────────────────────────────────
function RecordsTab({sessions, manualPRs, onSaveManualPR}) {
  const [selEx,setSelEx]=useState(null);
  const [chartMetric,setChartMetric]=useState("maxW");
  const [editingPR,setEditingPR]=useState(null); // exercise name being edited
  const [prInput,setPrInput]=useState({weight:"",reps:""});

  // ── New-record form (works even with zero training history) ──
  const [addOpen,setAddOpen]=useState(false);
  const [addPicker,setAddPicker]=useState(false);
  const [newRecName,setNewRecName]=useState("");
  const [newRecInput,setNewRecInput]=useState({weight:"",reps:""});
  const addRef=useRef();
  useEffect(()=>{
    const h=e=>{if(addRef.current&&!addRef.current.contains(e.target))setAddPicker(false);};
    if(addPicker)document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[addPicker]);

  const exMap={};
  sessions.forEach(s=>{
    s.exercises.forEach(ex=>{
      if(!ex.name.trim())return;
      if(!exMap[ex.name])exMap[ex.name]={name:ex.name,bestW:0,bestRM:0,bestVol:0,entries:[]};
      const maxW=Math.max(0,...ex.sets.map(st=>parseFloat(st.w)||0));
      const maxR=Math.max(0,...ex.sets.map(st=>parseInt(st.r)||0));
      const vol=ex.sets.reduce((a,st)=>a+(parseFloat(st.w)||0)*(parseInt(st.r)||0),0);
      const orm=calc1RM(maxW,maxR);
      if(maxW>exMap[ex.name].bestW)exMap[ex.name].bestW=maxW;
      if(orm>exMap[ex.name].bestRM){exMap[ex.name].bestRM=orm;exMap[ex.name].bestRMdate=s.date;exMap[ex.name].bestRMdetail=`${maxW}×${maxR}`;}
      if(vol>exMap[ex.name].bestVol)exMap[ex.name].bestVol=vol;
      exMap[ex.name].entries.push({date:s.date,maxW,maxR,vol,orm,dayType:s.dayType});
    });
  });

  // Merge in manually entered 1RMs (user can set their own true max, e.g. tested in gym)
  Object.keys(manualPRs||{}).forEach(name=>{
    const manual = manualPRs[name];
    if(!manual||!manual.value) return;
    if(!exMap[name]) exMap[name]={name,bestW:0,bestRM:0,bestVol:0,entries:[]};
    if(manual.value > exMap[name].bestRM){
      exMap[name].bestRM = manual.value;
      exMap[name].bestRMdate = manual.date;
      exMap[name].bestRMdetail = "вписано вручну";
      exMap[name].isManual = true;
    }
  });

  const sorted=Object.values(exMap).sort((a,b)=>b.entries.length-a.entries.length);

  const prSessions=sessions.filter(s=>s.prs&&s.prs.trim());

  const submitManualPR = (name) => {
    const w = parseFloat(prInput.weight), r = parseInt(prInput.reps)||1;
    if(!w) return;
    const value = r===1 ? w : calc1RM(w,r);
    onSaveManualPR(name, {value, date:today(), weight:w, reps:r});
    setEditingPR(null);
    setPrInput({weight:"",reps:""});
  };

  const submitNewRecord = () => {
    const name = newRecName.trim();
    const w = parseFloat(newRecInput.weight), r = parseInt(newRecInput.reps)||1;
    if(!name||!w) return;
    const value = r===1 ? w : calc1RM(w,r);
    onSaveManualPR(name, {value, date:today(), weight:w, reps:r});
    setNewRecName(""); setNewRecInput({weight:"",reps:""}); setAddOpen(false);
  };

  return (
    <div style={{padding:"14px",maxWidth:"680px",margin:"0 auto"}}>

      {/* Add new record — always visible, works even with zero training history */}
      <div style={{...S.card,border:"1px solid #A78BFA44"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:addOpen?"10px":"0"}}>
          <div style={{fontSize:"13px",color:"#A78BFA",fontWeight:700,fontFamily:"Inter,sans-serif"}}>🏆 Записати свій рекорд</div>
          <button onClick={()=>setAddOpen(o=>!o)} style={{...S.btn(addOpen?"#2A2E3A":"#A78BFA","#fff"),padding:"6px 14px"}}>{addOpen?"Сховати":"+ Додати"}</button>
        </div>
        {addOpen&&(
          <div>
            <div style={{position:"relative",marginBottom:"8px"}} ref={addRef}>
              <input placeholder="Назва вправи (напр. Жим лежачи) 📋" value={newRecName}
                onChange={e=>setNewRecName(e.target.value)} onFocus={()=>setAddPicker(true)}
                style={{...S.inp,border:`1px solid ${addPicker?"#A78BFA":"#3A3E4A"}`}}/>
              {addPicker&&<ExPicker recent={[...new Set(sorted.map(e=>e.name))]} onSelect={n=>{setNewRecName(n);setAddPicker(false);}}/>}
            </div>
            <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
              <input type="number" placeholder="Вага кг" value={newRecInput.weight} onChange={e=>setNewRecInput({...newRecInput,weight:e.target.value})} style={{...S.inp,textAlign:"center"}}/>
              <input type="number" placeholder="Повт (1 якщо макс)" value={newRecInput.reps} onChange={e=>setNewRecInput({...newRecInput,reps:e.target.value})} style={{...S.inp,textAlign:"center"}}/>
            </div>
            <button onClick={submitNewRecord} style={{...S.btn("#A78BFA","#fff"),width:"100%"}}>Зберегти рекорд</button>
            <div style={{fontSize:"10px",color:"#4A4E5A",fontFamily:"Inter,sans-serif",marginTop:"6px",textAlign:"center"}}>Якщо знаєш справжній 1ПМ — постав повт=1. Якщо просто підняв вагу N разів — впиши скільки.</div>
          </div>
        )}
      </div>

      {!sorted.length && (
        <div style={{padding:"30px 16px",textAlign:"center",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>
          <div style={{fontSize:"40px",marginBottom:"10px"}}>🏆</div>
          <div>Записаних рекордів ще немає — додай перший вище ↑</div>
        </div>
      )}

      {prSessions.length>0&&(
        <div style={{...S.card,marginBottom:"16px"}}>
          <div style={S.sectionLabel}>✍️ ЗАПИСАНІ РЕКОРДИ</div>
          {prSessions.slice().reverse().slice(0,5).map((s,i)=>(
            <div key={i} style={{paddingBottom:"8px",marginBottom:"8px",borderBottom:"1px solid #2A2E3A22"}}>
              <div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginBottom:"2px"}}>{fmtDate(s.date)}</div>
              <div style={{fontSize:"13px",color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{s.prs}</div>
            </div>
          ))}
        </div>
      )}

      <div style={S.sectionLabel}>📊 РЕКОРДИ ПО ВПРАВАХ</div>

      {sorted.map(ex=>{
        const trend=ex.entries.length>=2?ex.entries[ex.entries.length-1].maxW-ex.entries[ex.entries.length-2].maxW:0;
        const isOpen = selEx===ex.name;
        return (
          <div key={ex.name} style={{...S.card}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setSelEx(isOpen?null:ex.name)}>
              <div style={{flex:1}}>
                <div style={{fontSize:"14px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif",marginBottom:"6px"}}>{ex.name}</div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <div style={{background:"#E6394622",border:"1px solid #E6394644",borderRadius:"8px",padding:"5px 10px",textAlign:"center"}}>
                    <div style={{fontSize:"9px",color:"#E63946",fontWeight:700,fontFamily:"Inter,sans-serif"}}>ВАГА</div>
                    <div style={{fontSize:"16px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{ex.bestW}<span style={{fontSize:"10px",color:"#8890A4"}}> кг</span></div>
                  </div>
                  <div style={{background:ex.isManual?"#A78BFA22":"#FF6B1A22",border:`1px solid ${ex.isManual?"#A78BFA44":"#FF6B1A44"}`,borderRadius:"8px",padding:"5px 10px",textAlign:"center"}}>
                    <div style={{fontSize:"9px",color:ex.isManual?"#A78BFA":"#FF6B1A",fontWeight:700,fontFamily:"Inter,sans-serif"}}>1ПМ{ex.isManual?"":" ≈"}</div>
                    <div style={{fontSize:"16px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{ex.bestRM}<span style={{fontSize:"10px",color:"#8890A4"}}> кг</span></div>
                  </div>
                  <div style={{background:"#4CAF5022",border:"1px solid #4CAF5044",borderRadius:"8px",padding:"5px 10px",textAlign:"center"}}>
                    <div style={{fontSize:"9px",color:"#4CAF50",fontWeight:700,fontFamily:"Inter,sans-serif"}}>ОБ'ЄМ</div>
                    <div style={{fontSize:"16px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{ex.bestVol}<span style={{fontSize:"10px",color:"#8890A4"}}> кг</span></div>
                  </div>
                </div>
              </div>
              <div style={{textAlign:"right",marginLeft:"8px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:trend>0?"#4CAF50":trend<0?"#E63946":"#8890A4",fontFamily:"Inter,sans-serif"}}>{trend>0?`↑+${trend}`:trend<0?`↓${trend}`:"→"}</div>
                <div style={{fontSize:"10px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginTop:"2px"}}>{ex.entries.length} вик.</div>
                <div style={{fontSize:"10px",color:"#4A4E5A",fontFamily:"Inter,sans-serif",marginTop:"4px"}}>{isOpen?"▲":"▼"}</div>
              </div>
            </div>

            {isOpen&&(
              <div style={{marginTop:"12px",borderTop:"1px solid #2A2E3A",paddingTop:"10px"}}>

                {/* Manual 1RM entry */}
                <div style={{background:"#141720",borderRadius:"8px",padding:"10px",marginBottom:"10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:editingPR===ex.name?"8px":"0"}}>
                    <span style={{fontSize:"11px",color:"#A78BFA",fontWeight:700,fontFamily:"Inter,sans-serif"}}>✏️ Вписати свій 1ПМ</span>
                    <button onClick={(e)=>{e.stopPropagation();setEditingPR(editingPR===ex.name?null:ex.name);}} style={{...S.btn(editingPR===ex.name?"#2A2E3A":"#A78BFA22","#A78BFA"),padding:"4px 10px",fontSize:"11px"}}>{editingPR===ex.name?"Сховати":"+ Додати"}</button>
                  </div>
                  {editingPR===ex.name&&(
                    <div onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
                        <input type="number" placeholder="Вага кг" value={prInput.weight} onChange={e=>setPrInput({...prInput,weight:e.target.value})} style={{...S.inp,textAlign:"center"}}/>
                        <input type="number" placeholder="Повт (1 якщо макс)" value={prInput.reps} onChange={e=>setPrInput({...prInput,reps:e.target.value})} style={{...S.inp,textAlign:"center"}}/>
                      </div>
                      <button onClick={()=>submitManualPR(ex.name)} style={{...S.btn("#A78BFA","#fff"),width:"100%"}}>Зберегти як рекорд</button>
                      <div style={{fontSize:"10px",color:"#4A4E5A",fontFamily:"Inter,sans-serif",marginTop:"6px",textAlign:"center"}}>Якщо тестував справжній 1ПМ у залі — постав повт=1</div>
                    </div>
                  )}
                </div>

                {/* Growth chart */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                  <div style={{fontSize:"10px",color:"#4CAF50",fontWeight:700,fontFamily:"Inter,sans-serif"}}>📈 РІСТ ВАГИ У ВПРАВІ</div>
                  <div style={{display:"flex",gap:"4px"}} onClick={e=>e.stopPropagation()}>
                    {[["maxW","Вага"],["oneRM","1ПМ"],["vol","Об'єм"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setChartMetric(k)} style={{padding:"3px 8px",borderRadius:"6px",border:`1px solid ${chartMetric===k?"#4CAF50":"#2A2E3A"}`,background:chartMetric===k?"#4CAF5022":"transparent",color:chartMetric===k?"#4CAF50":"#8890A4",fontSize:"10px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>{l}</button>
                    ))}
                  </div>
                </div>
                <GrowthChart entries={ex.entries} metric={chartMetric}/>

                <div style={{fontSize:"10px",color:"#8890A4",fontWeight:700,marginTop:"12px",marginBottom:"6px",fontFamily:"Inter,sans-serif"}}>ОСТАННІ ЗАПИСИ</div>
                {ex.entries.slice(-8).reverse().map((e,i)=>{
                  const di=CYCLE_DAYS.find(d=>d.type===e.dayType)||CYCLE_DAYS[0];
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"6px",paddingBottom:"5px",marginBottom:"5px",borderBottom:"1px solid #2A2E3A22"}}>
                      <div style={{width:"26px",height:"26px",borderRadius:"50%",background:di.color+"22",border:`1.5px solid ${di.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:700,color:di.color,fontFamily:"Inter,sans-serif",flexShrink:0}}>{di.short}</div>
                      <div style={{flex:1,fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>{fmtDate(e.date)}</div>
                      <div style={{fontSize:"12px",color:"#E8E4DC",fontWeight:600,fontFamily:"Inter,sans-serif"}}>{e.maxW}кг×{e.maxR}</div>
                      <div style={{fontSize:"11px",color:"#FF6B1A",fontFamily:"Inter,sans-serif"}}>1ПМ:{e.orm}</div>
                    </div>
                  );
                })}
                {ex.bestRMdetail&&<div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginTop:"4px"}}>Кращий 1ПМ: <span style={{color:ex.isManual?"#A78BFA":"#FF6B1A"}}>{ex.bestRMdetail}</span> ({fmtDate(ex.bestRMdate)})</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────
function HistoryTab({sessions}) {
  const [sel,setSel]=useState(null);
  if(!sessions.length) return <div style={{padding:"40px",textAlign:"center",color:"#8890A4",fontFamily:"Inter,sans-serif"}}><div style={{fontSize:"48px"}}>📭</div><div style={{marginTop:"8px"}}>Тренувань ще немає</div></div>;

  const withWeeks = attachSeqWeeks(sessions);

  if(sel!==null){
    const s=sessions[sel],tot=calcTon(s.exercises);
    const sp=SPLIT_TYPES.find(t=>t.id===s.splitType);
    const seqWeek = withWeeks.find(w=>w.id===s.id)?.seqWeek;
    return (
      <div style={{padding:"14px",maxWidth:"680px",margin:"0 auto"}}>
        <button onClick={()=>setSel(null)} style={{...S.btn(),marginBottom:"12px"}}>← Назад</button>
        <div style={{...S.card}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:"17px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{fmtDate(s.date)}</div>
              <div style={{display:"flex",gap:"6px",marginTop:"6px",flexWrap:"wrap"}}>
                <span style={{padding:"2px 8px",borderRadius:"10px",background:"#FF6B1A22",color:"#FF6B1A",fontSize:"11px",fontWeight:600,fontFamily:"Inter,sans-serif"}}>{s.dayLabel||s.dayType} • Тиж.{seqWeek}</span>
                {sp&&<span style={{padding:"2px 8px",borderRadius:"10px",background:"#A78BFA22",color:"#A78BFA",fontSize:"11px",fontWeight:600,fontFamily:"Inter,sans-serif"}}>{sp.icon} {sp.label}</span>}
              </div>
            </div>
            <div style={{textAlign:"right"}}><div style={{fontSize:"22px",fontWeight:700,color:"#FF6B1A",fontFamily:"Inter,sans-serif"}}>{tot.toLocaleString()}</div><div style={{fontSize:"10px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>тоннаж кг</div></div>
          </div>
          <div style={{display:"flex",gap:"14px",marginTop:"10px"}}>
            {s.bodyweight&&<span style={{fontSize:"12px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>⚖️{s.bodyweight}кг</span>}
            {s.sleep&&<span style={{fontSize:"12px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>😴{s.sleep}год</span>}
            <span style={{fontSize:"12px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>⚡{s.energy}/10</span>
          </div>
        </div>
        {s.exercises.map((ex,i)=>(
          <div key={i} style={{...S.card}}>
            <div style={{fontWeight:700,color:"#E8E4DC",fontSize:"14px",marginBottom:"8px",fontFamily:"Inter,sans-serif"}}>{ex.name||"Вправа"}</div>
            {ex.sets.map((st,j)=>(
              <div key={j} style={{display:"flex",gap:"8px",fontSize:"12px",color:"#8890A4",marginBottom:"3px",fontFamily:"Inter,sans-serif",flexWrap:"wrap"}}>
                <span style={{color:"#4A4E5A"}}>#{j+1}</span>
                <span><span style={{color:"#E8E4DC",fontWeight:600}}>{st.w||"—"}</span>кг×<span style={{color:"#E8E4DC",fontWeight:600}}>{st.r||"—"}</span>повт</span>
                {st.rpe&&<span style={{color:"#FF6B1A"}}>RPE{st.rpe}</span>}
                {st.rir&&<span style={{color:"#4CAF50"}}>RIR{st.rir}</span>}
                {st.w&&st.r&&<span>1ПМ≈{calc1RM(st.w,st.r)}кг</span>}
              </div>
            ))}
            {ex.notes&&<div style={{marginTop:"6px",fontSize:"11px",color:"#8890A4",fontStyle:"italic",borderLeft:"2px solid #FF6B1A",paddingLeft:"7px",fontFamily:"Inter,sans-serif"}}>{ex.notes}</div>}
          </div>
        ))}
        {(s.prs||s.summary)&&<div style={{...S.card}}>
          {s.prs&&<div style={{marginBottom:"8px"}}><div style={{fontSize:"10px",color:"#FF6B1A",fontWeight:700,marginBottom:"3px",fontFamily:"Inter,sans-serif"}}>🏆 PR</div><div style={{fontSize:"13px",color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{s.prs}</div></div>}
          {s.summary&&<div><div style={{fontSize:"10px",color:"#8890A4",fontWeight:700,marginBottom:"3px",fontFamily:"Inter,sans-serif"}}>💬 Висновок</div><div style={{fontSize:"13px",color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{s.summary}</div></div>}
        </div>}
      </div>
    );
  }

  const byWeek={};
  withWeeks.forEach((s,i)=>{
    const w=`Тиждень ${s.seqWeek}`;
    if(!byWeek[w])byWeek[w]=[];
    byWeek[w].push({...s,_i:i,_seq:s.seqWeek});
  });
  const weekKeys = Object.keys(byWeek).sort((a,b)=>{
    const na = byWeek[a][0]._seq, nb = byWeek[b][0]._seq;
    return nb-na; // descending, most recent week first
  });

  return (
    <div style={{padding:"14px",maxWidth:"680px",margin:"0 auto"}}>
      {weekKeys.map(week=>{
        const ss = byWeek[week];
        const wt=ss.reduce((t,s)=>t+calcTon(s.exercises),0);
        return <div key={week} style={{marginBottom:"18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
            <span style={{fontSize:"12px",color:"#FF6B1A",fontWeight:700,fontFamily:"Inter,sans-serif"}}>{week}</span>
            <span style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>Тоннаж: {wt.toLocaleString()} кг</span>
          </div>
          {ss.map(s=>{
            const t=calcTon(s.exercises),di=CYCLE_DAYS.find(d=>d.type===s.dayType)||CYCLE_DAYS[0],sp=SPLIT_TYPES.find(x=>x.id===s.splitType);
            return <button key={s._i} onClick={()=>setSel(s._i)} style={{width:"100%",display:"flex",alignItems:"center",background:"#1A1D27",border:"1px solid #2A2E3A",borderRadius:"12px",padding:"10px 12px",marginBottom:"5px",cursor:"pointer",textAlign:"left"}}>
              <div style={{width:"38px",height:"38px",borderRadius:"50%",background:di.color+"22",border:`2px solid ${di.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:700,color:di.color,marginRight:"10px",flexShrink:0,fontFamily:"Inter,sans-serif"}}>{di.short}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:"#E8E4DC",fontSize:"13px",fontFamily:"Inter,sans-serif"}}>{fmtDate(s.date)}</div>
                <div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginTop:"2px"}}>{sp?sp.icon+" "+sp.label+" • ":""}{s.exercises.length}вправ ⚡{s.energy}/10</div>
              </div>
              <div style={{textAlign:"right"}}><div style={{fontSize:"15px",fontWeight:700,color:"#FF6B1A",fontFamily:"Inter,sans-serif"}}>{t.toLocaleString()}</div><div style={{fontSize:"9px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>кг</div></div>
            </button>;
          })}
        </div>;
      })}
    </div>
  );
}

// ─── BODY TAB ─────────────────────────────────────────────────────────────────
function BodyTab({bodyData,onSave}) {
  const [form,setForm]=useState({date:today(),weight:"",chest:"",bicep:"",forearm:"",waist:"",hip:"",calf:"",bodyfat:"",notes:""});
  const [saved,setSaved]=useState(false);
  const sv=()=>{onSave({...form,id:Date.now()});setSaved(true);setTimeout(()=>setSaved(false),2000);setForm({date:today(),weight:"",chest:"",bicep:"",forearm:"",waist:"",hip:"",calf:"",bodyfat:"",notes:""});};
  const inp=(f,l,u="см")=>(<div><div style={S.label}>{l} ({u})</div><input type="number" value={form[f]} onChange={e=>setForm({...form,[f]:e.target.value})} placeholder="0.0" style={S.inp}/></div>);
  return (
    <div style={{padding:"14px",maxWidth:"680px",margin:"0 auto"}}>
      <div style={{...S.card}}>
        <div style={S.sectionLabel}>📏 ЗАМІРИ ТІЛА</div>
        <div style={{marginBottom:"10px"}}><div style={S.label}>Дата</div><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.inp}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
          {inp("weight","⚖️ Вага тіла","кг")}{inp("bodyfat","📊 % жиру","%")}
          {inp("chest","💪 Груди")}{inp("bicep","💪 Біцепс")}
          {inp("forearm","🤜 Передпліччя")}{inp("waist","📐 Талія")}
          {inp("hip","🦵 Стегно")}{inp("calf","🦵 Гомілка")}
        </div>
        <textarea placeholder="Нотатки..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{...S.inp,resize:"vertical",color:"#8890A4"}}/>
        <button onClick={sv} style={{...S.accentBtn,marginTop:"10px",background:saved?"#4CAF50":undefined}}>{saved?"✅ Збережено!":"💾 Зберегти"}</button>
      </div>
      {bodyData.length>0&&<div>
        <div style={S.sectionLabel}>📈 ДИНАМІКА</div>
        {bodyData.slice().reverse().map((d,i)=>(
          <div key={i} style={{...S.card}}>
            <div style={{fontWeight:600,color:"#E8E4DC",fontSize:"12px",marginBottom:"8px",fontFamily:"Inter,sans-serif"}}>{fmtDate(d.date)}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
              {[["weight","⚖️","кг"],["chest","Груди","см"],["bicep","Біцепс","см"],["forearm","Передпліч.","см"],["waist","Талія","см"],["hip","Стегно","см"],["calf","Гомілка","см"],["bodyfat","Жир","%"]].map(([f,l,u])=>d[f]?<span key={f} style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>{l}: <span style={{color:"#E8E4DC",fontWeight:600}}>{d[f]}{u}</span></span>:null)}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── NUTRITION TAB (КБЖУ calculator + daily food log) ────────────────────────
function NutritionTab({foodLog, onSaveFood, onDeleteFood, nutritionProfile, onSaveProfile}) {
  const [gender,setGender]=useState(nutritionProfile.gender||"m");
  const [weight,setWeight]=useState(nutritionProfile.weight||"");
  const [height,setHeight]=useState(nutritionProfile.height||"");
  const [age,setAge]=useState(nutritionProfile.age||"");
  const [goal,setGoal]=useState(nutritionProfile.goal||"maintain");
  const [activity,setActivity]=useState(nutritionProfile.activity||1.55);

  const [logDate,setLogDate]=useState(today());
  const [entry,setEntry]=useState({name:"",kcal:"",protein:"",fat:"",carbs:""});

  useEffect(()=>{
    onSaveProfile({gender,weight,height,age,goal,activity});
  },[gender,weight,height,age,goal,activity]);

  const bmrVal = () => {
    const w=parseFloat(weight),h=parseFloat(height),a=parseInt(age);
    if(!w||!h||!a) return 0;
    return gender==="m" ? Math.round(88.36+13.4*w+4.8*h-5.7*a) : Math.round(447.6+9.2*w+3.1*h-4.3*a);
  };
  const tdee = Math.round(bmrVal()*activity);
  const targets = {
    bulk:    {kcal:tdee+300, label:"Набір маси (+300)", color:"#FF6B1A"},
    maintain:{kcal:tdee,     label:"Підтримка",         color:"#4CAF50"},
    cut:     {kcal:tdee-400, label:"Сушка (-400)",      color:"#29B6F6"},
  };
  const tgt = targets[goal];
  const protTarget = Math.round((parseFloat(weight)||0)*2.2);
  const fatTarget   = Math.round(tgt.kcal*0.25/9);
  const carbTarget  = Math.round((tgt.kcal - protTarget*4 - fatTarget*9)/4);

  const acts=[["1.2","Мінімум (сидячий)"],["1.375","Легка (1-3/тиж)"],["1.55","Помірна (3-5/тиж)"],["1.725","Активна (6-7/тиж)"],["1.9","Дуже активна"]];

  // Food log for selected date
  const dayEntries = (foodLog[logDate]||[]);
  const dayTotals = dayEntries.reduce((a,e)=>({
    kcal:a.kcal+(parseFloat(e.kcal)||0),
    protein:a.protein+(parseFloat(e.protein)||0),
    fat:a.fat+(parseFloat(e.fat)||0),
    carbs:a.carbs+(parseFloat(e.carbs)||0),
  }),{kcal:0,protein:0,fat:0,carbs:0});

  const addFoodEntry = () => {
    if(!entry.name.trim()||!entry.kcal) return;
    onSaveFood(logDate, {...entry, id:Date.now()});
    setEntry({name:"",kcal:"",protein:"",fat:"",carbs:""});
  };

  const kcalPct = tgt.kcal>0 ? Math.min(150,Math.round(dayTotals.kcal/tgt.kcal*100)) : 0;
  const kcalColor = kcalPct>110?"#E63946":kcalPct>90?"#4CAF50":"#FF6B1A";

  return (
    <div style={{padding:"14px",maxWidth:"680px",margin:"0 auto"}}>

      {/* ── Calculator ── */}
      <div style={{...S.card}}>
        <div style={S.sectionLabel}>🥗 КАЛЬКУЛЯТОР КБЖУ</div>
        <div style={{display:"flex",gap:"6px",marginBottom:"10px"}}>
          {[["m","♂ Чоловік"],["f","♀ Жінка"]].map(([v,l])=><button key={v} onClick={()=>setGender(v)} style={{flex:1,padding:"7px",borderRadius:"8px",border:`1px solid ${gender===v?"#FF6B1A":"#2A2E3A"}`,cursor:"pointer",background:gender===v?"#FF6B1A22":"transparent",color:gender===v?"#FF6B1A":"#8890A4",fontSize:"12px",fontWeight:600,fontFamily:"Inter,sans-serif"}}>{l}</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"10px"}}>
          {[["weight","⚖️ Вага","кг",weight,setWeight],["height","📏 Зріст","см",height,setHeight],["age","🎂 Вік","р",age,setAge]].map(([k,l,u,v,sv])=>(
            <div key={k}><div style={S.label}>{l} ({u})</div><input type="number" placeholder="0" value={v} onChange={e=>sv(e.target.value)} style={{...S.inp,textAlign:"center"}}/></div>
          ))}
        </div>
        <div style={{marginBottom:"10px"}}>
          <div style={S.label}>Рівень активності</div>
          <select value={activity} onChange={e=>setActivity(parseFloat(e.target.value))} style={{...S.inp}}>
            {acts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:"5px",marginBottom:"12px"}}>
          {Object.entries(targets).map(([k,t])=><button key={k} onClick={()=>setGoal(k)} style={{flex:1,padding:"6px 4px",borderRadius:"8px",border:`1px solid ${goal===k?t.color:"#2A2E3A"}`,cursor:"pointer",background:goal===k?t.color+"22":"transparent",color:goal===k?t.color:"#8890A4",fontSize:"10px",fontWeight:700,fontFamily:"Inter,sans-serif",lineHeight:"1.3"}}>{t.label}</button>)}
        </div>
        {tdee>0 ? (
          <>
            <div style={{background:tgt.color+"11",border:`1px solid ${tgt.color}33`,borderRadius:"10px",padding:"12px",marginBottom:"10px",textAlign:"center"}}>
              <div style={{fontSize:"10px",color:tgt.color,fontWeight:700,fontFamily:"Inter,sans-serif",marginBottom:"2px"}}>ЦІЛЬ ККАЛ НА ДЕНЬ</div>
              <div style={{fontSize:"38px",fontWeight:800,color:"#E8E4DC",fontFamily:"Inter,sans-serif",lineHeight:1}}>{tgt.kcal}</div>
              <div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginTop:"2px"}}>TDEE: {tdee} ккал (БМР: {bmrVal()})</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"6px"}}>
              {[["Білки","#E63946",protTarget],["Жири","#FF6B1A",fatTarget],["Вуглев.","#4CAF50",carbTarget]].map(([l,c,v])=>(
                <div key={l} style={{background:c+"11",border:`1px solid ${c}33`,borderRadius:"8px",padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:"9px",color:c,fontWeight:700,fontFamily:"Inter,sans-serif"}}>{l}</div>
                  <div style={{fontSize:"22px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif",lineHeight:1}}>{v}</div>
                  <div style={{fontSize:"9px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>г</div>
                </div>
              ))}
            </div>
          </>
        ) : <div style={{textAlign:"center",padding:"16px",color:"#4A4E5A",fontSize:"12px",fontFamily:"Inter,sans-serif"}}>Заповни поля вище для розрахунку</div>}
      </div>

      {/* ── Daily food log ── */}
      <div style={{...S.card}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
          <div style={{...S.sectionLabel,marginBottom:0}}>🍽 ЩОДЕННИК ЇЖІ</div>
          <input type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} style={{...S.inp,width:"140px",fontSize:"12px",padding:"5px 8px"}}/>
        </div>

        {tdee>0 && (
          <div style={{marginBottom:"12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginBottom:"4px"}}>
              <span>З'їдено: <span style={{color:"#E8E4DC",fontWeight:700}}>{Math.round(dayTotals.kcal)}</span> ккал</span>
              <span>Ціль: {tgt.kcal} ккал</span>
            </div>
            <div style={{height:"8px",background:"#0D0F14",borderRadius:"4px",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,kcalPct)}%`,background:kcalColor,borderRadius:"4px",transition:"width .3s"}}/>
            </div>
            <div style={{fontSize:"10px",color:kcalColor,fontFamily:"Inter,sans-serif",marginTop:"3px",fontWeight:600}}>{kcalPct}% від цілі {kcalPct>110?"— забагато":kcalPct<70?"— замало":"— добре"}</div>
          </div>
        )}

        {/* Totals row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px",marginBottom:"12px"}}>
          {[["Ккал",Math.round(dayTotals.kcal),"#FF6B1A"],["Білки",Math.round(dayTotals.protein),"#E63946"],["Жири",Math.round(dayTotals.fat),"#FFA726"],["Вугл.",Math.round(dayTotals.carbs),"#4CAF50"]].map(([l,v,c])=>(
            <div key={l} style={{background:"#0D0F14",borderRadius:"7px",padding:"7px",textAlign:"center"}}>
              <div style={{fontSize:"9px",color:c,fontWeight:700,fontFamily:"Inter,sans-serif"}}>{l}</div>
              <div style={{fontSize:"14px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Add entry form */}
        <div style={{background:"#141720",borderRadius:"10px",padding:"10px",marginBottom:"10px"}}>
          <input placeholder="Що з'їв (напр. Куряча грудка 200г)" value={entry.name} onChange={e=>setEntry({...entry,name:e.target.value})} style={{...S.inp,marginBottom:"6px"}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px",marginBottom:"8px"}}>
            <input type="number" placeholder="Ккал" value={entry.kcal} onChange={e=>setEntry({...entry,kcal:e.target.value})} style={{...S.inp,textAlign:"center",padding:"6px"}}/>
            <input type="number" placeholder="Білки" value={entry.protein} onChange={e=>setEntry({...entry,protein:e.target.value})} style={{...S.inp,textAlign:"center",padding:"6px"}}/>
            <input type="number" placeholder="Жири" value={entry.fat} onChange={e=>setEntry({...entry,fat:e.target.value})} style={{...S.inp,textAlign:"center",padding:"6px"}}/>
            <input type="number" placeholder="Вугл." value={entry.carbs} onChange={e=>setEntry({...entry,carbs:e.target.value})} style={{...S.inp,textAlign:"center",padding:"6px"}}/>
          </div>
          <button onClick={addFoodEntry} style={{...S.btn("#FF6B1A22","#FF6B1A"),width:"100%",border:"1px solid #FF6B1A44"}}>+ Додати прийом їжі</button>
        </div>

        {/* Entries list */}
        {dayEntries.length>0 ? dayEntries.map(e=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 0",borderBottom:"1px solid #2A2E3A22"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{e.name}</div>
              <div style={{fontSize:"10px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginTop:"2px"}}>Б:{e.protein||0}г Ж:{e.fat||0}г В:{e.carbs||0}г</div>
            </div>
            <div style={{fontSize:"14px",fontWeight:700,color:"#FF6B1A",fontFamily:"Inter,sans-serif"}}>{e.kcal}</div>
            <button onClick={()=>onDeleteFood(logDate,e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#E63946",fontSize:"15px"}}>×</button>
          </div>
        )) : <div style={{textAlign:"center",padding:"16px",color:"#4A4E5A",fontSize:"12px",fontFamily:"Inter,sans-serif"}}>Ще нічого не додано на цей день</div>}
      </div>
    </div>
  );
}

// ─── PROGRESSION TAB ─────────────────────────────────────────────────────────
function ProgressionTab({sessions}) {
  const [chartEx,setChartEx]=useState(null);
  const [chartMetric,setChartMetric]=useState("oneRM");

  const exMap={};
  sessions.forEach(s=>{
    s.exercises.forEach(ex=>{
      if(!ex.name.trim())return;
      if(!exMap[ex.name])exMap[ex.name]=[];
      const maxW=Math.max(0,...ex.sets.map(st=>parseFloat(st.w)||0));
      const maxR=Math.max(0,...ex.sets.map(st=>parseInt(st.r)||0));
      exMap[ex.name].push({date:s.date,maxW,maxR,dayType:s.dayType,oneRM:calc1RM(maxW,maxR),vol:ex.sets.reduce((a,st)=>a+(parseFloat(st.w)||0)*(parseInt(st.r)||0),0)});
    });
  });

  const records = chartEx ? exMap[chartEx]||[] : [];
  const vals = records.map(r=>chartMetric==="oneRM"?r.oneRM:chartMetric==="maxW"?r.maxW:r.vol);
  const W=300,H=110,pad=14;
  const minV=Math.min(...vals)||0,maxV=Math.max(...vals)||1,range=maxV-minV||1;
  const pts=records.map((r,i)=>({x:pad+(i/(records.length-1||1))*(W-2*pad),y:H-pad-((vals[i]-minV)/range)*(H-2*pad),...r}));

  const recommend=(records)=>{
    if(!records.length)return null;
    const vl=records.filter(r=>r.dayType==="volume"),sl=records.filter(r=>r.dayType==="strength"),sugg=[];
    if(vl.length){const v=vl[vl.length-1];if(v.maxR>=12)sugg.push({label:"Об'ємне: +2.5 кг",val:`${v.maxW}→${v.maxW+2.5}кг`,color:"#FF6B1A",reason:"12+ повт"});else if(v.maxR<=7)sugg.push({label:"Об'ємне: знизь",val:`${v.maxW}→${Math.max(0,v.maxW-2.5)}кг`,color:"#E63946",reason:"<8 повт"});else sugg.push({label:"Об'ємне: тримай",val:`${v.maxW}кг`,color:"#4CAF50",reason:"8-11 повт ✓"});}
    if(sl.length){const s=sl[sl.length-1];sugg.push({label:"Силове (80-90%)",val:`${Math.round(s.maxW*0.8*2)/2}–${Math.round(s.maxW*0.9*2)/2}кг`,color:"#E63946",reason:`від ${s.maxW}кг`});}
    const last=records[records.length-1];sugg.push({label:"Розвантаження (60%)",val:`${Math.round(last.maxW*0.6*2)/2}кг`,color:"#4CAF50",reason:"15-20 повт"});
    return sugg;
  };

  // Fixed: sequential training-week numbering (not ISO calendar week),
  // so totals don't collide or jump across year boundaries / gaps.
  const withWeeks = attachSeqWeeks(sessions);
  const weekTon={};
  withWeeks.forEach(s=>{
    const w=s.seqWeek;
    if(!weekTon[w])weekTon[w]=0;
    weekTon[w]+=calcTon(s.exercises);
  });
  const wkEntries=Object.entries(weekTon).sort((a,b)=>+a[0]-+b[0]).slice(-6);
  const maxTon=Math.max(...wkEntries.map(e=>e[1]),1);

  return (
    <div style={{padding:"14px",maxWidth:"680px",margin:"0 auto"}}>

      {/* Tonnage chart */}
      {wkEntries.length>0&&<div style={{...S.card}}>
        <div style={S.sectionLabel}>📊 ТОННАЖ ПО ТИЖНЯХ</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:"5px",height:"90px"}}>
          {wkEntries.map(([w,ton],i)=>{const h=Math.max(6,(ton/maxTon)*82),isL=i===wkEntries.length-1;return <div key={w} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}><div style={{fontSize:"9px",color:isL?"#FF6B1A":"#8890A4",fontFamily:"Inter,sans-serif",fontWeight:isL?700:400}}>{Math.round(ton/1000)}к</div><div style={{width:"100%",borderRadius:"3px 3px 0 0",background:isL?"linear-gradient(180deg,#FF6B1A,#E63946)":"#2A2E3A",height:`${h}px`,boxShadow:isL?"0 0 10px #FF6B1A44":"none"}}/><div style={{fontSize:"8px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>Т{w}</div></div>;})}
        </div>
      </div>}

      {/* Exercise chart modal */}
      {chartEx&&records.length>=2&&(
        <div style={{position:"fixed",inset:0,zIndex:9000,background:"#000000bb",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setChartEx(null)}>
          <div style={{background:"#1A1D27",borderRadius:"20px 20px 0 0",padding:"18px 16px 28px",width:"100%",maxWidth:"480px",maxHeight:"80vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
              <div><div style={{fontSize:"15px",fontWeight:700,color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{chartEx}</div><div style={{fontSize:"10px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>{records.length} тренувань</div></div>
              <button onClick={()=>setChartEx(null)} style={{...S.btn(),padding:"5px 10px"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:"5px",marginBottom:"12px"}}>
              {[["oneRM","1ПМ"],["maxW","Вага"],["vol","Об'єм"]].map(([k,l])=><button key={k} onClick={()=>setChartMetric(k)} style={{flex:1,padding:"5px",borderRadius:"7px",border:`1px solid ${chartMetric===k?"#FF6B1A":"#2A2E3A"}`,cursor:"pointer",background:chartMetric===k?"#FF6B1A22":"transparent",color:chartMetric===k?"#FF6B1A":"#8890A4",fontSize:"11px",fontWeight:600,fontFamily:"Inter,sans-serif"}}>{l}</button>)}
            </div>
            <div style={{background:"#0D0F14",borderRadius:"10px",padding:"10px",marginBottom:"12px"}}>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{height:"110px",display:"block"}}>
                <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B1A" stopOpacity=".3"/><stop offset="100%" stopColor="#FF6B1A" stopOpacity="0"/></linearGradient></defs>
                {[.25,.5,.75].map(f=><line key={f} x1={pad} y1={pad+(1-f)*(H-2*pad)} x2={W-pad} y2={pad+(1-f)*(H-2*pad)} stroke="#2A2E3A" strokeWidth="1"/>)}
                {pts.length>1&&<path d={`M${pts[0].x},${H-pad} ${pts.map(p=>`L${p.x},${p.y}`).join(" ")} L${pts[pts.length-1].x},${H-pad} Z`} fill="url(#cg)"/>}
                {pts.length>1&&<path d={pts.map((p,i)=>(i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`)).join(" ")} fill="none" stroke="#FF6B1A" strokeWidth="2" strokeLinecap="round"/>}
                {pts.map((p,i)=>{const di=CYCLE_DAYS.find(d=>d.type===p.dayType)||CYCLE_DAYS[0];return <circle key={i} cx={p.x} cy={p.y} r="4" fill={di.color} stroke="#1A1D27" strokeWidth="2"/>;})}
              </svg>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"6px",marginBottom:"10px"}}>
              {[["Поточний",vals[vals.length-1],"#FF6B1A"],["Прогрес",vals[vals.length-1]-(vals[vals.length-2]||0),vals[vals.length-1]>=(vals[vals.length-2]||0)?"#4CAF50":"#E63946"],["Максимум",Math.max(...vals),"#E8E4DC"]].map(([l,v,c])=>(
                <div key={l} style={{background:"#0D0F14",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:"9px",color:"#8890A4",fontFamily:"Inter,sans-serif",marginBottom:"2px"}}>{l}</div>
                  <div style={{fontSize:"17px",fontWeight:700,color:c,fontFamily:"Inter,sans-serif"}}>{typeof v==="number"?(v>=0&&l==="Прогрес"?"+":"")+v.toFixed(1):v}</div>
                </div>
              ))}
            </div>
            {records.slice(-5).reverse().map((r,i)=>{const di=CYCLE_DAYS.find(d=>d.type===r.dayType)||CYCLE_DAYS[0];return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 0",borderBottom:"1px solid #2A2E3A22"}}>
                <div style={{width:"26px",height:"26px",borderRadius:"50%",background:di.color+"22",border:`1.5px solid ${di.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:700,color:di.color,fontFamily:"Inter,sans-serif",flexShrink:0}}>{di.short}</div>
                <div style={{flex:1,fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>{fmtDate(r.date)}</div>
                <div style={{fontSize:"11px",color:"#E8E4DC",fontFamily:"Inter,sans-serif"}}>{r.maxW}×{r.maxR}</div>
                <div style={{fontSize:"11px",color:"#FF6B1A",fontFamily:"Inter,sans-serif"}}>1ПМ:{r.oneRM}</div>
              </div>
            );})}
          </div>
        </div>
      )}

      {/* Per-exercise recommendations */}
      {sessions.length>=2&&<>
        <div style={S.sectionLabel}>🔮 РЕКОМЕНДАЦІЇ НА НАСТУПНИЙ ЦИКЛ</div>
        <div style={{...S.card,background:"#141720"}}>
          <div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif",lineHeight:"1.6"}}>
            <span style={{color:"#FF6B1A",fontWeight:700}}>Цикл:</span> О1→О2→Силове(80-90%)→Розвантаж(60%)<br/>
            <span style={{color:"#4CAF50",fontWeight:600}}>Прогресія:</span> 12+повт→+2.5кг • &lt;8повт→тримай/знизь
          </div>
        </div>
        {Object.entries(exMap).map(([name,recs])=>{
          const last=recs[recs.length-1],trend=recs.length>=2?last.maxW-recs[recs.length-2].maxW:0,rec=recommend(recs);
          return(
            <div key={name} style={{...S.card}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                <div>
                  <div style={{fontWeight:700,color:"#E8E4DC",fontSize:"14px",fontFamily:"Inter,sans-serif"}}>{name}</div>
                  {last.oneRM>0&&<div style={{fontSize:"11px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>1ПМ≈<span style={{color:"#FF6B1A",fontWeight:600}}>{last.oneRM}кг</span></div>}
                </div>
                <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                  <span style={{fontSize:"11px",fontWeight:700,color:trend>0?"#4CAF50":trend<0?"#E63946":"#8890A4",fontFamily:"Inter,sans-serif"}}>{trend>0?`↑+${trend}`:trend<0?`↓${trend}`:"→"}</span>
                  <button onClick={()=>setChartEx(chartEx===name?null:name)} style={{background:"#FF6B1A22",border:"1px solid #FF6B1A44",cursor:"pointer",borderRadius:"7px",color:"#FF6B1A",padding:"4px 9px",fontSize:"11px",fontWeight:600,fontFamily:"Inter,sans-serif"}}>📈</button>
                </div>
              </div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"8px"}}>
                {recs.slice(-4).map((r,i)=>{const di=CYCLE_DAYS.find(d=>d.type===r.dayType)||CYCLE_DAYS[0];return <div key={i} style={{padding:"3px 7px",borderRadius:"5px",fontSize:"10px",background:di.color+"22",color:di.color,fontWeight:600,fontFamily:"Inter,sans-serif"}}>{di.short}:{r.maxW}×{r.maxR}</div>;})}
              </div>
              {rec&&<div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                {rec.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:"6px",background:"#0D0F14",borderRadius:"7px",padding:"6px 9px",borderLeft:`3px solid ${r.color}`}}>
                  <div style={{flex:1}}><div style={{fontSize:"10px",color:r.color,fontWeight:700,fontFamily:"Inter,sans-serif"}}>{r.label}</div><div style={{fontSize:"10px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>{r.reason}</div></div>
                  <div style={{fontSize:"13px",fontWeight:700,color:r.color,fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>{r.val}</div>
                </div>)}
              </div>}
            </div>
          );
        })}
      </>}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
function App() {
  const [tab,setTab]=useState("log");
  const [data,setData]=useState(()=>{
    const d=load();
    return{
      sessions:d.sessions||[],
      bodyData:d.bodyData||[],
      manualPRs:d.manualPRs||{},
      foodLog:d.foodLog||{},
      nutritionProfile:d.nutritionProfile||{},
    };
  });
  const [timer,setTimer]=useState(null);

  const persist=useCallback(nd=>{setData(nd);save(nd);},[]);
  const saveSess=s=>persist({...data,sessions:[...data.sessions,s]});
  const saveBody=e=>persist({...data,bodyData:[...data.bodyData,e]});
  const saveManualPR=(name,val)=>persist({...data,manualPRs:{...data.manualPRs,[name]:val}});
  const saveFood=(date,entry)=>persist({...data,foodLog:{...data.foodLog,[date]:[...(data.foodLog[date]||[]),entry]}});
  const deleteFood=(date,id)=>persist({...data,foodLog:{...data.foodLog,[date]:(data.foodLog[date]||[]).filter(e=>e.id!==id)}});
  const saveProfile=p=>persist({...data,nutritionProfile:p});

  const startTimer=secs=>setTimer({seconds:parseInt(secs)||90,key:Date.now()});

  const cycleTypes=data.sessions.slice(-4).map(s=>s.dayType);

  return (
    <div style={{background:"#0D0F14",minHeight:"100vh",color:"#E8E4DC",fontFamily:"Inter,sans-serif",WebkitFontSmoothing:"antialiased"}}>
      <div style={{background:"linear-gradient(135deg,#1A1D27,#0D0F14)",padding:"14px 14px 10px",borderBottom:"1px solid #2A2E3A"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:"680px",margin:"0 auto"}}>
          <div>
            <div style={{fontSize:"20px",fontWeight:800,letterSpacing:"-0.02em",background:"linear-gradient(135deg,#FF6B1A,#E63946)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontFamily:"Inter,sans-serif"}}>IRON LOG</div>
            <div style={{fontSize:"10px",color:"#8890A4",fontFamily:"Inter,sans-serif"}}>Щоденник бодібілдингу</div>
          </div>
          <div style={{display:"flex",gap:"3px"}}>
            {CYCLE_DAYS.map((d,i)=>{const done=cycleTypes[i]===d.type;return <div key={i} style={{width:"26px",height:"26px",borderRadius:"50%",background:done?d.color+"33":"#2A2E3A",border:`2px solid ${done?d.color:"#3A3E4A"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"8px",fontWeight:700,color:done?d.color:"#4A4E5A",fontFamily:"Inter,sans-serif"}}>{d.short}</div>;})}
          </div>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab}/>

      <div style={{paddingBottom:"80px"}}>
        {tab==="log"&&<LogTab sessions={data.sessions} onSave={saveSess} onTimer={startTimer}/>}
        {tab==="records"&&<RecordsTab sessions={data.sessions} manualPRs={data.manualPRs} onSaveManualPR={saveManualPR}/>}
        {tab==="history"&&<HistoryTab sessions={data.sessions}/>}
        {tab==="body"&&<BodyTab bodyData={data.bodyData} onSave={saveBody}/>}
        {tab==="nutrition"&&<NutritionTab foodLog={data.foodLog} onSaveFood={saveFood} onDeleteFood={deleteFood} nutritionProfile={data.nutritionProfile} onSaveProfile={saveProfile}/>}
        {tab==="progression"&&<ProgressionTab sessions={data.sessions}/>}
      </div>

      {timer&&<RestTimer key={timer.key} seconds={timer.seconds} onClose={()=>setTimer(null)}/>}
    </div>
  );
}

// ─── MOUNT ────────────────────────────────────────────────────────────────────
const rootEl = document.getElementById("root");
const root = ReactDOM.createRoot(rootEl);
root.render(<App />);
