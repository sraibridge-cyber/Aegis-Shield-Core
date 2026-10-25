export const TITLE="FIELD GUIDE — ONE RECORD, START TO FINISH";
export const INTRO="Nothing on this page leaves your device on its own. Every arrow below is an action you take. The app cannot transmit, and does not.";
export const SAMPLE="This walkthrough steps a sample record. It is not your ledger.";
export const LIMIT="This page describes records created on a single device. It does not establish that any observation was true, and it does not establish when the device clock said they were made. It does not measure your risk, your safety, or whether anyone is observing you.";
export const JOURNEY=[
  {n:1,title:"The phone measures something",what:"The app reads a value the phone can actually measure — network timing, motion, the magnetometer, or a BLE device you chose.",holds:"This device only. No server receives it.",check:"That a reading exists in the local chain, with its timestamp.",cannot:"Whether the reading was true, or whether anyone was observing you."},
  {n:2,title:"The reads become one number",what:"The MIND layer combines the reads into one resonance number using fixed weights.",holds:"This device only.",check:"The weights and the resulting number, if the record is exported.",cannot:"Whether the number means danger; it is a summary of the inputs, not a threat verdict.",weights:"E .30 · L .30 · S .15 · F .10 · V .08 · D .07"},
  {n:3,title:"The record gets a fingerprint",what:"The record is hashed. Two identical records give one fingerprint; one changed character gives a different one.",holds:"This device only.",check:"The fingerprint (hash) of the record.",cannot:"Whether the record's contents were true when it was made."},
  {n:4,title:"Each record points back",what:"The previous record's fingerprint is stored inside the next record. Changing an old record breaks every record after it.",holds:"This device only.",check:"That the chain is continuous, and the index where it breaks if it does.",cannot:"Whether the device was compromised before the record was made."},
  {n:5,title:"A key signs the chain",what:"A key generated on this phone, which cannot be copied out, signs the chain at a checkpoint.",holds:"This device holds the private key; the public key can be exported.",check:"The signature against the public key, and the key fingerprint.",cannot:"Whether the device was observed while it was signing."},
  {n:6,title:"You choose to move it",what:"You export a receipt or pack. This is the only step where anything moves, and it moves because you chose it.",holds:"You hold the exported file; whoever you give it to holds a copy.",check:"The chain, the seals, the Merkle root and the anchor digest, if present.",cannot:"Whether the observations were true, or when they happened beyond the device clock."}
];
export const RANKS=[
  {key:"UNRECORDED",n:0,condition:"No sealed record exists.",link:"/memory",instruction:"Seal a checkpoint in /memory."},
  {key:"LOGGING",n:1,condition:"At least 1 sealed record exists.",link:"/memory",instruction:"Seal a checkpoint in /memory."},
  {key:"DOCUMENTED",n:2,condition:"At least 2 records; hash-chain continuity re-verified in this session; Seal A present with extractable=false.",link:"/memory",instruction:"Add a second record and re-verify the chain in /memory."},
  {key:"ANCHORED",n:3,condition:"At least 1 ANCHOR record naming a channel; at least 1 checkpoint receipt emitted and saved off-device.",link:"/clock",instruction:"Record an anchor in /clock and prepare a checkpoint receipt in /memory."},
  {key:"THIRD-PARTY VERIFIABLE",n:4,condition:"A pack was verified in /verify and returned internally consistent; the run is logged with its time.",link:"/verify",instruction:"Verify a pack in /verify."},
  {key:"COUNSEL-READY",n:5,condition:"All of the above, plus at least 1 CUSTODY entry, an export pack newer than the last checkpoint, and zero lights NOT MEASURED.",link:"/clock",instruction:"Log custody in /clock and prepare a current export pack in /memory."}
];
export const LIGHTS=[
  {key:"chain",label:"Hash chain intact"},
  {key:"key",label:"Signing key present and non-extractable"},
  {key:"keeper",label:"Keeper file exported off-device"},
  {key:"anchor",label:"Anchor recorded with a named channel"},
  {key:"custody",label:"Custody logged"},
  {key:"export",label:"Export pack current"}
];
export const GLOSSARY=[
  ["hash","A short fingerprint of a file. Change one character and the fingerprint changes. It cannot tell you whether the file was true when it was made.","SHA-256 digest."],
  ["hash chain","Each record stores the fingerprint of the record before it. A change to an old record breaks every record after it.","Singly-linked hash chain."],
  ["seal / signature","A signature made with a key that cannot be copied off this device. It shows the chain has not changed since the seal.","ECDSA P-256 signature."],
  ["key","A number the device uses to sign. The private half stays on the device; the public half can be shared.","ECDSA P-256 keypair."],
  ["non-extractable key","A key the browser will not let any script export. It can sign, but it cannot be copied out.","WebCrypto extractable=false."],
  ["Merkle root","One fingerprint folded up out of all the records in a checkpoint. Change one record and the root changes.","Merkle root over record hashes."],
  ["checkpoint","A sealed snapshot of the chain so far, with a sequence range and a Merkle root.","Signed checkpoint."],
  ["receipt","A standalone file for one checkpoint. A verifier needs nothing else to check it.","Checkpoint receipt."],
  ["anchor","A copy of the digest stored somewhere this device cannot reach, with an independent timestamp.","Off-device anchor record."],
  ["custody log","A record of who held the file and when. Each entry is a CUSTODY record in the same chain.","CUSTODY ledger record."],
  ["UNNAMED","An advertiser that sends no local name in its advertising packet. The OS chooser shows it as Unknown or Unsupported Device. The app records it as an observation with an opaque id and does not infer a vendor, owner or purpose.","GAP advertising packet with no local name."]
];
export const GUIDE_TEXT=[TITLE,INTRO,SAMPLE,LIMIT,...JOURNEY.flatMap(x=>[x.title,x.what,x.holds,x.check,x.cannot,x.weights||""]),...RANKS.flatMap(x=>[x.key,x.condition,x.instruction]),...LIGHTS.map(x=>x.label),...GLOSSARY.flatMap(x=>x)];
