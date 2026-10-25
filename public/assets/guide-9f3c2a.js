import { r as React, u as useStore, L as Link, C as Copy } from "./index-CL6IUdNY.js";
import { TITLE, INTRO, SAMPLE, LIMIT, JOURNEY, RANKS, LIGHTS, GLOSSARY } from "./guide-content-9f3c2a.js";
import { computeRank } from "./rank-9f3c2a.js";
const h=React.createElement;
const btn="appearance:none;border:1px solid var(--border);background:var(--secondary);color:var(--chalk);border-radius:6px;padding:8px 10px;font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;min-height:44px";
const linkStyle={display:"inline-flex",alignItems:"center",minHeight:"44px",color:"var(--gold)",fontFamily:"var(--font-mono)",fontSize:"10px",textDecoration:"underline"};
function stateColor(s){return s==="MET"?"var(--phosphor)":s==="NOT MET"?"var(--crimson)":"var(--amber)";}
function Panel(props){return h("section",{className:"panel p-3",style:props.style||{}},props.children);}
function Label(props){return h("p",{className:"label",style:{color:props.color||"var(--smoke)",margin:0}},props.children);}
export function component(){
  const state=useStore();
  const [data,setData]=React.useState(null);
  const [stop,setStop]=React.useState(1);
  React.useEffect(()=>{let alive=true;computeRank(state).then(d=>{if(alive)setData(d);}).catch(()=>{if(alive)setData(null);});return()=>{alive=false;};},[]);
  const current=JOURNEY[stop-1];
  const rank=data?data.rank:"READING";
  const gatesMet=data?data.gatesMet:0;
  const lightsMeasured=data?data.lightsMeasured:0;
  const cap=data?data.capReason:null;
  const basis=data?data.basis:"reading the local ledger…";
  const sentences=[];
  if(data){
    const firstCp=data.checkpoints[0];
    const firstRec=data.records[0];
    const date=(firstCp&&firstCp.sealedAt)||(firstRec&&firstRec.ts)||null;
    const day=date?new Date(date).toISOString().slice(0,10):"an unrecorded date";
    const gate=k=>data.gates.find(g=>g.key===k);
    if(gate("LOGGING").state==="MET")sentences.push({rank:"LOGGING",text:`On ${day} this device sealed a record chain of ${data.records.length} entries. Each entry stores the fingerprint of the one before it, so a change to any entry would be visible.`});
    if(gate("DOCUMENTED").state==="MET")sentences.push({rank:"DOCUMENTED",text:`The chain was re-verified in this session: ${data.records.length} records across ${data.days} distinct checkpoint day(s). The signing key was generated on this device and reports extractable=false.`});
    if(gate("ANCHORED").state==="MET"){const a=data.anchorRecords[data.anchorRecords.length-1];sentences.push({rank:"ANCHORED",text:`An anchor record names the channel ${a.payload.channel} and the digest ${String(a.payload.digest||"").slice(0,16)}. A checkpoint receipt was prepared for checkpoint ${data.checkpoints.length}.`});}
    if(gate("THIRD-PARTY VERIFIABLE").state==="MET")sentences.push({rank:"THIRD-PARTY VERIFIABLE",text:`The pack was verified on this device at ${data.verifyFlag.at}; the verifier reported the chain internally consistent.`});
    if(gate("COUNSEL-READY").state==="MET"){const c=data.custodyRecords[data.custodyRecords.length-1];sentences.push({rank:"COUNSEL-READY",text:`A custody entry records ${c.payload.event||"a custody event"} on ${c.ts?new Date(c.ts).toISOString().slice(0,10):"an unrecorded date"}. The export pack's latest record is newer than the last checkpoint.`});}
  }
  const cover="This describes records created on a single device. It does not establish that any observation was true, and it does not establish when the device clock said they were made. "+sentences.map(s=>s.text).join(" ");
  return h("div",{className:"space-y-4"},
    h("header",{className:"space-y-2"},
      h(Label,{color:"var(--gold)"},"FIELD GUIDE"),
      h("h1",{style:{margin:0,fontSize:"22px",lineHeight:1.15,color:"var(--chalk)",letterSpacing:"-.02em"}},TITLE),
      h("p",{style:{margin:0,fontSize:"11px",lineHeight:1.6,color:"var(--smoke)"}},INTRO),
      h("p",{className:"mono",style:{margin:0,fontSize:"9px",lineHeight:1.5,color:"var(--amber)"}},SAMPLE)
    ),
    h(Panel,null,
      h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"8px",flexWrap:"wrap"}},
        h(Label,{color:"var(--gold)"},`STOP ${stop} OF 6`),
        h("div",{style:{display:"flex",gap:"4px",flexWrap:"wrap"}},
          JOURNEY.map(s=>h("button",{key:s.n,type:"button",onClick:()=>setStop(s.n),"aria-label":`Go to stop ${s.n}`,style:{...{appearance:"none",border:"1px solid "+(s.n===stop?"var(--gold)":"var(--border)"),background:s.n===stop?"var(--secondary)":"transparent",color:s.n===stop?"var(--gold)":"var(--smoke)",borderRadius:"6px",width:"44px",height:"44px",fontFamily:"var(--font-mono)",fontSize:"10px",cursor:"pointer"}}},String(s.n)))
        )
      ),
      h("h2",{style:{margin:"10px 0 0",fontSize:"15px",color:"var(--chalk)"}},current.title),
      h("p",{style:{margin:"6px 0 0",fontSize:"11px",lineHeight:1.6,color:"var(--smoke)"}},current.what),
      current.weights?h("p",{className:"mono",style:{margin:"6px 0 0",fontSize:"10px",color:"var(--gold)"}},current.weights):null,
      h("div",{style:{marginTop:"10px",display:"grid",gap:"6px"}},
        h("div",null,h(Label,null,"WHO HOLDS A COPY NOW"),h("p",{style:{margin:"2px 0 0",fontSize:"10.5px",lineHeight:1.5,color:"var(--chalk)"}},current.holds)),
        h("div",null,h(Label,null,"WHAT A THIRD PARTY CAN CHECK"),h("p",{style:{margin:"2px 0 0",fontSize:"10.5px",lineHeight:1.5,color:"var(--chalk)"}},current.check)),
        h("div",null,h(Label,null,"WHAT THEY STILL CANNOT DO"),h("p",{style:{margin:"2px 0 0",fontSize:"10.5px",lineHeight:1.5,color:"var(--chalk)"}},current.cannot))
      ),
      h("div",{style:{display:"flex",gap:"8px",marginTop:"10px",flexWrap:"wrap"}},
        h("button",{type:"button",disabled:stop===1,onClick:()=>setStop(s=>Math.max(1,s-1)),style:{...{appearance:"none",border:"1px solid var(--border)",background:"var(--secondary)",color:stop===1?"var(--smoke)":"var(--chalk)",borderRadius:"6px",padding:"8px 10px",fontFamily:"var(--font-mono)",fontSize:"10px",cursor:stop===1?"default":"pointer",minHeight:"44px",opacity:stop===1?".5":"1"}}},"PREV"),
        h("button",{type:"button",disabled:stop===6,onClick:()=>setStop(s=>Math.min(6,s+1)),style:{...{appearance:"none",border:"1px solid var(--border)",background:"var(--secondary)",color:stop===6?"var(--smoke)":"var(--chalk)",borderRadius:"6px",padding:"8px 10px",fontFamily:"var(--font-mono)",fontSize:"10px",cursor:stop===6?"default":"pointer",minHeight:"44px",opacity:stop===6?".5":"1"}}},"NEXT")
      )
    ),
    h(Panel,null,
      h(Label,{color:"var(--gold)"},`RANK: ${rank} · ${gatesMet} OF 5 GATES MET`),
      h("p",{className:"mono",style:{margin:"4px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)"}},basis),
      cap?h("p",{style:{margin:"4px 0 0",fontSize:"10px",lineHeight:1.5,color:"var(--amber)"}},`CAPPED AT ${rank} — ${cap}`):null,
      h("div",{style:{marginTop:"10px",display:"grid",gap:"8px"}},
        RANKS.map(r=>{
          const gate=r.n===0?null:(data?data.gates.find(g=>g.key===r.key):null);
          const st=r.n===0?"BASE":(gate?gate.state:"READING");
          const isCurrent=r.key===rank;
          return h("div",{key:r.key,style:{border:"1px solid "+(isCurrent?"var(--gold)":"var(--border)"),borderRadius:"6px",padding:"8px",background:isCurrent?"var(--secondary)":"transparent"}},
            h("div",{style:{display:"flex",justifyContent:"space-between",gap:"8px",alignItems:"center",flexWrap:"wrap"}},
              h("span",{className:"mono",style:{fontSize:"11px",color:isCurrent?"var(--gold)":"var(--chalk)"}},r.key),
              h("span",{className:"mono",style:{fontSize:"9px",color:stateColor(st)}},st)
            ),
            h("p",{style:{margin:"4px 0 0",fontSize:"10px",lineHeight:1.5,color:"var(--smoke)"}},r.condition),
            gate&&gate.basis?h("p",{className:"mono",style:{margin:"2px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)"}},gate.basis):null,
            r.n>0&&st!=="MET"?h(Link,{to:r.link,style:linkStyle},`DO THIS: ${r.instruction}`):null
          );
        })
      )
    ),
    h(Panel,null,
      h(Label,{color:"var(--gold)"},`LIGHTS: ${lightsMeasured} OF 6 MEASURED`),
      h("div",{style:{marginTop:"8px",display:"grid",gap:"6px"}},
        LIGHTS.map(def=>{
          const l=data?data.lights.find(x=>x.key===def.key):null;
          const st=l?l.state:"READING";
          return h("div",{key:def.key,style:{borderBottom:"1px solid var(--border)",paddingBottom:"6px"}},
            h("div",{style:{display:"flex",justifyContent:"space-between",gap:"8px",flexWrap:"wrap"}},
              h("span",{style:{fontSize:"10.5px",color:"var(--chalk)"}},def.label),
              h("span",{className:"mono",style:{fontSize:"9px",color:stateColor(st)}},st)
            ),
            h("p",{className:"mono",style:{margin:"2px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)"}},l?l.value:"reading…")
          );
        })
      ),
      h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},"This counts what your own records contain. It is not a measure of your risk, your safety, or whether anyone is observing you.")
    ),
    h(Panel,null,
      h(Label,{color:"var(--gold)"},"SAY THIS TO COUNSEL"),
      sentences.length?h("div",{style:{marginTop:"8px",display:"grid",gap:"8px"}},
        sentences.map(s=>h("div",{key:s.rank,style:{border:"1px solid var(--border)",borderRadius:"6px",padding:"8px"}},
          h("p",{className:"mono",style:{margin:0,fontSize:"9px",color:"var(--gold)"}},s.rank),
          h("p",{style:{margin:"4px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--chalk)"}},s.text),
          h(Copy,{text:s.text,label:"Copy sentence"})
        ))
      ):h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"No rank gate is met yet. The cover statement is empty until a gate is met."),
      h("div",{style:{marginTop:"10px",borderTop:"1px solid var(--border)",paddingTop:"8px"}},
        h(Label,{color:"var(--gold)"},"COVER STATEMENT"),
        h("p",{style:{margin:"4px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--chalk)"}},cover),
        h(Copy,{text:cover,label:"Copy cover statement"})
      )
    ),
    h(Panel,null,
      h("details",null,
        h("summary",{className:"label",style:{color:"var(--gold)",cursor:"pointer",minHeight:"44px",display:"flex",alignItems:"center"}},"GLOSSARY · 11 TERMS"),
        h("div",{style:{marginTop:"8px",display:"grid",gap:"8px"}},
          GLOSSARY.map(([term,plain,tech])=>h("div",{key:term,style:{borderBottom:"1px solid var(--border)",paddingBottom:"6px"}},
            h("p",{className:"mono",style:{margin:0,fontSize:"10px",color:"var(--chalk)"}},term),
            h("p",{style:{margin:"2px 0 0",fontSize:"10px",lineHeight:1.5,color:"var(--smoke)"}},plain),
            h("p",{className:"mono",style:{margin:"2px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)"}},tech)
          ))
        ),
        h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},"The Bluetooth chooser is browser UI the page cannot relabel. A row's name comes from the device's advertising packet; a device that advertises no name is shown as Unknown. The page resolves identity after you connect.")
      )
    ),
    h(Panel,{style:{borderColor:"var(--crimson)"}},
      h(Label,{color:"var(--crimson)"},"LIMITATION"),
      h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.65,color:"var(--smoke)"}},LIMIT)
    )
  );
}
