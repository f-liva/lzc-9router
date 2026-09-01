const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {
  convertChatCompletionToAnthropic,
  convertResponsesToAnthropic,
  patchChunk,
} = require('../docker/patch-next-chunks');

test('converts Codex chat completion to Anthropic Message', () => {
  const result = convertChatCompletionToAnthropic({
    id: 'chatcmpl-123',
    object: 'chat.completion',
    model: 'gpt-5.6-sol',
    choices: [{
      finish_reason: 'tool_calls',
      message: {
        content: 'Done',
        tool_calls: [{ id: 'call_1', function: { name: 'Read', arguments: '{"file_path":"/x"}' } }],
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 4 },
  });

  assert.deepEqual(result, {
    id: '123',
    type: 'message',
    role: 'assistant',
    model: 'gpt-5.6-sol',
    content: [
      { type: 'text', text: 'Done' },
      { type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: '/x' } },
    ],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 4 },
  });
});

test('converts Codex Responses payload to Anthropic Message', () => {
  const result = convertResponsesToAnthropic({
    id: 'resp_123',
    model: 'gpt-5.6-sol',
    output: [
      { type: 'message', content: [{ type: 'output_text', text: 'Done' }] },
      { type: 'function_call', call_id: 'call_1', name: 'Read', arguments: '{"file_path":"/x"}' },
    ],
    usage: { input_tokens: 10, output_tokens: 4 },
  });

  assert.equal(result.type, 'message');
  assert.equal(result.stop_reason, 'tool_use');
  assert.deepEqual(result.content[1].input, { file_path: '/x' });
});

test('patches both Codex SSE-to-JSON paths only for Claude target', () => {
  const source = 'let E=a.headers.get("content-type")||"";if(n(d)||c===i.h.OPENAI_RESPONSES)try{' +
    'return{success:!0,response:new Response(JSON.stringify(g),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})};' +
    'return{success:!0,response:new Response(JSON.stringify(c),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Responses API SSE→JSON failed:",a)' +
    'return{success:!0,response:new Response(JSON.stringify(o),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Chat Completions SSE→JSON failed:",a)' +
    'Failed to convert streaming response to JSON")}}';

  const patched = patchChunk(source);
  assert.match(patched, /,_target9r=c;if/);
  assert.match(patched, /_target9r===i\.h\.CLAUDE/);
  assert.match(patched, /__convertChat9r/);
  assert.match(patched, /__convertResponses9r/);
  assert.doesNotMatch(patched, /JSON\.stringify\(g\),\{headers/);
  assert.equal(patchChunk(patched), patched);
});


test('leaves unknown upstream chunks untouched', () => {
  const source = 'console.log("new upstream build")';
  assert.equal(patchChunk(source), source);
});


test('injected helper runs without module-local dependencies', () => {
  const source = 'let E=a.headers.get("content-type")||"";if(n(d)||c===i.h.OPENAI_RESPONSES)try{' +
    'return{success:!0,response:new Response(JSON.stringify(g),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})};' +
    'return{success:!0,response:new Response(JSON.stringify(c),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Responses API SSE→JSON failed:",a)' +
    'return{success:!0,response:new Response(JSON.stringify(o),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Chat Completions SSE→JSON failed:",a)' +
    'Failed to convert streaming response to JSON")}}';
  const patched = patchChunk(source);
  const context = {};
  vm.runInNewContext(patched.slice(patched.indexOf(';globalThis.__convertChat9r=')), context);
  const result = context.__convertChat9r({
    id: 'chatcmpl-1', object: 'chat.completion', choices: [{ message: {
      tool_calls: [{ id: 'call_1', function: { name: 'Read', arguments: '{"file_path":"/x"}' } }],
    } }],
  });
  assert.equal(result.content[0].input.file_path, '/x');
});
