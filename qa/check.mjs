import {chromium} from 'playwright';import assert from 'node:assert/strict';
// Renders the main states and checks every CAD mesh carries a guide material with no page errors.
const out=process.argv[2]||'qa/shot';const url=process.argv[3]||'http://127.0.0.1:4192/';
const b=await chromium.launch({channel:'chrome',headless:true});const e=[];
for(const [name,vp,scheme] of [['desk',{width:1440,height:900},'light'],['dark',{width:1440,height:900},'dark'],['phone',{width:390,height:844},'light']]){
 const p=await b.newPage({viewport:vp,colorScheme:scheme});p.on('pageerror',x=>e.push(x.message));await p.goto(url);await p.waitForFunction(()=>window.__podReady,null,{timeout:60000});await p.waitForTimeout(1200);
 await p.screenshot({path:`${out}-${name}.png`,fullPage:name==='phone'});
 if(name==='desk'){
  for(const [v,l,amb] of [['straight','day',true],['three','night',true],['three','night',false],['interior','night',true],['interior','day',false]]){
   const pick=async(cat,sel)=>{await p.click(`[data-cat=${cat}]`);await p.click(sel)}; // options show only for the open category
   await pick('camera',`[data-view=${v}]`);await pick('lighting',`[data-light=${l}]`);await pick('ambient',`[data-ambient=${amb?'on':'off'}]`);await p.waitForTimeout(1300);await p.screenshot({path:`${out}-${v}-${l}-${amb?'amb':'noamb'}.png`})}
  const r=await p.evaluate(()=>{const u=[];let n=0;window.__studio.scene.traverse(o=>{if(!o.isMesh||o.name==='Loomi screen'||o.material.type==='ShadowMaterial')return;n++;[].concat(o.material).forEach(m=>{if(!m.name.includes('·'))u.push(o.name+':'+m.name)})});return {n,u}});
  assert.ok(r.n>20);assert.deepEqual(r.u,[]);console.log('meshes',r.n)}
 await p.close()}
assert.deepEqual(e,[]);console.log('ok');await b.close();
