import {chromium} from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:900,height:1000}});const e=[];p.on('pageerror',x=>e.push(x.message));p.on('console',m=>{if(m.type()!=='log')e.push(m.text())});
await p.goto('http://127.0.0.1:4192/');await p.waitForFunction(()=>window.__podReady,null,{timeout:60000});await p.waitForTimeout(1500);
await p.evaluate(()=>{const s=window.__studio;s.camera.position.set(1.9,1.5,3.3);s.controls.target.set(0,.75,0);s.controls.update()});await p.waitForTimeout(600);
await p.screenshot({path:'/private/tmp/claude-501/-Users-seohaneul-Desktop-Little-Plains-Superstellar-3D-assets/b5544a13-6dc2-4e4a-ba5d-f37406d8b1bf/scratchpad/shadow-after.png'});
await p.setViewportSize({width:1512,height:778});await p.click('[data-view=interior]');await p.waitForTimeout(1600);await p.screenshot({path:'/private/tmp/claude-501/-Users-seohaneul-Desktop-Little-Plains-Superstellar-3D-assets/b5544a13-6dc2-4e4a-ba5d-f37406d8b1bf/scratchpad/shadow-after-int.png'});
console.log(e);await b.close();
