import { r as React, u as useStore, appendRecord, generateSealKeys, sealAll, verifyArtifact, sha256Hex, canonicalJson, idbGet, idbPut, clearAllStores, updateStore, setSealA, getSealA, getSealB, deriveVaultKey, encryptJson, decryptJson, randomBytes, bytesToB64, b64ToBytes, PBKDF2_ITERATIONS } from "./index-CL6IUdNY.js";
import { prepareDelivery } from "./download-GqGer48n.js";
const btn={appearance:"none",border:"1px solid var(--border)",background:"var(--secondary)",color:"var(--chalk)",borderRadius:"6px",padding:"8px 10px",fontFamily:"var(--font-mono)",fontSize:"10px",letterSpacing:".06em",textTransform:"uppercase",cursor:"pointer",minHeight:"44px"};
const btnDanger={...btn,borderColor:"var(--crimson)",color:"var(--crimson)"};
const input={width:"100%",background:"#040607",color:"var(--chalk)",border:"1px solid var(--border)",borderRadius:"6px",padding:"8px",fontFamily:"var(--font-mono)",fontSize:"11px",minHeight:"44px"};
const h=React.createElement;
const Panel=(props)=>h("section",{className:"panel p-3",style:props.style||{}},props.children);
const Label=(props)=>h("p",{className:"label",style:{color:props.color||"var(--smoke)",margin:0}},props.children);
const row=(label,value)=>h("div",{style:{display:"flex",justifyContent:"space-between",gap:"8px",borderBottom:"1px solid var(--border)",paddingBottom:"4px",flexWrap:"wrap"}},h("span",{className:"label",style:{margin:0}},label),h("span",{className:"mono",style:{fontSize:"10px",color:"var(--chalk)",wordBreak:"break-all",textAlign:"right"}},value));

