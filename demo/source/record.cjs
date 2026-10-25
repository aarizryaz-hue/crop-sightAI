// Real browser recording; no intercepted or mocked API responses.
// Browser plugin not available; Playwright uses the installed Chrome browser.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/Users/jami-yo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = process.env.DEMO_WORK_DIR || '/tmp/cropsight-recording';
fs.mkdirSync(out, {recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:out,size:{width:1440,height:960}},permissions:['clipboard-read','clipboard-write']});
 const started=Date.now(); const page=await context.newPage();
 const segments=[], responses=[], errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url().endsWith('/api/assess')) {const data=await r.json(); responses.push({status:r.status(),data}); fs.writeFileSync(path.join(out,'live-results.json'),JSON.stringify(responses,null,2));}});
 const wait=ms=>page.waitForTimeout(ms);
 const mark=()=> (Date.now()-started)/1000;
 async function scene(id,action,hold=6500){const start=mark();await action();await wait(hold);segments.push({id,start,end:mark()});await page.screenshot({path:path.join(out,id+'.png')});console.log('Recorded '+id);}
 async function position(selector){await page.locator(selector).evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-115,behavior:'smooth'}));await wait(750);}
 await page.goto('http://127.0.0.1:3000');
 await page.waitForFunction(()=>/cropsight-android-[45]/.test(document.querySelector('#setting-build').textContent));
 const serverInfo=await (await page.request.get('http://127.0.0.1:3000/api/status')).json();
 fs.writeFileSync(path.join(out,'server-info.json'),JSON.stringify(serverInfo,null,2));
 await scene('01-intro',async()=>{},5500);
 await scene('02-photo',async()=>{await page.locator('[data-mode=harvest]').click();await position('#workspace');await page.locator('#photo').setInputFiles(path.join(__dirname,'tomato-photo.jpg'));await page.locator('#preview').waitFor({state:'visible'});},6500);
 await scene('03-consent',async()=>{await position('#detail-area');await page.locator('#consent').check();},5000);
 const first=page.waitForResponse(r=>r.url().endsWith('/api/assess'),{timeout:70000});
 await page.locator('#analyze').click();
 const waitingStart=mark(); await wait(1800);segments.push({id:'04-wait',start:waitingStart,end:mark()});
 const firstResponse=await first;if(!firstResponse.ok())throw Error('Live analysis failed: '+await firstResponse.text());
 await page.locator('#result').waitFor({state:'visible'});
 await scene('05-evidence',async()=>position('#result'),8000);
 await scene('06-causes',async()=>position(await page.locator('.problem-list').count()?'.problem-list':'.checks'),7000);
 if(await page.locator('.follow-up').count()){
  await scene('07-question',async()=>position('.follow-up'),6000);
  const options=await page.locator('[data-answer]').allTextContents();
  const unsure=options.findIndex(s=>/not sure|unsure|don.t know|unknown/i.test(s));
  if(unsure>=0){
   const second=page.waitForResponse(r=>r.url().endsWith('/api/assess'),{timeout:70000});
   await page.locator('[data-answer]').nth(unsure).click();
   const response=await second;if(!response.ok())throw Error('Follow-up failed: '+await response.text());
   await page.locator('#result').waitFor({state:'visible'});
   await scene('08-refined',async()=>position('#result'),5000);
  }
 }
 await scene('09-summary',async()=>{await position('.supervisor');await page.locator('#copy-result').click();},7000);
 await scene('10-settings',async()=>{await page.locator('.settings-link').click();await wait(600);await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));},6500);
 const video=page.video();await context.close();await video.saveAs(path.join(out,'raw.webm'));await browser.close();
 fs.writeFileSync(path.join(out,'timeline.json'),JSON.stringify({segments,errors,responses:responses.map(r=>({status:r.status,meta:r.data.meta}))},null,2));
 console.log(JSON.stringify({segments,errors,liveCalls:responses.length}));
})().catch(e=>{console.error(e);process.exit(1)});
