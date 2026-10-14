import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const PROJECT = "C:\\Users\\ayush\\Desktop\\AYUSH\\BMS_AI_project";
const BUILD = path.join(PROJECT, ".codex-presentation-build");
const OUTPUT = path.join(PROJECT, "Tarang_Hackathon_Presentation_2026-10-09_v2");
const SKILL_DIR = "C:\\Users\\ayush\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.1007.11041\\skills\\presentations";
const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href
);
const FONT = resolvePresentationFont();
const C = { bg:"#07131F", panel:"#102230", white:"#F3F7FA", muted:"#A8BAC6",
  quiet:"#6E8595", cyan:"#55D9E8", blue:"#579FF2", green:"#4DD4AA",
  amber:"#F2B76B", line:"#294353" };
const p = Presentation.create({ slideSize:{width:1280,height:720} });

function box(slide,x,y,w,h,fill,stroke="none",radius=0) {
  return slide.shapes.add({ geometry:radius?"roundRect":"rect",
    position:{left:x,top:y,width:w,height:h}, fill,
    line:{style:"solid",fill:stroke,width:stroke==="none"?0:1.2},
    ...(radius?{borderRadius:radius}:{}) });
}
function text(slide,value,x,y,w,h,opt={}) {
  const s=slide.shapes.add({geometry:"textbox",position:{left:x,top:y,width:w,height:h},
    fill:"none",line:{style:"solid",fill:"none",width:0}});
  s.text=value;
  s.text.style={typeface:FONT,fontSize:opt.size??18,bold:opt.bold??false,
    italic:opt.italic??false,color:opt.color??C.white,alignment:opt.align??"left",
    verticalAlignment:opt.valign??"top",autoFit:"shrinkText",wrap:"square",insets:0};
  return s;
}
function tag(slide,label,x,y,w,color,fill=C.panel) {
  box(slide,x,y,w,27,fill,color,13);
  text(slide,label,x+8,y+6,w-16,15,{size:12,bold:true,color,align:"center"});
}
function header(slide,section,page) {
  text(slide,section.toUpperCase(),60,27,800,20,{size:14,bold:true,color:C.cyan});
  box(slide,60,55,48,3,C.cyan);
  text(slide,page+" / 04",1137,28,83,20,{size:13,bold:true,color:C.muted,align:"right"});
}
function arrow(slide,x,y,color=C.cyan,w=16) {
  slide.shapes.add({geometry:"rightArrow",position:{left:x,top:y,width:w,height:12},
    fill:color,line:{style:"solid",fill:"none",width:0}});
}
function notes(slide,lines) { slide.speakerNotes.text=lines.join("\n"); slide.speakerNotes.setVisible(true); }
async function image(slide,file,alt,x,y,w,h) {
  const bytes=await fs.readFile(path.join(BUILD,file));
  const blob=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  slide.images.add({blob,contentType:"image/png",alt,fit:"cover",
    position:{left:x,top:y,width:w,height:h},geometry:"roundRect",borderRadius:18});
}

