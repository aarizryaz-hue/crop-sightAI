const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('../server');
async function fixture(t,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cropsight-reports-'));
 const server=createServer({key:'',webAppOptions:{reportsDir:dir,contactEmail:'support@example.com',developerName:'Test publisher',...options}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>{server.close(r);server.closeAllConnections();});fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 return {dir,base,post:(body,headers={})=>fetch(base+'/api/report',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})};
}
const report={consent:true,reason:'incorrect',requestId:'test-analysis',resultText:'Possible tomato; crop identity needs review.',comment:'The crop was lettuce.'};
test('install manifest, correctly sized icons and worker are served from explicit routes',async t=>{
 const f=await fixture(t),response=await fetch(f.base+'/manifest.webmanifest');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/manifest/);
 const manifest=await response.json();assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.name,'CropSight');
 for(const icon of manifest.icons){const r=await fetch(f.base+icon.src);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);const size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
 const sw=await fetch(f.base+'/sw.js');assert.equal(sw.headers.get('service-worker-allowed'),'/');assert.match(await sw.text(),/pathname.startsWith\('\/api\/'\)/);
 for(const url of ['/server.js','/webapp.js','/package-lock.json','/data/reports','/.env','/icons/../../.env'])assert.equal((await fetch(f.base+url)).status,404);
});
test('reports require explicit consent, same-origin requests and bounded text, with no photos',async t=>{
 const f=await fixture(t);
 for(const body of [{...report,consent:false},{...report,reason:'invented'},{...report,comment:'x'.repeat(1001)},{...report,image:'secret photo'}])assert.equal((await f.post(body)).status,400);
 assert.equal((await f.post(report,{Origin:'https://elsewhere.example'})).status,403);
 assert.equal((await f.post({...report,resultText:'x'.repeat(25000)})).status,413);
 assert.deepEqual(fs.readdirSync(f.dir),[]);
});
test('accepted reports are stored privately and cannot be read through the public server',async t=>{
 const f=await fixture(t),response=await f.post(report);assert.equal(response.status,201);const {reportId}=await response.json();
 const file=path.join(f.dir,reportId+'.json');const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.comment,report.comment);assert.equal(saved.resultText,report.resultText);assert.equal(Object.hasOwn(saved,'image'),false);assert.equal(fs.statSync(file).mode&0o777,0o600);
 assert.equal((await fetch(f.base+'/data/reports/'+reportId+'.json')).status,404);
});
test('expired reports are removed while recent reports remain',async t=>{
 const f=await fixture(t);const old='11111111-1111-4111-8111-111111111111.json';fs.writeFileSync(path.join(f.dir,old),'{}');const before=new Date(Date.now()-31*86400000);fs.utimesSync(path.join(f.dir,old),before,before);
 assert.equal((await f.post(report)).status,201);assert.equal(fs.existsSync(path.join(f.dir,old)),false);assert.equal(fs.readdirSync(f.dir).length,1);
});
test('privacy identifies the publisher, provider and separate report retention',async t=>{
 const f=await fixture(t,{developerName:'Team <script>'});const response=await fetch(f.base+'/privacy');const body=await response.text();assert.equal(response.status,200);assert.match(body,/Team &lt;script&gt;/);assert.match(body,/support@example.com/);assert.match(body,/30 days/);assert.match(body,/OpenAI/);assert.equal(response.headers.get('cache-control'),'no-store');
 const links=await(await fetch(f.base+'/.well-known/assetlinks.json')).json();assert.ok(Array.isArray(links));
});
