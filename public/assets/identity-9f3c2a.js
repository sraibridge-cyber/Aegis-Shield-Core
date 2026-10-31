import { r as React, u as useStore } from "./index-CL6IUdNY.js";
export function IdentityBanner(){
  const state=useStore();
  const change=state&&state.identityChange;
  if(!change)return null;
  const firstRun=change.reason==="no prior hull on this origin";
  const prior=change.prior_hull_id||"no prior hull on this origin";
  const heading=firstRun?"NEW INSTANCE ON THIS BROWSER":"INSTANCE IDENTITY CHANGED";
  const headingColor=firstRun?"var(--chalk)":"var(--crimson)";
  const border=firstRun?"var(--border)":"var(--crimson)";
  const body=firstRun
    ?`No earlier identity is stored for this browser, so there was nothing to compare against. This check did not replace any key. It is expected the first time AEGIS opens on a new device or browser. Current hull id: ${change.new_hull_id}. Current fingerprint: ${change.new_fingerprint||"none"}.`
    :`Previous hull id: ${prior}. Previous fingerprint: ${change.prior_fingerprint||"none"}. Current hull id: ${change.new_hull_id}. Current fingerprint: ${change.new_fingerprint||"none"}. The key this browser holds now is not the one it held last time. If you did not expect that, check whether browser data was cleared, you switched browsers, or you restored from a backup.`;
  const note=firstRun
    ?"If you used AEGIS in this browser before, its stored identity was lost, probably when browser data was cleared. Records from before this point are not in this chain."
    :"Records signed before this point are not in this chain. They verify against their own embedded fingerprint, not against this key. The new chain does not continue the old one.";
  return React.createElement("section",{className:"panel p-3",style:{borderColor:border}},
    React.createElement("p",{className:"label",style:{color:headingColor,margin:0}},heading),
    React.createElement("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--chalk)",wordBreak:"break-all",overflowWrap:"anywhere"}},body),
    React.createElement("p",{style:{margin:"4px 0 0",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},note),
    React.createElement("p",{style:{margin:"4px 0 0",fontSize:"9px",lineHeight:1.5,color:"var(--smoke)"}},`Detected at ${change.detected_at}. Reason: ${change.reason}. An IDENTITY record was appended to the chain.`)
  );
}
