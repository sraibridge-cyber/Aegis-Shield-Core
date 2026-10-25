/* AEGIS 44 two-stage delivery: PREPARE builds and holds the file; SHARE / SAVE runs inside the tap. */
const LIMIT="The delivered file proves its contents have not changed since sealing on this device, and nothing about whether the recorded observations were true or when they happened.";
let pending={};
let currentKey=null;
let dataVersion=0;
function currentVersion(){return dataVersion;}
function bumpVersion(){dataVersion+=1;Object.values(pending).forEach(h=>{h.stale=true;});}
function caps(){
  const nav=navigator;
  let canShareFiles=false;
  try{
    if(typeof nav.canShare==="function"&&typeof File!=="undefined"){
      canShareFiles=nav.canShare({files:[new File(["aegis"],"probe.txt",{type:"text/plain"})]});
    }
  }catch(e){canShareFiles=false;}
  const download="download" in document.createElement("a");
  return {share:typeof nav.share==="function",canShareFiles,download};
}
let lastHost=null;
let statusTimer=null;
if(typeof document!=="undefined"){
  document.addEventListener("click",e=>{
    const b=e.target&&e.target.closest?e.target.closest("button"):null;
    if(b){lastHost=b.closest(".panel")||b.closest("section")||document.querySelector("main")||document.body;}
  },true);
}
function statusHost(){
  if(lastHost&&lastHost.isConnected)return lastHost;
  return document.querySelector("main")||document.body;
}
function ensureStatus(){
  let el=document.getElementById("aegis-delivery-status");
  if(!el){
    el=document.createElement("div");
    el.id="aegis-delivery-status";
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
    el.style.cssText="margin-top:8px;background:#0a0d10;border:1px solid #1c2228;border-radius:8px;padding:10px 12px;font-family:var(--font-mono);font-size:10px;line-height:1.5;color:#e8e4da;display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap";
    statusHost().appendChild(el);
  }
  return el;
}
function showStatus(message,tone){
  const el=ensureStatus();
  if(statusTimer)clearTimeout(statusTimer);
  el.textContent="";
  const dot=document.createElement("span");
  dot.style.cssText="flex:0 0 auto;width:6px;height:6px;border-radius:999px;margin-top:4px;background:"+(tone==="fail"?"#d96a6a":tone==="warn"?"#d9a441":"#7fd1a8");
  const txt=document.createElement("span");
  txt.style.cssText="flex:1 1 220px;min-width:0;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere";
  txt.textContent=message;
  const close=document.createElement("button");
  close.type="button";close.textContent="×";close.setAttribute("aria-label","Dismiss delivery status");
  close.style.cssText="flex:0 0 auto;appearance:none;border:0;background:transparent;color:#8a8f96;font-size:14px;line-height:1;cursor:pointer;padding:0 2px";
  close.addEventListener("click",()=>{if(statusTimer)clearTimeout(statusTimer);el.remove();});
  el.appendChild(dot);el.appendChild(txt);el.appendChild(close);
}
function reportError(message){showStatus(message,"fail");}
window.__aegisReportDeliveryError=reportError;
window.__aegisBumpDeliveryVersion=bumpVersion;
function ensurePanel(){
  let el=document.getElementById("aegis-delivery-panel");
  if(!el){
    el=document.createElement("div");
    el.id="aegis-delivery-panel";
    el.style.cssText="pointer-events:auto;background:#0a0d10;border:1px solid #1c2228;border-radius:8px;padding:10px 12px;font-family:var(--font-mono);font-size:10px;line-height:1.5;color:#e8e4da;box-shadow:0 8px 24px #0008";
    el.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#c9a86a">DELIVERY</span><span id="aegis-delivery-state" style="font-size:9px;color:#8a8f96">no file prepared</span></div><div id="aegis-delivery-body" style="margin-top:6px;color:#8a8f96">Prepare a file first. Nothing is delivered until you tap SHARE / SAVE.</div><div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><button id="aegis-delivery-action" type="button" disabled style="appearance:none;border:1px solid #c9a86a;background:#10151a;color:#e8e4da;border-radius:6px;padding:7px 10px;font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;opacity:.55">SHARE / SAVE</button><span id="aegis-delivery-reason" style="font-size:9px;color:#8a8f96">prepare first</span></div><div id="aegis-delivery-list" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px"></div><p id="aegis-delivery-limit" style="display:none;margin:8px 0 0;font-size:9px;line-height:1.5;color:#8a8f96">'+LIMIT+'</p>';
    statusHost().appendChild(el);
  }
  const host=statusHost();
  if(el.parentNode!==host)host.appendChild(el);
  return el;
}
function renderPanel(holder,opts){
  opts=opts||{};
  const el=ensurePanel();
  const state=el.querySelector("#aegis-delivery-state");
  const body=el.querySelector("#aegis-delivery-body");
  const action=el.querySelector("#aegis-delivery-action");
  const reason=el.querySelector("#aegis-delivery-reason");
  if(!holder){
    state.textContent="no file prepared";
    body.textContent="Prepare a file first. Nothing is delivered until you tap SHARE / SAVE.";
    action.textContent="SHARE / SAVE";
    action.disabled=true;
    action.style.opacity=".55";
    action.onclick=null;
    reason.textContent="prepare first";
    const lim=el.querySelector("#aegis-delivery-limit");
    if(lim)lim.style.display="none";
    return;
  }
  const probe=!!opts.probe;
  state.textContent=(probe?"PROBE · ":"prepared · ")+holder.name;
  body.innerHTML="";
  const line=document.createElement("div");
  line.textContent=holder.name+" · "+holder.bytes+" bytes · "+holder.mime;
  line.style.cssText="color:#e8e4da;word-break:break-word";
  const hash=document.createElement("details");
  hash.style.cssText="margin-top:4px;color:#8a8f96";
  const sum=document.createElement("summary");
  sum.textContent="SHA-256 "+holder.sha256.slice(0,16)+"…";
  sum.style.cssText="cursor:pointer";
  const full=document.createElement("code");
  full.textContent=holder.sha256;
  full.style.cssText="display:block;margin-top:4px;word-break:break-all;color:#c9a86a;font-size:9px";
  hash.appendChild(sum);hash.appendChild(full);
  const note=document.createElement("div");
  note.style.cssText="margin-top:4px;color:#8a8f96";
  note.textContent=probe?"Probe only — no file will be saved.":(holder.canShare?"The platform offers a share sheet.":"This platform offers no share sheet; the save rung will be used.");
  body.appendChild(line);body.appendChild(hash);body.appendChild(note);
  if(holder.notice){const n=document.createElement("p");n.textContent=holder.notice;n.style.cssText="margin-top:6px;font-size:9px;line-height:1.5;color:#d9a441;word-break:break-word";body.appendChild(n);}
  action.textContent=probe?"PROBE ONLY":(holder.canShare?"SHARE / SAVE":"SAVE FILE");
  action.disabled=probe;
  action.style.opacity=probe?".55":"1";
  action.onclick=probe?null:()=>{deliverPending(holder);};
  reason.textContent=probe?"probe — no file will be saved":(holder.canShare?"share sheet available":"no share sheet — save rung");
  const lim=el.querySelector("#aegis-delivery-limit");
  if(lim)lim.style.display="block";
  const list=el.querySelector("#aegis-delivery-list");
  list.textContent="";
  if(!probe){
    Object.keys(pending).forEach(k=>{
      if(k===holder.key)return;
      const b=document.createElement("button");
      b.type="button";b.textContent="SHOW "+pending[k].name;
      b.style.cssText="appearance:none;border:1px solid #1c2228;background:#10151a;color:#8a8f96;border-radius:6px;padding:5px 7px;font-family:var(--font-mono);font-size:9px;cursor:pointer";
      b.addEventListener("click",()=>renderPanel(pending[k]));
      list.appendChild(b);
    });
  }
}
function resetPanel(){
  const keys=Object.keys(pending);
  if(keys.length){currentKey=keys[keys.length-1];renderPanel(pending[currentKey]);}
  else{currentKey=null;renderPanel(null);}
}
function showManual(filename,text,mime,error){
  let el=document.getElementById("aegis-manual-copy");
  if(el)el.remove();
  el=document.createElement("div");
  el.id="aegis-manual-copy";
  el.style.cssText="margin-top:8px;background:#0a0d10;border:1px solid #c9a86a;border-radius:8px;padding:12px;font-family:var(--font-mono);color:#e8e4da;max-height:70vh;overflow:auto";
  const title=document.createElement("p");
  title.textContent="MANUAL COPY — "+filename;
  title.style.cssText="margin:0 0 6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#c9a86a";
  const note=document.createElement("p");
  note.textContent="The browser blocked every automatic delivery rung. Select the payload below, copy it, paste it into a text file, and keep that file."+(error?" Last error: "+error:"");
  note.style.cssText="margin:0 0 8px;font-size:10px;line-height:1.5;color:#8a8f96";
  const ta=document.createElement("textarea");
  ta.value=text;ta.readOnly=true;
  ta.style.cssText="width:100%;min-height:140px;resize:vertical;background:#040607;color:#e8e4da;border:1px solid #1c2228;border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:10px;line-height:1.5";
  const row=document.createElement("div");
  row.style.cssText="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap";
  const copy=document.createElement("button");
  copy.type="button";copy.textContent="SELECT ALL + COPY";
  copy.style.cssText="appearance:none;border:1px solid #1c2228;background:#10151a;color:#e8e4da;border-radius:6px;padding:7px 10px;font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;cursor:pointer";
  copy.addEventListener("click",async()=>{
    ta.focus();ta.select();
    try{await navigator.clipboard.writeText(text);copy.textContent="COPIED";}
    catch(e){try{document.execCommand("copy");copy.textContent="COPIED";}catch(e2){copy.textContent="SELECT + COPY";}}
  });
  const close=document.createElement("button");
  close.type="button";close.textContent="CLOSE";
  close.style.cssText=copy.style.cssText;
  close.addEventListener("click",()=>el.remove());
  row.appendChild(copy);row.appendChild(close);
  const limit=document.createElement("p");
  limit.textContent=LIMIT;
  limit.style.cssText="margin:8px 0 0;font-size:9px;line-height:1.5;color:#8a8f96";
  el.appendChild(title);el.appendChild(note);el.appendChild(ta);el.appendChild(row);el.appendChild(limit);
  statusHost().appendChild(el);
}
function blobToDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result));
    r.onerror=()=>reject(r.error||new Error("FileReader failed"));
    r.readAsDataURL(blob);
  });
}
function clickDownload(href,filename){
  const a=document.createElement("a");
  a.href=href;a.download=filename;a.rel="noopener";
  document.body.appendChild(a);a.click();a.remove();
}
async function prepareDelivery(spec,opts){
  opts=opts||{};
  const mime=spec.mime||spec.blob.type||"application/octet-stream";
  const buf=await spec.blob.arrayBuffer();
  const digest=await crypto.subtle.digest("SHA-256",buf);
  const sha256=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
  const file=new File([spec.blob],spec.name,{type:mime});
  let canShare=false;
  try{canShare=!!(navigator.canShare&&navigator.canShare({files:[file]}));}catch(e){canShare=false;}
  const holder={key:spec.key||spec.name,file,name:spec.name,bytes:file.size,sha256,mime,preparedAt:Date.now(),version:currentVersion(),canShare,stale:false,notice:spec.notice||null};
  if(opts.probe||spec.probe){renderPanel(holder,{probe:true});return holder;}
  pending[holder.key]=holder;
  currentKey=holder.key;
  renderPanel(holder);
  return holder;
}
async function deliverPending(holder){
  holder=holder||pending[currentKey];
  if(!holder||!holder.file){showStatus("Delivery: no prepared file — prepare first","warn");return {ok:false,rung:"none"};}
  if(holder.stale||holder.version!==currentVersion()){
    delete pending[holder.key];
    if(currentKey===holder.key)currentKey=null;
    resetPanel();
    showStatus("Delivery: prepared file is stale — prepare again","warn");
    return {ok:false,rung:"stale"};
  }
  const file=holder.file;
  let lastError=null;
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file],title:holder.name,text:holder.name});
      showStatus("Delivery: share sheet accepted — "+holder.name+". The OS reported the sheet closed; this page cannot confirm the file was received.","ok");
      return {ok:true,rung:"share sheet"};
    }catch(e){
      lastError=(e&&e.name?e.name:"Error")+" — "+(e&&e.message?e.message:String(e));
      showStatus("share rejected: "+lastError,"warn");
    }
  }
  try{
    const url=URL.createObjectURL(file);
    clickDownload(url,holder.name);
    setTimeout(()=>URL.revokeObjectURL(url),1200);
    showStatus("Delivery: blob download triggered — "+holder.name+". The page cannot confirm the download landed; check your Downloads folder."+(lastError?" (share rejected: "+lastError+")":""),"warn");
    return {ok:true,rung:"blob download",error:lastError};
  }catch(e){lastError=(e&&e.name?e.name:"Error")+" — "+(e&&e.message?e.message:String(e));}
  try{
    const dataUrl=await blobToDataUrl(file);
    clickDownload(dataUrl,holder.name);
    showStatus("Delivery: data URL download triggered — "+holder.name+". The page cannot confirm the download landed; check your Downloads folder."+(lastError?" (earlier rung failed: "+lastError+")":""),"warn");
    return {ok:true,rung:"data URL",error:lastError};
  }catch(e){lastError=(e&&e.name?e.name:"Error")+" — "+(e&&e.message?e.message:String(e));}
  let text="";
  try{text=await file.text();}catch(e){text="";}
  showManual(holder.name,text,holder.mime,lastError);
  showStatus("Delivery: manual copy panel — "+holder.name+". Copy the payload and keep it."+(lastError?" (last error: "+lastError+")":""),"warn");
  return {ok:true,rung:"manual copy",error:lastError};
}
function probeDelivery(holder){
  const c=caps();
  const canShare=!!(holder&&holder.canShare);
  const rung=canShare?"share sheet":(c.download?"blob download":(typeof FileReader!=="undefined"?"data URL":"manual copy"));
  return {canShare,rung,download:c.download};
}
function clearPending(key){
  if(key&&pending[key]){delete pending[key];if(currentKey===key)currentKey=null;}
  resetPanel();
}
function canonical(v){
  if(v===null||v===undefined)return "null";
  if(typeof v==="number")return Number.isFinite(v)?String(v):"null";
  if(typeof v==="boolean"||typeof v==="string")return JSON.stringify(v);
  if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
  if(typeof v==="object")return "{"+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
  return "null";
}
function prepareJson(filename,obj,opts){
  return prepareDelivery({key:(opts&&opts.key)||filename,name:filename,blob:new Blob([JSON.stringify(obj,null,2)],{type:"application/json"})},opts);
}
function prepareCanonicalJson(filename,obj,opts){
  return prepareDelivery({key:(opts&&opts.key)||filename,name:filename,blob:new Blob([canonical(obj)],{type:"application/json"})},opts);
}
function prepareText(filename,text,mime,opts){
  return prepareDelivery({key:(opts&&opts.key)||filename,name:filename,blob:new Blob([String(text)],{type:mime||"text/plain"})},opts);
}
ensurePanel();
export{prepareJson as a,prepareCanonicalJson as b,prepareText as d,prepareDelivery,deliverPending,probeDelivery,clearPending,resetPanel,caps as deliveryCapabilities,bumpVersion,reportError};
