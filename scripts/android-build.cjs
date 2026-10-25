const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const {appUrl,check}=require('./android-common.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'android'),file=path.join(dir,'twa-manifest.json');
 if(!fs.existsSync(file))throw Error('First run npm run android:init -- --url YOUR_PUBLIC_HTTPS_ORIGIN.');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));await check(appUrl('https://'+manifest.host),{release:true});
 const gradle=fs.readFileSync(path.join(dir,'app','build.gradle'),'utf8');const target=gradle.match(/targetSdk(?:Version)?\s*(?:=\s*)?(\d+)/);
 if(!target||Number(target[1])<36)throw Error('The generated Android project must target API 36 or newer. Update the Bubblewrap project before building.');
 const result=spawnSync(process.execPath,[path.join(root,'node_modules','@bubblewrap','cli','bin','bubblewrap.js'),'build'],{cwd:dir,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)throw Error('Android build did not finish.');
 for(const name of ['app-release-bundle.aab','app-release-signed.apk'])if(!fs.existsSync(path.join(dir,name)))throw Error('Expected signed artifact is missing: '+name);
 console.log('Signed APK and Android App Bundle are in android/. Upload the AAB to a Play internal test first.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
