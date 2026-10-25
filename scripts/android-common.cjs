const assert=require('node:assert/strict');
function appUrl(value){
 if(!value)throw Error('Provide the public HTTPS CropSight address with --url. A localhost link cannot be used for a Play Store app.');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||/^(localhost|127\.|\[::1\])/.test(url.hostname))throw Error('Use a public HTTPS origin, such as https://your-host.example, without a path or credentials.');
 return url.origin;
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){if(!['--url','--package','--fingerprint'].includes(argv[i])||!argv[i+1])throw Error('Expected --url, --package or --fingerprint followed by a value.');out[argv[i].slice(2)]=argv[++i];}return out;}
async function get(origin,pathname){const response=await fetch(origin+pathname,{signal:AbortSignal.timeout(90000),redirect:'error'});if(!response.ok)throw Error(`${pathname} returned HTTP ${response.status}. Deploy all app files first.`);return response;}
async function check(origin,{release=false,packageId}={}){
 const manifest=await(await get(origin,'/manifest.webmanifest')).json();assert.equal(manifest.name,'CropSight');assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');
 for(const icon of manifest.icons){const url=new URL(icon.src,origin);assert.equal(url.origin,origin);const bytes=Buffer.from(await(await get(origin,url.pathname)).arrayBuffer());assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');const size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
 assert.ok(manifest.icons.some(i=>i.sizes==='192x192'));assert.ok(manifest.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
 const worker=await(await get(origin,'/sw.js')).text();assert.match(worker,/cropsight-shell-/);
 const status=await(await get(origin,'/api/status')).json();assert.equal(status.version,'cropsight-android-4','Deploy/restart the Android v4 server.');assert.equal(status.aiEnabled,true,'Configure the server API key before building the app.');
 const privacy=await(await get(origin,'/privacy')).text();
 if(release){assert.doesNotMatch(privacy,/not yet configured|Not configured/,'Set APP_CONTACT_EMAIL and APP_DEVELOPER_NAME before release.');const info=await(await get(origin,'/api/app-info')).json();assert.equal(info.reportStoragePathConfigured,true,'Configure REPORTS_DIR on persistent private storage before release.');}
 if(packageId){const links=await(await get(origin,'/.well-known/assetlinks.json')).json();assert.ok(links.some(link=>link.target?.package_name===packageId&&link.target?.namespace==='android_app'&&link.relation?.includes('delegate_permission/common.handle_all_urls')&&link.target.sha256_cert_fingerprints?.some(f=>/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(f))),'Deploy Digital Asset Links with the Play app-signing certificate.');}
 return {origin,version:status.version,model:status.model,connectionVerified:status.connectionVerified,manifest};
}
module.exports={appUrl,args,check};
