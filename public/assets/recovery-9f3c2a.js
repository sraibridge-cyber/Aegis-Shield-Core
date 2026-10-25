import { r as React } from "./index-CL6IUdNY.js";
export const RECOVERY_CASES=[
  {n:1,title:"Seal B keeper file lost, browser data intact",works:["Seal A still signs.","Existing receipts still verify.","Further checkpoints can be sealed with Seal A only."],lost:["The Seal B cosignature for future checkpoints.","The keeper file itself cannot be recreated from this device."],doThis:["Generate a new Seal B.","Note in the chain that a new off-device key was established.","Export the new keeper file immediately."]},
  {n:2,title:"Browser data cleared, keeper file retained",works:["Old packs and receipts verify elsewhere with no local state.","The keeper file still unwraps."],lost:["The old Seal A private key is gone.","No further records can be appended to the old chain.","A new instance must be started."],doThis:["Start the new instance.","Keep the old exported packs as the record of the earlier period.","The /verify different-instance notice labels them correctly."]},
  {n:3,title:"Both lost",works:["Whatever was handed to a third party. That is the whole record now."],lost:["No cryptographic recovery exists and none is claimed."],doThis:["Nothing can be done for the lost chain.","Start a new instance and keep future receipts off-device."]}
];
export const RECOVERY_PRACTICES=["Export a pack at a fixed cadence.","Send each receipt off-device at the moment it is made.","Keep the keeper file on separate media from the pack.","Re-export after any period of active use."];
export const RECOVERY_CLOSING="This page describes mechanisms and limits. It does not assert that any record will be accepted as evidence, and it does not assert that the app protects anyone.";
export const RECOVERY_BLOCKLIST=["secure","safe","protected","guaranteed","guarantee","we can recover","we will recover","your data is safe","no data loss","fully recoverable"];
export function scanRecovery(texts){
  const hay=(texts||[]).join(" \n ").toLowerCase();
  const matches=[];
  for(const phrase of RECOVERY_BLOCKLIST){if(hay.includes(phrase))matches.push(phrase);}
  return {count:matches.length,matches};
}
export const RECOVERY_TEXT=[...RECOVERY_CASES.flatMap(c=>[c.title,...c.works,...c.lost,...c.doThis]),...RECOVERY_PRACTICES,RECOVERY_CLOSING];
export function component(){
  const h=React.createElement;
  return h("div",{className:"space-y-4"},
    h("header",{className:"space-y-2"},
      h("p",{className:"label",style:{color:"var(--gold)",margin:0}},"RECOVERY"),
      h("h1",{style:{margin:0,fontSize:"22px",lineHeight:1.15,color:"var(--chalk)",letterSpacing:"-.02em"}},"If a key is lost"),
      h("p",{style:{margin:0,fontSize:"11px",lineHeight:1.6,color:"var(--smoke)"}},"This page describes what is and is not possible. It does not offer a recovery that does not exist.")
    ),
    RECOVERY_CASES.map(c=>h("section",{className:"panel p-3",key:c.n},
      h("p",{className:"label",style:{color:"var(--gold)",margin:0}},`CASE ${c.n}`),
      h("h2",{style:{margin:"4px 0 0",fontSize:"14px",color:"var(--chalk)"}},c.title),
      h("p",{className:"label",style:{margin:"8px 0 0",color:"var(--phosphor)"}},"WHAT STILL WORKS"),
      h("ul",{style:{margin:"2px 0 0",paddingLeft:"16px",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},c.works.map(x=>h("li",{key:x},x))),
      h("p",{className:"label",style:{margin:"8px 0 0",color:"var(--crimson)"}},"WHAT IS LOST OR CANNOT BE DONE"),
      h("ul",{style:{margin:"2px 0 0",paddingLeft:"16px",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},c.lost.map(x=>h("li",{key:x},x))),
      c.doThis.length?h("p",{className:"label",style:{margin:"8px 0 0",color:"var(--gold)"}},"WHAT TO DO"):null,
      c.doThis.length?h("ol",{style:{margin:"2px 0 0",paddingLeft:"16px",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},c.doThis.map(x=>h("li",{key:x},x))):null
    )),
    h("section",{className:"panel p-3"},
      h("p",{className:"label",style:{color:"var(--gold)",margin:0}},"PRACTICE THAT REDUCES THE BLAST RADIUS"),
      h("ul",{style:{margin:"6px 0 0",paddingLeft:"16px",fontSize:"10.5px",lineHeight:1.6,color:"var(--smoke)"}},RECOVERY_PRACTICES.map(x=>h("li",{key:x},x)))
    ),
    h("section",{className:"panel p-3",style:{borderColor:"var(--crimson)"}},
      h("p",{className:"label",style:{color:"var(--crimson)",margin:0}},"LIMITATION"),
      h("p",{style:{margin:"6px 0 0",fontSize:"10.5px",lineHeight:1.65,color:"var(--smoke)"}},RECOVERY_CLOSING)
    )
  );
}