export function differentInstanceNotice(packFp,currentHull){
  if(!packFp||!currentHull||packFp===currentHull)return null;
  return `This pack was sealed on a different instance. Pack instance: ${packFp.slice(0,8)} · This device: ${currentHull.slice(0,8)}. The signatures in the pack still verify against the key embedded in the pack.`;
}
export function detectIdentityChange(stored,current){
  if(!current)return {changed:false,reason:"no current identity"};
  if(!stored)return {changed:true,prior_hull_id:null,new_hull_id:current.hullId,prior_fingerprint:null,new_fingerprint:current.fingerprint,reason:"no prior hull on this origin"};
  if(stored.hullId!==current.hullId||stored.fingerprint!==current.fingerprint)return {changed:true,prior_hull_id:stored.hullId,new_hull_id:current.hullId,prior_fingerprint:stored.fingerprint,new_fingerprint:current.fingerprint,reason:"stored identity differs"};
  return {changed:false,reason:"stored identity matches"};
}
export function resetGuard({typedHullId,currentHullId,acknowledged,boundaryPrepared,secondConfirmed}){
  if(!currentHullId)return {enabled:false,reason:"no current hull id"};
  if(typedHullId!==currentHullId)return {enabled:false,reason:"typed hull id does not match"};
  if(!acknowledged)return {enabled:false,reason:"acknowledgement is unticked"};
  if(!boundaryPrepared)return {enabled:false,reason:"reset boundary not prepared"};
  if(!secondConfirmed)return {enabled:false,reason:"second confirmation is unticked"};
  return {enabled:true,reason:"guard satisfied"};
}
export function muCoverageLabel(r){
  const b=r&&r.mu_basis;
  const n=b?b.n_of_6:0;
  const w=b?Math.round(Number(b.weight_contributing)*100):0;
  return n<6?`PARTIAL (${n}/6 · ${w}% weight) — a partial μ is the weighted mean of the domains actually measured`:`full coverage — 6 of 6 domains measured`;
}
export async function persistProbe(){
  try{
    if(!navigator.storage||typeof navigator.storage.persist!=="function")return {outcome:"absent",persisted:null,error:null};
    const r=await navigator.storage.persist();
    const p=await navigator.storage.persisted();
    return {outcome:r?"granted":"denied",persisted:p,error:null};
  }catch(e){return {outcome:"error",persisted:null,error:(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e))};}
}
async function sealAObject(seal){
  const jwk=await crypto.subtle.exportKey("jwk",seal.publicKey);
  const spkiBytes=new Uint8Array(await crypto.subtle.exportKey("spki",seal.publicKey));
  const fingerprint=await sha256Hex(spkiBytes);
  return {privateKey:seal.privateKey,publicKey:seal.publicKey,publicKeyJwk:jwk,fingerprint,spki:seal.spki};
}
async function sealBObject(seal){
  const jwk=await crypto.subtle.exportKey("jwk",seal.publicKey);
  const spkiBytes=new Uint8Array(await crypto.subtle.exportKey("spki",seal.publicKey));
  const fingerprint=await sha256Hex(spkiBytes);
  return {privateKey:seal.privateKey,publicKey:seal.publicKey,publicKeyJwk:jwk,fingerprint,spki:seal.spki,createdAt:new Date().toISOString(),lastCosignedAt:null,mode:"device"};
}
export function component(){
  const state=useStore();
  const identity=state&&state.identity;
  const sealB=state&&state.sealB;
  const records=(state&&state.ledger&&state.ledger.records)||[];
  const checkpoints=(state&&state.ledger&&state.ledger.checkpoints)||[];
  const lastCp=checkpoints.length?checkpoints[checkpoints.length-1]:null;
  const lastAnchor=lastCp?(lastCp.merkleRoot??lastCp.rootAtSeal??"—"):"—";
  const [persisted,setPersisted]=React.useState(null);
  const [typed,setTyped]=React.useState("");
  const [ack,setAck]=React.useState(false);
  const [second,setSecond]=React.useState(false);
  const [boundary,setBoundary]=React.useState(null);
  const [busy,setBusy]=React.useState(false);
  const [msg,setMsg]=React.useState(null);
  const [rotateMsg,setRotateMsg]=React.useState(null);
  const [oldPass,setOldPass]=React.useState("");
  const [newPass,setNewPass]=React.useState("");
  const [rewrapAck,setRewrapAck]=React.useState(false);
  const [rewrapMsg,setRewrapMsg]=React.useState(null);
  const storedBoundary=React.useMemo(()=>{try{return localStorage.getItem("aegis44.instance.boundary.v1");}catch(e){return null;}},[]);
  const lastReset=React.useMemo(()=>{try{const raw=localStorage.getItem("aegis44.instance.last-reset.v1");return raw?JSON.parse(raw):null;}catch(e){return null;}},[]);
  React.useEffect(()=>{let alive=true;navigator.storage.persisted().then(p=>{if(alive)setPersisted(p);}).catch(()=>{if(alive)setPersisted("error");});return()=>{alive=false;};},[]);
  const guard=resetGuard({typedHullId:typed,currentHullId:identity?identity.hullId:null,acknowledged:ack,boundaryPrepared:!!boundary,secondConfirmed:second});
  async function rotateKeys(){
    if(!window.confirm("Rotate the identity keys? A KEY-ROTATION record will be appended and a checkpoint sealed with the new key."))return;
    setBusy(true);setRotateMsg(null);
    try{
      const current=getSealA();
      if(!current)throw new Error("no current Seal A key");
      const newSeal=await generateSealKeys();
      const newA=await sealAObject(newSeal);
      let newB=null;
      if(sealB){const b=await generateSealKeys();newB=await sealBObject(b);}
      const rec=await appendRecord("KEY-ROTATION","key rotation",{previous_fingerprint:identity?identity.hullId:null,new_fingerprint:newA.fingerprint,rotated_at:new Date().toISOString(),scope:"identity-keys-only"},false);
      const cp=await sealAll([...records,rec],{sealA:newA,sealB:newB,index:checkpoints.length+1,prevCheckpointRoot:lastCp?(lastCp.merkleRoot??null):null,specVersion:"aegis44/2",appVersion:"44.2.0"},false);
      await idbPut("keys","seal",newSeal);
      if(newB)await idbPut("keys","sealB",newB);
      setSealA(newSeal);
      updateStore({identity:{hullId:newSeal.hullId,spki:newSeal.spki,algorithm:"ECDSA P-256",extractable:newSeal.privateKey.extractable,createdAt:new Date().toISOString()},sealB:newB?{fingerprint:newB.fingerprint,spki:newB.spki,publicKeyJwk:newB.publicKeyJwk,createdAt:newB.createdAt,lastCosignedAt:null,extractable:newB.privateKey.extractable,mode:"device"}:null,ledger:{...state.ledger,checkpoints:[...checkpoints,cp]}});
      setRotateMsg(`KEY-ROTATION record ${rec.hash.slice(0,16)}… appended; checkpoint ${cp.id} sealed by the new key. Earlier signatures verify against the previous public key retained in the chain.`);
    }catch(e){setRotateMsg("Key rotation failed: "+(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e)));}
    finally{setBusy(false);}
  }
  async function rewrapVault(){
    if(!window.confirm("Rewrap the vault with a new passphrase? If the old passphrase is not provided, the old vault contents will be lost."))return;
    setBusy(true);setRewrapMsg(null);
    try{
      if(!newPass||newPass.length<8)throw new Error("new passphrase must be at least 8 characters");
      const meta=await idbGet("vault","meta");
      let payload={};
      if(meta&&oldPass){
        const oldKey=await deriveVaultKey(oldPass,b64ToBytes(meta.salt),meta.iterations||PBKDF2_ITERATIONS);
        payload=await decryptJson(oldKey,meta);
      }else if(meta&&!oldPass&&!rewrapAck){
        throw new Error("old passphrase required, or tick the acknowledgement that the old vault contents will be lost");
      }
      const salt=randomBytes(16);
      const newKey=await deriveVaultKey(newPass,salt);
      const enc=await encryptJson(newKey,payload);
      const newMeta={mode:"passphrase",salt:bytesToB64(salt),iterations:PBKDF2_ITERATIONS,iv:enc.iv,ciphertext:enc.ciphertext,updatedAt:new Date().toISOString()};
      await idbPut("vault","meta",newMeta);
      updateStore({vaultMode:"passphrase",vaultMeta:newMeta,locked:false});
      setRewrapMsg(meta&&!oldPass?"Vault rewrapped with a new passphrase. The previous vault contents were discarded under the acknowledgement.":"Vault rewrapped with a new passphrase. The payload round-tripped through the old passphrase.");
    }catch(e){setRewrapMsg("Vault rewrap failed: "+(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e)));}
    finally{setBusy(false);}
  }
  async function prepareBoundary(){
    setBusy(true);setMsg(null);
    try{
      const seal=getSealA();
      if(!seal)throw new Error("no current Seal A key");
      const a=await sealAObject(seal);
      const payload={previous_hull_id:identity?identity.hullId:null,previous_seal_a_fingerprint:a.fingerprint,record_count:records.length,last_checkpoint_anchor_digest:lastCp?(lastCp.merkleRoot??lastCp.rootAtSeal??null):null,intent:"full fresh instance"};
      const rec=await appendRecord("RESET-BOUNDARY","reset boundary",payload,false);
      const cp=await sealAll([...records,rec],{sealA:a,sealB:null,index:checkpoints.length+1,prevCheckpointRoot:lastCp?lastCp.merkleRoot??null:null,specVersion:"aegis44/2",appVersion:"44.2.0"},false);
      const digest=rec.hash;
      try{localStorage.setItem("aegis44.instance.boundary.v1",digest);}catch(e){}
      const blob=new Blob([JSON.stringify({payload,record:rec,checkpoint:cp},null,2)],{type:"application/json"});
      await prepareDelivery({key:"reset-boundary",name:"AEGIS-RESET-BOUNDARY.json",blob});
      setBoundary({digest,record:rec,checkpoint:cp});
      setMsg(`RESET-BOUNDARY record ${digest.slice(0,16)}… appended and sealed. The file is prepared below; use SHARE / SAVE to keep it off-device.`);
    }catch(e){setMsg("Reset boundary failed: "+(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e)));}
    finally{setBusy(false);}
  }
  async function fullReset(){
    if(!guard.enabled)return;
    setBusy(true);setMsg(null);
    try{
      const digest=boundary?boundary.digest:storedBoundary;
      if(!digest)throw new Error("no reset boundary digest");
      try{localStorage.setItem("aegis44.instance.boundary.v1",digest);}catch(e){}
      await clearAllStores();
      const keep=new Set(["aegis44.instance.boundary.v1","aegis44.identity.last.v1"]);
      for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith("aegis44.")&&!keep.has(k))localStorage.removeItem(k);}
      location.reload();
    }catch(e){setMsg("Full reset failed: "+(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e)));setBusy(false);}
  }
  return h("div",{className:"space-y-4"},
    h("header",{className:"space-y-2"},
      h(Label,{color:"var(--gold)"},"INSTANCE"),
      h("h1",{style:{margin:0,fontSize:"22px",lineHeight:1.15,color:"var(--chalk)",letterSpacing:"-.02em"}},"Instance identity and guarded reset"),
      h("p",{style:{margin:0,fontSize:"11px",lineHeight:1.6,color:"var(--smoke)"}},"This page shows what this browser origin holds and what each reset scope destroys. Publishing a rebuild of this site does not clear the ledger or the keys: they live in this browser's storage for this origin, so a rebuild normally requires no reset."),h("p",{style:{margin:0,fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},h("a",{href:"#/soul",className:"text-gold underline underline-offset-2",children:"Open the reset control on /soul"})),h("p",{style:{margin:0,fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},h("a",{href:"#/memory",className:"text-gold underline underline-offset-2",children:"Backup status is on /memory"}))
    ),
    lastReset?h(Panel,{style:{borderColor:"var(--phosphor)"}},
      h(Label,{color:"var(--phosphor)"},"RESET COMPLETE"),
      h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--chalk)",wordBreak:"break-all",overflowWrap:"anywhere"}},`New hull id: ${lastReset.new_hull_id||"—"}. Created at: ${lastReset.created_at||"—"}. Records: 1 (genesis). Boundary anchor digest: ${lastReset.boundary_anchor_digest||"—"}.`),
      h("p",{style:{margin:"4px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},"Any pack sealed under the previous instance still verifies against the key embedded in that pack.")
    ):null,
    h(Panel,null,
      h(Label,{color:"var(--gold)"},"INSTANCE IDENTITY"),
      h("div",{style:{marginTop:"8px",display:"grid",gap:"4px"}},
        row("Hull id",identity?identity.hullId:"—"),
        row("Seal A fingerprint",identity?identity.hullId:"—"),
        row("Seal B fingerprint",sealB?sealB.fingerprint:"none"),
        row("Instance created at",identity&&identity.createdAt?identity.createdAt:"—"),
        row("Ledger present",records.length>0?"true":"false"),
        row("Records",String(records.length)),
        row("Last chain hash",records.length?records[records.length-1].hash:"—"),
        row("Checkpoints",String(checkpoints.length)),
        row("Last checkpoint anchor digest",lastAnchor),
        row("Storage persisted",String(persisted))
      ),
      h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},"The hull id is the first 16 hex characters of SHA-256 over the Seal A SPKI public key. The fingerprint shown here is that same prefix.")
    ),
    h(Panel,null,
      h(Label,{color:"var(--gold)"},"ROTATE IDENTITY KEYS ONLY"),
      h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"Generates a new Seal A and, if one exists, a new Seal B. Appends a KEY-ROTATION record with the previous fingerprint and the new fingerprint, then seals a checkpoint with the new key. Earlier signatures are not invalidated: they verify against the previous public key, which is retained in the chain."),
      h("button",{type:"button",onClick:rotateKeys,disabled:busy,style:{...btn,marginTop:"8px"}},busy?"WORKING…":"ROTATE IDENTITY KEYS"),
      rotateMsg?h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--chalk)"}},rotateMsg):null
    ),
    h(Panel,null,
      h(Label,{color:"var(--gold)"},"REWRAP VAULT (PASSKEY RESET)"),
      h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"The vault passphrase is never stored. This re-derives a wrapping key from a new passphrase. If the vault holds data encrypted under the old passphrase and no export exists, the old contents are unrecoverable. Unwrap with the old passphrase to keep them, or tick the acknowledgement to discard them."),
      h("input",{type:"password",value:oldPass,onChange:e=>setOldPass(e.target.value),placeholder:"old passphrase (optional)",style:{...input,marginTop:"8px"}}),
      h("input",{type:"password",value:newPass,onChange:e=>setNewPass(e.target.value),placeholder:"new passphrase (at least 8 characters)",style:{...input,marginTop:"6px"}}),
      h("label",{style:{display:"flex",gap:"8px",alignItems:"flex-start",marginTop:"8px",fontSize:"10px",lineHeight:1.5,color:"var(--smoke)"}},
        h("input",{type:"checkbox",checked:rewrapAck,onChange:e=>setRewrapAck(e.target.checked),style:{marginTop:"2px"}}),
        h("span",null,"I acknowledge that without the old passphrase the old vault contents will be lost.")
      ),
      h("button",{type:"button",onClick:rewrapVault,disabled:busy,style:{...btn,marginTop:"8px"}},busy?"WORKING…":"REWRAP VAULT"),
      rewrapMsg?h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--chalk)"}},rewrapMsg):null
    ),
    h(Panel,{style:{borderColor:"var(--crimson)"}},
      h(Label,{color:"var(--crimson)"},"FULL FRESH INSTANCE"),
      h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"Destroys the chain, the Seal A and Seal B keys, the vault contents and any stored keeper wrapper. Mints a new hull id and new keys. The console becomes a fresh instance with record count 0. This is irrecoverable on this device."),
      h("p",{style:{margin:"6px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},"Before the wipe, a RESET-BOUNDARY record is appended and sealed into the outgoing chain. It records the previous hull id, the previous Seal A fingerprint, the record count, the last checkpoint anchor digest and the new-instance intent. The file is offered through the same PREPARE → SHARE / SAVE ladder."),
      h("label",{style:{display:"flex",gap:"8px",alignItems:"flex-start",marginTop:"8px",fontSize:"10px",lineHeight:1.5,color:"var(--smoke)"}},
        h("input",{type:"checkbox",checked:ack,onChange:e=>setAck(e.target.checked),style:{marginTop:"2px"}}),
        h("span",null,"I have sealed a final checkpoint and exported the pack, or I acknowledge that no export exists and the evidence will be lost.")
      ),
      h("input",{type:"text",value:typed,onChange:e=>setTyped(e.target.value),placeholder:"type the current hull id exactly",style:{...input,marginTop:"8px"}}),
      h("button",{type:"button",onClick:prepareBoundary,disabled:busy,style:{...btn,marginTop:"8px"}},busy?"WORKING…":"PREPARE RESET BOUNDARY"),
      boundary?h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--chalk)",wordBreak:"break-all",overflowWrap:"anywhere"}},`Boundary digest: ${boundary.digest}. Prepared file: AEGIS-RESET-BOUNDARY.json.`):null,
      h("label",{style:{display:"flex",gap:"8px",alignItems:"flex-start",marginTop:"8px",fontSize:"10px",lineHeight:1.5,color:"var(--smoke)"}},
        h("input",{type:"checkbox",checked:second,onChange:e=>setSecond(e.target.checked),style:{marginTop:"2px"}}),
        h("span",null,"I confirm this full fresh instance is irrecoverable on this device.")
      ),
      h("button",{type:"button",onClick:fullReset,disabled:!guard.enabled||busy,style:{...btnDanger,marginTop:"8px",opacity:guard.enabled?1:.5}},busy?"WORKING…":"CONFIRM FULL FRESH INSTANCE"),
      h("p",{className:"mono",style:{margin:"6px 0 0",fontSize:"9px",lineHeight:1.5,color:guard.enabled?"var(--phosphor)":"var(--amber)"}},`guard: ${guard.enabled?"enabled":"disabled"} — ${guard.reason}`),
      msg?h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--chalk)"}},msg):null,
      storedBoundary?h("p",{className:"mono",style:{margin:"8px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)",wordBreak:"break-all",overflowWrap:"anywhere"}},`Stored boundary digest: ${storedBoundary}`):null
    ),
    h(Panel,null,
      h(Label,{color:"var(--crimson)"},"HONEST SCOPE"),
      h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"A reset does not remove records already exported or already anchored off-device. It does not invalidate a third party's retained receipt. It does not prove anything about prior records being true. An old exported pack remains verifiable off-device after this reset, because /verify uses only the pack's own embedded keys and never local state.")
    )
  );
}
export function ResetPanel(){
  const state=useStore();
  const identity=state&&state.identity;
  const records=(state&&state.ledger&&state.ledger.records)||[];
  const checkpoints=(state&&state.ledger&&state.ledger.checkpoints)||[];
  const lastCp=checkpoints.length?checkpoints[checkpoints.length-1]:null;
  const [typed,setTyped]=React.useState("");
  const [boundaryAck,setBoundaryAck]=React.useState(false);
  const [second,setSecond]=React.useState(false);
  const [reason,setReason]=React.useState("deliberate fresh start");
  const [boundary,setBoundary]=React.useState(null);
  const [newSeal,setNewSeal]=React.useState(null);
  const [busy,setBusy]=React.useState(false);
  const [msg,setMsg]=React.useState(null);
  const guard=resetGuard({typedHullId:typed,currentHullId:identity?identity.hullId:null,acknowledged:boundaryAck,boundaryPrepared:!!boundary,secondConfirmed:second});
  async function prepareBoundary(){
    setBusy(true);setMsg(null);
    try{
      const oldSeal=getSealA();
      if(!oldSeal)throw new Error("no current Seal A key");
      const oldA=await sealAObject(oldSeal);
      const oldB=getSealB();
      const oldBObj=oldB?{privateKey:oldB.privateKey,publicKeyJwk:oldB.publicKeyJwk,fingerprint:oldB.fingerprint,spki:oldB.spki}:null;
      const fresh=await generateSealKeys();
      const payload={old_hull_id:identity?identity.hullId:null,old_seal_a_fingerprint:oldA.fingerprint,old_record_count:records.length,last_chain_hash:records.length?records[records.length-1].hash:null,last_checkpoint_anchor_digest:lastCp?(lastCp.merkleRoot??lastCp.rootAtSeal??null):null,new_hull_id:fresh.hullId,generated_at:new Date().toISOString(),reason};
      const rec=await appendRecord("RESET_BOUNDARY","reset boundary",payload,false);
      const cp=await sealAll([...records,rec],{sealA:oldA,sealB:oldBObj,index:checkpoints.length+1,prevCheckpointRoot:lastCp?lastCp.merkleRoot??null:null,specVersion:"aegis44/2",appVersion:"44.2.0"},false);
      const digest=rec.hash;
      try{localStorage.setItem("aegis44.instance.boundary.v1",digest);}catch(e){}
      const blob=new Blob([JSON.stringify({payload,record:rec,checkpoint:cp},null,2)],{type:"application/json"});
      await prepareDelivery({key:"reset-boundary",name:"AEGIS-RESET-BOUNDARY.json",blob});
      setBoundary({digest,record:rec,checkpoint:cp});
      setNewSeal(fresh);
      setMsg(`RESET_BOUNDARY ${digest.slice(0,16)}… appended and sealed by the old Seal A${oldBObj?" and Seal B":""}. The file is prepared below; use SHARE / SAVE, then tick the boundary acknowledgement.`);
    }catch(e){setMsg("Reset boundary failed: "+(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e)));}
    finally{setBusy(false);}
  }
  async function fullReset(){
    if(!guard.enabled)return;
    setBusy(true);setMsg(null);
    try{
      const digest=boundary?boundary.digest:null;
      if(!digest)throw new Error("no reset boundary digest");
      if(!newSeal)throw new Error("no new keypair prepared");
      const createdAt=new Date().toISOString();
      try{localStorage.setItem("aegis44.instance.last-reset.v1",JSON.stringify({new_hull_id:newSeal.hullId,created_at:createdAt,boundary_anchor_digest:digest}));}catch(e){}
      await clearAllStores();
      await idbPut("keys","seal",newSeal);
      const keep=new Set(["aegis44.instance.boundary.v1","aegis44.identity.last.v1","aegis44.instance.last-reset.v1"]);
      for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith("aegis44.")&&!keep.has(k))localStorage.removeItem(k);}
      location.reload();
    }catch(e){setMsg("Full reset failed: "+(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e)));setBusy(false);}
  }
  return h("section",{className:"panel p-3",style:{borderColor:"var(--crimson)"}},
    h(Label,{color:"var(--crimson)"},"RESET INSTANCE"),
    h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"This destroys the local chain and the Seal A private key. It does not destroy any pack or receipt already exported to disk, and it does not destroy Seal B's keeper file if that file was exported. A non-extractable Seal A private key cannot be backed up and cannot be recovered after the wipe."),
    h("p",{style:{margin:"6px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--smoke)"}},"Before anything is destroyed, a RESET_BOUNDARY record is appended to the outgoing chain and sealed by the old Seal A and, if present, Seal B. The record names the old hull id, the old Seal A fingerprint, the record count, the last chain hash, the last checkpoint anchor digest, the new hull id, the generated-at time and the reason. It is offered through the same PREPARE → SHARE / SAVE ladder."),
    h("label",{style:{display:"block",marginTop:"8px",fontSize:"10px",color:"var(--smoke)"}},"Reason"),
    h("select",{value:reason,onChange:e=>setReason(e.target.value),style:{...input,marginTop:"4px"}},
      h("option",{value:"cleared browser data"},"cleared browser data"),
      h("option",{value:"new device"},"new device"),
      h("option",{value:"deliberate fresh start"},"deliberate fresh start"),
      h("option",{value:"key suspected lost"},"key suspected lost")
    ),
    h("input",{type:"text",value:typed,onChange:e=>setTyped(e.target.value),placeholder:"type the current hull id exactly",style:{...input,marginTop:"8px"}}),
    h("button",{type:"button",onClick:prepareBoundary,disabled:busy,style:{...btn,marginTop:"8px"}},busy?"WORKING…":"PREPARE RESET BOUNDARY"),
    boundary?h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--chalk)",wordBreak:"break-all",overflowWrap:"anywhere"}},`Boundary digest: ${boundary.digest}. Prepared file: AEGIS-RESET-BOUNDARY.json.`):null,
    h("label",{style:{display:"flex",gap:"8px",alignItems:"flex-start",marginTop:"8px",fontSize:"10px",lineHeight:1.5,color:"var(--smoke)"}},
      h("input",{type:"checkbox",checked:boundaryAck,onChange:e=>setBoundaryAck(e.target.checked),style:{marginTop:"2px"}}),
      h("span",null,"I have saved the boundary record, or I chose not to save it.")
    ),
    h("label",{style:{display:"flex",gap:"8px",alignItems:"flex-start",marginTop:"6px",fontSize:"10px",lineHeight:1.5,color:"var(--smoke)"}},
      h("input",{type:"checkbox",checked:second,onChange:e=>setSecond(e.target.checked),style:{marginTop:"2px"}}),
      h("span",null,"I confirm this full fresh instance is irrecoverable on this device.")
    ),
    h("button",{type:"button",onClick:fullReset,disabled:!guard.enabled||busy,style:{...btnDanger,marginTop:"8px",opacity:guard.enabled?1:.5}},busy?"WORKING…":"CONFIRM FULL FRESH INSTANCE"),
    h("p",{className:"mono",style:{margin:"6px 0 0",fontSize:"9px",lineHeight:1.5,color:guard.enabled?"var(--phosphor)":"var(--amber)"}},`guard: ${guard.enabled?"enabled":"disabled"} — ${guard.reason}`),
    msg?h("p",{style:{margin:"8px 0 0",fontSize:"10px",lineHeight:1.6,color:"var(--chalk)"}},msg):null
  );
}
