const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const {appUrl,args,check}=require('./android-common.cjs');
(async()=>{
 const origin=appUrl(args(process.argv.slice(2)).url);await check(origin);
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'android');
 if(fs.existsSync(dir)&&fs.readdirSync(dir).length)throw Error('android/ already exists. Keep its signing key and update the existing project instead of replacing it.');
 fs.mkdirSync(dir,{recursive:true});
 const cli=path.join(root,'node_modules','@bubblewrap','cli','bin','bubblewrap.js');
 if(!fs.existsSync(cli))throw Error('Run npm ci first to install the pinned Android build tools.');
 console.log('Choose and record your permanent application ID. Keep the signing key and password private and backed up.');
 const result=spawnSync(process.execPath,[cli,'init','--manifest',origin+'/manifest.webmanifest','--directory',dir],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)throw Error('Android project generation did not finish.');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'twa-manifest.json'),'utf8'));
 if(manifest.host!==new URL(origin).host)throw Error('Generated Android host does not match the verified website.');
 console.log('Android project generated: '+dir);console.log('Application ID: '+manifest.packageId);console.log('Next: npm run android:build');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
