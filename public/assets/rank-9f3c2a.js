import { r as React, u as useStore, verifyChain, L as Link } from "./index-CL6IUdNY.js";
import { RANKS, LIGHTS } from "./guide-content-9f3c2a.js";
const VERIFY_KEY="aegis44.guide.verify.v1";
const EXPORT_KEY="aegis44.guide.export.v1";
function readFlag(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch(e){return null;}}
export function distinctCheckpointDays(checkpoints){
  const days=new Set();
  for(const cp of checkpoints||[]){
    const ts=cp&&cp.sealedAt;
    if(!ts)continue;
    const d=new Date(ts);
    if(Number.isNaN(d.getTime()))continue;
    days.add(d.toISOString().slice(0,10));
  }
  return days.size;
}
const FORBIDDEN=[" you are safe","secure","protected","no threats detected","great job","well done","congratulations","you're safe","shielded"];
export function scanForbidden(texts){
  const hay=(texts||[]).join(" \n ").toLowerCase();
  const matches=[];
  for(const phrase of FORBIDDEN){if(hay.includes(phrase))matches.push(phrase);}
  return {count:matches.length,matches};
}
export async function computeRank(state){
  const records=(state&&state.ledger&&state.ledger.records)||[];
  const checkpoints=(state&&state.ledger&&state.ledger.checkpoints)||[];
  const identity=(state&&state.identity)||null;
  const sealB=(state&&state.sealB)||null;
  const chain=records.length>=2?await verifyChain(records):null;
  const days=distinctCheckpointDays(checkpoints);
  const anchorRecords=records.filter(r=>r&&r.type==="ANCHOR"&&r.payload&&r.payload.channel);
  const custodyRecords=records.filter(r=>r&&r.type==="CUSTODY");
  const verifyFlag=readFlag(VERIFY_KEY);
  const exportFlag=readFlag(EXPORT_KEY);
  const lastCp=checkpoints.length?checkpoints[checkpoints.length-1]:null;
  const lastCpSeq=lastCp?(lastCp.lastSeq??lastCp.toSeq??0):0;
  const latestSeq=records.length?(records[records.length-1].seq??0):0;
  const exportCurrent=!!(exportFlag&&lastCpSeq>0&&Number(exportFlag.latestSeq)>=lastCpSeq);
  const lights=[];
  if(records.length<2)lights.push({key:"chain",label:"Hash chain intact",state:"NOT MEASURED",value:"fewer than two records"});
  else if(chain&&chain.ok)lights.push({key:"chain",label:"Hash chain intact",state:"MET",value:`${records.length} records; chain re-verified in this session`});
  else lights.push({key:"chain",label:"Hash chain intact",state:"NOT MET",value:`broken at record ${chain&&chain.brokenAt!=null?chain.brokenAt+1:"?"}: ${chain&&chain.reason?chain.reason:"unknown"}`});
  if(!identity)lights.push({key:"key",label:"Signing key present and non-extractable",state:"NOT MEASURED",value:"no Seal A key in the store"});
  else if(identity.extractable===false)lights.push({key:"key",label:"Signing key present and non-extractable",state:"MET",value:"Seal A present; extractable=false"});
  else lights.push({key:"key",label:"Signing key present and non-extractable",state:"NOT MET",value:"Seal A present but extractable=true"});
  lights.push({key:"keeper",label:"Keeper file exported off-device",state:"NOT MEASURED",value:sealB?"the off-device keeper file is not measured — the app cannot confirm it was stored off-device":"the off-device keeper file was never exported (not measured)"});
  if(!records.length)lights.push({key:"anchor",label:"Anchor recorded with a named channel",state:"NOT MEASURED",value:"no records to inspect"});
  else if(!anchorRecords.length)lights.push({key:"anchor",label:"Anchor recorded with a named channel",state:"NOT MET",value:"no ANCHOR record"});
  else lights.push({key:"anchor",label:"Anchor recorded with a named channel",state:"MET",value:`channel: ${anchorRecords[anchorRecords.length-1].payload.channel}`});
  if(!records.length)lights.push({key:"custody",label:"Custody logged",state:"NOT MEASURED",value:"no records to inspect"});
  else if(!custodyRecords.length)lights.push({key:"custody",label:"Custody logged",state:"NOT MET",value:"no CUSTODY record"});
  else lights.push({key:"custody",label:"Custody logged",state:"MET",value:`${custodyRecords.length} custody entries`});
  if(!exportFlag)lights.push({key:"export",label:"Export pack current",state:"NOT MEASURED",value:"no export pack prepared in this session"});
  else if(exportCurrent)lights.push({key:"export",label:"Export pack current",state:"MET",value:`export prepared at ${exportFlag.at}; latest record seq ${exportFlag.latestSeq}`});
  else lights.push({key:"export",label:"Export pack current",state:"NOT MET",value:`export is older than the last checkpoint (seq ${lastCpSeq})`});
  if(!records.length){const kl=lights.find(l=>l.key==="key");if(kl){kl.state="NOT MEASURED";kl.value="no records to inspect";}}
  const lightByKey=Object.fromEntries(lights.map(l=>[l.key,l]));
  const gates=[];
  gates.push({key:"LOGGING",n:1,state:records.length>=1?"MET":"NOT MET",basis:records.length>=1?`${records.length} record(s)`:"0 records"});
  let docState="NOT MET",docBasis="";
  if(records.length<2){docState="NOT MET";docBasis="fewer than two records";}
  else if(!chain){docState="NOT MEASURED";docBasis="chain not verified";}
  else if(!chain.ok){docState="NOT MET";docBasis=`chain broken at record ${chain.brokenAt+1}: ${chain.reason}`;}
  else if(!identity){docState="NOT MEASURED";docBasis="no Seal A key in the store";}
  else if(identity.extractable!==false){docState="NOT MET";docBasis="Seal A key reports extractable=true";}
  else{docState="MET";docBasis=`${records.length} records; chain re-verified; Seal A extractable=false`;}
  gates.push({key:"DOCUMENTED",n:2,state:docState,basis:docBasis});
  let ancState="NOT MET",ancBasis="";
  if(!anchorRecords.length){ancState="NOT MET";ancBasis="no ANCHOR record naming a channel";}
  else if(!checkpoints.length){ancState="NOT MET";ancBasis="no checkpoint receipt emitted";}
  else if(lightByKey.keeper.state==="NOT MEASURED"){ancState="NOT MEASURED";ancBasis=lightByKey.keeper.value;}
  else{ancState="MET";ancBasis=`anchor channel ${anchorRecords[anchorRecords.length-1].payload.channel}; ${checkpoints.length} checkpoint(s)`;}
  gates.push({key:"ANCHORED",n:3,state:ancState,basis:ancBasis});
  let verState="NOT MEASURED",verBasis="";
  if(!verifyFlag){verState="NOT MEASURED";verBasis="no /verify run recorded in this session (not measured)";}
  else if(verifyFlag.ok){verState="MET";verBasis=`verified at ${verifyFlag.at}`;}
  else{verState="NOT MET";verBasis="the last /verify run did not return internally consistent";}
  gates.push({key:"THIRD-PARTY VERIFIABLE",n:4,state:verState,basis:verBasis});
  const allPrev=gates.every(g=>g.state==="MET");
  const anyUnmeasured=lights.some(l=>l.state==="NOT MEASURED");
  let crState="NOT MET",crBasis="";
  if(!allPrev){crState="NOT MET";crBasis="not every earlier gate is met";}
  else if(lightByKey.custody.state!=="MET"){crState="NOT MET";crBasis="no CUSTODY record";}
  else if(lightByKey.export.state!=="MET"){crState="NOT MET";crBasis=lightByKey.export.value;}
  else if(anyUnmeasured){crState="NOT MEASURED";crBasis=lights.find(l=>l.state==="NOT MEASURED").value;}
  else{crState="MET";crBasis="all gates met; custody logged; export current; no light unmeasured";}
  gates.push({key:"COUNSEL-READY",n:5,state:crState,basis:crBasis});
  let rankIndex=0;
  for(const g of gates){if(g.state==="MET")rankIndex=g.n;else break;}
  const firstUnmet=gates.find(g=>g.state!=="MET")||null;
  const capReason=firstUnmet&&firstUnmet.state==="NOT MEASURED"?firstUnmet.basis:null;
  const rank=RANKS[rankIndex].key;
  const gatesMet=gates.filter(g=>g.state==="MET").length;
  const lightsMeasured=lights.filter(l=>l.state!=="NOT MEASURED").length;
  const nextGate=firstUnmet?{...firstUnmet,link:(RANKS.find(r=>r.key===firstUnmet.key)||{}).link||"/memory"}:null;
  const basis=gates.map(g=>`${g.key} ${g.state}${g.basis?" — "+g.basis:""}`).join(" · ");
  return {rank,rankIndex,gatesMet,gates,lights,lightsMeasured,capReason,nextGate,basis,days,records,checkpoints,identity,sealB,anchorRecords,custodyRecords,verifyFlag,exportFlag,lastCpSeq,latestSeq,exportCurrent};
}
export function RankStrip(){
  const state=useStore();
  const [data,setData]=React.useState(null);
  React.useEffect(()=>{let alive=true;computeRank(state).then(d=>{if(alive)setData(d);}).catch(()=>{if(alive)setData(null);});return()=>{alive=false;};},[]);
  const next=data?data.nextGate:null;
  return React.createElement("div",{className:"panel mb-3 p-2.5",style:{fontSize:"10px"}},
    React.createElement("p",{className:"mono",style:{margin:0,color:"var(--gold)"}},`RANK: ${data?data.rank:"READING"} · ${data?data.gatesMet:0} OF 5 GATES MET`),
    React.createElement("p",{className:"mono",style:{margin:"2px 0 0",color:"var(--smoke)"}},`LIGHTS: ${data?data.lightsMeasured:0} OF 6 MEASURED`),
    React.createElement("p",{className:"mono",style:{margin:"2px 0 0",color:"var(--smoke)"}},next?React.createElement(React.Fragment,null,"NEXT GATE: ",React.createElement(Link,{to:next.link,className:"text-gold hover:underline"},`${next.key} → ${next.link}`)):"NEXT GATE: none — basis: all five gates met")
  );
}
