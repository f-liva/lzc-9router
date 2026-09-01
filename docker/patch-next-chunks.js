const fs = require('node:fs');

function parseArguments(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function convertChatCompletionToAnthropic(message) {
  const parse = value => { if (!value) return {}; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch { return {}; } };
  if (!message || message.object !== 'chat.completion' || !message.choices?.[0]) return message;
  const choice = message.choices[0];
  const source = choice.message || {};
  const content = [];
  if (typeof source.content === 'string' && source.content.length) {
    content.push({ type: 'text', text: source.content });
  }
  for (const [index, toolCall] of (source.tool_calls || []).entries()) {
    const fn = toolCall.function || {};
    content.push({
      type: 'tool_use',
      id: toolCall.id || `toolu_${Date.now()}_${index}`,
      name: fn.name || toolCall.name || '',
      input: parse(fn.arguments || toolCall.arguments),
    });
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  const usage = message.usage || {};
  const stopReasons = { tool_calls: 'tool_use', length: 'max_tokens' };
  return {
    id: String(message.id || `msg_${Date.now()}`).replace(/^chatcmpl-/, ''),
    type: 'message',
    role: 'assistant',
    model: message.model || 'unknown',
    content,
    stop_reason: stopReasons[choice.finish_reason] || 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: (usage.prompt_tokens || usage.input_tokens || 0) +
        (usage.prompt_tokens_details?.cached_tokens || 0),
      output_tokens: usage.completion_tokens || usage.output_tokens || 0,
    },
  };
}

function convertResponsesToAnthropic(response) {
  const parse = value => { if (!value) return {}; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch { return {}; } };
  if (!response || !Array.isArray(response.output)) return response;
  const content = [];
  for (const item of response.output) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block?.type === 'output_text') content.push({ type: 'text', text: block.text || '' });
      }
    } else if (item?.type === 'function_call') {
      content.push({
        type: 'tool_use',
        id: item.call_id || item.id || `toolu_${Date.now()}_${content.length}`,
        name: item.name || '',
        input: parse(item.arguments),
      });
    }
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  const usage = response.usage || {};
  return {
    id: String(response.id || `msg_${Date.now()}`),
    type: 'message',
    role: 'assistant',
    model: response.model || 'unknown',
    content,
    stop_reason: content.some(block => block.type === 'tool_use') ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: (usage.input_tokens || 0) + (usage.cache_read_input_tokens || usage.cached_tokens || 0) +
        (usage.cache_creation_input_tokens || 0),
      output_tokens: usage.output_tokens || 0,
    },
  };
}

const HELPER = ';globalThis.__convertChat9r=' + convertChatCompletionToAnthropic.toString() +
  ';globalThis.__convertResponses9r=' + convertResponsesToAnthropic.toString() + ';';

function patchChunk(source) {
  if (source.includes('globalThis.__convertChat9r=')) return source;
  let patched = source.replace(
    'let E=a.headers.get("content-type")||"";if(',
    'let E=a.headers.get("content-type")||"",_target9r=c;if(',
  );
  patched = patched.replace(
    'JSON.stringify(g),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})',
    'JSON.stringify(_target9r===i.h.CLAUDE?globalThis.__convertResponses9r(g):g),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})',
  );
  patched = patched.replace(
    'JSON.stringify(c),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Responses API SSE→JSON failed:',
    'JSON.stringify(_target9r===i.h.CLAUDE&&c&&"chat.completion"===c.object?globalThis.__convertChat9r(c):c),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Responses API SSE→JSON failed:',
  );
  patched = patched.replace(
    'JSON.stringify(o),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Chat Completions SSE→JSON failed:',
    'JSON.stringify(_target9r===i.h.CLAUDE&&o&&"chat.completion"===o.object?globalThis.__convertChat9r(o):o),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}}catch(a){return console.error("[ChatCore] Chat Completions SSE→JSON failed:',
  );
  return patched === source ? source : patched + HELPER;
}

if (require.main === module) {
  let changed = 0;
  for (const file of process.argv.slice(2)) {
    const source = fs.readFileSync(file, 'utf8');
    const patched = patchChunk(source);
    if (patched !== source) {
      fs.writeFileSync(file, patched);
      console.log(`[entrypoint] patch Codex Anthropic applicata a ${file}`);
      changed++;
    }
  }
  if (!changed) console.log('[entrypoint] patch Codex Anthropic già applicata o pattern assente');
}

module.exports = { convertChatCompletionToAnthropic, convertResponsesToAnthropic, patchChunk };
