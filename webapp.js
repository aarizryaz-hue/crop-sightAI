// Installable app assets and explicit user reports. Never serves arbitrary filesystem paths.
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const ASSETS = {
  '/manifest.webmanifest':['manifest.webmanifest','application/manifest+json'],
  '/sw.js':['sw.js','text/javascript; charset=utf-8'],
  '/icons/icon-192.png':['icons/icon-192.png','image/png'],
  '/icons/icon-512.png':['icons/icon-512.png','image/png'],
  '/icons/maskable-512.png':['icons/maskable-512.png','image/png'],
  '/icons/cropsight.svg':['icons/cropsight.svg','image/svg+xml'],
  '/.well-known/assetlinks.json':['.well-known/assetlinks.json','application/json'],
};
const RETENTION = 30 * 24 * 60 * 60 * 1000;
const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createWebApp({reportsDir = process.env.REPORTS_DIR || path.join(__dirname,'data','reports'), contactEmail = process.env.APP_CONTACT_EMAIL || '', developerName = process.env.APP_DEVELOPER_NAME || '', provider = {name:'OpenAI',privacyUrl:'https://developers.openai.com/api/docs/guides/your-data'}, now = Date.now} = {}) {
  let windowStart = 0, count = 0;
  const json = (res, code, data) => {res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  async function cleanReports(){
    await fs.promises.mkdir(reportsDir,{recursive:true,mode:0o700});
    for(const name of await fs.promises.readdir(reportsDir)){
      if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
      const file=path.join(reportsDir,name);
      try {const stat=await fs.promises.stat(file);if(stat.mtimeMs < now()-RETENTION)await fs.promises.unlink(file);}
      catch(error){if(error.code!=='ENOENT')throw error;}
    }
  }
  // Enforce retention during normal operation, even when no new report arrives.
  const timer=setInterval(()=>cleanReports().catch(()=>console.error('Report retention cleanup failed.')),60*60*1000);timer.unref();
  cleanReports().catch(()=>console.error('Report storage unavailable.'));
  async function handle(req,res,url){
    if(req.method==='GET'&&url.pathname==='/api/app-info'){json(res,200,{reportStoragePathConfigured:Boolean(process.env.REPORTS_DIR),privacyContactConfigured:Boolean(contactEmail&&developerName),reportRetentionDays:30});return true;}
    if(req.method==='GET' && Object.hasOwn(ASSETS,url.pathname)){
      const [file,type]=ASSETS[url.pathname];let bytes;
      try{bytes=await fs.promises.readFile(path.join(__dirname,'public',file));}
      catch(error){if(url.pathname==='/.well-known/assetlinks.json'&&error.code==='ENOENT'){json(res,200,[]);return true;}throw error;}
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache',...(url.pathname==='/sw.js'?{'Service-Worker-Allowed':'/'}:{})});res.end(bytes);return true;
    }
    if(req.method==='GET'&&url.pathname==='/privacy'){
      const contact=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)?`<a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a>`:'Not configured. This deployment is not ready for a Play Store release.';
      const providerLink=provider.privacyUrl&&/^https:\/\//.test(provider.privacyUrl)?`<a href="${esc(provider.privacyUrl)}">${esc(provider.name)} data policy</a>`:esc(provider.name);
      const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111c17"><title>CropSight privacy</title><style>body{margin:0;background:#111c17;color:#e0e9df;font:16px/1.7 system-ui}main{max-width:720px;margin:auto;padding:28px 22px}h1,h2{color:#e9f2dc;line-height:1.2}h2{margin-top:30px;font-size:1.2rem}a{color:#93c59b}small{color:#a7b9aa}</style><main><a href="/#settings">← Back to CropSight</a><h1>CropSight privacy</h1><small>Updated October 24, 2026</small><p>CropSight helps people describe visible crop conditions for human review. Publisher: ${esc(developerName||'Publisher identity not yet configured')}.</p><h2>Photos and analysis</h2><p>You choose photos using the system file picker. We do not request access to your full photo library, location, contacts or microphone. Photos remain in tab memory until you consent and request analysis. The app resizes and re-encodes them, then sends the images, chosen stage, language and any follow-up answer through its server to ${esc(provider.name)}. The application does not save uploaded photos or routine analysis results to disk.</p><p>The provider may retain data under its own policies. ${providerLink}. A setting that disables stored completions does not promise zero provider retention. Hosting infrastructure may process network metadata such as IP addresses and request times under the host's policies.</p><h2>Preferences and offline use</h2><p>Language and stage preferences are saved on your device. The service worker caches the application interface and icons so it can open offline. It does not cache API responses, photos or analysis results. Analysis requires internet. Clear site/app data to remove preferences and cached files; close the app to clear in-memory photos and results.</p><h2>Reports you choose to submit</h2><p>If you report an AI result, a separate confirmation sends the result text, reason, optional comment and request identifier to the developer for review. Photos are not attached. Do not include personal information in comments. Reports are stored in private server files and removed after 30 days by an hourly cleanup. Contact us with your report ID to request earlier deletion. We do not sell your reports or use them to train a model in this application.</p><h2>Contact and deletion requests</h2><p>${contact}</p><p>CropSight has no user account registration and no advertising or analytics SDK. Your AI provider and hosting service operate under their own policies. The publisher must update this notice if the deployed services or data practices change.</p></main></html>`;
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return true;
    }
    if(req.method==='POST'&&url.pathname==='/api/report'){
      if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{json(res,403,{error:'invalid_origin'});return true;}if(origin.host!==req.headers.host||!['https:','http:'].includes(origin.protocol)){json(res,403,{error:'invalid_origin'});return true;}}
      if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'invalid_request'});return true;}
      if(now()-windowStart>=60000){windowStart=now();count=0;}if(count>=20){json(res,429,{error:'busy'});return true;}count++;
      const chunks=[];let size=0,tooLarge=false;
      for await(const chunk of req){size+=chunk.length;if(size>24000){tooLarge=true;chunks.length=0;}else if(!tooLarge)chunks.push(chunk);}
      if(tooLarge){json(res,413,{error:'too_large'});return true;}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(res,400,{error:'invalid_request'});return true;}
      if(!body||body.consent!==true||!['incorrect','unsafe','offensive','other'].includes(body.reason)||typeof body.resultText!=='string'||!body.resultText.trim()||body.resultText.length>14000||typeof body.comment!=='string'||body.comment.length>1000||typeof body.requestId!=='string'||body.requestId.length>100||Object.keys(body).some(k=>!['consent','reason','resultText','comment','requestId'].includes(k))){json(res,400,{error:'invalid_request'});return true;}
      const reportId=randomUUID();
      try{await cleanReports();await fs.promises.writeFile(path.join(reportsDir,reportId+'.json'),JSON.stringify({reportId,createdAt:new Date(now()).toISOString(),reason:body.reason,resultText:body.resultText,comment:body.comment,requestId:body.requestId}),{flag:'wx',mode:0o600});}
      catch{json(res,503,{error:'report_unavailable'});return true;}
      json(res,201,{reportId});return true;
    }
    return false;
  }
  return {handle,close:()=>clearInterval(timer)};
}
module.exports={createWebApp};
