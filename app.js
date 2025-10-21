const { useState, useEffect } = React;
const LS_KEY = "outreach_tracker_v2";

/* ---------- defaults ---------- */
function defaultSequences() {
  const genId = nid(), fishId = nid(), nurtId = nid();
  const makeStep = (seqId, order, action, waitH=0, waitD=0) =>
    ({ id:nid(), sequenceId:seqId, order, actionType:action, waitHours:waitH, waitDays:waitD });

  const generalSteps = [
    makeStep(genId,1,"email"),
    makeStep(genId,2,"call",2),
    ...Array.from({length:10},(_,i)=>makeStep(genId,i+3, i%2?"email":"call",0,i+1))
  ];
  const nurtureSteps = [];
  for(let i=1;i<=15;i++) nurtureSteps.push(makeStep(nurtId,i, i%3?"email":"call",0,Math.floor(i*3)));

  return {
    sequences:[
      {id:genId,name:"General Prospecting"},
      {id:fishId,name:"GoFish Sequence"},
      {id:nurtId,name:"Nurture"}
    ],
    steps:[...generalSteps.map(s=>({...s})), ...generalSteps.map(s=>({...s, id:nid(), sequenceId:fishId})), ...nurtureSteps]
  };
}

/* ---------- main app ---------- */
function App(){
  const [data,setData] = useState(()=>loadData());
  const [tab,setTab] = useState("today");
  useEffect(()=>saveData(data),[data]);
  const tabs=["today","contacts","sequences","steps","tasks","backup"];
  return (
    <>
      <div className="tabs">
        {tabs.map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?"active":""}>{t[0].toUpperCase()+t.slice(1)}</button>)}
      </div>
      {tab==="today"&&<Today data={data} setData={setData}/>}
      {tab==="contacts"&&<Contacts data={data} setData={setData}/>}
      {tab==="sequences"&&<Sequences data={data} setData={setData}/>}
      {tab==="steps"&&<Steps data={data} setData={setData}/>}
      {tab==="tasks"&&<Tasks data={data} setData={setData}/>}
      {tab==="backup"&&<Backup data={data}/>}
    </>
  );
}

/* ---------- persistence ---------- */
function loadData(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw){return JSON.parse(raw);}
    const d=defaultSequences();
    return {contacts:[],tasks:[],...d};
  }catch{return {contacts:[],tasks:[],...defaultSequences()};}
}
function saveData(d){localStorage.setItem(LS_KEY,JSON.stringify(d));}
function nid(){return Math.random().toString(36).slice(2)+Date.now().toString(36);}

/* ---------- helpers ---------- */
function computeDue(step,now,isFirst){
  const start=6,end=16;
  if(isFirst&&step.waitHours>0){
    const c=new Date(now);c.setHours(c.getHours()+step.waitHours);
    if(c.getHours()<end)return c.toISOString();
  }
  const d=new Date(now);
  if(d.getHours()>=end){d.setDate(d.getDate()+1);d.setHours(start,0,0,0);}
  else d.setHours(start,0,0,0);
  return d.toISOString();
}
function formatDate(iso){return new Date(iso).toLocaleString();}

/* ---------- Today ---------- */
function Today({data,setData}){
  const now=new Date();
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const end=new Date(start);end.setHours(23,59,59);
  const overdue=data.tasks.filter(t=>!t.outcome&&new Date(t.dueAt)<start);
  const due=data.tasks.filter(t=>!t.outcome&&new Date(t.dueAt)>=start&&new Date(t.dueAt)<=end);
  const done=data.tasks.filter(t=>t.outcome==="done");
  return<>
    <h3>Past Due</h3><TaskList tasks={overdue} data={data} setData={setData}/>
    <h3>Today</h3><TaskList tasks={due} data={data} setData={setData}/>
    <h3>Completed</h3><TaskList tasks={done} data={data} setData={setData}/>
  </>;
}

