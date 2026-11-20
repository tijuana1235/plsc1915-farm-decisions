/* PLSC1915 daily farm model. Documented rules and classroom assumptions are
   separated below and displayed in both apps. This is not a game emulator. */
'use strict';
const FarmSimulation = (() => {
 const VERSION='3.0',VERIFIED='2026-11-19',CAPITAL_VERIFIED='2026-11-20';
 const SOURCES={
  clock:'https://stardewvalleywiki.com/Day_Cycle', speed:'https://stardewvalleywiki.com/Speed',
  hoe:'https://stardewvalleywiki.com/Hoes', can:'https://stardewvalleywiki.com/Watering_Cans',
  tools:'https://stardewvalleywiki.com/Tools', smith:'https://stardewvalleywiki.com/Blacksmith',
  sprinkler:'https://stardewvalleywiki.com/Sprinkler', quality:'https://stardewvalleywiki.com/Quality_Sprinkler',
  iridium:'https://stardewvalleywiki.com/Iridium_Sprinkler', nozzle:'https://stardewvalleywiki.com/Pressure_Nozzle',
  starfruit:'https://stardewvalleywiki.com/Starfruit', starseed:'https://stardewvalleywiki.com/Starfruit_Seeds',
  ancient:'https://stardewvalleywiki.com/Ancient_Fruit', ancientseed:'https://stardewvalleywiki.com/Ancient_Seeds',
  parsnip:'https://stardewvalleywiki.com/Parsnip', parseed:'https://stardewvalleywiki.com/Parsnip_Seeds',
  island:'https://stardewvalleywiki.com/Ginger_Island', keg:'https://stardewvalleywiki.com/Keg',
  farming:'https://stardewvalleywiki.com/Farming', energy:'https://stardewvalleywiki.com/Energy',
  shipping:'https://stardewvalleywiki.com/Shipping', controls:'https://stardewvalleywiki.com/Controls',
  copper:'https://stardewvalleywiki.com/Copper_Bar',iron:'https://stardewvalleywiki.com/Iron_Bar',
  gold:'https://stardewvalleywiki.com/Gold_Bar',iridiumbar:'https://stardewvalleywiki.com/Iridium_Bar',
  quartz:'https://stardewvalleywiki.com/Refined_Quartz',battery:'https://stardewvalleywiki.com/Battery_Pack',
  wood:'https://stardewvalleywiki.com/Wood',resin:'https://stardewvalleywiki.com/Oak_Resin',
  preserves:'https://stardewvalleywiki.com/Preserves_Jar',melon:'https://stardewvalleywiki.com/Melon',
  melonseed:'https://stardewvalleywiki.com/Melon_Seeds',stone:'https://stardewvalleywiki.com/Stone',coal:'https://stardewvalleywiki.com/Coal'
 };
 const TIERS=[
  {name:'Basic',area:1,capacity:40,water:1,cash:0,bars:0},
  {name:'Copper',area:3,capacity:55,water:2,cash:2000,bars:300},
  {name:'Steel',area:5,capacity:70,water:3,cash:5000,bars:600},
  {name:'Gold',area:9,capacity:85,water:4,cash:10000,bars:1250},
  {name:'Iridium',area:18,capacity:100,water:5,cash:25000,bars:5000}
 ];
 const IRRIGATION={none:{name:'Manual watering',coverage:0,value:0,level:0},basic:{name:'Sprinkler',coverage:4,value:180,level:2},quality:{name:'Quality sprinkler',coverage:8,value:420,level:6},iridium:{name:'Iridium sprinkler',coverage:24,value:1750,level:9},nozzle:{name:'Iridium + pressure nozzle',coverage:48,value:1750,level:9}};
 const CROPS={parsnip:{name:'Parsnip',grow:4,regrow:0,raw:35,wine:0,seedCash:20,seedValue:0},melon:{name:'Melon',grow:12,regrow:0,raw:250,wine:750,seedCash:80,seedValue:0},starfruit:{name:'Starfruit',grow:13,regrow:0,raw:750,wine:2250,seedCash:400,seedValue:0},ancient:{name:'Ancient Fruit',grow:28,regrow:7,raw:550,wine:1650,seedCash:0,seedValue:30}};
 const PROCESSORS=Object.freeze({keg:{name:'Keg',level:8,value:390},jar:{name:'Preserves jar',level:4,value:300}});
 function processingRule(crop,type){
  const c=CROPS[crop];
  if(type==='jar')return{name:c.wine?'Jelly':'Pickles',price:2*c.raw+50,minutes:4000};
  return{name:c.wine?'Wine':'Juice',price:c.wine||Math.floor(c.raw*2.25),minutes:c.wine?10000:6000};
 }
 // All entries here, except day length / clock conversion, are explicit classroom assumptions.
 const TIMING=Object.freeze({day:960,realSecondsPerGameMinute:.7,houseTiles:40,pondTiles:8,shedTiles:12,tilesPerRealSecond:4,
  hoeSeconds:[1,1.5,2,2.5,3],waterSeconds:[1.2,1.7,2.2,2.7,3.2],seedSeconds:.35,harvestSeconds:.6,
  loadSeconds:.4,collectSeconds:.4,refillSeconds:1,placeSeconds:.8,shippingMinutes:2,smithMinutes:240});
 const cats=['Travel','Tilling','Planting','Watering','Harvesting','Keg loading','Wine collection','Installation','Errand / waiting','Shipping','Jar loading','Preserves collection'];
 const minutes=s=>s/TIMING.realSecondsPerGameMinute;
 const walk=tiles=>minutes(tiles/TIMING.tilesPerRealSecond);
 const emptyWork=()=>Object.fromEntries(cats.map(k=>[k,0]));
 function sumUpgrade(from,to){let cash=0,materials=0,steps=0;for(let i=from+1;i<=to;i++){cash+=TIERS[i].cash;materials+=TIERS[i].bars;steps++}return{cash,materials,steps}}
 function kitCost(config,kit){
  const hoe=sumUpgrade(config.currentHoe,kit.hoe),can=sumUpgrade(config.currentCan,kit.can),ir=IRRIGATION[kit.irrigation];
  const covered=ir.coverage?Math.min(config.plots,kit.sprinklerCount===undefined?Math.ceil(config.plots*kit.coverage/100):kit.sprinklerCount*ir.coverage):0;
  const sprinklers=ir.coverage?(kit.sprinklerCount??Math.ceil(covered/ir.coverage)):0;
  const nozzlePacks=kit.irrigation==='nozzle'?Math.ceil(sprinklers/4):0;
  return {cash:hoe.cash+can.cash,materials:hoe.materials+can.materials+sprinklers*ir.value+kit.newKegs*390+(kit.newJars||0)*300,
   sprinklers,covered,nozzlePacks,qiGems:nozzlePacks*20,steps:hoe.steps+can.steps,leadDays:2*(hoe.steps+can.steps)};
 }
 function validate(config,kit){
  const errors=[];
  if(!['island','early'].includes(config.mode))errors.push('Choose a valid scenario.');
  for(const k of ['plots','days','gold','existingKegs','currentHoe','currentCan','farming','ancientShare'])if(!Number.isInteger(config[k])||config[k]<0)errors.push('Invalid whole-number input: '+k);
  if(config.plots>2000||config.days>112||config.days<1||config.existingKegs>500||config.currentHoe>4||config.currentCan>4||config.farming>10||config.ancientShare>100)errors.push('Input outside supported bounds.');
  if(![0,1,2,3,4].includes(kit.hoe)||kit.hoe<config.currentHoe||![0,1,2,3,4].includes(kit.can)||kit.can<config.currentCan)errors.push('New tools cannot be below current tools.');
  if(!IRRIGATION[kit.irrigation]||!Number.isInteger(kit.coverage)||kit.coverage<0||kit.coverage>100||!Number.isInteger(kit.newKegs)||kit.newKegs<0||kit.newKegs>500)errors.push('Invalid equipment plan.');
  if(!['starter','food'].includes(config.energy))errors.push('Choose an energy assumption.');
  if(!['none','tiller','artisan'].includes(config.profession))errors.push('Choose a profession.');
  if(kit.newJars!==undefined&&(!Number.isInteger(kit.newJars)||kit.newJars<0||kit.newJars>200))errors.push('Choose between 0 and 200 preserves jars.');
  if(kit.sprinklerCount!==undefined&&(!Number.isInteger(kit.sprinklerCount)||kit.sprinklerCount<0||kit.sprinklerCount>500))errors.push('Choose between 0 and 500 sprinklers.');
  if(config.mode==='early'&&(![28,35].includes(config.days)||config.existingKegs!==0||!['none','basic'].includes(kit.irrigation)))errors.push('The home-farm scenario covers one 28-day growing season, optionally followed by seven processing days, starts without processing machines, and uses basic sprinklers.');
  if(config.mode==='early'&&!['parsnip','melon'].includes(config.earlyCrop||'parsnip'))errors.push('Choose Spring parsnips or Summer melons.');
  if(config.recipeAccess!==undefined&&!['level','assumed'].includes(config.recipeAccess))errors.push('Choose a valid recipe-access rule.');
  if(config.holdCrops!==undefined&&typeof config.holdCrops!=='boolean')errors.push('Choose a valid crop-selling policy.');
  if(config.capitalBudget!==undefined&&(!Number.isInteger(config.capitalBudget)||config.capitalBudget<0))errors.push('Enter a nonnegative whole-number capital budget.');
  if(config.mode==='early'&&config.recipeAccess!=='assumed'){
   if(kit.newKegs&&config.farming<8)errors.push('Keg crafting needs Farming 8. Change the farm stage or explicitly assume access.');
   if(kit.newJars&&config.farming<4)errors.push('Preserves jar crafting needs Farming 4. Change the farm stage or explicitly assume access.');
   if(kit.irrigation==='basic'&&(kit.sprinklerCount??kit.coverage)>0&&config.farming<2)errors.push('Basic sprinklers need Farming 2. Change the farm stage or explicitly assume access.');
  }
  if(config.mode==='early'&&((kit.hoe-config.currentHoe)+(kit.can-config.currentCan)>1))errors.push('Compare one next-tier tool upgrade per early-game run.');
  if(errors.length)return errors;
  if(kitCost(config,kit).cash>config.gold)errors.push('Not enough starting gold for this tool upgrade.');
  if(config.capitalBudget!==undefined){const c=kitCost(config,kit);if(c.cash+c.materials>config.capitalBudget)errors.push('This plan exceeds the capital budget (tool fees plus material sale value).');}
  return errors;
 }
 function chargePlan(n,tier,kind){
  const work=emptyWork();let energy=0,actions=[];
  while(n>0){let level=tier;while(level>0&&TIERS[level-1].area>=n)level--;let take=Math.min(n,TIERS[level].area);
   work[kind==='hoe'?'Tilling':'Watering']+=minutes((kind==='hoe'?TIMING.hoeSeconds:TIMING.waterSeconds)[level]);
   work.Travel+=walk(take);actions.push({level,take});n-=take;
  }
  return {work,actions,energy};
 }
 function simulate(config,kit){
  const errors=validate(config,kit);if(errors.length)return{valid:false,errors};
  const cost=kitCost(config,kit),energyLimit=config.energy==='food'?Infinity:270;
  const plots=Array.from({length:config.plots},(_,i)=>({crop:config.mode==='early'?(config.earlyCrop||'parsnip'):(Math.floor((i+1)*config.ancientShare/100)>Math.floor(i*config.ancientShare/100)?'ancient':'starfruit'),tilled:false,planted:false,remaining:0,wet:false,ever:false}));
  const kegs=Array.from({length:config.existingKegs},()=>({readyAt:null,crop:null,price:0}));
  const jars=[];
  let cash=config.gold-cost.cash,seedCash=0,seedValue=0,pending=0,receipts=0,canWater=TIERS[kit.can].capacity,installed=0,newKegsPlaced=0;
  const cropKeys=['parsnip','starfruit','ancient',...(config.mode==='early'&&config.earlyCrop==='melon'?['melon']:[])],counts=()=>Object.fromEntries(cropKeys.map(c=>[c,0]));
  let harvested=counts(),soldRaw=counts(),soldWine=counts(),soldPreserves=counts(),newJarsPlaced=0;
  const inventory=counts(),retainRaw=config.holdCrops&&(config.existingKegs+kit.newKegs+(kit.newJars||0)>0);
  const daily=[];let totalPlanted=0,missedWater=0,unharvestedDays=0,firstHarvest=null,capacityFirstDay=0,expiredCrops=0;
  for(let day=1;day<=config.days;day++){
   cash+=pending;receipts+=pending;const cashIn=pending;pending=0;
   if(config.mode==='early'&&day===29)for(const p of plots){if(p.planted){expiredCrops++;p.planted=false;p.remaining=0}}
   for(const p of plots){if(p.planted&&p.wet&&p.remaining>0)p.remaining--;p.wet=false}
   // Morning watering only reaches tiles already tilled, with equipment installed on an earlier day.
   for(let i=0;i<plots.length;i++)if(i<Math.min(cost.covered,installed*(IRRIGATION[kit.irrigation].coverage||0))&&plots[i].tilled)plots[i].wet=true;
   const work=emptyWork();work.Travel=walk(2*TIMING.houseTiles);work.Shipping=TIMING.shippingMinutes;
   if(config.mode==='early'&&cost.steps&&(day===1||day===3))work['Errand / waiting']+=TIMING.smithMinutes;
   let used=Object.values(work).reduce((a,b)=>a+b,0),energy=0,plantedToday=0,harvestToday=0,wineToday=0,loaded=0,preservesToday=0,jarsLoaded=0,refills=0,seedSpendToday=0,energyBlocked=false,timeBlocked=false,cashBlocked=false;
   const availableHoe=!(config.mode==='early'&&kit.hoe>config.currentHoe&&day<=2);
   const availableCan=!(config.mode==='early'&&kit.can>config.currentCan&&day<=2);
   // Return travel and shipping are reserved in the budget, but happen at day's end.
   const absolute=()=>1600*(day-1)+used-walk(TIMING.houseTiles)-TIMING.shippingMinutes;
   function commit(parts,en=0){
    const duration=Object.values(parts).reduce((a,b)=>a+b,0);
    if(used+duration>TIMING.day+1e-8){timeBlocked=true;return false}
    if(energy+en>energyLimit+1e-8){energyBlocked=true;return false}
    used+=duration;energy+=en;for(const [key,val]of Object.entries(parts))work[key]+=val;return true;
   }
   function watering(n){
    const c=chargePlan(n,kit.can,'water');let left=canWater,extra=0,en=0;
    for(const a of c.actions){if(left<=0){c.work.Travel+=walk(2*TIMING.pondTiles);c.work.Watering+=minutes(TIMING.refillSeconds);left=TIERS[kit.can].capacity;extra++}
     left=Math.max(0,left-TIERS[a.level].water);en+=Math.max(0,2+2*a.level-.1*config.farming)}
    return{work:c.work,water:left,refills:extra,energy:en};
   }
   function merge(a,b){for(const k of cats)a[k]+=(b[k]||0);return a}
   // Placement labor is charged; materials were committed upfront. Installation may take multiple days.
   while(installed<cost.sprinklers){if(!commit({Installation:minutes(TIMING.placeSeconds),Travel:walk(1)}))break;installed++}
   while(newKegsPlaced<kit.newKegs){if(!commit({Installation:minutes(TIMING.placeSeconds),Travel:walk(1)}))break;kegs.push({readyAt:null,crop:null,price:0});newKegsPlaced++}
   while(newJarsPlaced<(kit.newJars||0)){if(!commit({Installation:minutes(TIMING.placeSeconds),Travel:walk(1)}))break;jars.push({readyAt:null,crop:null,price:0});newJarsPlaced++}
   function serviceMachines(machines,late,type){
    if(!machines.length)return;
    const canCollect=machines.some(k=>k.readyAt!==null&&(k.readyAt<=absolute()||late&&k.readyAt<=1600*(day-1)+TIMING.day-10));
    const canLoad=machines.some(k=>k.readyAt===null)&&Object.values(inventory).some(n=>n>0);
    if(!canCollect&&!canLoad)return;
    if(!commit({Travel:walk(2*TIMING.shedTiles)}))return;
    const sorted=[...machines].sort((a,b)=>(a.readyAt??Infinity)-(b.readyAt??Infinity));
    for(const k of sorted){
     if(k.readyAt!==null&&k.readyAt>absolute()&&late){
      const wait=k.readyAt-absolute();const tail=minutes(TIMING.collectSeconds)+walk(1);
      if(used+wait+tail<=TIMING.day&&wait>=0)commit({'Errand / waiting':wait});
     }
     if(k.readyAt!==null&&k.readyAt<=absolute()+1e-8){
      if(!commit({[type==='keg'?'Wine collection':'Preserves collection']:minutes(TIMING.collectSeconds),Travel:walk(1)}))continue;
      pending+=k.price;if(type==='keg'){soldWine[k.crop]++;wineToday++}else{soldPreserves[k.crop]++;preservesToday++}k.readyAt=null;k.crop=null;
     }
     if(k.readyAt===null){const crop=['starfruit','ancient','melon','parsnip'].find(c=>inventory[c]>0);
      if(crop&&commit({[type==='keg'?'Keg loading':'Jar loading']:minutes(TIMING.loadSeconds),Travel:walk(1)})){inventory[crop]--;if(type==='keg')loaded++;else jarsLoaded++;const product=processingRule(crop,type);k.crop=crop;k.price=Math.floor(product.price*(config.profession==='artisan'?1.4:1)+1e-8);k.readyAt=absolute()+product.minutes}
     }
    }
   }
   // Ready wine is collected first. Growing crops and harvests then precede expansion.
   serviceMachines(kegs,false,'keg');serviceMachines(jars,false,'jar');
   for(const p of plots){if(!p.planted||p.remaining!==0)continue;
    if(!commit({Harvesting:minutes(TIMING.harvestSeconds),Travel:walk(1)}))continue;
    inventory[p.crop]++;harvested[p.crop]++;harvestToday++;if(firstHarvest===null)firstHarvest=day;
    if(CROPS[p.crop].regrow)p.remaining=CROPS[p.crop].regrow;else{p.planted=false;p.remaining=0}
   }
   const dry=plots.filter(p=>p.planted&&p.remaining>0&&!p.wet);
   if(availableCan){let cursor=0;while(cursor<dry.length){let success=false;
    for(let n=Math.min(TIERS[kit.can].area,dry.length-cursor);n>=1;n--){const w=watering(n);if(commit(w.work,w.energy)){for(let j=0;j<n;j++)dry[cursor+j].wet=true;cursor+=n;canWater=w.water;refills+=w.refills;success=true;break}}
    if(!success)break;
   }}
   // Replant only when a nominal next harvest can fit; initial planting is always attempted.
   const growingCutoff=config.mode==='early'?28:config.days;
   const open=day>growingCutoff?[]:plots.filter(p=>!p.planted&&(!p.ever||day+CROPS[p.crop].grow<=growingCutoff));
   let at=0;
   while(at<open.length){let success=false;
    for(let n=Math.min(18,open.length-at);n>=1;n--){
     const batch=open.slice(at,at+n),untilled=batch.filter(p=>!p.tilled).length,dryN=batch.filter(p=>!p.wet).length;
     if(untilled&&!availableHoe||dryN&&!availableCan)continue;
     const money=batch.reduce((s,p)=>s+CROPS[p.crop].seedCash,0);if(money>cash+1e-8){cashBlocked=true;continue}
     const parts=emptyWork();let en=0;
     if(untilled){const h=chargePlan(untilled,kit.hoe,'hoe');merge(parts,h.work);en+=h.actions.length*Math.max(0,2-.1*config.farming)}
     parts.Planting+=minutes(n*TIMING.seedSeconds);parts.Travel+=walk(n);
     const w=watering(dryN);merge(parts,w.work);en+=w.energy;
     if(!commit(parts,en))continue;
     cash-=money;seedCash+=money;seedSpendToday+=money;seedValue+=batch.reduce((s,p)=>s+CROPS[p.crop].seedValue,0);
     canWater=w.water;refills+=w.refills;
     for(const p of batch){p.tilled=true;p.planted=true;p.wet=true;p.remaining=CROPS[p.crop].grow;p.ever=true}
     at+=n;totalPlanted+=n;plantedToday+=n;success=true;break;
    }
    if(!success){
     // Cash-poor Starfruit planting must not block already-owned Ancient Seeds later in the list.
     if(CROPS[open[at].crop].seedCash>cash){at++;continue}
     break;
    }
   }
   // While a can is at the blacksmith, prepare ground with an available hoe.
   if(!availableCan&&availableHoe){const prep=plots.filter(p=>!p.tilled);let pos=0;while(pos<prep.length){const n=Math.min(TIERS[kit.hoe].area,prep.length-pos),h=chargePlan(n,kit.hoe,'hoe');if(!commit(h.work,h.actions.length*Math.max(0,2-.1*config.farming)))break;for(let j=0;j<n;j++)prep[pos+j].tilled=true;pos+=n}}
   serviceMachines(kegs,true,'keg');serviceMachines(jars,true,'jar');
   // Same-day overflow is sold raw, not silently treated as processed output.
   if(!retainRaw)for(const crop of Object.keys(inventory)){const raw=Math.floor(CROPS[crop].raw*(config.profession==='none'?1:1.1)+1e-8);pending+=inventory[crop]*raw;soldRaw[crop]+=inventory[crop];inventory[crop]=0}
   const missed=plots.filter(p=>p.planted&&p.remaining>0&&!p.wet).length;
   const waitingHarvest=plots.filter(p=>p.planted&&p.remaining===0).length;
   missedWater+=missed;unharvestedDays+=waitingHarvest;
   if(day===1)capacityFirstDay=plantedToday;
   daily.push({day,minutes:used,energy,work,planted:plantedToday,harvested:harvestToday,wineCollected:wineToday,loaded,preservesCollected:preservesToday,jarsLoaded,rawStored:Object.values(inventory).reduce((a,b)=>a+b,0),refills,missedWater:missed,waitingHarvest,
    cashIn,seedSpend:seedSpendToday,cash,receipts,seedCash,seedValue,net:cash-config.gold-cost.materials-seedValue,pending,energyBlocked,timeBlocked,cashBlocked,
    living:plots.filter(p=>p.planted).length});
  }
  const wineInKegs=kegs.filter(k=>k.readyAt!==null),preservesInJars=jars.filter(k=>k.readyAt!==null),peak=daily.reduce((a,b)=>b.minutes>a.minutes?b:a),peakEnergy=Math.max(...daily.map(d=>d.energy));
  const plantedPlots=plots.filter(p=>p.ever).length;
  return{valid:true,config:{...config},kit:{...kit},cost,daily,cash,receipts,seedCash,seedValue,net:cash-config.gold-cost.materials-seedValue,
   harvested,soldRaw,soldWine,soldPreserves,totalPlanted,plantedPlots,capacityFirstDay,missedWater,unharvestedDays,firstHarvest,peak,peakEnergy,
   pendingSales:pending,wineInKegs:wineInKegs.length,wineInventoryValue:wineInKegs.reduce((a,k)=>a+k.price,0),
   preservesInJars:preservesInJars.length,preservesInventoryValue:preservesInJars.reduce((a,k)=>a+k.price,0),rawStored:{...inventory},rawInventoryValue:Object.entries(inventory).reduce((s,[c,n])=>s+n*Math.floor(CROPS[c].raw*(config.profession==='none'?1:1.1)+1e-8),0),totalMinutes:daily.reduce((s,d)=>s+d.minutes,0),
   unplanted:config.plots-plantedPlots,living:plots.filter(p=>p.planted).length,expiredCrops,installed,newKegsPlaced,newJarsPlaced,
   unusedAncientSeeds:plots.filter(p=>p.crop==='ancient'&&!p.ever).length};
 }
 function baselineKit(c){return{hoe:c.currentHoe,can:c.currentCan,irrigation:'none',coverage:0,newKegs:0}}
 function compare(config,kit){
  const baseline=simulate(config,baselineKit(config)),plan=simulate(config,kit);
  if(!baseline.valid||!plan.valid)return{valid:false,errors:[...(baseline.errors||[]),...(plan.errors||[])]};
  const investment=plan.cost.cash+plan.cost.materials,delta=plan.net-baseline.net;
  // A brief crossing caused by deferred seed spending is not reported as recovery.
  // Report the start of the final nonnegative interval, conditional on this horizon.
  let recovery=null;
  if(investment)for(let i=plan.daily.length-1;i>=0;i--){if(plan.daily[i].net-baseline.daily[i].net < -1e-8)break;recovery=plan.daily[i].day}
  return{valid:true,baseline,plan,investment,delta,roi:investment?delta/investment:null,payback:recovery,
   goldOnly:plan.cost.qiGems===0,curve:plan.daily.map((d,i)=>({day:d.day,delta:d.net-baseline.daily[i].net}))};
 }
 function comparePlans(config,kitA,kitB){
  const errors=[...validate(config,kitA).map(s=>'Plan A: '+s),...validate(config,kitB).map(s=>'Plan B: '+s)];
  if(errors.length)return{valid:false,errors};
  const a=compare(config,kitA),b=compare(config,kitB);
  if(!a.valid||!b.valid)return{valid:false,errors:[...(a.errors||[]),...(b.errors||[])]};
  const capitalDifference=a.investment-b.investment,delta=a.plan.net-b.plan.net;
  const higher=capitalDifference>0?'A':capitalDifference<0?'B':null;
  return{valid:true,config:{...config},a,b,baseline:a.baseline,delta,capitalDifference,
   incremental:higher?{higher,extraCapital:Math.abs(capitalDifference),addedNet:higher==='A'?delta:-delta,roi:(higher==='A'?delta:-delta)/Math.abs(capitalDifference)}:null,
   curve:a.plan.daily.map((d,i)=>({day:d.day,a:d.net-a.baseline.daily[i].net,b:b.plan.daily[i].net-b.baseline.daily[i].net}))};
 }
 function plantingCapacity(config,kit){
  // A distinct planting-only day, with no harvest/keg backlog, unlimited seed money,
  // all tools ready, and installation already complete. Upper bound, not a schedule promise.
  const c={...config,mode:'island',days:1,gold:100000000,plots:2000,existingKegs:0,currentHoe:kit.hoe,currentCan:kit.can,ancientShare:0};
  const k={hoe:kit.hoe,can:kit.can,irrigation:'none',coverage:0,newKegs:0};
  const r=simulate(c,k);return r.capacityFirstDay;
 }
 return Object.freeze({VERSION,VERIFIED,CAPITAL_VERIFIED,SOURCES,TIERS,IRRIGATION,CROPS,PROCESSORS,processingRule,TIMING,cats,minutes,walk,kitCost,validate,simulate,baselineKit,compare,comparePlans,plantingCapacity});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FarmSimulation;
