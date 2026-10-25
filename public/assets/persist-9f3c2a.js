import { r as React } from "./index-CL6IUdNY.js";
const btn={appearance:"none",border:"1px solid var(--border)",background:"var(--secondary)",color:"var(--chalk)",borderRadius:"6px",padding:"8px 10px",fontFamily:"var(--font-mono)",fontSize:"10px",letterSpacing:".06em",textTransform:"uppercase",cursor:"pointer",minHeight:"44px"};
export function PersistControl(){
  const [before,setBefore]=React.useState(null);
  const [after,setAfter]=React.useState(null);
  const [requested,setRequested]=React.useState(null);
  const [usage,setUsage]=React.useState(null);
  const [quota,setQuota]=React.useState(null);
  const [error,setError]=React.useState(null);
  const [busy,setBusy]=React.useState(false);
  React.useEffect(()=>{let alive=true;(async()=>{try{const p=await navigator.storage.persisted();if(alive)setBefore(p);}catch(e){if(alive)setError(e.name+": "+e.message);}try{const est=await navigator.storage.estimate();if(alive){setUsage(est.usage);setQuota(est.quota);}}catch(e){}})();return()=>{alive=false;};},[]);
  async function request(){
    setBusy(true);setError(null);
    try{
      if(!navigator.storage||typeof navigator.storage.persist!=="function"){setRequested("unsupported");setAfter(null);return;}
      const r=await navigator.storage.persist();
      setRequested(r);
      const p=await navigator.storage.persisted();
      setAfter(p);
      let est=null;
      try{est=await navigator.storage.estimate();setUsage(est.usage);setQuota(est.quota);}catch(e){}
      try{localStorage.setItem("aegis44.backup.persist.v1",JSON.stringify({at:new Date().toISOString(),requested:r,persisted:p,usage:est?est.usage:null,quota:est?est.quota:null}));}catch(e){}
    }catch(e){setError(e.name+": "+e.message);}
    finally{setBusy(false);}
  }
  const mb=n=>n==null?"—":(n/1048576).toFixed(2)+" MB";
  const outcome=requested===null?"not requested":requested===true?"granted":requested===false?"denied":"unsupported";
  return React.createElement("section",{className:"panel p-3",style:{borderColor:"var(--amber)"}},
    React.createElement("p",{className:"label",style:{color:"var(--gold)",margin:0}},"PERSISTENT STORAGE"),
    React.createElement("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"This control calls navigator.storage.persist() only when you tap it. It never runs on load."),
    React.createElement("div",{style:{marginTop:"8px",display:"grid",gap:"4px",fontFamily:"var(--font-mono)",fontSize:"10px",color:"var(--chalk)"}},
      React.createElement("p",{style:{margin:0}},"persisted() before: "+String(before)),
      React.createElement("p",{style:{margin:0}},"persist() returned: "+(requested===null?"not requested":String(requested))),
      React.createElement("p",{style:{margin:0}},"persisted() after: "+String(after)),
      React.createElement("p",{style:{margin:0}},"outcome: "+outcome),
      React.createElement("p",{style:{margin:0}},"usage: "+mb(usage)+" · quota: "+mb(quota))
    ),
    React.createElement("button",{type:"button",onClick:request,disabled:busy,style:{...btn,marginTop:"8px"}},busy?"REQUESTING…":"REQUEST PERSISTENT STORAGE"),
    error?React.createElement("p",{style:{margin:"6px 0 0",fontSize:"10px",color:"var(--crimson)"}},"error: "+error):null,
    React.createElement("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},"If the result is false or unsupported, the OS may evict this origin's storage. Exported packs and the keeper file are the only durable copy. A granted flag is a browser hint, not a guarantee against eviction; the browser may still clear data.")
  );
}