// Slide 1: Introduction
{
  const s=p.slides.add(); s.background.fill=C.bg; header(s,"Introduction","01");
  text(s,"SMART BMS\nMONITORING SYSTEM",60,91,550,112,{size:48,bold:true});
  text(s,"An Integrated Hardware–Software Platform for Intelligent Battery Monitoring",62,216,535,57,{size:21,color:C.muted});
  tag(s,"TARANG",62,294,135,C.cyan,"#102B3A");
  text(s,"Battery operation is shaped by voltage, current and temperature. A shared view helps teams follow those conditions and spot configured abnormal readings.",62,349,536,86,{size:18});
  box(s,62,454,4,88,C.cyan);
  text(s,"Connecting battery measurements with actionable software insights for more visible and manageable battery operation.",82,458,508,78,{size:19,bold:true});
  await image(s,"battery-hardware-concept.png","Concept illustration of a four-cell battery pack beside a generic controller and temperature probe",648,88,574,398);
  tag(s,"CONCEPT ILLUSTRATION / NOT A BUILT PROTOTYPE",773,495,330,C.muted,"#10202D");
  tag(s,"SOFTWARE FOUNDATION / IMPLEMENTED",648,540,278,C.green,"#10291F");
  tag(s,"PHYSICAL INTEGRATION / PENDING",940,540,282,C.amber,"#30251A");
  text(s,"Current dashboard values come from the backend development simulator. Physical sensor measurements are not connected.",650,582,555,52,{size:16,color:C.muted});
  text(s,"MEASURE",66,595,146,18,{size:12,bold:true,color:C.amber,align:"center"});
  text(s,"PROCESS",246,595,146,18,{size:12,bold:true,color:C.green,align:"center"});
  text(s,"VIEW",426,595,146,18,{size:12,bold:true,color:C.green,align:"center"});
  box(s,66,618,146,43,"#172431","#806540",12);
  box(s,246,618,146,43,"#122B2B","#367B6A",12);
  box(s,426,618,146,43,"#122B2B","#367B6A",12);
  text(s,"V / I / 4 temperatures",75,632,128,17,{size:13,align:"center"});
  text(s,"FastAPI + SQLite",255,632,128,17,{size:13,align:"center"});
  text(s,"Vanilla JS dashboard",435,632,128,17,{size:13,align:"center"});
  arrow(s,219,634,C.cyan,20); arrow(s,399,634,C.cyan,20);
  notes(s,[
    "Timing: 45 seconds.",
    "Battery performance changes with load and temperature, so teams need to see voltage, current and temperature together. Tarang's Smart BMS Monitoring System connects battery measurements to a software view that can show trends and configured abnormal readings.",
    "The software foundation is implemented. The frontend currently receives simulated telemetry from the backend. No physical sensor or embedded controller is connected yet. The image is conceptual artwork, not a photograph of our prototype.",
    "Our value proposition is to connect battery measurements with actionable software insights for more visible and manageable battery operation.",
    "Judge cue: If asked whether this is live hardware, say no. The displayed values come from the development mock. Physical integration and measurement validation are next.",
    "Sources: README.md; frontend2/index.html; frontend2/app.js; backend/README.md; hardware/README.md."
  ]);
}