/* ---------- Contacts ---------- */
function Contacts({data,setData}){
  function add(){setData({...data,contacts:[...data.contacts,{id:nid(),first:"",last:"",email:"",company:"",sequenceId:""}]});}
  function update(id,p){setData({...data,contacts:data.contacts.map(c=>c.id===id?{...c,...p}:c)});}
  function remove(id){setData({...data,contacts:data.contacts.filter(c=>c.id!==id)});}
  function enroll(id){
    const c=data.contacts.find(x=>x.id===id);
    if(!c.sequenceId)return alert("Select a sequence first");
    const steps=data.steps.filter(s=>s.sequenceId===c.sequenceId).sort((a,b)=>a.order-b.order);
    const now=new Date();
    const tasks=steps.filter((s,i)=>i===0||s.waitHours===0).map((s,i)=>({
      id:nid(),contactId:c.id,actionType:s.actionType,
      name:`${data.sequences.find(q=>q.id===s.sequenceId)?.name||""} - Day ${i+1} - ${s.actionType}`,
      dueAt:computeDue(s,now,i===0),outcome:""
    }));
    setData({...data,tasks:[...data.tasks,...tasks]});
  }

  return<>
    <button className="btn" onClick={add}>Add Contact</button>
    <table><thead><tr>
      <th>First</th><th>Last</th><th>Email</th><th>Company</th><th>Sequence</th><th></th>
    </tr></thead><tbody>
      {data.contacts.map(c=><tr key={c.id}>
        <td><input value={c.first} onChange={e=>update(c.id,{first:e.target.value})}/></td>
        <td><input value={c.last} onChange={e=>update(c.id,{last:e.target.value})}/></td>
        <td><input value={c.email} onChange={e=>update(c.id,{email:e.target.value})}/></td>
        <td><input value={c.company} onChange={e=>update(c.id,{company:e.target.value})}/></td>
        <td>
          <select value={c.sequenceId||""} onChange={e=>update(c.id,{sequenceId:e.target.value})}>
            <option value="">None</option>
            {data.sequences.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </td>
        <td>
          <button className="btn" onClick={()=>enroll(c.id)}>Enroll</button>{" "}
          <button className="btn danger" onClick={()=>remove(c.id)}>Delete</button>
        </td>
      </tr>)}
    </tbody></table>
  </>;
}

/* ---------- Sequences ---------- */
function Sequences({data,setData}){
  function add(){setData({...data,sequences:[...data.sequences,{id:nid(),name:"New Sequence"}]});}
  function update(id,p){setData({...data,sequences:data.sequences.map(s=>s.id===id?{...s,...p}:s)});}
  function remove(id){setData({...data,sequences:data.sequences.filter(s=>s.id!==id),steps:data.steps.filter(st=>st.sequenceId!==id)});}
  return<>
    <button className="btn" onClick={add}>Add Sequence</button>
    <table><thead><tr><th>Name</th><th></th></tr></thead>
      <tbody>{data.sequences.map(s=><tr key={s.id}>
        <td><input value={s.name} onChange={e=>update(s.id,{name:e.target.value})}/></td>
        <td><button className="btn danger" onClick={()=>remove(s.id)}>Delete</button></td>
      </tr>)}</tbody>
    </table>
  </>;
}

/* ---------- Steps ---------- */
function Steps({data,setData}){
  function add(seqId){
    if(!seqId)return alert("Select a sequence first");
    const count=data.steps.filter(s=>s.sequenceId===seqId).length+1;
    setData({...data,steps:[...data.steps,{id:nid(),sequenceId:seqId,order:count,actionType:"email",waitHours:0,waitDays:0}]});
  }
  function update(id,p){setData({...data,steps:data.steps.map(s=>s.id===id?{...s,...p}:s)});}
  function remove(id){setData({...data,steps:data.steps.filter(s=>s.id!==id)});}
  const seq=data.sequences[0];
  return<>
    <button className="btn" onClick={()=>add(seq?.id)}>Add Step</button>
    <table><thead><tr><th>Sequence</th><th>Order</th><th>Action</th><th>Wait Hours</th><th>Wait Days</th><th></th></tr></thead>
      <tbody>{data.steps.map(s=><tr key={s.id}>
        <td><select value={s.sequenceId} onChange={e=>update(s.id,{sequenceId:e.target.value})}>
          {data.sequences.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select></td>
        <td><input type="number" value={s.order} onChange={e=>update(s.id,{order:+e.target.value})}/></td>
        <td><select value={s.actionType} onChange={e=>update(s.id,{actionType:e.target.value})}>
          <option value="email">Email</option><option value="call">Call</option><option value="task">Task</option>
        </select></td>
        <td><input type="number" value={s.waitHours} onChange={e=>update(s.id,{waitHours:+e.target.value})}/></td>
        <td><input type="number" value={s.waitDays} onChange={e=>update(s.id,{waitDays:+e.target.value})}/></td>
        <td><button className="btn danger" onClick={()=>remove(s.id)}>Delete</button></td>
      </tr>)}</tbody>
    </table>
  </>;
}

/* ---------- Tasks ---------- */
function Tasks({data,setData}){
  const list=[...data.tasks].sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt));
  function complete(id){setData({...data,tasks:data.tasks.map(t=>t.id===id?{...t,outcome:"done"}:t)});}
  function remove(id){setData({...data,tasks:data.tasks.filter(t=>t.id!==id)});}
  return<table><thead><tr><th>Due</th><th>Name</th><th>Action</th><th></th></tr></thead>
    <tbody>{list.map(t=><tr key={t.id}>
      <td>{formatDate(t.dueAt)}</td><td>{t.name}</td><td>{t.actionType}</td>
      <td><button className="btn" onClick={()=>complete(t.id)}>Complete</button>{" "}
      <button className="btn danger" onClick={()=>remove(t.id)}>Delete</button></td>
    </tr>)}</tbody></table>;
}

/* ---------- Backup ---------- */
function Backup({data}){
  function exp(){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download=`outreach-backup-${Date.now()}.json`;a.click();URL.revokeObjectURL(url);
  }
  function imp(e){
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=()=>{try{
      localStorage.setItem(LS_KEY,r.result);location.reload();
    }catch{alert("Invalid file");}};r.readAsText(f);
  }
  return<>
    <button className="btn" onClick={exp}>Export</button>{" "}
    <input type="file" accept="application/json" onChange={imp}/>
  </>;
}

/* ---------- TaskList ---------- */
function TaskList({tasks,data,setData}){
  function complete(id){setData({...data,tasks:data.tasks.map(t=>t.id===id?{...t,outcome:"done"}:t)});}
  return<table><thead><tr><th>Due</th><th>Name</th><th>Action</th><th></th></tr></thead>
    <tbody>{tasks.map(t=><tr key={t.id}>
      <td>{formatDate(t.dueAt)}</td><td>{t.name}</td><td>{t.actionType}</td>
      <td><button className="btn" onClick={()=>complete(t.id)}>Complete</button></td>
    </tr>)}</tbody></table>;
}

/* ---------- render ---------- */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
