import { r as React, sha256Hex, canonicalJson, buildRecord, verifyChain, merkleRootFromLeaves, generateSealKeys, signBytesB64, verifyBytesB64, deriveVaultKey, encryptJson, decryptJson, PBKDF2_ITERATIONS, sealAll, buildReceipt, verifyArtifact, anchorDigest, signBytesUrl, verifyBytesUrl, bytesToHex, bytesToB64, b64ToBytes, randomBytes, utf8, idbGet, getOutboundAudit } from "./index-CL6IUdNY.js";
import { prepareDelivery, deliverPending, deliveryCapabilities, clearPending } from "./download-GqGer48n.js";
import { computeRank, distinctCheckpointDays, scanForbidden } from "./rank-9f3c2a.js";
import { GUIDE_TEXT } from "./guide-content-9f3c2a.js";
import { resetGuard, detectIdentityChange, persistProbe, muCoverageLabel, differentInstanceNotice } from "./instance-9f3c2a.js";
import { measureBackup, computeUnbacked } from "./backup-9f3c2a.js";
import { scanRecovery, RECOVERY_TEXT } from "./recovery-9f3c2a.js";
import { requestDeviceOptions, makeIdentity, identityLabel, resolveIdentity, makeObservation } from "./ble-9f3c2a.js";
import { derToRaw, rawToDer, importSpkiVerifyKey, verifyRaw } from "./ecdsa-interop.js";
import { AegisKeystoreWeb } from "./aegis-keystore-web.js";
const h=React.createElement;
const ZERO="0".repeat(64);
const VECTOR="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const LIMIT="A pass here proves these code paths ran and returned these values in this browser at this moment. It does not prove the device is uncompromised, does not prove the ledger will be accepted as evidence, does not prove anything about whether the device is being observed, and a browser self-test cannot attest to the browser's own integrity.";
let runStartIndex=0;
function sourceOf(c){try{const u=new URL(c.url,location.href);if(u.pathname==="/__va"||u.pathname.startsWith("/cdn-cgi/rum"))return "host-injected";if(u.origin!==location.origin)return "host-injected";return "app-originated";}catch(e){return "unattributed";}}
async function makeChain(){
  const recs=[];let prev=ZERO;
  for(let i=1;i<=4;i++){
    const r=await buildRecord(prev,i,"SELFTEST",`synthetic record ${i}`,{i,note:"synthetic",run:"selftest"},true);
    recs.push(r);prev=r.hash;
  }
  return recs;
}
async function makeSeal(){
  const s=await generateSealKeys();
  const spki=new Uint8Array(await crypto.subtle.exportKey("spki",s.publicKey));
  const jwk=await crypto.subtle.exportKey("jwk",s.publicKey);
  const fingerprint=(await sha256Hex(spki)).slice(0,16);
  return {privateKey:s.privateKey,publicKey:s.publicKey,publicKeyJwk:jwk,fingerprint,spki:s.spki};
}
async function c1(){
  const secure=!!window.isSecureContext;
  const subtle=!!(window.crypto&&window.crypto.subtle);
  const sw=navigator.serviceWorker&&navigator.serviceWorker.controller?"present":"absent";
  return {status:secure&&subtle?"pass":"fail",value:`isSecureContext=${secure}\ncrypto.subtle=${subtle}\norigin=${location.origin}\nserviceWorker.controller=${sw}`};
}
async function c2(){
  const hex=await sha256Hex("abc");
  return {status:hex===VECTOR?"pass":"fail",value:`sha256("abc")=${hex}\nexpected=${VECTOR}\nmatch=${hex===VECTOR}`};
}
async function c3(){
  const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const pt=utf8("AEGIS 44 synthetic plaintext 0123456789");
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,pt));
  const back=new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv},key,ct));
  const exact=bytesToHex(back)===bytesToHex(pt);
  const differs=bytesToHex(ct)!==bytesToHex(pt);
  const wrong=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
  let rejected=false;
  try{await crypto.subtle.decrypt({name:"AES-GCM",iv},wrong,ct);}catch(e){rejected=true;}
  return {status:exact&&differs&&rejected?"pass":"fail",value:`ciphertext=${ct.length} bytes\niv=${iv.length} bytes\nciphertext≠plaintext=${differs}\nroundtrip=${exact?"exact":"MISMATCH"}\nwrongKey=${rejected?"correctly rejected":"ACCEPTED (FAIL)"}`};
}
async function c4(){
  const a=randomBytes(16),b=randomBytes(16);
  const k1=await deriveVaultKey("aegis-selftest-passphrase",a);
  const k2=await deriveVaultKey("aegis-selftest-passphrase",a);
  const k3=await deriveVaultKey("aegis-selftest-passphrase",b);
  const iv=new Uint8Array(12),pt=utf8("pbkdf2-probe");
  const e1=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k1,pt));
  const e2=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k2,pt));
  const e3=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k3,pt));
  const same=bytesToHex(e1)===bytesToHex(e2);
  const diff=bytesToHex(e1)!==bytesToHex(e3);
  return {status:same&&diff?"pass":"fail",value:`iterations=${PBKDF2_ITERATIONS}\nderived=256 bits\nsameSalt=${same?"identical":"DIFFERENT (FAIL)"}\ndifferentSalt=${diff?"different":"IDENTICAL (FAIL)"}`};
}
async function c5(){
  const s=await generateSealKeys();
  const msg=utf8("aegis44-selftest-ecdsa");
  const sig=await signBytesB64(s.privateKey,msg);
  const ok=await verifyBytesB64(s.publicKey,sig,msg);
  const bad=await verifyBytesB64(s.publicKey,sig,utf8("aegis-selftest-ecdsa"));
  return {status:s.privateKey.extractable===false&&ok&&!bad?"pass":"fail",value:`privateKey.extractable=${s.privateKey.extractable}\nsignature=${sig.slice(0,24)}… (${sig.length} chars)\nverify=${ok}\ntamperedMessageVerify=${bad}`};
}
async function c6(){
  const recs=await makeChain();
  let links=0,p=ZERO;
  for(const r of recs){
    const ph=await sha256Hex(canonicalJson(r.payload));
    const hh=await sha256Hex(canonicalJson({seq:r.seq,ts:r.ts,type:r.type,payloadHash:r.payloadHash,prevHash:r.prevHash}));
    if(r.prevHash===p&&r.payloadHash===ph&&r.hash===hh)links++;
    p=r.hash;
  }
  return {status:links===4?"pass":"fail",value:`records=${recs.length}\nlinks matched=${links}/${recs.length}\nfirstHash=${recs[0].hash.slice(0,16)}…\nlastHash=${recs[3].hash.slice(0,16)}…`};
}
async function c7(){
  const recs=await makeChain();
  const leaves=recs.map(r=>r.hash);
  const root=await merkleRootFromLeaves(leaves);
  let level=leaves.slice();
  while(level.length>1){
    const next=[];
    for(let i=0;i<level.length;i+=2)next.push(i+1<level.length?await sha256Hex(level[i]+level[i+1]):level[i]);
    level=next;
  }
  const ind=level[0]||ZERO;
  return {status:root===ind?"pass":"fail",value:`root=${root.slice(0,16)}…\nindependent=${ind.slice(0,16)}…\nmatch=${root===ind}`};
}
async function c8(){
  const recs=await makeChain();
  const t=recs.map(r=>({...r,payload:{...r.payload}}));
  t[1].payload.note="tampered";
  const v=await verifyChain(t);
  return {status:!v.ok&&v.brokenAt===1?"pass":"fail",value:`verifier=${v.ok?"PASS (FAIL)":"FAIL"}\naccused=record ${v.brokenAt+1} (index ${v.brokenAt})\nreason=${v.reason}\nexpected=${String(v.expected).slice(0,24)}…\nfound=${String(v.found).slice(0,24)}…\nrestored=true (mutation applied to a clone)`};
}
async function c9(){
  const s=await makeSeal();
  const root=await sha256Hex("aegis44-selftest-checkpoint");
  const sig=await signBytesUrl(s.privateKey,utf8(root));
  const okA=await verifyBytesUrl(s.publicKey,sig,utf8(root));
  let b=null;
  try{b=await idbGet("keys","sealB");}catch(e){}
  if(!b||!b.privateKey)return {status:okA?"skip":"fail",value:`sealA=${okA?"verified":"FAILED"}\nsealB=NOT MEASURED\nreason=no off-device attestation key on this device`};
  const sigB=await signBytesUrl(b.privateKey,utf8(root));
  const okB=await verifyBytesUrl(b.publicKey,sigB,utf8(root));
  return {status:okA&&okB?"pass":"fail",value:`sealA=${okA?"verified":"FAILED"}\nsealB=${okB?"verified":"FAILED"}\nsealB.fingerprint=${b.fingerprint||"—"}`};
}
async function c10(){
  const recs=await makeChain();
  const s=await makeSeal();
  const cp=await sealAll(recs,{sealA:s,sealB:null,index:1,prevCheckpointRoot:null,specVersion:"aegis44/2",appVersion:"44.2.0"},true);
  const receipt=await buildReceipt(cp,recs);
  const self=await verifyArtifact(cp,cp.sealA,"short");
  const wrong=await verifyArtifact({...cp,merkleRoot:ZERO,rootAtSeal:ZERO},cp.sealA,"short");
  const anchorOk=receipt.anchor===await anchorDigest(receipt,["anchor"]);
  return {status:self.ok&&!wrong.ok&&anchorOk?"pass":"fail",value:`receipt.anchor=${receipt.anchor.slice(0,24)}…\nselfVerify=${self.ok}\nwrongDigest=${wrong.ok?"ACCEPTED (FAIL)":"rejected"}\nanchorRecompute=${anchorOk}`};
}
async function c11(){
  const salt=randomBytes(16);
  const key=await deriveVaultKey("correct horse battery staple",salt);
  const payload={synthetic:true,n:42,note:"selftest vault payload"};
  const enc=await encryptJson(key,payload);
  const dec=await decryptJson(key,enc);
  const exact=canonicalJson(dec)===canonicalJson(payload);
  const wrong=await deriveVaultKey("wrong passphrase",salt);
  let rejected=false;
  try{await decryptJson(wrong,enc);}catch(e){rejected=true;}
  return {status:exact&&rejected?"pass":"fail",value:`iterations=${PBKDF2_ITERATIONS}\nciphertext=${enc.ciphertext.length} b64 chars\niv=${enc.iv.length} b64 chars\nroundtrip=${exact?"exact":"MISMATCH"}\nwrongPassphrase=${rejected?"rejected":"ACCEPTED (FAIL)"}`};
}
async function c12(){
  const calls=getOutboundAudit().calls.slice(runStartIndex);
  const origins=[...new Set(calls.map(c=>{try{return new URL(c.url,location.href).origin;}catch(e){return c.url;}}))];
  const lines=calls.map(c=>`${c.kind} ${c.url} — ${sourceOf(c)}`);
  const app=calls.filter(c=>sourceOf(c)==="app-originated").length;
  const host=calls.filter(c=>sourceOf(c)==="host-injected").length;
  const unattr=calls.filter(c=>sourceOf(c)==="unattributed").length;
  return {status:app===0?"pass":"fail",value:`network calls during run=${calls.length}\napp-originated=${app}\nhost-injected=${host}${unattr?`\nunattributed=${unattr}`:""}\norigins: ${origins.length?origins.join(", "):"none"}\n${lines.length?lines.join("\n"):"origins contacted=none"}\nThis counts requests observed in this session, nothing about the device.`};
}
async function c13(){
  const c=deliveryCapabilities();
  const blob=new Blob(["AEGIS 44 self-test delivery probe — synthetic, not evidence."],{type:"text/plain"});
  const p=await prepareDelivery({key:"selftest-probe",name:"aegis44-selftest-probe.txt",blob,probe:true},{probe:true});
  const o=await deliverPending(p);
  clearPending();
  return {status:o.ok?"pass":"fail",value:`prepared=${p.name} (${p.bytes} bytes, sha256 ${p.sha256.slice(0,16)}…)\ncanShare({files})=${c.canShareFiles}\nrung that fired=${o.rung}\ndownload attr=${c.download}\nprobe file — save attempt, not evidence`};
}
async function c22(){
  let can=false,err=null;
  try{
    const f=new File(["aegis44-share-probe"],"probe.json",{type:"application/json"});
    can=!!(navigator.canShare&&navigator.canShare({files:[f]}));
  }catch(e){err=(e&&e.name?e.name+": ":"")+(e&&e.message?e.message:String(e));}
  return {status:"info",value:`navigator.canShare({files})=${can}\n${can?"the platform offers a share sheet; true says nothing about whether it will accept the file":"the platform offers no share sheet; the ladder will use a save rung"}${err?"\nerror="+err:""}`};
}
async function c14(){
  let persisted=null,usage=null,quota=null,ledger="unreadable";
  try{persisted=await navigator.storage.persisted();}catch(e){persisted="error: "+e.message;}
  try{const est=await navigator.storage.estimate();usage=est.usage;quota=est.quota;}catch(e){}
  try{const v=await idbGet("state","ledger");ledger=v?"readable (record present)":"readable (no record)";}catch(e){ledger="unreadable: "+e.message;}
  const mb=n=>n==null?"—":(n/1048576).toFixed(2)+" MB";
  const quotaNote=quota!=null&&quota<52428800?"quota is small (<50 MB) — the OS can evict it":"quota is not small; eviction risk is governed by persistence, not size";
  return {status:"info",value:`navigator.storage.persisted()=${persisted}\nusage=${mb(usage)}\nquota=${mb(quota)}\nledger store=${ledger}\n${persisted===true?"persisted=true — eviction protection granted":"persisted=false — the OS may evict this origin's storage under pressure"}\n${quotaNote}`};
}
async function c15(){
  const n=navigator;
  const bt=!!(n.bluetooth&&n.bluetooth.requestDevice);
  const motion="DeviceMotionEvent" in window;
  const mag="Magnetometer" in window;
  const conn=!!n.connection;
  return {status:"info",value:`Web Bluetooth=${bt?"AVAILABLE":"UNAVAILABLE"} — ${bt?"requestDevice exposed":"this browser does not expose Web Bluetooth (iOS/Safari commonly does not)"}\nDeviceMotionEvent=${motion?"AVAILABLE":"UNAVAILABLE"} — ${motion?"motion events exposed":"this browser does not expose DeviceMotionEvent"}\nMagnetometer=${mag?"AVAILABLE":"UNAVAILABLE"} — ${mag?"Generic Sensor API exposed":"this browser does not expose the Magnetometer sensor API"}\nnavigator.connection=${conn?"AVAILABLE":"UNAVAILABLE"} — ${conn?"Network Information API exposed":"this browser does not expose navigator.connection"}\nBLE scanning path=${bt?"requestDevice (user-gesture)":"none — Web Bluetooth unavailable, no requestDevice path"}\nplatform=${n.platform||"—"} — reported by navigator.platform`};
}
async function c16(){
  let manifest="not in cache";
  try{const m=await caches.match(new URL("manifest.json",location.href).href);manifest=m?"cached":"not in cache";}catch(e){manifest="cache API unavailable: "+e.message;}
  const sw=navigator.serviceWorker?(navigator.serviceWorker.controller?"active (controlling)":"registered, not controlling"):"unavailable";
  const standalone=!!((window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true);
  return {status:"info",value:`manifest=${manifest}\nservice worker=${sw}\ndisplay-mode standalone=${standalone}\nnavigator.onLine=${navigator.onLine} (${navigator.onLine?"network on":"network off"})`};
}
async function c17(){
  const kp=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const spki=new Uint8Array(await crypto.subtle.exportKey("spki",kp.publicKey));
  const pkcs8=new Uint8Array(await crypto.subtle.exportKey("pkcs8",kp.privateKey));
  const pub=await crypto.subtle.importKey("spki",spki,{name:"ECDSA",namedCurve:"P-256"},true,["verify"]);
  const priv=await crypto.subtle.importKey("pkcs8",pkcs8,{name:"ECDSA",namedCurve:"P-256"},true,["sign"]);
  const msg=utf8("aegis44-der-roundtrip");
  const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},priv,msg);
  const ok=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},pub,sig,msg);
  return {status:ok?"pass":"fail",value:`SPKI=${spki.length} bytes\nPKCS#8=${pkcs8.length} bytes\nimport+sign+verify=${ok}`};
}
async function c18(){
  const ikm=crypto.getRandomValues(new Uint8Array(32));
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const info=utf8("aegis44-hkdf-selftest");
  const base=await crypto.subtle.importKey("raw",ikm,"HKDF",false,["deriveBits"]);
  const a=new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info},base,256));
  const b=new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info},base,256));
  const c=new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info:utf8("different")},base,256));
  const same=bytesToHex(a)===bytesToHex(b);
  const diff=bytesToHex(a)!==bytesToHex(c);
  return {status:same&&diff?"pass":"fail",value:`derived=256 bits\nsameInputs=${same?"identical":"DIFFERENT (FAIL)"}\ndifferentInfo=${diff?"different":"IDENTICAL (FAIL)"}\nfirst16=${bytesToHex(a).slice(0,16)}…`};
}
async function c19(){
  const a=typeof crypto.randomUUID==="function"?crypto.randomUUID():null;
  const b=typeof crypto.randomUUID==="function"?crypto.randomUUID():null;
  const valid=a?/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(a):false;
  return {status:a&&b&&a!==b&&valid?"pass":"fail",value:`uuid1=${a||"unavailable"}\nuuid2=${b||"unavailable"}\ndistinct=${a!==b}\nv4 format=${valid}`};
}
async function c20(){
  const bytes=utf8("AEGIS 44 helpers");
  const hex=bytesToHex(bytes);
  const b64=bytesToB64(bytes);
  const back=b64ToBytes(b64);
  const round=bytesToHex(back)===hex;
  const hexOk=/^[0-9a-f]+$/.test(hex)&&hex.length===bytes.length*2;
  return {status:round&&hexOk?"pass":"fail",value:`input=${bytes.length} bytes\nhex=${hex.slice(0,24)}… (${hex.length} chars)\nb64=${b64.slice(0,24)}… (${b64.length} chars)\nroundtrip=${round}`};
}
async function c21(){
  if(!navigator.serviceWorker)return {status:"fail",value:"navigator.serviceWorker unavailable"};
  let reg=null,err=null;
  try{reg=await navigator.serviceWorker.getRegistration();}catch(e){err=e.message;}
  const active=!!(reg&&reg.active);
  const controlled=!!navigator.serviceWorker.controller;
  return {status:active?"pass":"fail",value:`registration=${reg?"present":"absent"}\nactive=${active}\ncontroller=${controlled}\nscope=${reg&&reg.scope?reg.scope:"—"}${err?"\nerror="+err:""}`};
}
async function c23(){
  const d=await computeRank({ledger:{records:[],checkpoints:[]},identity:null,sealB:null});
  return {status:d.rank==="UNRECORDED"&&d.gatesMet===0&&d.lightsMeasured===0?"pass":"fail",value:`rank=${d.rank}\ngates met=${d.gatesMet} of 5\nlights measured=${d.lightsMeasured} of 6\nbasis=${d.basis}`};
}
async function c24(){
  const recs=await makeChain();
  const anchor=await buildRecord(recs[recs.length-1].hash,5,"ANCHOR","anchor",{channel:"email"},true);
  recs.push(anchor);
  const cp={id:"cp-1",firstSeq:1,lastSeq:5,sealedAt:new Date().toISOString(),merkleRoot:ZERO};
  const d=await computeRank({ledger:{records:recs,checkpoints:[cp]},identity:{hullId:"synthetic",extractable:false},sealB:null});
  return {status:d.rank==="DOCUMENTED"&&d.capReason&&d.capReason.includes("keeper file")?"pass":"fail",value:`rank=${d.rank}\ngates met=${d.gatesMet} of 5\ncap=${d.capReason||"none"}\nbasis=${d.basis}`};
}
async function c25(){
  const ts="2026-01-01T00:00:00.000Z";
  const days=distinctCheckpointDays([{sealedAt:ts},{sealedAt:ts}]);
  return {status:days===1?"pass":"fail",value:`checkpoints=2\nsame timestamp=${ts}\ndistinct days=${days}\nexpected=1`};
}
async function c26(){
  const r=scanForbidden(GUIDE_TEXT);
  return {status:r.count===0?"pass":"fail",value:`forbidden matches=${r.count}\n${r.matches.length?r.matches.join("\n"):"no forbidden verdict vocabulary in the guide copy"}`};
}
async function c27(){
  const a=resetGuard({typedHullId:"abc",currentHullId:"abc",acknowledged:true,boundaryPrepared:true,secondConfirmed:true});
  const b=resetGuard({typedHullId:"abd",currentHullId:"abc",acknowledged:true,boundaryPrepared:true,secondConfirmed:true});
  const c=resetGuard({typedHullId:"abc",currentHullId:"abc",acknowledged:false,boundaryPrepared:true,secondConfirmed:true});
  return {status:a.enabled&&!b.enabled&&!c.enabled?"pass":"fail",value:`match+ack+second=${a.enabled}\nmismatch=${b.enabled} (${b.reason})\nunacknowledged=${c.enabled} (${c.reason})`};
}
async function c28(){
  const d=detectIdentityChange({hullId:"old",fingerprint:"oldfp"},{hullId:"new",fingerprint:"newfp"});
  return {status:d.changed&&d.prior_hull_id==="old"&&d.new_hull_id==="new"?"pass":"fail",value:`changed=${d.changed}\nprior=${d.prior_hull_id}\ncurrent=${d.new_hull_id}\nreason=${d.reason}`};
}
async function c29(){
  const recs=await makeChain();
  const seal=await makeSeal();
  const payload={previous_hull_id:"old",previous_seal_a_fingerprint:"oldfp",record_count:4,last_checkpoint_anchor_digest:"anchor",intent:"full fresh instance"};
  const rec=await buildRecord(recs[recs.length-1].hash,5,"RESET-BOUNDARY","reset boundary",payload,true);
  recs.push(rec);
  const cp=await sealAll(recs,{sealA:seal,sealB:null,index:1,prevCheckpointRoot:null,specVersion:"aegis44/2",appVersion:"44.2.0"},true);
  const v=await verifyArtifact(cp,cp.sealA,"short");
  const digest=await sha256Hex(canonicalJson(payload));
  const recomputed=await sha256Hex(canonicalJson(payload));
  return {status:v.ok&&digest===recomputed?"pass":"fail",value:`record=${rec.hash.slice(0,16)}…\ncheckpoint=${cp.id}\nsealVerify=${v.ok}\ndigest=${digest.slice(0,16)}…\nrecomputed=${recomputed.slice(0,16)}…`};
}
async function c30(){
  const r=await persistProbe();
  return {status:r.outcome!=="error"?"pass":"fail",value:`outcome=${r.outcome}\npersisted=${r.persisted}\n${r.error?"error="+r.error:""}`};
}
async function c31(){
  const line=muCoverageLabel({mu_basis:{n_of_6:5,weight_contributing:0.62}});
  const ok=line.includes("PARTIAL (5/6")&&line.includes("62% weight");
  return {status:ok?"pass":"fail",value:line};
}
async function c32(){
  const el=document.getElementById("aegis-delivery-status");
  if(!el)return {status:"fail",value:"no delivery status element present after the probe"};
  const pos=getComputedStyle(el).position;
  const role=el.getAttribute("role");
  const live=el.getAttribute("aria-live");
  const inPanel=!!(el.closest(".panel")||el.closest("main"));
  await new Promise(r=>setTimeout(r,1200));
  const still=!!document.getElementById("aegis-delivery-status");
  return {status:pos==="static"&&role==="status"&&live==="polite"&&inPanel&&still?"pass":"fail",value:`position=${pos}\nrole=${role}\naria-live=${live}\ninside .panel or main=${inPanel}\nstill present after 1.2s=${still}`};
}
async function c33(){
  const recs=await makeChain();
  const boundaryPayload={old_hull_id:"old",new_hull_id:"new",old_record_count:4,last_chain_hash:recs[recs.length-1].hash,last_checkpoint_anchor_digest:"anchor",generated_at:new Date().toISOString(),reason:"deliberate fresh start"};
  const boundary=await buildRecord(recs[recs.length-1].hash,5,"RESET_BOUNDARY","reset boundary",boundaryPayload,true);
  const genesis=await buildRecord(boundary.hash,1,"GENESIS","hull genesis",{hullId:"new",boundary_anchor_digest:boundary.hash},true);
  const ok=genesis.payload.boundary_anchor_digest===boundary.hash&&genesis.prevHash===boundary.hash;
  return {status:ok?"pass":"fail",value:`boundary=${boundary.hash.slice(0,16)}…\ngenesis.prevHash=${genesis.prevHash.slice(0,16)}…\ngenesis.boundary_anchor_digest=${String(genesis.payload.boundary_anchor_digest).slice(0,16)}…\nmatch=${ok}`};
}
async function c34(){
  const msg=differentInstanceNotice("deadbeefdeadbeef","cafebabecafebabe");
  const same=differentInstanceNotice("deadbeefdeadbeef","deadbeefdeadbeef");
  const ok=!!msg&&msg.includes("different instance")&&msg.includes("deadbeef")&&msg.includes("cafebabe")&&same===null;
  return {status:ok?"pass":"fail",value:`different=${msg||"null"}\nsame=${same===null?"null":"NOT NULL"}`};
}
async function c35(){
  const flags={keeper:{at:"2026-01-01T00:00:00.000Z"},pubkey:{at:"2026-01-02T00:00:00.000Z"},pack:{at:"2026-01-03T00:00:00.000Z",recordCount:4,latestSeq:4},receipt:{at:"2026-01-04T00:00:00.000Z",checkpointIndex:1},persist:{at:"2026-01-05T00:00:00.000Z",requested:true,persisted:true,usage:1000,quota:100000}};
  const d=measureBackup({ledger:{records:[]}},flags);
  const ok=d.rows.length>0&&d.rows.every(r=>["MEASURED","NOT DONE","NOT POSSIBLE"].includes(r.state)&&r.value&&r.value.length>0);
  return {status:ok?"pass":"fail",value:d.rows.map(r=>`${r.key}=${r.state} · ${r.value}`).join("\n")};
}
async function c36(){
  const records=[{seq:1,ts:"2026-01-01T00:00:00.000Z"},{seq:2,ts:"2026-01-02T00:00:00.000Z"},{seq:3,ts:"2026-01-03T00:00:00.000Z"}];
  const u=computeUnbacked(records,{latestSeq:1});
  const ok=u.count===2&&u.oldestTs==="2026-01-02T00:00:00.000Z";
  return {status:ok?"pass":"fail",value:`count=${u.count}\noldest=${u.oldestTs}\nexpected count=2 · oldest=2026-01-02T00:00:00.000Z`};
}
async function c37(){
  const r=scanRecovery(RECOVERY_TEXT);
  return {status:r.count===0?"pass":"fail",value:`forbidden matches=${r.count}\n${r.matches.length?r.matches.join("\n"):"no recovery promise vocabulary in the recovery copy"}`};
}
async function c38(){
  const cases=[
    {device:{name:"Tracker A",id:"opaque-1"},resolved:{deviceName:"GAP Name"},expect:"advertised"},
    {device:{name:null,id:"opaque-2"},resolved:{deviceName:"GAP Name"},expect:"gap-0x2A00"},
    {device:{name:null,id:"opaque-3"},resolved:{deviceName:null},expect:"none"}
  ];
  const rows=cases.map(c=>{
    const id=makeIdentity({device:c.device,resolved:c.resolved,discoveryMode:"all"});
    return {source:id.nameSource,label:identityLabel(id),expect:c.expect,ok:id.nameSource===c.expect};
  });
  const unnamed=rows[2].label==="UNNAMED DEVICE";
  const ok=rows.every(r=>r.ok)&&rows[0].label==="Tracker A"&&rows[1].label==="GAP Name"&&unnamed;
  return {status:ok?"pass":"fail",value:rows.map(r=>`${r.expect} → ${r.source} · label=${r.label}`).join("\n")+`\nUNNAMED literal=${unnamed}`};
}
async function c39(){
  const notFound=()=>{const e=new Error("not found");e.name="NotFoundError";throw e;};
  const ga={getCharacteristic:async(uuid)=>{
    if(uuid==="device_name")notFound();
    if(uuid==="appearance")return {readValue:async()=>new DataView(new ArrayBuffer(2))};
    return {readValue:async()=>new TextEncoder().encode("GAP Name")};
  }};
  const di={getCharacteristic:async(uuid)=>{
    if(uuid==="manufacturer_name_string")return {readValue:async()=>new TextEncoder().encode("Vendor X")};
    if(uuid==="model_number_string")return {readValue:async()=>new TextEncoder().encode("M1")};
    if(uuid==="firmware_revision_string")notFound();
    return {readValue:async()=>new TextEncoder().encode("")};
  }};
  const device={gatt:{connect:async()=>({getPrimaryService:async(name)=>name==="generic_access"?ga:di})}};
  const r=await resolveIdentity(device,"all");
  const ok=r.deviceName===null&&r.errors.device_name==="NotFoundError"&&r.manufacturer==="Vendor X"&&r.model==="M1"&&r.errors.firmware==="NotFoundError";
  return {status:ok?"pass":"fail",value:`deviceName=${r.deviceName}\nerrors.device_name=${r.errors.device_name}\nmanufacturer=${r.manufacturer}\nmodel=${r.model}\nerrors.firmware=${r.errors.firmware}`};
}
async function c40(){
  const fixtures=[
    {device:{name:"A",id:"id-1"},resolved:{deviceName:"G"}},
    {device:{name:null,id:"opaque-2"},resolved:{deviceName:null}},
    {device:{name:null,id:null},resolved:null}
  ];
  const ids=fixtures.map(f=>makeIdentity({device:f.device,resolved:f.resolved,discoveryMode:"all"}));
  const allowed=["advertised","gap-0x2A00","none"];
  const macOk=ids.every(i=>i.macAddress==="not-exposed");
  const sourceOk=ids.every(i=>allowed.includes(i.nameSource));
  const obs=makeObservation(ids[1],[]);
  const obsMac=obs.macAddress==="not-exposed";
  const ok=macOk&&sourceOk&&obsMac;
  return {status:ok?"pass":"fail",value:`macAddress values=${[...new Set(ids.map(i=>i.macAddress))].join(",")}\nnameSource values=${ids.map(i=>i.nameSource).join(",")}\nobservation macAddress=${obs.macAddress}`};
}
async function c41(){
  const all=requestDeviceOptions("all","");
  const named=requestDeviceOptions("named","AEGIS");
  const allOk=all.acceptAllDevices===true&&!all.filters;
  const namedOk=Array.isArray(named.filters)&&named.filters[0]?.namePrefix==="AEGIS"&&!named.acceptAllDevices;
  const servicesOk=Array.isArray(all.optionalServices)&&all.optionalServices.includes("generic_access")&&all.optionalServices.includes("device_information");
  const fallback=requestDeviceOptions("unknown","");
  const noSilent=fallback.acceptAllDevices===true;
  const ok=allOk&&namedOk&&servicesOk&&noSilent;
  return {status:ok?"pass":"fail",value:`all.acceptAllDevices=${all.acceptAllDevices}\nall.filters=${all.filters?"present":"absent"}\nnamed.filters=${JSON.stringify(named.filters)}\nnamed.acceptAllDevices=${named.acceptAllDevices}\noptionalServices=${all.optionalServices.join(",")}\nunknown mode falls back to acceptAllDevices=${fallback.acceptAllDevices}`};
}
const DER_VECTOR_HEX="30440220"+"0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"+"0220"+"2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40";
const RAW_VECTOR_HEX="0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"+"2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40";
function hexToBytes(hex){const out=new Uint8Array(hex.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16);return out;}
function bytesEqual(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
async function c42(){
  try{
    const der=hexToBytes(DER_VECTOR_HEX);
    const raw=derToRaw(der);
    const expected=hexToBytes(RAW_VECTOR_HEX);
    const ok=bytesEqual(raw,expected);
    return {status:ok?"pass":"fail",value:`derToRaw length=${raw.length}\nexpected length=${expected.length}\nfirst=${bytesToHex(raw.slice(0,8))}\nexpected=${bytesToHex(expected.slice(0,8))}`};
  }catch(error){return {status:"fail",value:`derToRaw threw ${error.name||"Error"}: ${error.message||error}`};}
}
async function c43(){
  try{
    const der=hexToBytes(DER_VECTOR_HEX);
    const round=rawToDer(derToRaw(der));
    const ok=bytesEqual(round,der);
    return {status:ok?"pass":"fail",value:`rawToDer(derToRaw(x)) length=${round.length}\noriginal length=${der.length}\nround-trip=${ok}`};
  }catch(error){return {status:"fail",value:`round trip threw ${error.name||"Error"}: ${error.message||error}`};}
}
async function c44(){
  const cases=[];
  try{derToRaw(new Uint8Array([0x30]));cases.push("truncated:no-error");}catch(e){cases.push(`truncated:${e.code||e.name}`);}
  try{const d=hexToBytes(DER_VECTOR_HEX);d[0]=0x31;derToRaw(d);cases.push("wrong-tag:no-error");}catch(e){cases.push(`wrong-tag:${e.code||e.name}`);}
  try{derToRaw(hexToBytes("30450221"+"01".repeat(33)+"0220"+"21".repeat(32)));cases.push("too-long:no-error");}catch(e){cases.push(`too-long:${e.code||e.name}`);}
  const ok=cases[0]==="truncated:TRUNCATED"&&cases[1]==="wrong-tag:WRONG_TAG"&&cases[2]==="too-long:INTEGER_TOO_LONG";
  return {status:ok?"pass":"fail",value:cases.join("\n")};
}
async function c45(){
  try{
    const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
    const spki=new Uint8Array(await crypto.subtle.exportKey("spki",pair.publicKey));
    const key=await importSpkiVerifyKey(spki);
    const data=new TextEncoder().encode("aegis-ecdsa-interop-self-test");
    const raw=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,data));
    const ok=await verifyRaw(key,data,raw);
    const tampered=new Uint8Array(raw);tampered[0]^=0xff;
    const bad=await verifyRaw(key,data,tampered);
    return {status:ok&&!bad?"pass":"fail",value:`raw length=${raw.length}\nverifyRaw=${ok}\ntampered=${bad}`};
  }catch(error){return {status:"fail",value:`verifyRaw threw ${error.name||"Error"}: ${error.message||error}`};}
}
async function c46(){
  try{
    const stub=new AegisKeystoreWeb();
    const results=[await stub.isAvailable(),await stub.generateKey({alias:"x"}),await stub.getPublicKeySpki({alias:"x"}),await stub.sign({alias:"x",dataBase64:"AA=="}),await stub.getKeyInfo({alias:"x"}),await stub.deleteKey({alias:"x"})];
    const ok=results.every(r=>r.available===false&&r.reason==="NOT_A_NATIVE_BUILD")&&!results[3].signatureBase64;
    return {status:ok?"pass":"fail",value:results.map(r=>`available=${r.available} reason=${r.reason}`).join("\n")};
  }catch(error){return {status:"fail",value:`web stub threw ${error.name||"Error"}: ${error.message||error}`};}
}
const CHECKS=[
  {n:1,title:"Runtime & secure context",desc:"Reads isSecureContext, SubtleCrypto, origin and the service-worker controller.",run:c1},
  {n:2,title:"SHA-256 known-answer test",desc:"Hashes the ASCII string “abc” and compares it with the published vector.",run:c2},
  {n:3,title:"AES-GCM-256 round trip",desc:"Encrypts, decrypts, and rejects the same ciphertext under a wrong key.",run:c3},
  {n:4,title:"PBKDF2-SHA256 derivation",desc:"Derives twice with one salt and once with another; compares the outputs.",run:c4},
  {n:5,title:"ECDSA P-256 keygen & non-extractability",desc:"Generates Seal A, checks extractable=false, signs, verifies, then tampers.",run:c5},
  {n:6,title:"Hash chain",desc:"Builds four synthetic records and recomputes every previous-hash link.",run:c6},
  {n:7,title:"Merkle root",desc:"Rolls up the four leaves and recomputes the root independently.",run:c7},
  {n:8,title:"Tamper detection",desc:"Mutates record 2 and requires the verifier to name that record.",run:c8},
  {n:9,title:"Seal A + Seal B signing",desc:"Signs a checkpoint with Seal A and, if present, Seal B.",run:c9},
  {n:10,title:"Receipt round trip",desc:"Builds a receipt, verifies it, then verifies against a wrong digest.",run:c10},
  {n:11,title:"Vault wrap / unwrap",desc:"Wraps a synthetic payload, unwraps it, and rejects a wrong passphrase.",run:c11},
  {n:12,title:"Network silence",desc:"Counts fetch, XHR, beacon, WebSocket and EventSource calls during the run.",run:c12},
  {n:13,title:"Delivery-path probe",desc:"Prepares a probe file, then attempts the save and reports the rung that fired.",run:c13},
  {n:14,title:"Persistent storage",desc:"Reads persisted(), the storage estimate, and whether the ledger store is readable.",run:c14},
  {n:15,title:"Sensors",desc:"Reports Bluetooth, motion, magnetometer and connection as measurements.",run:c15},
  {n:16,title:"Install posture",desc:"Checks the cached manifest, service worker, standalone mode and network state.",run:c16},
  {n:17,title:"DER key round trip",desc:"Exports a P-256 key as SPKI and PKCS#8, imports both, then signs and verifies.",run:c17},
  {n:18,title:"HKDF-SHA256 derive",desc:"Derives 256 bits twice with the same inputs and once with different info.",run:c18},
  {n:19,title:"Random UUID",desc:"Generates two UUIDs and checks v4 format and distinctness.",run:c19},
  {n:20,title:"Base64 / hex helpers",desc:"Encodes bytes to hex and base64, then decodes the base64 back.",run:c20},
  {n:21,title:"Service worker registration",desc:"Reads the active registration, controller and scope.",run:c21},
  {n:22,title:"Share rung reachability",desc:"Calls navigator.canShare with a probe file and prints the boolean.",run:c22},
  {n:23,title:"Rank computation on an empty store",desc:"Runs the rank module on an empty synthetic store and prints the rank and gate count.",run:c23},
  {n:24,title:"Rank cap without a keeper export",desc:"Runs the rank module on a synthetic chain with no keeper export and prints the cap reason.",run:c24},
  {n:25,title:"Chain-continuity day source",desc:"Checks that distinct checkpoint days come from ledger timestamps, not a counter.",run:c25},
  {n:26,title:"Guide copy scan",desc:"Scans the guide copy for forbidden verdict vocabulary and prints the match count.",run:c26},
  {n:27,title:"Reset guard",desc:"Checks that the reset button stays disabled unless the typed hull id matches and the acknowledgement is resolved.",run:c27},
  {n:28,title:"Identity-change detection",desc:"Checks that a stored identity mismatch produces the change notice.",run:c28},
  {n:29,title:"Reset boundary record",desc:"Appends a synthetic RESET-BOUNDARY record, seals it, and recomputes its digest.",run:c29},
  {n:30,title:"Persist request",desc:"Calls navigator.storage.persist() and reports granted/denied/absent without throwing.",run:c30},
  {n:31,title:"μ coverage labelling",desc:"Checks that coverage below six forces the partial-coverage label.",run:c31},
  {n:32,title:"Delivery status layout",desc:"Checks that the delivery status is in-flow, announced, inside a panel, and does not auto-dismiss.",run:c32},
  {n:33,title:"Genesis after reset",desc:"Checks that a synthetic GENESIS record references the RESET_BOUNDARY anchor.",run:c33},
  {n:34,title:"Different-instance notice",desc:"Checks that a pack sealed under a different instance id produces the notice.",run:c34},
  {n:35,title:"Backup status rows",desc:"Checks that every backup row has a measured state and a non-empty value.",run:c35},
  {n:36,title:"Un-backed-up window",desc:"Checks the un-backed-up record count against a synthetic ledger with a known export point.",run:c36},
  {n:37,title:"Recovery copy scan",desc:"Scans the recovery page copy for recovery-promise vocabulary.",run:c37},
  {n:38,title:"BLE name-resolution precedence",desc:"Runs synthetic fixtures through advertised → gap-0x2A00 → UNNAMED and checks the label.",run:c38},
  {n:39,title:"BLE absent-characteristic tolerance",desc:"Runs a mock GATT that throws NotFoundError on 0x2A00 and checks the other characteristics still resolve.",run:c39},
  {n:40,title:"BLE identity honesty",desc:"Checks that no identity path writes a MAC and that nameSource stays in the three allowed values.",run:c40},
  {n:41,title:"BLE discovery-mode wiring",desc:"Checks that the armed mode maps to acceptAllDevices or filters and that named-only is never silently substituted.",run:c41},
  {n:42,title:"DER → raw known-answer",desc:"Converts a fixed DER signature to the expected 64-byte raw R||S and compares byte-for-byte.",run:c42},
  {n:43,title:"raw ↔ DER round trip",desc:"Re-encodes the known raw signature and compares it with the original DER.",run:c43},
  {n:44,title:"Malformed DER rejection",desc:"Checks truncated, wrong-tag, and over-long INTEGER inputs are rejected with named errors.",run:c44},
  {n:45,title:"SPKI import + raw verify",desc:"Generates a WebCrypto P-256 keypair, signs, and verifies through the raw path.",run:c45},
  {n:46,title:"Keystore web stub honesty",desc:"Checks every web-stub method reports available:false and never fabricates a signature.",run:c46}
];
const COLORS={pass:"var(--phosphor)",fail:"var(--crimson)",info:"var(--smoke)",skip:"var(--smoke)",running:"var(--gold)",idle:"var(--smoke)"};
const LABELS={pass:"PASS",fail:"FAIL",info:"MEASURED",skip:"NOT MEASURED",running:"RUNNING",idle:"NOT RUN"};
function badgeStyle(st){
  const c=COLORS[st]||COLORS.idle;
  return `font-family:var(--font-mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${c};border:1px solid ${c};border-radius:999px;padding:3px 7px;white-space:nowrap`;
}
function btnStyle(){
  return "appearance:none;border:1px solid var(--border);background:var(--secondary);color:var(--chalk);border-radius:6px;padding:7px 10px;font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer";
}
function mount(root){
  runStartIndex=getOutboundAudit().calls.length;
  root.innerHTML="";
  const wrap=document.createElement("main");
  wrap.className="mx-auto w-full max-w-[760px] px-4 pb-28 pt-6";
  wrap.innerHTML=`<header>
    <p class="label" style="color:var(--gold)">SELF-TEST · LOCAL ONLY</p>
    <h1 style="margin:6px 0 0;font-size:22px;line-height:1.15;color:var(--chalk);letter-spacing:-.02em">End-to-end self-test</h1>
    <p style="margin:8px 0 0;font-size:11px;line-height:1.6;color:var(--smoke)">Forty-six checks run in this browser and print measured values. The records created here are synthetic and never enter the evidence chain.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      <button id="st-run" type="button" style="${btnStyle()}">Run all 46</button>
      <button id="st-reset" type="button" style="${btnStyle()}">Reset</button>
    </div>
    <div class="panel" style="margin-top:14px;padding:12px">
      <p class="label" style="color:var(--smoke)">SUMMARY</p>
      <p id="st-count" class="mono" style="margin:6px 0 0;font-size:13px;color:var(--chalk)">0 PASSED · 0 FAILED · 46 NOT MEASURED</p>
      <p id="st-net" class="mono" style="margin:4px 0 0;font-size:10px;color:var(--smoke)">network calls during run=0</p>
      <p style="margin:8px 0 0;font-size:10px;line-height:1.65;color:var(--smoke)">These checks verify that the primitives run on this device; they prove nothing about the device's trustworthiness or about whether the user is being observed.</p>
      <p style="margin:8px 0 0;font-size:10px;line-height:1.65;color:var(--smoke)">${LIMIT}</p>
    </div>
  </header>
  <div id="st-checks" style="display:grid;gap:10px;margin-top:14px"></div>
`;
  root.appendChild(wrap);
  const list=wrap.querySelector("#st-checks");
  const count=wrap.querySelector("#st-count");
  const netLine=wrap.querySelector("#st-net");
  const results=new Array(CHECKS.length).fill(null);
  const cards=[];
  CHECKS.forEach((c,i)=>{
    const a=document.createElement("article");
    a.className="panel";
    a.style.cssText="padding:12px;border-radius:8px;scroll-margin-top:80px";
    a.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
      <div style="min-width:0"><p class="label" style="color:var(--smoke)">CHECK ${String(c.n).padStart(2,"0")}</p>
      <h2 style="margin:4px 0 0;font-size:13px;color:var(--chalk)">${c.title}</h2>
      <p style="margin:4px 0 0;font-size:10.5px;line-height:1.5;color:var(--smoke)">${c.desc}</p></div>
      <span data-badge class="mono" style="${badgeStyle("idle")}">NOT RUN</span></div>
      <pre data-value class="mono" style="margin:10px 0 0;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--carbon);color:var(--chalk);font-size:10px;line-height:1.55;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere">—</pre>
      <button data-run type="button" style="${btnStyle()};margin-top:8px;scroll-margin-top:80px">Run this check</button>`;
    const badge=a.querySelector("[data-badge]");
    const value=a.querySelector("[data-value]");
    const run=a.querySelector("[data-run]");
    run.addEventListener("click",()=>runOne(i));
    list.appendChild(a);
    cards.push({badge,value,run});
  });
  function paint(i,st){
    const c=cards[i];
    c.badge.textContent=LABELS[st]||st;
    c.badge.setAttribute("style",badgeStyle(st));
  }
  function updateSummary(){
    const done=results.filter(Boolean);
    const p=done.filter(r=>r.status==="pass").length;
    const f=done.filter(r=>r.status==="fail").length;
    const nm=CHECKS.length-p-f;
    count.textContent=`${p} PASSED · ${f} FAILED · ${nm} NOT MEASURED`;
    const calls=getOutboundAudit().calls;
    const during=calls.slice(runStartIndex);
    const before=calls.slice(0,runStartIndex);
    const allOrigins=[...new Set(calls.map(c=>{try{return new URL(c.url,location.href).origin;}catch(e){return c.url;}}))];
    const app=during.filter(c=>sourceOf(c)==="app-originated").length;
    const host=during.filter(c=>sourceOf(c)==="host-injected").length;
    const unattr=during.filter(c=>sourceOf(c)==="unattributed").length;
    netLine.textContent=`during run=${during.length} · app-originated=${app} · host-injected=${host}${unattr?` · unattributed=${unattr}`:""} · before run=${before.length} · total=${calls.length} · origins: ${allOrigins.length?allOrigins.join(", "):"none"}`+(during.length?` · calls: ${during.slice(0,3).map(c=>`${c.kind} ${c.url}`).join(", ")}`:"")+" · This counts requests observed in this session, nothing about the device.";
  }
  async function runOne(i){
    const c=CHECKS[i];
    paint(i,"running");
    cards[i].value.textContent="running…";
    try{
      const r=await c.run();
      results[i]=r;
      cards[i].value.textContent=r.value;
      paint(i,r.status);
      if(r.status==="fail")console.error("[selftest] check "+(i+1)+" failed:",r.value);
    }catch(e){
      const msg=e&&e.message?e.message:String(e);
      results[i]={status:"fail",value:"THREW: "+msg};
      cards[i].value.textContent="THREW: "+msg;
      paint(i,"fail");
      console.error("[selftest] check "+(i+1)+" threw:",msg);
    }
    updateSummary();
  }
  let busy=false;
  async function runAll(){
    if(busy)return;
    busy=true;
    const runBtn=wrap.querySelector("#st-run");
    runBtn.disabled=true;
    runStartIndex=getOutboundAudit().calls.length;
    results.fill(null);
    cards.forEach((c,i)=>{c.value.textContent="—";paint(i,"idle");});
    updateSummary();
    for(let i=0;i<CHECKS.length;i++){
      if(i===11)continue;
      await runOne(i);
    }
    await runOne(11);
    runBtn.disabled=false;
    busy=false;
  }
  wrap.querySelector("#st-run").addEventListener("click",runAll);
  wrap.querySelector("#st-reset").addEventListener("click",()=>{
    if(busy)return;
    runStartIndex=getOutboundAudit().calls.length;
    results.fill(null);
    cards.forEach((c,i)=>{c.value.textContent="—";paint(i,"idle");});
    updateSummary();
  });
  updateSummary();
  return ()=>{};
}
export function component(){
  const ref=React.useRef(null);
  React.useEffect(()=>{
    if(!ref.current)return;
    const cleanup=mount(ref.current);
    return cleanup;
  },[]);
  return h("div",{ref,className:"min-h-screen"});
}