// Slide 2: Technical explanation
{
  const s=p.slides.add(); s.background.fill=C.bg; header(s,"Technical explanation","02");
  text(s,"SYSTEM ARCHITECTURE & TECHNICAL METHODOLOGY",60,68,1115,48,{size:35,bold:true});
  text(s,"Implemented software path with physical measurement shown as pending",62,119,1080,28,{size:18,color:C.muted});
  text(s,"HARDWARE / PENDING",70,153,465,20,{size:13,bold:true,color:C.amber});
  text(s,"COMMUNICATION / DEVICE LINK PENDING",565,153,170,20,{size:11,bold:true,color:C.blue,align:"center"});
  text(s,"SOFTWARE / IMPLEMENTED",730,153,480,20,{size:13,bold:true,color:C.green});
  const nodes=[
    [70,"Battery pack","Prototype concept\nnot integrated",C.amber,"#211D19"],
    [235,"Measurement","Voltage, current\n4 temperature channels\nSensors TBD",C.amber,"#211D19"],
    [400,"ESP32","Controller and firmware\npending",C.amber,"#211D19"],
    [565,"HTTP JSON","POST /api/telemetry\nAPI route ready",C.blue,"#152132"],
    [730,"FastAPI","Pydantic validates\ntelemetry payload",C.green,"#12241F"],
    [895,"SQLite + services","History, risk rules\nand alert records",C.green,"#12241F"],
    [1060,"Dashboard","5 vanilla JS views\nREST polling every 5 s",C.green,"#12241F"]
  ];
  for(const [x,title,body,color,fill] of nodes) {
    box(s,x,181,150,130,fill,color,14);
    text(s,title,x+10,197,130,38,{size:17,bold:true,color,align:"center",valign:"middle"});
    text(s,body,x+11,240,128,59,{size:14,align:"center",valign:"middle"});
  }
  for(let i=0;i<nodes.length-1;i++) arrow(s,nodes[i][0]+151,240,i<2?C.amber:i===2?C.blue:C.cyan,13);
  text(s,"WHAT THE SOFTWARE DOES TODAY",60,337,500,22,{size:14,bold:true,color:C.cyan});
  const cards=[
    [60,"VALIDATED TELEMETRY",C.blue,"Schema accepts voltage, current, SOC and four temperatures. Power is derived if omitted. SOH is optional."],
    [453,"RISK, HISTORY AND ALERTS",C.cyan,"SQLite stores readings and alerts. Risk logic uses the hottest cell and recent trend against a configured threshold."],
    [846,"MODEL AND INTERFACE",C.green,"CALCE-trained XGBoost estimates average temperature 10 minutes ahead. Advisory only, not validated on this pack."]
  ];
  for(const [x,title,color,body] of cards) {
    box(s,x,369,374,130,C.panel,C.line,14);
    text(s,title,x+18,385,340,22,{size:13,bold:true,color});
    text(s,body,x+18,418,340,68,{size:16});
  }
  box(s,60,521,1160,145,"#0B1B28","#243C4C",16);
  text(s,"IMPLEMENTATION STATUS",80,538,300,20,{size:13,bold:true,color:C.muted});
  tag(s,"SOFTWARE FOUNDATION / IMPLEMENTED",80,570,270,C.green,"#10291F");
  tag(s,"PHYSICAL SENSOR FEED / PENDING",80,608,270,C.amber,"#30251A");
  text(s,"Safety boundary",390,541,200,21,{size:16,bold:true,color:C.amber});
  text(s,"The 55°C threshold is an inherited demo default, not a validated cell limit. Fan output is a display indicator. No automatic shutdown, cell balancing or certified protection is implemented. The physical BMS remains authoritative.",390,572,800,70,{size:15});
  notes(s,[
    "Timing: 105 seconds.",
    "The software architecture starts with a telemetry schema, not a hardware assumption. The API requires a device identifier, timestamp, voltage, current, SOC and four cell temperatures. Power is calculated when the sender omits it. SOH remains optional because no validated estimator is present.",
    "The intended physical path is a battery pack, measurement channels and ESP32 firmware. The repository does not identify selected sensor part numbers, and this path has not been integrated. The backend provides an HTTP POST endpoint at /api/telemetry. The development mock currently supplies samples.",
    "FastAPI passes incoming payloads through Pydantic validation. SQLAlchemy stores telemetry and alert rows in SQLite by default. The status endpoint combines the latest record with history, four-channel averages and maximums, risk, prediction, alerts, connection freshness and a demo fan indicator. The frontend polls that status endpoint every five seconds.",
    "Risk classification uses the hottest current sensor and recent hottest-sensor trend against a configured threshold. The included default of 55 degrees Celsius came from the earlier UI and is not a validated safe limit. The fan percentage is calculated for display only. There is no relay command, shutdown, or cell-balancing control.",
    "The XGBoost artifact predicts the four-sensor average about ten minutes ahead from CALCE single-cell cycling traces. The held-out CALCE test report records MAE 0.952 degrees Celsius across 8,437 samples. This does not establish performance on a four-cell pack, and the estimate is advisory.",
    "Judge cues: Accuracy is unknown until calibrated against reference instruments. The REST endpoint is ready, while the ESP32 sender is pending. Hardware protection remains authoritative.",
    "Sources: docs/ARCHITECTURE.md; docs/API.md; backend/app/schemas/telemetry.py; backend/app/api/telemetry.py; backend/app/services/risk_service.py; backend/app/services/mock_telemetry_service.py; ml/models/metrics.json."
  ]);
}

