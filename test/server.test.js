const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const photo = 'data:image/jpeg;base64,/9j/2Q==';
const input = { image: photo, crop: 'almond', symptom: 'spots', consent: true };
const bi = (en, es) => ({ en, es });
const observation = () => ({
  photo_usable: true,
  overall: 'problem_found',
  photo_note: bi('Brown spots are visible on leaves.', 'Se ven manchas cafés en las hojas.'),
  crop_seen: bi('Almond leaves', 'Hojas de almendro'),
  possible_problems: [{
    name_en: 'Possible leaf spot', name_es: 'Posible mancha foliar',
    looks_like_en: 'Small brown spots with pale edges.', looks_like_es: 'Manchas cafés pequeñas con bordes claros.',
    first_steps: [bi('Check nearby leaves without touching them.', 'Revise las hojas cercanas sin tocarlas.')],
  }],
  tell_supervisor_today: false,
  report_to_supervisor: bi('Please review these visible spots.', 'Por favor revise estas manchas visibles.'),
});
const envelope = result => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
const reply = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
async function fixture(t, options = {}) {
  const server = createServer({ key: 'test-only-not-a-real-key', ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, post: (body = input, headers = {}) => fetch(base + '/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }) };
}
test('core and truthful status remain usable with no API key', async t => {
  const f = await fixture(t, { key: '' });
  assert.equal((await fetch(f.base)).status, 200);
  const status = await (await fetch(f.base + '/api/status')).json();
  assert.equal(status.aiEnabled, false); assert.equal(status.connectionVerified, false);
  assert.equal((await f.post()).status, 503);
  assert.equal((await fetch(f.base + '/.env')).status, 404);
});
test('rejects malformed bodies, absent consent, invalid categories, foreign origins and excessive uploads before spending', async t => {
  let calls = 0; const f = await fixture(t, { fetchImpl: async () => { calls++; return reply(envelope(observation())); } });
  for (const value of [null, [], {}, { ...input, consent: false }, { ...input, crop: 'injected instructions' }, { ...input, image: 'https://example.com/secret' }]) assert.equal((await f.post(value)).status, 400);
  assert.equal((await f.post(input, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await f.post(input, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.post({ ...input, image: 'x'.repeat(8 * 1024 * 1024) })).status, 413);
  assert.equal(calls, 0);
});
test('unknown symptom is allowed as "unsure" so a photo can be assessed first', async t => {
  let request; const f = await fixture(t, { fetchImpl: async (_url, options) => { request = JSON.parse(options.body); return reply(envelope(observation())); } });
  assert.equal((await f.post({ ...input, symptom: 'unsure' })).status, 200);
  assert.match(request.messages[1].content[0].text, /unsure/);
});
test('valid bilingual observations use strict schema, bounded tokens and no stored completion', async t => {
  let request; const f = await fixture(t, { fetchImpl: async (url, options) => { request = JSON.parse(options.body); assert.equal(url, 'https://api.openai.com/v1/chat/completions'); return reply(envelope(observation())); } });
  const r = await f.post(); assert.equal(r.status, 200); assert.deepEqual((await r.json()).result, observation());
  assert.equal(request.store, false); assert.equal(request.response_format.json_schema.strict, true); assert.equal(request.max_tokens, 2800);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});
test('malformed, incomplete, refused and invalid upstream responses fail closed', async t => {
  const cases = [
    { choices: [] },
    { choices: [{ finish_reason: 'length', message: { content: '{}' } }] },
    { choices: [{ finish_reason: 'stop', message: { refusal: 'No' } }] },
    envelope(null),
    envelope({ ...observation(), possible_problems: [{ ...observation().possible_problems[0], first_steps: ['English only'] }] }),
    envelope({ ...observation(), confidence: 'high' }),
  ];
  for (const body of cases) {
    const f = await fixture(t, { fetchImpl: async () => reply(body) });
    assert.equal((await f.post()).status, 502);
    assert.equal((await fetch(f.base + '/api/status')).status, 200);
  }
});
test('unusable photo returns no problems and asks for a retake', async t => {
  const f = await fixture(t, { fetchImpl: async () => reply(envelope({ ...observation(), photo_usable: false })) });
  const r = await (await f.post()).json();
  assert.deepEqual(r.result.possible_problems, []);
});
test('network errors, upstream errors and invalid JSON are contained', async t => {
  for (const fetchImpl of [async () => { throw new Error('network'); }, async () => new Response('denied', { status: 401 }), async () => new Response('not JSON')]) {
    const f = await fixture(t, { fetchImpl }); assert.equal((await f.post()).status, 502); assert.equal((await fetch(f.base + '/api/status')).status, 200);
  }
});
test('slow upstream times out and releases its concurrency slot', async t => {
  const f = await fixture(t, { timeoutMs: 25, fetchImpl: async (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
  for (let i = 0; i < 3; i++) { const r = await f.post(); assert.equal(r.status, 504); assert.equal((await r.json()).error, 'timeout'); }
});
test('single-process request budget bounds repeated paid calls', async t => {
  let calls = 0; const f = await fixture(t, { fetchImpl: async () => { calls++; return reply(envelope(observation())); } });
  for (let i = 0; i < 10; i++) assert.equal((await f.post()).status, 200);
  assert.equal((await f.post()).status, 429); assert.equal(calls, 10);
});
test('a healthy-looking plant returns looks_healthy with no problem list', async t => {
  const healthy = { ...observation(), overall: 'looks_healthy', possible_problems: [], report_to_supervisor: bi('Looks healthy from this photo.', 'Se ve sana en esta foto.') };
  const f = await fixture(t, { fetchImpl: async () => reply(envelope(healthy)) });
  const r = await (await f.post()).json();
  assert.equal(r.result.overall, 'looks_healthy'); assert.deepEqual(r.result.possible_problems, []);
});
test('an unknown overall verdict fails closed', async t => {
  const f = await fixture(t, { fetchImpl: async () => reply(envelope({ ...observation(), overall: 'definitely_diseased' })) });
  assert.equal((await f.post()).status, 502);
});
test('Seeds and Harvest are validated and passed to the provider', async t => {
  const requests=[];const f=await fixture(t,{fetchImpl:async(_url,options)=>{requests.push(JSON.parse(options.body));return reply(envelope(observation()));}});
  for(const mode of ['seeds','harvest'])assert.equal((await f.post({image:photo,consent:true,mode})).status,200);
  assert.match(requests[0].messages[1].content[0].text,/Focus: seeds/);
  assert.match(requests[1].messages[1].content[0].text,/Focus: harvest/);
  // Seeds guidance reaches the model for v3 requests, so seedlings are not treated as a different stage.
  const seedsV3=[];const g=await fixture(t,{fetchImpl:async(_url,options)=>{seedsV3.push(JSON.parse(options.body));return reply(envelope(evidence()));}});
  assert.equal((await g.post({...input,mode:'seeds',analysisVersion:3})).status,200);
  assert.match(seedsV3[0].messages[0].content,/SEEDS FOCUS/);
  assert.match(seedsV3[0].messages[0].content,/damping-off/);
  assert.equal((await f.post({...input,mode:'unknown'})).status,400);
  assert.equal(requests.length,2);
});
test('unusable photo cannot claim a crop, healthy verdict or urgent flag', async t => {
  const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...observation(),photo_usable:false,overall:'looks_healthy',tell_supervisor_today:true}))});
  const {result}=await(await f.post()).json();
  assert.equal(result.overall,'unclear');assert.equal(result.tell_supervisor_today,false);
  assert.equal(result.crop_seen.en,'Could not identify');assert.match(result.report_to_supervisor.en,/another photo/);
});
test('contradictory healthy result is downgraded and empty crop gets a readable fallback', async t => {
  const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...observation(),overall:'looks_healthy',crop_seen:bi('','')}))});
  const {result}=await(await f.post()).json();assert.equal(result.overall,'unclear');assert.equal(result.crop_seen.en,'Could not identify');
  assert.match(result.report_to_supervisor.en,/inconsistent/);
});
test('a blank observation or supervisor summary is filled in, not rejected', async t => {
  for(const property of ['photo_note','report_to_supervisor']){
    const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...observation(),[property]:bi('','')}))});
    const response=await f.post();
    assert.equal(response.status,200);
    const {result}=await response.json();
    for(const lang of ['en','es']){assert.ok(result.photo_note[lang].trim());assert.ok(result.report_to_supervisor[lang].trim());}
  }
});
test('extra problems are trimmed to three instead of failing', async t => {
  const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...observation(),possible_problems:[1,2,3,4].map(()=>observation().possible_problems[0])}))});
  const response=await f.post();
  assert.equal(response.status,200);
  assert.equal((await response.json()).result.possible_problems.length,3);
});
test('compatible provider receives JSON mode and status identifies it for consent', async t => {
  let request;const f=await fixture(t,{baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'test-model',fetchImpl:async(url,options)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');request=JSON.parse(options.body);return reply(envelope(observation()));}});
  assert.equal((await f.post()).status,200);assert.equal(request.response_format.type,'json_object');assert.match(request.messages[0].content,/JSON Schema/);
  assert.equal((await(await fetch(f.base+'/api/status')).json()).provider.name,'Google Gemini');
});

const evidence = () => ({
 photo_usable:true,crop:'Tomato',crop_identification:'identified',stage_match:'matches',stage_note:'',overall:'problem_found',
 observation_summary:'Brown patches are visible on the fruit.',
 evidence:[{view:'overview',observation:'The fruit has brown patches.'}],
 possible_problems:[{name:'Possible surface injury',evidence_indices:[0],why_possible:'Damage appears on one exposed side.',how_to_distinguish:'Check whether the same side is affected on nearby fruit.'}],
 next_steps:['Show the affected fruit to your supervisor.'],
 follow_up:{question:'Do nearby fruit show the same marks?',options:['Yes','No','Not sure']},
 limits:'A photo cannot establish the cause.',report_to_supervisor:'Please review the brown patches visible on this fruit.'
});
const enhanced = {...input,analysisVersion:3,mode:'harvest',language:'en'};
test('v3 compares two views, requests one language, reports provenance and verifies a successful call',async t=>{
 let request;const f=await fixture(t,{fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);return reply(envelope({...evidence(),evidence:[...evidence().evidence,{view:'detail',observation:'The patch has a dry edge.'}]}));}});
 const response=await f.post({...enhanced,detailImage:photo});assert.equal(response.status,200);const {result,meta}=await response.json();
 assert.equal(request.messages[1].content.filter(c=>c.type==='image_url').length,2);assert.match(request.messages[1].content[0].text,/Language: English/);
 assert.equal(request.response_format.json_schema.name,'crop_evidence');assert.equal(request.max_tokens,3000);assert.equal(result.evidence[1].view,'detail');
 assert.equal(meta.imageCount,2);assert.equal(meta.analysisVersion,3);assert.equal(meta.model,'gpt-4o-mini');assert.equal(typeof meta.requestId,'string');assert.ok(meta.elapsedMs>=0);
 assert.equal((await(await fetch(f.base+'/api/status')).json()).connectionVerified,true);
 assert.equal((await fetch(f.base+'/settings')).status,200);
});
test('v3 follow-up is user-reported context, requests Spanish only, and completes the one-question loop',async t=>{
 let request;const f=await fixture(t,{fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);return reply(envelope(evidence()));}});
 const response=await f.post({...enhanced,language:'es',followUp:{question:'Nearby plants?',answer:'Not sure'}});
 assert.equal(response.status,200);assert.match(request.messages[1].content[0].text,/Language: Spanish/);assert.match(request.messages[1].content[0].text,/User-reported context \(not visually verified\)/);assert.match(request.messages[1].content[0].text,/Not sure/);
 assert.deepEqual((await response.json()).result.follow_up,{question:'',options:[]});
});
test('v3 rejects invalid photo and evidence references without relabeling them',async t=>{
 const cases=[
  {...evidence(),evidence:[{view:'detail',observation:'Not supplied.'}]},
  {...evidence(),evidence:[]},
  {...evidence(),evidence:[{view:'other',observation:'Invalid view.'}]},
  {...evidence(),possible_problems:[{...evidence().possible_problems[0],evidence_indices:[4]}]},
  {...evidence(),possible_problems:[{...evidence().possible_problems[0],evidence_indices:[-1]}]},
  {...evidence(),possible_problems:[{...evidence().possible_problems[0],evidence_indices:[]}]},
  {...evidence(),confidence:99},
  {...evidence(),stage_match:'certain'},
  {...evidence(),follow_up:{question:'Question?',options:['Only one answer']}},
 ];
 for(const result of cases){const f=await fixture(t,{fetchImpl:async()=>reply(envelope(result))});const response=await f.post(enhanced);assert.equal(response.status,502);assert.equal((await response.json()).error,'unreadable_response');}
});
test('v3 normalizes unusable photos and conflicting healthy claims without inventing a crop',async t=>{
 for(const language of ['en','es']){
  const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...evidence(),photo_usable:false,overall:'looks_healthy'}))});
  const {result}=await(await f.post({...enhanced,language})).json();assert.equal(result.overall,'unclear');assert.deepEqual(result.evidence,[]);assert.deepEqual(result.possible_problems,[]);assert.deepEqual(result.follow_up.options,[]);assert.equal(result.observation_summary,result.report_to_supervisor);assert.notEqual(result.crop,'Tomato');
 }
 const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...evidence(),overall:'looks_healthy',crop:''}))});const {result}=await(await f.post(enhanced)).json();assert.equal(result.overall,'unclear');assert.equal(result.crop,'Unknown');assert.match(result.report_to_supervisor,/conflict/);
});
test('v3 invalid language, follow-up and detail image do not spend a provider call',async t=>{
 let calls=0;const f=await fixture(t,{fetchImpl:async()=>{calls++;return reply(envelope(evidence()));}});
 for(const extra of [{language:'xx'},{followUp:{}},{followUp:{question:'q',answer:'a'.repeat(201)}},{detailImage:'https://example.com/private'},{detailImage:null}])assert.equal((await f.post({...enhanced,...extra})).status,400);
 assert.equal(calls,0);
});
test('provider failures distinguish invalid key, quota, busy, unavailable model and truncated response',async t=>{
 for(const [status,code,expected] of [[401,'invalid_api_key','invalid_key'],[429,'insufficient_quota','quota_exhausted'],[429,'rate_limit_exceeded','provider_busy'],[404,'model_not_found','model_unavailable']]){
  const f=await fixture(t,{fetchImpl:async()=>new Response(JSON.stringify({error:{code}}),{status})});assert.equal((await(await f.post(enhanced)).json()).error,expected);
 }
 const f=await fixture(t,{fetchImpl:async()=>reply({choices:[{finish_reason:'length',message:{content:'{}'}}]})});assert.equal((await(await f.post(enhanced)).json()).error,'incomplete_response');
});

