import {chromium} from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage();
p.on('pageerror',x=>console.log('pageerror',x.message));p.on('console',m=>{if(m.type()!=='log')console.log(m.type(),m.text().slice(0,300))});
await p.goto('http://127.0.0.1:4192/');await p.waitForTimeout(6000);await b.close();