// Slide 3: Real-life application
{
  const s=p.slides.add(); s.background.fill=C.bg; header(s,"Real-life application","03");
  text(s,"REAL-WORLD APPLICATION & SCALABILITY",60,68,1110,48,{size:36,bold:true});
  text(s,"Potential contexts after hardware integration and measurement validation",62,120,1080,28,{size:18,color:C.muted});
  await image(s,"application-concepts.png","Concept scenes for electric mobility, stationary storage and industrial battery systems",60,162,568,378);
  text(s,"POTENTIAL USE CONTEXTS / CONCEPT ART",62,546,565,20,{size:12,bold:true,color:C.quiet,align:"center"});
  text(s,"APPLICATION AREAS",667,159,400,22,{size:14,bold:true,color:C.cyan});
  const uses=[
    ["EV AND ELECTRIC MOBILITY","Review pack conditions during testing and maintenance."],
    ["STATIONARY STORAGE","Follow trends in storage and backup-power systems."],
    ["INDUSTRIAL BATTERY BANKS","Support bench checks and maintenance workflows."]
  ];
  let uy=194;
  for(const [label,body] of uses) {
    box(s,667,uy,8,50,C.cyan);
    text(s,label,692,uy,515,20,{size:14,bold:true});
    text(s,body,692,uy+24,515,34,{size:15,color:C.muted});
    uy+=68;
  }
  box(s,667,402,548,145,C.panel,C.line,14);
  text(s,"CURRENT SOFTWARE CAPABILITIES",685,418,500,20,{size:13,bold:true,color:C.green});
  text(s,"One view for voltage, current, reported SOC and four temperature channels. Stored history and configured risk alerts support review. Device IDs support per-device API queries. More sensor channels require schema changes.",685,449,510,84,{size:15});
  text(s,"Deployment needs sensor compatibility checks, calibration, reliable networking, threshold configuration and a safety review.",667,558,548,43,{size:14,color:C.amber});
  const flow=[
    [80,"MONITOR","Validated measurements",C.blue],
    [460,"ANALYSE","History and configured rules",C.cyan],
    [840,"INFORM","Dashboard and stored alerts",C.green]
  ];
  for(const [x,label,sub,color] of flow) {
    box(s,x,619,310,50,"#102231",color,12);
    text(s,label,x+15,627,115,17,{size:13,bold:true,color});
    text(s,sub,x+15,647,280,16,{size:13});
  }
  arrow(s,400,638,C.cyan,28); arrow(s,780,638,C.cyan,28);
  text(s,"Use cases are proposed. No field deployment is demonstrated.",62,682,1150,18,{size:12,color:C.quiet,align:"center"});
  notes(s,[
    "Timing: 90 seconds.",
    "Battery monitoring can be useful in electric mobility test settings, stationary storage and backup-power systems, and industrial battery-bank maintenance. These are potential applications for this architecture, not deployments completed by Tarang.",
    "The current software presents telemetry in one dashboard, stores history and records configured risk alerts. Operators could use those records to review an abnormal reading and trace whether it followed a load or temperature change. The system does not establish that an incident was prevented or that safety improved.",
    "The API includes a device identifier and per-device query paths, which gives a starting point for monitoring more than one unit. The current telemetry contract has four fixed temperature channels. Adding modules, sensor types or additional channels would require schema and interface changes. Database migration and operational load testing would also be needed before expanding beyond the prototype.",
    "Before use outside a lab, the team needs to choose sensors compatible with the pack, calibrate them, verify wiring and controller behavior, test network loss and stale readings, and set thresholds from cell specifications. The 55 degree demo threshold must not be treated as a deployment limit.",
    "Judge cue: EV, storage or grid use is a target context after integration, calibration and safety review. There is no field test or customer deployment in the repository.",
    "Sources: docs/ARCHITECTURE.md; docs/API.md; hardware/README.md; frontend2/app.js; backend/app/schemas/telemetry.py."
  ]);
}