test('team reference examples are sent before the photo, and skipped when unusable', async t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cropsight-refs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'ref.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify([
    { file: 'ref.png', crop: 'lettuce', stage: 'seeds', label: 'Lettuce seed lot' },
    { file: '../outside.png', crop: 'x', label: 'escapes the folder' },
    { file: 'missing.jpg', crop: 'x', label: 'no file' },
  ]));
  const sent = [];
  const f = await fixture(t, { referencesDir: dir, fetchImpl: async (_url, options) => { sent.push(JSON.parse(options.body)); return reply(envelope(evidence())); } });
  assert.equal((await f.post({ ...input, mode: 'seeds', analysisVersion: 3 })).status, 200);
  const content = sent[0].messages[1].content;
  const refIndex = content.findIndex(b => b.type === 'image_url' && b.image_url.url.startsWith('data:image/png'));
  assert.ok(refIndex > 0, 'reference image is sent');
  assert.equal(content.filter(b => b.type === 'image_url' && b.image_url.url.startsWith('data:image/png')).length, 1, 'escaping and missing entries are skipped');
  assert.match(content[refIndex - 1].text, /crop lettuce, stage seeds\. Label: Lettuce seed lot/);
});

test('the crop guide is loaded into the evidence prompt for every crop', async t => {
  const sent = [];
  const f = await fixture(t, { fetchImpl: async (_url, options) => { sent.push(JSON.parse(options.body)); return reply(envelope(evidence())); } });
  assert.equal((await f.post({ ...input, mode: 'harvest', analysisVersion: 3 })).status, 200);
  assert.match(sent[0].messages[0].content, /CROP GUIDE/);
  assert.match(sent[0].messages[0].content, /- Lettuce \(Vegetable.*\)\. Seeds:/);
});
test('common seeds (apple, tomato, lettuce, orange, banana, grape, cucumber, pepper, watermelon, bean, strawberry) have guide context without forced classifications', () => {
  const analysis = require('../analysis');
  const guide = analysis.loadSeedGuide(require('path').join(__dirname, '..', 'references', 'seed_guide.txt'));
  const prompt = analysis.promptFor('seeds', '', guide);
  for (const crop of ['Apple', 'Tomato', 'Lettuce', 'Orange', 'Banana', 'Grape', 'Cucumber', 'Pepper', 'Watermelon', 'Bean', 'Strawberry']) {
    assert.match(guide, new RegExp(`^- ${crop}[:\\s]`, 'm'), `${crop} missing from seed guide`);
  }
  assert.match(prompt, /Unknown is a valid answer/);
  assert.doesNotMatch(prompt, /Never answer Unknown|must be one of the allowed crop names|QUICK KEY/);
});

