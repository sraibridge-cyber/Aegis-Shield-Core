import { r as React, u as useStore } from "./index-CL6IUdNY.js";
const KEEPER_KEY="aegis44.backup.keeper.v1";
const PUBKEY_KEY="aegis44.backup.pubkey.v1";
const PACK_KEY="aegis44.backup.pack.v1";
const RECEIPT_KEY="aegis44.backup.receipt.v1";
const PERSIST_KEY="aegis44.backup.persist.v1";
function readFlag(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch(e){return null;}}
export function computeUnbacked(records,exportPoint){
  const seq=exportPoint&&Number.isFinite(Number(exportPoint.latestSeq))?Number(exportPoint.latestSeq):-1;
  const un=(records||[]).filter(r=>r&&Number(r.seq)>seq);
  let oldest=null;
  for(const r of un){if(r.ts&&(!oldest||r.ts<oldest))oldest=r.ts;}
  return {count:un.length,oldestTs:oldest,latestSeq:seq};
}
export function measureBackup(state,flags){
  const records=(state&&state.ledger&&state.ledger.records)||[];
  const f=flags||{keeper:readFlag(KEEPER_KEY),pubkey:readFlag(PUBKEY_KEY),pack:readFlag(PACK_KEY),receipt:readFlag(RECEIPT_KEY),persist:readFlag(PERSIST_KEY)};
  const un=computeUnbacked(records,f.pack);
  const rows=[
    {key:"keeper",label:"Seal B keeper file",state:f.keeper?"MEASURED":"NOT DONE",value:f.keeper?`last export ${f.keeper.at}`:"never exported",at:f.keeper?f.keeper.at:null,reason:f.keeper?null:"no keeper export recorded on this origin"},
    {key:"pubkey",label:"Seal A public key / instance record",state:f.pubkey?"MEASURED":"NOT DONE",value:f.pubkey?`last export ${f.pubkey.at} · public only`:"never exported · public only",at:f.pubkey?f.pubkey.at:null,reason:f.pubkey?null:"no public-key export recorded on this origin"},
    {key:"sealA-private",label:"Seal A private half",state:"NOT POSSIBLE",value:"not exportable by design",at:null,reason:"the private key is non-extractable; no backup can exist"},
    {key:"pack",label:"Evidence pack",state:f.pack?"MEASURED":"NOT DONE",value:f.pack?`last export ${f.pack.at} · ${f.pack.recordCount} records`:"never exported",at:f.pack?f.pack.at:null,reason:f.pack?null:"no pack export recorded on this origin"},
    {key:"receipt",label:"Checkpoint receipt",state:f.receipt?"MEASURED":"NOT DONE",value:f.receipt?`last export ${f.receipt.at} · checkpoint ${f.receipt.checkpointIndex}`:"never exported",at:f.receipt?f.receipt.at:null,reason:f.receipt?null:"no receipt export recorded on this origin"},
    {key:"storage",label:"Storage",state:f.persist?"MEASURED":"NOT MEASURED",value:f.persist?`persisted=${f.persist.persisted} · persist()=${f.persist.requested} · usage=${f.persist.usage} · quota=${f.persist.quota}`:"not measured this session",at:f.persist?f.persist.at:null,reason:f.persist?null:"no persist() result recorded this session"}
  ];
  return {rows,unbacked:un,closing:"This panel reports what was observed this session. Clearing browser data destroys the local chain and the Seal A private key."};
}
export function recordBackup(kind,data){
  const key=kind==="keeper"?KEEPER_KEY:kind==="pubkey"?PUBKEY_KEY:kind==="pack"?PACK_KEY:kind==="receipt"?RECEIPT_KEY:kind==="persist"?PERSIST_KEY:null;
  if(!key)return;
  try{localStorage.setItem(key,JSON.stringify({...data,at:data&&data.at?data.at:new Date().toISOString()}));}catch(e){}
}
export function BackupStatus(){
  const state=useStore();
  const data=measureBackup(state);
  const h=React.createElement;
  const stateColor=s=>s==="MEASURED"?"var(--phosphor)":s==="NOT DONE"?"var(--amber)":"var(--smoke)";
  return h("section",{className:"panel p-3"},
    h("p",{className:"label",style:{color:"var(--gold)",margin:0}},"BACKUP STATUS"),
    h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"Each row is measured on this origin. A row that was never done is marked NOT DONE; a row that cannot exist is marked NOT POSSIBLE with the reason."),
    h("div",{style:{marginTop:"8px",display:"grid",gap:"6px"}},
      data.rows.map(r=>h("div",{key:r.key,style:{borderBottom:"1px solid var(--border)",paddingBottom:"6px"}},
        h("div",{style:{display:"flex",justifyContent:"space-between",gap:"8px",flexWrap:"wrap"}},
          h("span",{style:{fontSize:"10.5px",color:"var(--chalk)"}},r.label),
          h("span",{className:"mono",style:{fontSize:"9px",color:stateColor(r.state)}},r.state)
        ),
        h("p",{className:"mono",style:{margin:"2px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)",wordBreak:"break-word"}},r.value+(r.at?` · ${r.at}`:"")+(r.reason?` — ${r.reason}`:""))
      ))
    ),
    h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--chalk)"}},data.unbacked.count>0?`${data.unbacked.count} records have been added since the last exported pack. Those records exist only in this browser's storage.`:`0 records have been added since the last exported pack.`),
    data.unbacked.oldestTs?h("p",{className:"mono",style:{margin:"2px 0 0",fontSize:"9px",color:"var(--smoke)"}},`oldest un-backed-up record: ${data.unbacked.oldestTs}`):null,
    h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},data.closing)
  );
}
export function BackupReminder(){
  const state=useStore();
  const data=measureBackup(state);
  const pack=readFlag(PACK_KEY);
  const days=pack&&pack.at?Math.max(0,Math.floor((Date.now()-new Date(pack.at).getTime())/86400000)):null;
  const count=data.unbacked.count;
  const over=count>25||(days!==null&&days>7);
  const text=over?`${count} records / ${days===null?"—":days} days since the last exported pack.`:`${count} records · ${days===null?"—":days} days since the last exported pack.`;
  return React.createElement("p",{className:"mono",style:{margin:"6px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)"}},text);
}
if(typeof window!=="undefined"){window.__aegisRecordBackup=(kind,data)=>{try{recordBackup(kind,data);}catch(e){}};}
