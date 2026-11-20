'use strict';
const M=FarmSimulation,$=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
const money=n=>fmt(n)+'g',signed=n=>(n>0?'+':'')+money(n);
const percent=n=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:1}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const total=o=>Object.values(o).reduce((a,b)=>a+b,0);
let snapshot=null,busy=false,inputRevision=0;
const choices=[
 ['none','Keep equipment / save capital'],['can','Next watering-can upgrade'],
 ['hoe','Next hoe upgrade'],['sprinklers','Basic sprinklers'],
 ['jars','Preserves jars (Farming 4)'],['kegs','Kegs (Farming 8)'],
 ['mixed','Build a mixed plan']
];
function field(id,label,control){return `<div class="field"><label for="${id}">${label}</label>${control}</div>`}
function select(id,values,value){return `<select id="${id}">${values.map(([v,label])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('')}</select>`}
function number(id,label,value,min,max,step=1){return field(id,label,`<input id="${id}" type="number" required min="${min}" max="${max}" step="${step}" value="${value}">`)}
const tiers=M.TIERS.map((x,i)=>[i,x.name]);
function planControls(id,choice){
 return `<fieldset class="capital-plan"><legend>Plan ${id.toUpperCase()}</legend>
  ${field(id+'-choice','Investment',select(id+'-choice',choices,choice))}
  <div id="${id}-tool-group" hidden>${field(id+'-tool','Tool to upgrade',select(id+'-tool',[['none','Keep both tools'],['can','Next watering-can upgrade'],['hoe','Next hoe upgrade']],'none'))}</div>
  <div id="${id}-sprinkler-group" hidden>${number(id+'-sprinklers','Basic sprinklers to craft',12,0,150)}</div>
  <div id="${id}-keg-group" hidden>${number(id+'-kegs','Kegs to craft',4,0,200)}</div>
  <div id="${id}-jar-group" hidden>${number(id+'-jars','Preserves jars to craft',4,0,200)}</div>
  <div id="${id}-cost" class="cost-box" aria-live="polite"></div>
 </fieldset>`;
}
$('scenario-context').textContent='Compare two capital plans for the same home farm. Both plans get the same crop, starting gold, materials access, and workday. Keeping equipment remains a third reference. The 10 p.m. bedtime is a classroom rule; the game day can run until 2 a.m.';
$('controls').innerHTML=`
 <div class="capital-farm-grid">
  ${field('crop','Growing season and crop',select('crop',[['parsnip','Spring: parsnips'],['melon','Summer: melons']],'parsnip'))}
  ${number('plots','Target crop plots',120,20,600,10)}
  ${number('gold','Starting gold for fees and seeds',5000,0,10000000)}
  ${number('capitalBudget','Capital budget (g of cash + materials)',5000,0,10000000)}
  ${field('farming','Current Farming level',select('farming',Array.from({length:11},(_,n)=>[n,n+(n===2?' · basic sprinklers':n===4?' · preserves jars':n===8?' · kegs':'')]),2))}
  ${field('days','Count sales through',select('days',[[28,'Day 28: end of the season'],[35,'Day 35: finish processing']],28))}
 </div>
 <p class="small muted">The capital budget limits tool fees plus the sale value of materials committed to equipment. Materials are already owned; their value is an opportunity cost, not a shop price. Only fees and seed purchases reduce starting gold. Growing stops after day 28; days 29–35 allow processing and payment, with no new planting.</p>
 <details><summary>Current tools, recipe access, and selling policy</summary><div class="capital-farm-grid">
  ${field('currentHoe','Current hoe',select('currentHoe',tiers,0))}
  ${field('currentCan','Current watering can',select('currentCan',tiers,0))}
  ${field('energy','Energy assumption',select('energy',[['food','Food supplied; study time and money'],['starter','270 energy; no extra food']],'food'))}
  ${field('recipeAccess','Recipe access',select('recipeAccess',[['level','Use normal Farming unlocks'],['assumed','Assume all recipes available (classroom)']],'level'))}
  ${field('salesPolicy','Harvests that cannot be processed today',select('salesPolicy',[['sell','Sell overflow raw that evening'],['store','Store for later processing']],'sell'))}
 </div><p class="small muted">Farming level stays fixed during a run. The access override changes recipe availability only; it does not increase proficiency. Food costs, eating time, clearing, and resource gathering are omitted. If a plan has no processing machines, its harvest is always sold raw. Mixed processing plans fill kegs first, then jars.</p></details>
 <div id="recipe-note" class="warn" hidden></div>
 <div class="divider"><span class="eyebrow">The investments</span><h3>What are your two alternatives?</h3>
 <p class="small muted">Choose any pair, or build a mix with one tool upgrade and any number of the listed machines. Compare each plan with the same capital budget.</p>
 <div class="capital-plan-grid">${planControls('a','can')}${planControls('b','sprinklers')}</div></div>`;
