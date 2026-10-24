const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const photo = 'data:image/jpeg;base64,/9j/2Q==';
const input = { image:photo, crop:'almond', symptom:'spots', consent:true };
const observation = () => ({
  photo_usable:true, photo_note:'Brown spots are visible.', photo_note_es:'Se ven manchas cafés.',
  likely_causes:[{name:'Unknown',name_es:'Desconocido',why:'A photo cannot establish the cause.',why_es:'Una foto no permite determinar la causa.'}],
  what_to_check:[{en:'Look at nearby leaves without touching.',es:'Mire las hojas cercanas sin tocarlas.'}],
  report_to_supervisor:'Please review these visible spots.',report_to_supervisor_es:'Revise estas manchas visibles.',
});
const envelope = result => ({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]});
const reply = body => new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
async function fixture(t, options = {}) {
  const server = createServer({key:'test-only-not-a-real-key',...options});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, post:(body=input,headers={}) => fetch(base+'/api/assess',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}) };
}
test('core and truthful status remain usable with no API key', async t => {
  const f = await fixture(t,{key:''});
  assert.equal((await fetch(f.base)).status,200);
  const status = await (await fetch(f.base+'/api/status')).json();
  assert.equal(status.aiEnabled,false); assert.equal(status.connectionVerified,false);
  assert.equal((await f.post()).status,503);
  assert.equal((await fetch(f.base+'/.env')).status,404);
});
test('rejects malformed bodies, absent consent, invalid categories, foreign origins and excessive uploads before spending', async t => {
  let calls=0; const f=await fixture(t,{fetchImpl:async()=>{calls++;return reply(envelope(observation()));}});
  for (const value of [null, [], {}, {...input,consent:false}, {...input,crop:'injected instructions'}, {...input,image:'https://example.com/secret'}]) assert.equal((await f.post(value)).status,400);
  assert.equal((await f.post(input,{Origin:'https://other.example'})).status,403);
  assert.equal((await f.post(input,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await f.post({...input,image:'x'.repeat(8*1024*1024)})).status,413);
  assert.equal(calls,0);
});
test('valid bilingual observations use strict schema, bounded tokens and no stored completion', async t => {
  let request; const f=await fixture(t,{fetchImpl:async(url,options)=>{request=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/chat/completions');return reply(envelope(observation()));}});
  const r=await f.post(); assert.equal(r.status,200); assert.deepEqual((await r.json()).result,observation());
  assert.equal(request.store,false); assert.equal(request.response_format.json_schema.strict,true); assert.equal(request.max_tokens,1800);
  assert.equal(r.headers.get('cache-control'),'no-store');
});
test('malformed, incomplete, refused and invalid upstream responses fail closed', async t => {
  const cases = [{choices:[]},{choices:[{finish_reason:'length',message:{content:'{}'}}]}, {choices:[{finish_reason:'stop',message:{refusal:'No'}}]}, envelope(null), envelope({...observation(),what_to_check:['English only']}), envelope({...observation(),confidence:'high'}), envelope({...observation(),likely_causes:[{name:'Definite disease',name_es:'x',why:'x',why_es:'x'}]})];
  for (const body of cases) {
    const f=await fixture(t,{fetchImpl:async()=>reply(body)});
    assert.equal((await f.post()).status,502);
    assert.equal((await fetch(f.base+'/api/status')).status,200);
  }
});
test('unusable photo cannot return cause lists or inspection instructions', async t => {
  const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...observation(),photo_usable:false}))});
  const r=await (await f.post()).json(); assert.deepEqual(r.result.likely_causes,[]); assert.deepEqual(r.result.what_to_check,[]);
});
test('network errors, upstream errors and invalid JSON are contained', async t => {
  for (const fetchImpl of [async()=>{throw new Error('network')},async()=>new Response('denied',{status:401}),async()=>new Response('not JSON')]) {
    const f=await fixture(t,{fetchImpl}); assert.equal((await f.post()).status,502); assert.equal((await fetch(f.base+'/api/status')).status,200);
  }
});
test('slow upstream times out and releases its concurrency slot', async t => {
  const f=await fixture(t,{timeoutMs:25,fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))});
  for (let i=0;i<3;i++) {const r=await f.post();assert.equal(r.status,504);assert.equal((await r.json()).error,'timeout');}
});
test('single-process request budget bounds repeated paid calls', async t => {
  let calls=0;const f=await fixture(t,{fetchImpl:async()=>{calls++;return reply(envelope(observation()));}});
  for(let i=0;i<10;i++)assert.equal((await f.post()).status,200);
  assert.equal((await f.post()).status,429);assert.equal(calls,10);
});