test('usable seed photos can remain Unknown and are never inferred from problem names', async t => {
  const requests = [];
  const f = await fixture(t, { fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return reply(envelope(seedResult({ crop: 'Unknown', possible_problems: [{ name: 'Cucumber', evidence_indices: [0], why_possible: 'Smooth flat seed with a pale rim.', how_to_distinguish: 'Tomato seeds are fuzzy.' }] }))); } });
  const response = await f.post({ ...input, mode: 'seeds', analysisVersion: 3, consent: true });
  assert.equal(response.status, 200);
  const { result } = await response.json();
  assert.equal(result.crop, 'Unknown');
  assert.equal(result.crop_identification, 'unknown');
  const cropSchema = requests[0].response_format.json_schema.schema.properties.crop;
  assert.equal(cropSchema.enum, undefined);
});
test('harvest keeps a free-text crop field and unusable photos stay Unknown', async t => {
  const requests = [];
  const f = await fixture(t, { fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return reply(envelope(seedResult({ photo_usable: false, crop: 'Unknown', possible_problems: [] }))); } });
  const unusable = await f.post({ ...input, mode: 'seeds', analysisVersion: 3, consent: true });
  assert.equal((await unusable.json()).result.crop, 'Unknown');
  await f.post({ ...input, mode: 'harvest', analysisVersion: 3, consent: true });
  assert.equal(requests[1].response_format.json_schema.schema.properties.crop.enum, undefined);
});
const seedResult = (over = {}) => ({
  photo_usable: true, crop: 'Tomato', crop_identification: 'tentative', stage_match: 'matches', stage_note: '', overall: 'unclear',
  observation_summary: 'Small flat seeds with a smooth pale rim.',
  evidence: [{ view: 'overview', observation: 'Flat oval seeds with a pale margin.' }],
  possible_problems: [], next_steps: ['Photograph one seed beside a coin.'],
  follow_up: { question: '', options: [] }, limits: 'A photo cannot show viability.',
  report_to_supervisor: 'Seeds visible; likely cucumber.', ...over,
});

test('tentative crop labels remain explicit in English and Spanish', async t => {
  for (const [language, label] of [['en', 'Possible Tomato'], ['es', 'Posible Tomato']]) {
    const f = await fixture(t, {fetchImpl: async () => reply(envelope(seedResult({crop: 'Tomato (likely)'})))});
    const response = await f.post({...enhanced, mode:'seeds', language});
    assert.equal(response.status, 200); assert.equal((await response.json()).result.crop, label);
  }
});
test('unknown identification overrides a named crop, and missing identification is rejected', async t => {
  const f = await fixture(t, {fetchImpl: async () => reply(envelope({...evidence(),crop_identification:'unknown'}))});
  assert.equal((await(await f.post(enhanced)).json()).result.crop, 'Unknown');
  const value=evidence();delete value.crop_identification;
  const missing=await fixture(t,{fetchImpl:async()=>reply(envelope(value))});
  assert.equal((await missing.post(enhanced)).status,502);
});