function readConfig(){
 return{mode:'early',earlyCrop:$('crop').value,plots:Number($('plots').value),days:Number($('days').value),
  gold:Number($('gold').value),capitalBudget:Number($('capitalBudget').value),existingKegs:0,
  currentHoe:Number($('currentHoe').value),currentCan:Number($('currentCan').value),
  farming:Number($('farming').value),ancientShare:0,energy:$('energy').value,profession:'none',
  recipeAccess:$('recipeAccess').value,holdCrops:$('salesPolicy').value==='store'};
}
function readPlan(id,config){
 const choice=$(id+'-choice').value,tool=choice==='mixed'?$(id+'-tool').value:choice;
 const sprinklers=['sprinklers','mixed'].includes(choice)?Number($(id+'-sprinklers').value):0;
 const kegs=['kegs','mixed'].includes(choice)?Number($(id+'-kegs').value):0;
 const jars=['jars','mixed'].includes(choice)?Number($(id+'-jars').value):0;
 return{...M.baselineKit(config),hoe:tool==='hoe'?config.currentHoe+1:config.currentHoe,
  can:tool==='can'?config.currentCan+1:config.currentCan,irrigation:sprinklers?'basic':'none',
  coverage:0,sprinklerCount:sprinklers,newKegs:kegs,newJars:jars};
}
function describe(kit,config){
 const parts=[];
 if(kit.hoe>config.currentHoe)parts.push(M.TIERS[kit.hoe]?.name+' hoe');
 if(kit.can>config.currentCan)parts.push(M.TIERS[kit.can]?.name+' watering can');
 if(kit.sprinklerCount)parts.push(kit.sprinklerCount+' basic sprinklers');
 if(kit.newKegs)parts.push(kit.newKegs+' kegs');
 if(kit.newJars)parts.push(kit.newJars+' preserves jars');
 return parts.join(' + ')||'Keep equipment / save capital';
}
function updateControls(){
 const config=readConfig();
 $('recipe-note').hidden=config.recipeAccess!=='assumed';
 $('recipe-note').textContent='Access override is on: this comparison assumes every listed recipe is available. Unlocking it and gathering its materials are outside the costs and schedule.';
 for(const id of ['a','b']){
  const choice=$(id+'-choice').value;
  for(const [group,active] of [['tool',choice==='mixed'],['sprinkler',['mixed','sprinklers'].includes(choice)],['keg',['mixed','kegs'].includes(choice)],['jar',['mixed','jars'].includes(choice)]]){
   $(id+'-'+group+'-group').hidden=!active;
   for(const control of $(id+'-'+group+'-group').querySelectorAll('input,select'))control.disabled=!active;
  }
  const kit=readPlan(id,config);
  if(kit.hoe>4||kit.can>4){$(id+'-cost').textContent='This tool is already Iridium. Choose another investment.';continue}
  const errors=M.validate(config,kit),cost=M.kitCost(config,kit),investment=cost.cash+cost.materials;
  $(id+'-cost').innerHTML=`<p>Capital committed<strong>${money(investment)}</strong></p><p>${money(cost.cash)} in cash fees + ${money(cost.materials)} in materials</p>
   <p>Cash left for initial seeds: <b>${money(config.gold-cost.cash)}</b><br>Uncommitted capital budget: <b>${money(config.capitalBudget-investment)}</b></p>
   ${cost.sprinklers?`<p>${cost.sprinklers} sprinklers cover up to ${cost.covered} of ${config.plots} crop plots.</p>`:''}
   ${cost.steps?'<p>Upgraded tool is unavailable on days 1–2; collect it on day 3. Blacksmith errands use time.</p>':''}
   ${kit.newKegs?`<p>Keg output: ${M.processingRule(config.earlyCrop,'keg').name.toLowerCase()}.</p>`:''}
   ${kit.newJars?`<p>Jar output: ${M.processingRule(config.earlyCrop,'jar').name.toLowerCase()}.</p>`:''}
   ${errors.length?`<p class="negative"><strong class="small">Cannot run this plan</strong>${errors.map(esc).join(' ')}</p>`:''}`;
 }
}
function dirty(){
 inputRevision++;snapshot=null;updateControls();
 $('results').hidden=true;$('reflection').hidden=true;$('empty').hidden=false;$('errors').hidden=true;
 $('status').textContent='Inputs changed. Predict and run the new comparison.';
 for(const input of document.querySelectorAll('[name=prediction]'))input.checked=false;
}
for(const el of $('controls').querySelectorAll('input,select'))el.addEventListener('input',dirty);
function showErrors(errors){$('errors').hidden=false;$('errors').textContent=errors.join(' ')}
function makeTablesAccessible(){
 for(const el of document.querySelectorAll('.table-wrap')){el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label',(el.querySelector('caption')?.textContent||'Data table')+'. Scroll horizontally if needed.')}
}
function warning(sim,label){
 const notes=[];
 if(sim.unplanted)notes.push(`${fmt(sim.unplanted)} target plots never get planted.`);
 if(sim.missedWater)notes.push(`${fmt(sim.missedWater)} unwatered crop-days delay growth.`);
 if(sim.daily.some(d=>d.energyBlocked))notes.push('The energy allowance prevents some attempted work.');
 if(sim.daily.some(d=>d.cashBlocked))notes.push('Seed cash constrains planting on at least one day.');
 if(sim.peakEnergy>270&&sim.config.energy==='food')notes.push(`Peak energy use is ${fmt(sim.peakEnergy)}. This plan depends on supplied food.`);
 if(total(sim.rawStored))notes.push(`${fmt(total(sim.rawStored))} harvested crops remain stored (${money(sim.rawInventoryValue)} at raw sale prices). They are not cash receipts.`);
 if(sim.wineInKegs||sim.preservesInJars)notes.push(`${sim.wineInKegs+sim.preservesInJars} products remain in machines at the cutoff.`);
 if(sim.pendingSales)notes.push(`${money(sim.pendingSales)} has shipped but will be paid the next morning.`);
 if(sim.expiredCrops)notes.push(`${sim.expiredCrops} crops reached the season boundary without being harvested and are lost.`);
 return notes.length?`<div class="warn"><strong>${label}</strong><ul>${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:'';
}
function comparisonTable(r){
 const sims=[r.baseline,r.a.plan,r.b.plan],stats=[null,r.a,r.b],cap=s=>s.cost.cash+s.cost.materials;
 const rows=[
  ['Capital committed',sims.map(s=>money(cap(s)))],
  ['Cash fees paid upfront',sims.map(s=>money(s.cost.cash))],
  ['Material opportunity cost',sims.map(s=>money(s.cost.materials))],
  ['Capital budget uncommitted',sims.map(s=>money(r.config.capitalBudget-cap(s)))],
  ['Cash left for initial seeds',sims.map(s=>money(r.config.gold-s.cost.cash))],
  ['Sale receipts received',sims.map(s=>money(s.receipts))],
  ['Gold spent on seeds',sims.map(s=>money(s.seedCash))],
  ['Modeled net return',sims.map(s=>signed(s.net))],
  ['Added net return vs. keep',sims.map(s=>signed(s.net-r.baseline.net))],
  ['ROI vs. keep',stats.map(s=>s?percent(s.roi):'N/A')],
  ['Recovery vs. keep',stats.map(s=>!s||!s.investment?'N/A':s.payback?'Day '+s.payback:'Not by cutoff')],
  ['Ending cash on hand',sims.map(s=>money(s.cash))],
  ['Harvested crops',sims.map(s=>fmt(total(s.harvested)))],
  ['Planted on day 1',sims.map(s=>fmt(s.capacityFirstDay))],
  ['Sold raw',sims.map(s=>fmt(total(s.soldRaw)))],
  ['Keg products shipped',sims.map(s=>fmt(total(s.soldWine)))],
  ['Jar products shipped',sims.map(s=>fmt(total(s.soldPreserves)))],
  ['Shipped, payment pending',sims.map(s=>money(s.pendingSales))],
  ['Raw crops still stored',sims.map(s=>fmt(total(s.rawStored)))],
  ['Products still in machines',sims.map(s=>fmt(s.wineInKegs+s.preservesInJars))],
  ['Scheduled time (game hours)',sims.map(s=>(s.totalMinutes/60).toFixed(1))],
  ['Time freed vs. keep (game hours)',sims.map(s=>((r.baseline.totalMinutes-s.totalMinutes)/60).toFixed(1))],
  ['Peak day (game minutes)',sims.map(s=>s.peak.minutes.toFixed(1)+' / 960')],
  ['Peak energy used',sims.map(s=>s.peakEnergy.toFixed(1))]
 ];
 return `<div class="table-wrap"><table class="capital-table"><caption>Same farm, three choices, through day ${r.config.days}</caption>
  <thead><tr><th scope="col">Measure</th><th scope="col">Keep equipment</th><th scope="col">Plan A</th><th scope="col">Plan B</th></tr></thead>
  <tbody>${rows.map(([label,values])=>`<tr ${label==='Modeled net return'?'class="highlight"':''}><th scope="row">${label}</th>${values.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function chart(r,kind='added'){
 const profit=kind==='profit',id=profit?'profit-chart':'capital-chart';
 // daily.net already contains the running total; never sum those totals again.
 const data=profit?r.a.plan.daily.map((d,i)=>({day:d.day,a:d.net,b:r.b.plan.daily[i].net})):r.curve;
 const values=data.flatMap(d=>[d.a,d.b]),low=Math.min(0,...values),high=Math.max(0,...values);
 const span=Math.max(1,high-low),lo=low-span*.1,hi=high+span*.1;
 const x=d=>88+(d-1)/(r.config.days-1)*460,y=v=>24+(hi-v)/(hi-lo)*180;
 const line=key=>data.map(v=>x(v.day)+','+y(v[key])).join(' ');
 const ticks=[1,7,14,21,28,...(r.config.days===35?[35]:[])];
 const labels=[0,...[low,high].filter(v=>v!==0&&Math.abs(y(v)-y(0))>=16)];
 const title=profit?'Cumulative net profit through day '+r.config.days:'Added net return compared with keeping equipment';
 const zero=profit?'Zero = received sales cover modeled costs':'Zero = keep equipment';
 const end=profit?`At day ${r.config.days}, Plan A has ${money(r.a.plan.net)} cumulative net profit and Plan B has ${money(r.b.plan.net)}.`:`At day ${r.config.days}, Plan A adds ${money(r.a.delta)} and Plan B adds ${money(r.b.delta)} compared with keeping equipment.`;
 const plans=`Green is Plan A (${esc(describe(r.a.plan.kit,r.config))}); dashed blue is Plan B (${esc(describe(r.b.plan.kit,r.config))}).`;
 const note=profit?`${plans} Each line is the running total of sales received minus seed purchases, tool fees, and equipment material value. <strong>Equipment costs are charged once.</strong> Above zero means the farm has covered those modeled costs so far. Seed purchases can make the running total fall; sale payments make it rise. Starting gold and unpaid sales are excluded. This is the same “modeled net return” reported in the table and daily download.`:`${plans} Each line shows that plan’s cumulative net return minus the return from keeping current equipment. <strong>Below zero means the plan trails the keep-equipment farm; the plan itself may still be profitable.</strong> Equipment costs are charged once, at the start. Later dips and rebounds reflect the timing of seed purchases and sale payments. The gap between the lines compares A with B directly; the higher line has the better net return that day.`;
 return `<div id="${id}" class="chart"><h3>${title}</h3>
 <p class="small"><span class="plan-key-a">━━ Plan A</span> &nbsp; <span class="plan-key-b">┄┄ Plan B</span> &nbsp; ${zero}</p>
 <svg viewBox="0 0 580 265" role="img" aria-labelledby="${id}-title ${id}-desc" aria-describedby="${id}-note">
 <title id="${id}-title">${title}</title><desc id="${id}-desc">${end} Solid line is Plan A; dashed line is Plan B. Exact daily figures follow.</desc>
 <line class="chart-zero" x1="88" x2="548" y1="${y(0)}" y2="${y(0)}" stroke="#52665c" stroke-dasharray="3 4"/>
 ${labels.map(v=>`<text x="80" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#52665c">${money(v)}</text>`).join('')}
 <polyline points="${line('a')}" fill="none" stroke="#245c43" stroke-width="3"/>
 <polyline points="${line('b')}" fill="none" stroke="#375d95" stroke-width="3" stroke-dasharray="8 5"/>
 ${ticks.map(d=>`<text x="${x(d)}" y="233" text-anchor="middle" fill="#52665c" font-size="13">${d}</text>`).join('')}
 <text x="315" y="258" text-anchor="middle" fill="#52665c" font-size="13">End of day</text></svg>
 <p class="small"><strong>Day ${r.config.days}:</strong> ${profit?`Plan A profit: ${signed(r.a.plan.net)} · Plan B profit: ${signed(r.b.plan.net)} · Keep-equipment profit: ${signed(r.baseline.net)}`:`Plan A versus keep: ${signed(r.a.delta)} · Plan B versus keep: ${signed(r.b.delta)}`}</p>
 <p id="${id}-note" class="small muted" role="note"><strong>Reading the lines:</strong> ${note}</p></div>`;
}
function dailyTable(r){
 return `<details><summary>Day-by-day evidence</summary><div class="table-wrap"><table class="compact"><caption>Running profit at the end of each day</caption>
 <thead><tr><th scope="col">Day</th><th scope="col">Keep: cumulative profit</th><th scope="col">A: cumulative profit</th><th scope="col">B: cumulative profit</th><th scope="col">A minus B</th><th scope="col">A: minutes</th><th scope="col">B: minutes</th></tr></thead>
 <tbody>${r.curve.map((d,i)=>`<tr><th scope="row">${d.day}</th><td>${signed(r.baseline.daily[i].net)}</td><td>${signed(r.a.plan.daily[i].net)}</td><td>${signed(r.b.plan.daily[i].net)}</td><td>${signed(r.a.plan.daily[i].net-r.b.plan.daily[i].net)}</td><td>${r.a.plan.daily[i].minutes.toFixed(1)}</td><td>${r.b.plan.daily[i].minutes.toFixed(1)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function render(r){
 const headline=r.delta===0?'Plans A and B finish with the same net return.':`Plan ${r.delta>0?'A':'B'} finishes ${money(Math.abs(r.delta))} ahead of Plan ${r.delta>0?'B':'A'}.`;
 const marginal=r.incremental;
 const marginalText=marginal?`Plan ${marginal.higher} commits ${money(marginal.extraCapital)} more capital than the other plan and returns ${money(Math.abs(marginal.addedNet))} ${marginal.addedNet<0?'less':'more'} than that plan. Its incremental ROI is ${percent(marginal.roi)} (the difference in net return divided by that extra capital).`:'Both plans commit the same capital value, so incremental ROI has no denominator. Compare their net returns and workload.';
 const keepBest=r.baseline.net>=Math.max(r.a.plan.net,r.b.plan.net)&&(r.a.investment||r.b.investment);
 $('results').innerHTML=`<section class="panel">
 <span class="eyebrow">Your capital decision</span><h2 id="result-heading" tabindex="-1">${headline}</h2>
 <p><strong>Plan A:</strong> ${esc(describe(r.a.plan.kit,r.config))}<br><strong>Plan B:</strong> ${esc(describe(r.b.plan.kit,r.config))}</p>
 <p class="small muted">${r.config.earlyCrop==='melon'?'Summer melons':'Spring parsnips'} · Farming ${r.config.farming} · Sales through day ${r.config.days}${r.config.recipeAccess==='assumed'?' · Recipe-access override ON':''}</p>
 <div class="metrics"><div class="metric"><span>Plan A: cumulative net profit</span><strong>${signed(r.a.plan.net)}</strong><small>Capital: ${money(r.a.investment)} · ROI vs. keep: ${percent(r.a.roi)}</small></div>
 <div class="metric"><span>Plan B: cumulative net profit</span><strong>${signed(r.b.plan.net)}</strong><small>Capital: ${money(r.b.investment)} · ROI vs. keep: ${percent(r.b.roi)}</small></div>
 <div class="metric"><span>A minus B: net return</span><strong>${signed(r.delta)}</strong><small>after seeds, fees, and material value</small></div></div>
 ${keepBest?'<p class="warn"><strong>Keeping equipment remains competitive.</strong> It has at least as much modeled net return as either selected plan. Explain whether the time saved or a longer view would change your decision.</p>':''}
 <p class="small">${marginalText}</p>
 ${comparisonTable(r)}
 <p class="small muted">Net return includes all new equipment value upfront. Cash on hand includes starting gold; it is a different measure. Stored crops, products in machines, future equipment value, and unpaid shipping are outside received return. Time saved has no invented wage.</p>
 <p class="small">Payment timing: Plan A has ${money(r.a.plan.pendingSales)} awaiting payment; Plan B has ${money(r.b.plan.pendingSales)}. Including those shipped sales would make the A-minus-B difference ${signed(r.delta+r.a.plan.pendingSales-r.b.plan.pendingSales)}.</p>
 ${chart(r,'profit')}
 <details id="investment-payback"><summary>Has the investment paid back compared with keeping equipment?</summary>
 <p class="small"><strong>A profitable farm can still earn less than a farm that keeps its old tools.</strong> Investment recovery here means the plan catches up with keeping equipment and stays at or above it through day ${r.config.days}. “Not by cutoff” does not mean “never”; this run does not predict later periods.</p>
 ${chart(r)}</details>${dailyTable(r)}</section>
 <section class="panel"><h2>What limits each plan?</h2><div class="capital-plan-grid">${warning(r.a.plan,'Plan A')||'<p>Plan A has no unmet-work, stock, or payment warnings under these assumptions.</p>'}${warning(r.b.plan,'Plan B')||'<p>Plan B has no unmet-work, stock, or payment warnings under these assumptions.</p>'}</div>
 <p class="small muted">Processing capacity, seasonal growth, seed cash, and energy can matter even when there is spare clock time. Extra machines need enough crops and time to load, collect, and receive payment. Holding every crop for a small number of machines can tie up much of the harvest.</p>
 <div class="capital-plan-grid">${[['A',r.a.plan],['B',r.b.plan]].map(([label,s])=>`<div><h3>Plan ${label}: peak day ${s.peak.day}</h3>${M.cats.filter(k=>s.peak.work[k]>0).map(k=>`<div class="bar-row"><span>${k==='Wine collection'?'Keg collection':k}</span><div class="bar-track"><div class="bar-fill" style="width:${s.peak.work[k]/960*100}%"></div></div><b>${s.peak.work[k].toFixed(1)} min</b></div>`).join('')}</div>`).join('')}</div></section>`;
 $('results').hidden=false;$('reflection').hidden=false;$('empty').hidden=true;makeTablesAccessible();
}
$('run').addEventListener('click',async()=>{
 if(busy)return;
 const prediction=document.querySelector('[name=prediction]:checked');
 if(!prediction){showErrors(['Choose a prediction first. Uncertainty is useful.']);document.querySelector('[name=prediction]').focus();return}
 const invalid=[...$('controls').querySelectorAll('input[type=number]:not(:disabled)')].filter(el=>!el.checkValidity());
 if(invalid.length){showErrors(invalid.map(el=>`Check ${document.querySelector('label[for="'+el.id+'"]').textContent}: enter a valid number from ${el.min} to ${el.max}, in steps of ${el.step}.`));return}
 const config=readConfig(),a=readPlan('a',config),b=readPlan('b',config);
 if(a.hoe>4||a.can>4||b.hoe>4||b.can>4){showErrors(['An Iridium tool cannot be upgraded again. Choose another investment.']);return}
 const errors=[...M.validate(config,a).map(s=>'Plan A: '+s),...M.validate(config,b).map(s=>'Plan B: '+s)];
 if(errors.length){showErrors(errors);return}
 const revision=inputRevision,predicted=prediction.value;busy=true;$('run').disabled=true;$('errors').hidden=true;$('status').textContent='Following all three farms…';
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  if(revision!==inputRevision)return;
  const result=M.comparePlans(config,a,b);if(!result.valid)throw Error(result.errors.join(' '));
  snapshot={result,prediction:predicted};render(result);$('status').textContent='Comparison complete. Change one decision, predict, and run again.';
  $('result-heading').focus({preventScroll:true});$('results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }catch(e){snapshot=null;$('results').hidden=true;$('reflection').hidden=true;showErrors(['The comparison could not run: '+e.message])}
 finally{busy=false;$('run').disabled=false}
});
function downloadFile(name,text,type){
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function decisionText(){
 if(!snapshot)throw Error('Run the current comparison first.');
 const r=snapshot.result;
 return[
  'PLSC1915 | Before Ten: capital decisions',`Model version: ${M.VERSION}`,`Prediction: ${snapshot.prediction}`,'',
  `Configuration: ${JSON.stringify(r.config)}`,`Recipe-access override: ${r.config.recipeAccess==='assumed'?'ON':'OFF'}`,
  `Plan A: ${describe(r.a.plan.kit,r.config)}`,`Plan A inputs: ${JSON.stringify(r.a.plan.kit)}`,
  `Plan B: ${describe(r.b.plan.kit,r.config)}`,`Plan B inputs: ${JSON.stringify(r.b.plan.kit)}`,'',
  `Keep equipment net return: ${money(r.baseline.net)}`,
  ...[['A',r.a],['B',r.b]].flatMap(([id,s])=>[
   `Plan ${id} capital: ${money(s.investment)}`,`Plan ${id} net return: ${money(s.plan.net)}`,
   `Plan ${id} ROI vs. keep: ${percent(s.roi)}`,`Plan ${id} recovery vs. keep: ${!s.investment?'N/A':s.payback?'day '+s.payback:'not by cutoff'}`,
   `Plan ${id} pending receipts: ${money(s.plan.pendingSales)}`,
   `Plan ${id} stored raw crops: ${total(s.plan.rawStored)}; products still in machines: ${s.plan.wineInKegs+s.plan.preservesInJars}`,
   `Plan ${id} scheduled game hours: ${(s.plan.totalMinutes/60).toFixed(1)}`]),
  `A minus B net return: ${signed(r.delta)}`,`A minus B capital: ${signed(r.capitalDifference)}`,
  `Incremental ROI of the higher-capital plan: ${r.incremental?percent(r.incremental.roi):'N/A; equal capital'}`,'',
  `Recommendation: ${$('reason').value.trim()||'(not yet written)'}`,`I would reconsider if: ${$('change').value.trim()||'(not yet written)'}`,'',
  'Boundaries: one 28-day growing season; optional seven days to finish processing and receive payment. No new planting after day 28; unharvested seasonal crops are lost. Fixed 6am–10pm classroom workday. Action rates and routes are assumptions. Cleared land; normal-quality crops; no rain, fertilizer, growth or price bonuses. Materials owned; full sale value charged to capital. Seed purchases and tool fees use cash. Food costs, resource gathering, unlock work, wages, and terminal equipment value omitted. One next-tier tool upgrade per plan; unavailable days 1–2. Kegs are served before jars. Shipping pays next morning. Unsold crops, machine contents, and unpaid sales are not receipts.',
  '',...Object.entries(M.SOURCES).map(([name,url])=>name+': '+url)
 ].join('\n');
}
$('note').addEventListener('click',()=>{if(snapshot)downloadFile('PLSC1915-capital-decision.txt',decisionText(),'text/plain;charset=utf-8')});
$('csv').addEventListener('click',()=>{
 if(!snapshot)return;
 const r=snapshot.result,rows=[['day','choice','minutes','energy','planted','harvested','keg_products_collected','jar_products_collected','raw_crops_stored','cash_receipts_today','seed_spending_today','cash_on_hand','cumulative_net_return','pending_receipts','capital_committed','recipe_override']];
 for(const [label,s] of [['keep',r.baseline],['A',r.a.plan],['B',r.b.plan]])for(const d of s.daily){
  rows.push([d.day,label,d.minutes,d.energy,d.planted,d.harvested,d.wineCollected,d.preservesCollected,d.rawStored,d.cashIn,d.seedSpend,d.cash,d.net,d.pending,s.cost.cash+s.cost.materials,r.config.recipeAccess==='assumed']);
 }
 const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
 downloadFile('PLSC1915-capital-daily-results.csv',csv,'text/csv;charset=utf-8');
});
function documentation(){
 const link=(key,label)=>`<a href="${M.SOURCES[key]}" target="_blank" rel="noopener">${label}</a>`;
 const rows=[
  ['Capital value','Tool fees + sale value of bars and crafting materials. The same budget applies separately to each plan. Seeds are an operating cost.','Classroom accounting; materials already owned.'],
  ['Tool upgrades','One next-tier upgrade per plan. The tool is unavailable on days 1–2; collect it on day 3. Two 240-minute errands include travel and waiting.',link('smith','Blacksmith')+'; errand length is assumed.'],
  ['Basic sprinklers','180g of material value per unit; covers up to four crop tiles. Farming 2. Installation uses time; new tilled ground needs initial manual water.',link('sprinkler','Sprinkler')+'; efficient layout assumed.'],
  ['Preserves jars','50 wood + 40 stone + 8 coal = 300g in sale value. Farming 4. Pickles or jelly: 2 × base crop price + 50g; 4,000 processing minutes.',link('preserves','Preserves Jar')+' · '+link('stone','Stone')+' · '+link('coal','Coal')],
  ['Kegs','30 wood + copper bar + iron bar + oak resin = 390g in sale value. Farming 8. Fruit becomes wine (3 × base price; 10,000 minutes); parsnips become juice (78g; 6,000 minutes).',link('keg','Keg')+' · '+link('parsnip','Parsnip')],
  ['Spring parsnips','20g seed; four growing days; 35g raw, 78g juice, 120g pickles. No regrowth.',link('parseed','Parsnip Seeds')+' · '+link('parsnip','Parsnip')],
  ['Summer melons','80g seed; 12 growing days; 250g raw, 750g wine, 550g jelly. No regrowth.',link('melonseed','Melon Seeds')+' · '+link('melon','Melon')],
  ['The season and cutoff','Plant and grow only on days 1–28. Replant only when nominal maturity fits that season. At day 29, remaining seasonal crops are lost. Optional days 29–35 process stored harvests and receive sales.','One growing season; no giant crops or quality bonuses.'],
  ['Recipe access','Normal Farming unlocks apply to new machines. The explicit classroom override assumes all recipes available without changing Farming proficiency.','Unlock work and material gathering remain outside the model.'],
  ['Selling and processing','Serve kegs first, then jars. Choose immediate raw overflow sales or storage for later batches. A plan with no processing machines always sells raw.','Fixed policy, not an optimal schedule. Each machine type has its own assumed service trip.'],
  ['Daily time and energy','6 a.m.–10 p.m. = 960 game minutes, including travel home. Optional 270 energy limit. Machines process during sleep, with 1,600 machine minutes per full day.',link('clock','Day Cycle')+' · '+link('energy','Energy')+'; bedtime is a classroom rule.'],
  ['Action timings','Hoe: 1 / 1.5 / 2 / 2.5 / 3 seconds by tier. Can: 1.2 / 1.7 / 2.2 / 2.7 / 3.2. Seed: 0.35; harvest: 0.6; machine load/collect: 0.4; placement: 0.8; refill: 1. Divide seconds by 0.7 for game minutes.','Assumed effective rates, not calibrated gameplay measurements.'],
  ['Travel','Four tiles/second; 40 tiles each way between house and field, eight to water, 12 to each machine area. One tile of movement per plot/action pass. Two minutes reserved daily for shipping.','Chosen compact layout; paths and equipment footprints need extra space.'],
  ['Net return and ROI','Net return = received sales − seed cash − tool fees − committed material value. ROI vs. keep = (plan net − keep net) ÷ plan capital. Zero capital has undefined ROI.','Full equipment cost upfront; residual equipment and crop values excluded.'],
  ['Direct comparison','A-minus-B net return includes both plans’ costs. Incremental ROI uses the extra capital of the more expensive plan, never one plan’s whole cost as the denominator for a two-plan difference.','Equal capital: incremental ROI undefined. Compare net return and time.'],
  ['Recovery and cash','Recovery is the start of the final uninterrupted nonnegative added-return interval vs. keep through the cutoff. Shipped sales pay next morning.','A temporary lead is not recovery. Saved time receives no wage; no discounting or borrowing.']
 ];
 return `<p class="warn">Capital costs, daily work, inventory, and payment timing are modeled together. The results are conditional classroom estimates, not a calibrated game optimizer.</p><div class="table-wrap"><table><caption>Rules for the home-farm capital comparison</caption><thead><tr><th scope="col">Component</th><th scope="col">Rule</th><th scope="col">Source or assumption</th></tr></thead><tbody>${rows.map(([a,b,c])=>`<tr><th scope="row">${a}</th><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Processing and melon rules checked ${M.CAPITAL_VERIFIED}. Existing shared game-rule checks: ${M.VERIFIED}. No gameplay timing experiment was performed.</p>`;
}
$('model-content').innerHTML=documentation();updateControls();makeTablesAccessible();
