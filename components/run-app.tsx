"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { CalendarDays,Check,ChevronLeft,ChevronRight,ClipboardList,Plus,Settings,Sun,CalendarRange,X } from "lucide-react";
type Tab="today"|"week"|"plan"|"settings";
type Workout={id:string;workout_date:string;week_number:number|null;workout_type:string|null;title:string;planned_distance_km:number;duration_min:number|null;description:string|null;pace_target:string|null;completed:number;actual_distance_km:number|null;workout_notes:string|null;source:string};
const iso=(d=new Date())=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
const fmt=(d:string)=>new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"long"}).format(new Date(d+"T12:00:00"));
const km=(n:number)=>`${n.toFixed(1)} km`;
export default function RunApp({initialTab="today"}:{initialTab?:Tab}){
 const [tab,setTab]=useState<Tab>(initialTab),[uid,setUid]=useState(""),[workouts,setWorkouts]=useState<Workout[]>([]),[loading,setLoading]=useState(true),[modal,setModal]=useState<null|{kind:"complete";workout:Workout}|{kind:"manual"}>(null),[error,setError]=useState("");
 const api=useCallback(async(path:string,options:RequestInit={})=>{const r=await fetch(path,{...options,headers:{...options.headers,"x-user-id":uid}});const data=await r.json();if(!r.ok)throw new Error(data.error||"Request failed");return data},[uid]);
 const refresh=useCallback(async()=>{if(!uid)return;const d=await api("/api/workouts");setWorkouts(d.workouts)},[api,uid]);
 useEffect(()=>{let id=localStorage.getItem("run-user-id");if(!id){id=crypto.randomUUID();localStorage.setItem("run-user-id",id)}setUid(id)},[]);
 useEffect(()=>{if(!uid)return;(async()=>{try{await api("/api/bootstrap",{method:"POST"});await refresh()}catch(e){setError(e instanceof Error?e.message:"Could not load app")}finally{setLoading(false)}})()},[uid,api,refresh]);
 const navigate=(t:Tab)=>{setTab(t);history.replaceState(null,"",t==="today"?"/":`/${t}`)};
 if(loading)return <main className="app"><div className="loading">Loading RUN…</div></main>;
 return <main className="app"><header className="top"><div className="brand">RUN</div><div className="avatar">R</div></header>{error&&<div className="error">{error}</div>}{tab==="today"&&<Today workouts={workouts} onComplete={w=>setModal({kind:"complete",workout:w})}/>} {tab === "week" && (
  <Week
    workouts={workouts}
    onComplete={(workout) =>
      setModal({
        kind: "complete",
        workout,
      })
    }
  />
)} {tab==="plan"&&<Plan workouts={workouts} onComplete={w=>setModal({kind:"complete",workout:w})}/>} {tab==="settings"&&<SettingsPage api={api} onDone={refresh}/>} {tab==="today"&&<button className="fab" aria-label="Log an unscheduled run" onClick={()=>setModal({kind:"manual"})}><Plus/></button>}<Nav tab={tab} onChange={navigate}/>{modal&&<WorkoutModal modal={modal} api={api} close={()=>setModal(null)} done={async()=>{setModal(null);await refresh()}}/>}</main>
}
function WorkoutCard({
  w,
  onComplete,
  showDate = false,
  showDetails = true,
}: {
  w: Workout;
  onComplete: (workout: Workout) => void;
  showDate?: boolean;
  showDetails?: boolean;
}) {
  const distanceLabel =
    w.source === "manual"
      ? `Actual ${km(Number(w.actual_distance_km || 0))}`
      : `Planned ${km(Number(w.planned_distance_km || 0))}`;

  return (
    <article className="card">
      <div className="workout-row">
        <button
          className={`check ${w.completed ? "done" : ""}`}
          onClick={() => onComplete(w)}
          aria-label={
            w.completed ? "Edit completed workout" : "Complete workout"
          }
        >
          {w.completed ? <Check size={16} /> : null}
        </button>

        <div className="grow">
          <div className="title">{w.title}</div>

          {showDate && (
            <div className="muted">{fmt(w.workout_date)}</div>
          )}

          <div className="meta">
            {w.workout_type && (
              <span className="pill">{w.workout_type}</span>
            )}

            <span className="pill">{distanceLabel}</span>

            {Boolean(w.completed) && w.source !== "manual" && (
              <span className="pill">
                Actual {km(Number(w.actual_distance_km || 0))}
              </span>
            )}

            {w.pace_target && (
              <span className="pill">{w.pace_target}</span>
            )}
          </div>

          {showDetails && w.description && (
  <div className="workout-instructions">
    <div className="eyebrow">
      WORKOUT INSTRUCTIONS
    </div>

    <p>{w.description}</p>
  </div>
)}
        </div>
      </div>
    </article>
  );
}

