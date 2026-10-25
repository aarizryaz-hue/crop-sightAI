const fs=require('node:fs'),path=require('node:path');const {args}=require('./android-common.cjs');
try{
 const options=args(process.argv.slice(2));
 if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(options.package||''))throw Error('Provide the final Android application ID with --package.');
 const fingerprint=String(options.fingerprint||'').toUpperCase();if(!/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint))throw Error('Provide the SHA-256 certificate fingerprint from Play Console App integrity with --fingerprint.');
 const dir=path.resolve(__dirname,'../public/.well-known'),file=path.join(dir,'assetlinks.json');fs.mkdirSync(dir,{recursive:true});
 let entries=[];if(fs.existsSync(file))entries=JSON.parse(fs.readFileSync(file,'utf8'));
 const old=entries.find(e=>e.target?.package_name===options.package);const hashes=[...new Set([...(old?.target?.sha256_cert_fingerprints||[]),fingerprint])];
 entries=entries.filter(e=>e.target?.package_name!==options.package);entries.push({relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:options.package,sha256_cert_fingerprints:hashes}});
 fs.writeFileSync(file,JSON.stringify(entries,null,2)+'\n');console.log('Wrote public/.well-known/assetlinks.json. Redeploy it to the same website before testing full-screen launch.');
}catch(error){console.error(error.message);process.exitCode=1;}
