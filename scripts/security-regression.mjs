import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const uri = require('fast-uri');
const Router = require('find-my-way');
const fastify = require('fastify');
let failures = 0;
async function check(name, fn) { try { await fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); } }
// GHSA-v2hh-gcrm-f6hx: policy parser must not approve a different host.
await check('URI backslash authority agreement', () => {
  const input = String.raw`http://evil.example\@allowed.example`;
  const parsed = uri.parse(input);
  assert.ok(parsed.error || parsed.host === new URL(input).hostname);
});
// GHSA-c96f-x56v-gq3h: inherited names must not crash HTTP/2 routing.
await check('router inherited method names', () => {
  const router = Router(); router.on('GET', '/', () => {});
  for (const method of ['constructor', 'toString', '__proto__']) assert.equal(router.find(method, '/'), null);
});
// GHSA-w2qp-rph6-63g4: handler must see the validated primitive type.
await check('validated primitive reaches handler', async () => {
  const app = fastify();
  try {
    app.post('/', { schema: { body: { type: 'integer', minimum: 1, maximum: 10 } } }, async req => ({ type: typeof req.body, value: req.body }));
    const response = await app.inject({ method: 'POST', url: '/', headers: { 'content-type': 'application/json' }, payload: JSON.stringify('10') });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { type: 'number', value: 10 });
  } finally { await app.close(); }
});
process.exitCode = failures ? 1 : 0;
