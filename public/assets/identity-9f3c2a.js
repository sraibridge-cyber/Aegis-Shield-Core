import { r as React, u as useStore } from "./index-CL6IUdNY.js";
export function IdentityBanner(){
  const state=useStore();
  const change=state&&state.identityChange;
  if(!change)return null;
  const prior=change.prior_hull_id||"no prior hull on this origin";
  return React.createElement("section",{className:"panel p-3",style:{borderColor:"var(--crimson)"}},
    React.createElement("p",{className:"label",style:{color:"var(--crimson)",margin:0}},"INSTANCE IDENTITY CHANGED"),
    React.createElement("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--chalk)",wordBreak:"break-all",overflowWrap:"anywhere"}},`Previous hull id: ${prior}. Previous fingerprint: ${change.prior_fingerprint||"none"}. Current hull id: ${change.new_hull_id}. Current fingerprint: ${change.new_fingerprint||"none"}.`),
    React.createElement("p",{style:{margin:"4px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},"Records signed before this point are not in this chain. They verify against their own embedded fingerprint, not against this key. The new chain does not continue the old one."),
    React.createElement("p",{style:{margin:"4px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)"}},`Detected at ${change.detected_at}. Reason: ${change.reason}. An IDENTITY record was appended to the chain.`)
  );
}