// Slide 4: Conclusion and next steps
{
  const s=p.slides.add(); s.background.fill=C.bg; header(s,"Conclusion","04");
  text(s,"FROM SOFTWARE FOUNDATION TO A VALIDATED BMS",60,68,1150,48,{size:35,bold:true});
  text(s,"A practical validation sequence for the next engineering milestone",62,120,1080,27,{size:18,color:C.muted});
  const steps=[
    ["01","Integrate physical sensors and ESP32"],
    ["02","Compare readings with reference instruments"],
    ["03","Verify telemetry delivery and latency"],
    ["04","Test fault logic with controlled inputs"],
    ["05","Review reliability and safety before deployment"]
  ];
  const sx=60,sw=218,sg=18;
  steps.forEach(([n,label],i)=>{
    const x=sx+i*(sw+sg);
    box(s,x,166,sw,176,"#102230","#294353",14);
    box(s,x+17,183,38,38,"#332819",C.amber,19);
    text(s,n,x+17,192,38,19,{size:14,bold:true,color:C.amber,align:"center"});
    text(s,label,x+17,237,sw-34,70,{size:17,bold:true});
    text(s,"NEXT MILESTONE",x+17,316,sw-34,15,{size:11,bold:true,color:C.amber});
    if(i<steps.length-1)arrow(s,x+sw+1,246,C.cyan,15);
  });
  text(s,"PROPOSED VALIDATION METRICS / NO RESULTS RECORDED",60,373,730,22,{size:14,bold:true,color:C.cyan});
  const metrics=[
    ["Voltage measurement error",60,414],["Current measurement error",450,414],["Temperature measurement error",840,414],
    ["End-to-end telemetry latency",60,466],["Successful data-delivery rate",450,466],["Fault-detection correctness",840,466]
  ];
  for(const [label,x,y] of metrics) {
    box(s,x,y,365,38,"#0D1C29","#223B4C",10);
    box(s,x+13,y+13,8,8,C.amber,"none",4);
    text(s,label,x+34,y+10,318,20,{size:15});
  }
  box(s,60,533,1160,121,"#0E202D","#244052",15);
  text(s,"“Our vision is to connect reliable battery measurements with a clear, scalable and thoroughly validated monitoring experience.”",86,554,1085,63,{size:23,bold:true,align:"center",valign:"middle"});
  text(s,"TARANG",60,671,200,20,{size:14,bold:true,color:C.cyan});
  text(s,"Software demo complete / physical integration and validation remain",450,671,770,20,{size:13,color:C.muted,align:"right"});
  notes(s,[
    "Timing: 60 seconds.",
    "The next milestone is physical integration, followed by calibration against appropriate reference instruments. The team should record voltage, current and temperature error rather than assume sensor accuracy from a part datasheet. It should also measure how long a sample takes to reach the API and dashboard, and how often delivery succeeds under normal and degraded network conditions.",
    "Fault tests should use controlled inputs around thresholds agreed from actual cell and pack specifications. The current threshold in the demo configuration is not a verified trip point. The team should test stale or missing samples, out-of-range values, and alert clearing behavior before connecting any real actuator.",
    "The six validation measures on the slide are proposed. No values have been collected yet. Reliability and safety review must precede any field deployment, with the physical BMS retaining protection authority.",
    "Our vision is to connect reliable battery measurements with a clear, scalable and thoroughly validated monitoring experience. We are Tarang.",
    "Judge cue: Do not give accuracy, latency, delivery-rate or detection numbers until controlled tests document the method and reference equipment.",
    "Sources: hardware/README.md; docs/ARCHITECTURE.md; docs/API.md; backend/app/core/config.py; backend/app/services/risk_service.py."
  ]);
}

const candidatePath=path.join(BUILD,"candidate.pptx");
await (await PresentationFile.exportPptx(p)).save(candidatePath);
for(const [i,s] of p.slides.items.entries()) {
  const png=await p.export({slide:s,format:"png",scale:1.4});
  await fs.writeFile(path.join(BUILD,"slide-"+String(i+1).padStart(2,"0")+".png"),new Uint8Array(await png.arrayBuffer()));
  const layout=await s.export({format:"layout"});
  await fs.writeFile(path.join(BUILD,"slide-"+String(i+1).padStart(2,"0")+".layout.json"),await layout.text());
}
const inspection=await p.inspect({kind:"slide,textbox,image,notes,layout",maxChars:24000});
await fs.writeFile(path.join(BUILD,"deck-inspection.ndjson"),inspection.ndjson,"utf8");

const finalPath=path.join(OUTPUT,"Tarang_Smart_BMS_Hackathon.pptx");
const receiptPath=path.join(BUILD,"finalizer","validation-v2.json");
await fs.mkdir(path.dirname(receiptPath),{recursive:true});
const requirements={explicitTotalSlideCount:4,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[]};
const result=await finalizePresentation({
  ...requirements,workspaceDir:PROJECT,candidatePath,finalPath,
  pythonExecutable:"C:\\Users\\ayush\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
  integrityValidatorPath:path.join(SKILL_DIR,"container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath:path.join(SKILL_DIR,"container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs:["--expected-slide-size-emu","12192000,6858000","--validate-heading-fit"],
  fontPolicy:{basis:"design",families:[FONT]},
  verifyArtifactToolImport:true,
  receiptPath
});
console.log(JSON.stringify({font:FONT,candidatePath,finalPath,result}));