function Today({workouts,onComplete}:{workouts:Workout[];onComplete:(w:Workout)=>void}){const today=iso(),todayRuns=workouts.filter(w=>w.workout_date===today),yesterday=iso(new Date(Date.now()-86400000)),yRuns=workouts.filter(w=>w.workout_date===yesterday);return <><div className="eyebrow">TODAY</div><h1>{fmt(today)}</h1>{todayRuns.length?todayRuns.map(w=><WorkoutCard key={w.id} w={w} onComplete={onComplete}/>):<div className="card empty"><Sun size={35}/><h2>Nothing scheduled today</h2><p className="muted">Enjoy the day off, or log an unscheduled run.</p></div>}{yRuns.length>0&&<section className="section"><div className="eyebrow">YESTERDAY</div>{yRuns.map(w=><WorkoutCard key={w.id} w={w} onComplete={onComplete}/>)}</section>}</>}
function weekBounds(offset=0){const d=new Date();d.setHours(12,0,0,0);const monday=new Date(d);monday.setDate(d.getDate()-((d.getDay()+6)%7)+offset*7);const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);return{monday,sunday}}
function Week({
  workouts,
  onComplete,
}: {
  workouts: Workout[];
  onComplete: (workout: Workout) => void;
}) {
  const [offset, setOffset] = useState(0);
  const { monday, sunday } = weekBounds(offset);

  const weekStart = iso(monday);
  const weekEnd = iso(sunday);
  const today = iso();

  const initialSelectedDate =
    today >= weekStart && today <= weekEnd ? today : weekStart;

  const [selectedDate, setSelectedDate] =
    useState(initialSelectedDate);

  useEffect(() => {
    const nextSelectedDate =
      today >= weekStart && today <= weekEnd
        ? today
        : weekStart;

    setSelectedDate(nextSelectedDate);
  }, [weekStart, weekEnd, today]);

  const weekWorkouts = workouts.filter(
    (workout) =>
      workout.workout_date >= weekStart &&
      workout.workout_date <= weekEnd,
  );

  const selectedWorkouts = weekWorkouts.filter(
    (workout) => workout.workout_date === selectedDate,
  );

  const planned = weekWorkouts.reduce(
    (total, workout) =>
      total + Number(workout.planned_distance_km || 0),
    0,
  );

  const actual = weekWorkouts
    .filter((workout) => Boolean(workout.completed))
    .reduce(
      (total, workout) =>
        total + Number(workout.actual_distance_km || 0),
      0,
    );

  const percentage = planned
    ? Math.min(100, Math.round((actual / planned) * 100))
    : 0;

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });

  return (
    <>
      <div className="week-head">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous week"
          onClick={() => setOffset((current) => current - 1)}
        >
          <ChevronLeft size={18} />
        </button>

        <div style={{ textAlign: "center" }}>
          <div className="eyebrow">WEEK</div>

          <h2>
            {monday.getDate()}{" "}
            {monday.toLocaleString("en", {
              month: "short",
            })}{" "}
            – {sunday.getDate()}{" "}
            {sunday.toLocaleString("en", {
              month: "short",
            })}
          </h2>
        </div>

        <button
          type="button"
          className="icon-btn"
          aria-label="Next week"
          onClick={() => setOffset((current) => current + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="stats section">
        <div className="stat">
          <span className="muted">Planned</span>
          <strong>{km(planned)}</strong>
        </div>

        <div className="stat">
          <span className="muted">Actual</span>
          <strong>{km(actual)}</strong>
        </div>
      </div>

      <div
        className="progress"
        aria-label={`${percentage}% of planned distance completed`}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>

      <div className="week-strip">
        {days.map((day) => {
          const date = iso(day);

          const dayDistance = weekWorkouts
            .filter(
              (workout) => workout.workout_date === date,
            )
            .reduce(
              (total, workout) =>
                total +
                Number(
                  workout.planned_distance_km ||
                    workout.actual_distance_km ||
                    0,
                ),
              0,
            );

          const selected = selectedDate === date;

          return (
            <button
              key={date}
              type="button"
              className={`day ${
                selected ? "selected" : ""
              }`}
              aria-pressed={selected}
              aria-label={`Show workouts for ${fmt(date)}`}
              onClick={() => setSelectedDate(date)}
            >
              {day.toLocaleString("en", {
                weekday: "narrow",
              })}

              <b>{day.getDate()}</b>

              <small>
                {dayDistance
                  ? `${dayDistance.toFixed(1)}k`
                  : "–"}
              </small>
            </button>
          );
        })}
      </div>

      <section className="selected-day-section">
        <div className="selected-day-heading">
          <div>
            <div className="eyebrow">SELECTED DAY</div>
            <h2>{fmt(selectedDate)}</h2>
          </div>

          <span className="pill">
            {selectedWorkouts.length === 1
              ? "1 workout"
              : `${selectedWorkouts.length} workouts`}
          </span>
        </div>

        {selectedWorkouts.length > 0 ? (
          selectedWorkouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              w={workout}
              onComplete={onComplete}
              showDetails
            />
          ))
        ) : (
          <div className="card empty">
            <Sun size={32} />

            <h2>Nothing scheduled</h2>

            <p className="muted">
              No workout is planned for this day.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
function Plan({workouts,onComplete}:{workouts:Workout[];onComplete:(w:Workout)=>void}){const grouped=useMemo(()=>{const m=new Map<number,Workout[]>();workouts.filter(w=>w.source!=="manual").forEach(w=>{const k=w.week_number||0;m.set(k,[...(m.get(k)||[]),w])});return [...m.entries()].sort((a,b)=>a[0]-b[0])},[workouts]);const planned=workouts.reduce((s,w)=>s+Number(w.planned_distance_km||0),0);return <><div className="eyebrow">FULL PLAN</div><h1>{workouts.length} workouts · {km(planned)} planned</h1>{grouped.length?grouped.map(([week,runs])=><section className="section" key={week}><div className="week-head"><div className="eyebrow">{week?`WEEK ${week}`:"UNASSIGNED"}</div><b>{km(runs.reduce((s,w)=>s+Number(w.planned_distance_km||0),0))}</b></div>{runs.map(w=><WorkoutCard key={w.id} w={w} onComplete={onComplete} showDate showDetails={false}/>)}</section>):<div className="card empty"><ClipboardList size={34}/><h2>No plan imported</h2><p className="muted">Open Settings to import your CSV plan.</p></div>}</>}
function SettingsPage({api,onDone}:{api:(p:string,o?:RequestInit)=>Promise<any>;onDone:()=>Promise<void>}){const[msg,setMsg]=useState(""),[err,setErr]=useState("");async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setMsg("");setErr("");try{const form=new FormData(e.currentTarget);const d=await api("/api/import",{method:"POST",body:form});setMsg(`Imported ${d.imported} workouts. Completed runs were preserved.`);await onDone()}catch(e){setErr(e instanceof Error?e.message:"Import failed")}}return <><div className="eyebrow">SETTINGS</div><h1>Training plan</h1><form className="card" onSubmit={submit}><div className="field"><label>PLAN NAME</label><input name="planName" defaultValue="My Training Plan" required/></div><div className="field"><label>CHOOSE A CSV FILE</label><input className="file" name="file" type="file" accept=".csv,text/csv" required/></div><p className="muted">Columns: date, week_number, day_of_week, workout_type, title, distance_km, duration_min, description, pace_target, notes.</p>{err&&<div className="error">{err}</div>}{msg&&<div className="success">{msg}</div>}<button className="primary" type="submit">Import CSV</button></form><div className="card"><h2>Polar Flow</h2><p className="muted">Planned for a future release. The data model already records workout source information.</p></div><div className="card"><h2>About anonymous access</h2><p className="muted">This version stores an anonymous ID on this device. Do not treat it as private authentication. Accounts can be added later.</p></div></>}
function Nav({tab,onChange}:{tab:Tab;onChange:(t:Tab)=>void}){const items:[Tab,React.ReactNode,string][]=[["today",<CalendarDays key="i" size={20}/>,"Today"],["week",<CalendarRange key="i" size={20}/>,"Week"],["plan",<ClipboardList key="i" size={20}/>,"Plan"],["settings",<Settings key="i" size={20}/>,"Settings"]];return <nav className="nav">{items.map(([id,icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>onChange(id)}>{icon}{label}</button>)}</nav>}
function WorkoutModal({modal,api,close,done}:{modal:any;api:(p:string,o?:RequestInit)=>Promise<any>;close:()=>void;done:()=>Promise<void>}){const w:Workout|undefined=modal.workout,[err,setErr]=useState("");async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setErr("");const fd=new FormData(e.currentTarget);try{if(modal.kind==="manual")await api("/api/workouts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({date:fd.get("date"),title:fd.get("title"),actualDistanceKm:fd.get("distance"),durationMin:fd.get("duration"),notes:fd.get("notes")})});else await api(`/api/workouts/${w!.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({completed:true,actualDistanceKm:fd.get("distance"),notes:fd.get("notes")})});await done()}catch(e){setErr(e instanceof Error?e.message:"Could not save")}}return <div className="dialog-back" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><form className="dialog" onSubmit={submit}><div className="dialog-head"><h2>{modal.kind==="manual"?"Log a run":"Complete workout"}</h2><button type="button" className="icon-btn" onClick={close}><X size={18}/></button></div>{modal.kind==="manual"?<><div className="field"><label>DATE</label><input name="date" type="date" defaultValue={iso()} required/></div><div className="field"><label>TITLE</label><input name="title" defaultValue="Manual run" required/></div></>:<p className="muted">{w!.title} · planned {km(Number(w!.planned_distance_km||0))}</p>}<div className="field"><label>ACTUAL DISTANCE (KM)</label><input name="distance" type="number" min="0" step="0.01" defaultValue={w?.actual_distance_km??w?.planned_distance_km??""} required/></div>{modal.kind==="manual"&&<div className="field"><label>DURATION (MINUTES)</label><input name="duration" type="number" min="0" step="1"/></div>}<div className="field"><label>NOTES</label><textarea name="notes" rows={3} defaultValue={w?.workout_notes||""}/></div>{err&&<div className="error">{err}</div>}<button className="primary" type="submit">Save run</button>{modal.kind==="complete"&&w?.completed&&<button className="secondary" style={{marginTop:10}} type="button" onClick={async()=>{await api(`/api/workouts/${w.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({completed:false})});await done()}}>Mark incomplete</button>}</form></div>}
