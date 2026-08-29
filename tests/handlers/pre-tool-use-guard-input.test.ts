import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/handlers/emit.js', () => ({ emitEvent: vi.fn() }));

import { handlePreToolUse } from '../../src/handlers/pre-tool-use.js';
import type { PintaCodexConfig } from '../../src/core/config.js';
import type { PreToolUseEvent } from '../../src/core/types.js';

/**
 * The hook payload carries more than the guard was being told.
 *
 * `cwd` locates a relative target — `rm -rf passwd` reads as routine work
 * until you know it was issued from /etc (PTA-176) — and `hook_event_name` is
 * what lets the manager trust `tool_name`, since Claude Code owns those names
 * and codex does not, so without it a tool called `Read` is taken at its word
 * and its arguments are read as content rather than as a command (PTA-207).
 *
 * Asserted on the POST body rather than on a mocked `evaluateGuard`, so the
 * whole chain — handler, the codex binding, and @pinta-ai/core — has to carry
 * the fields for this to pass.
 */
describe('handlePreToolUse — what the guard is told about the invocation', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('puts the working directory and the event on the wire', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ decision: 'ALLOW', reason: null, durationMs: 1 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    globalThis.fetch = fetchMock as never;

    await handlePreToolUse(
      {
        hook_event_name: 'PreToolUse',
        session_id: 's1',
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf passwd' },
        cwd: '/etc',
      } as PreToolUseEvent,
      { guardEndpoint: 'http://127.0.0.1:5147/guard/evaluate' } as PintaCodexConfig,
    );

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.input).toMatchObject({ cwd: '/etc', method: 'PreToolUse' });
  });
});
