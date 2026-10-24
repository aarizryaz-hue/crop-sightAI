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
  assert.equal(request.store, false); assert.equal(request.response_format.json_schema.strict, true); assert.equal(request.max_tokens, 1800);
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
    envelope({ ...observation(), possible_problems: [1, 2, 3, 4].map(() => observation().possible_problems[0]) }),
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
test('a blank observation or supervisor summary is rejected', async t => {
  for(const property of ['photo_note','report_to_supervisor']){
    const f=await fixture(t,{fetchImpl:async()=>reply(envelope({...observation(),[property]:bi('','')}))});
    assert.equal((await f.post()).status,502);
  }
});
test('compatible provider receives JSON mode and status identifies it for consent', async t => {
  let request;const f=await fixture(t,{baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'test-model',fetchImpl:async(url,options)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');request=JSON.parse(options.body);return reply(envelope(observation()));}});
  assert.equal((await f.post()).status,200);assert.equal(request.response_format.type,'json_object');assert.match(request.messages[0].content,/JSON Schema/);
  assert.equal((await(await fetch(f.base+'/api/status')).json()).provider.name,'Google Gemini');
});
