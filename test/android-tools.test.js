const {test}=require('node:test');const assert=require('node:assert/strict');
const {appUrl,args}=require('../scripts/android-common.cjs');const {spawnSync}=require('node:child_process');const path=require('node:path');
test('Android packaging rejects local, insecure and credential-bearing launch URLs',()=>{
 for(const value of [undefined,'http://crop.example','https://localhost','https://127.0.0.1','https://user:secret@crop.example','https://crop.example/private','https://crop.example/?key=secret'])assert.throws(()=>appUrl(value));
 assert.equal(appUrl('https://crop.example/'),'https://crop.example');assert.deepEqual(args(['--url','https://crop.example','--package','org.example.cropsight']),{url:'https://crop.example',package:'org.example.cropsight'});assert.throws(()=>args(['--unknown']));
});
test('Android commands stop before generating artifacts when release inputs are missing',()=>{
 const root=path.resolve(__dirname,'..');
 for(const script of ['android-init.cjs','android-check.cjs','android-links.cjs']){const run=spawnSync(process.execPath,[path.join(root,'scripts',script)],{cwd:root,encoding:'utf8'});assert.equal(run.status,1);assert.ok(run.stderr.length>0);}
});
