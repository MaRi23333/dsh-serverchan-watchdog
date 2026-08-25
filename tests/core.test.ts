import { test } from 'node:test'
import assert from 'node:assert/strict'
import './env-isolation.ts'
import { PendingTracker, buildPushUrl, describeExitPlanCall, describeQuestionCall, minutesValue, recoverPending } from '../src/core.ts'

test('buildPushUrl: classic SendKey', () => {
  assert.equal(buildPushUrl('SCTabc'), 'https://sctapi.ftqq.com/SCTabc.send')
})

test('buildPushUrl: sctp SendKey', () => {
  assert.equal(buildPushUrl('sctp123tAbCdEf'), 'https://123.push.ft07.com/send/sctp123tAbCdEf.send')
})

test('buildPushUrl: full URL passes through', () => {
  assert.equal(
    buildPushUrl('https://123.push.ft07.com/send/sctp123tX.send'),
    'https://123.push.ft07.com/send/sctp123tX.send',
  )
})

test('buildPushUrl: accepts documented key characters and normalizes an optional URL slash', () => {
  assert.equal(buildPushUrl('SCTa_b-c'), 'https://sctapi.ftqq.com/SCTa_b-c.send')
  assert.equal(buildPushUrl('sctp123tA_b-c'), 'https://123.push.ft07.com/send/sctp123tA_b-c.send')
  assert.equal(buildPushUrl('https://sctapi.ftqq.com/SCTa_b-c.send/'), 'https://sctapi.ftqq.com/SCTa_b-c.send')
})

test('buildPushUrl: malformed credentials are rejected', () => {
  assert.equal(buildPushUrl('sctp-no-uid'), null)
  assert.equal(buildPushUrl(''), null)
  assert.equal(buildPushUrl('   '), null)
})

test('buildPushUrl: uppercase SCTP is rejected, not misrouted to the classic endpoint', () => {
  assert.equal(buildPushUrl('SCTP123tAb'), null)
  assert.equal(buildPushUrl('https://sctapi.ftqq.com/SCTP123tAb.send'), null)
})

test('buildPushUrl: full URL limited to official ServerChan hosts (https only)', () => {
  assert.equal(buildPushUrl('https://sctapi.ftqq.com/SCTa.send'), 'https://sctapi.ftqq.com/SCTa.send')
  assert.equal(
    buildPushUrl('https://42.push.ft07.com/send/sctp42tX.send'),
    'https://42.push.ft07.com/send/sctp42tX.send',
  )
  assert.equal(buildPushUrl('http://127.0.0.1:8080/send'), null)
  assert.equal(buildPushUrl('https://evil.example.com/x'), null)
})

test('buildPushUrl: rejects URL credentials, query/hash, malformed paths, and mismatched SC3 uid', () => {
  assert.equal(buildPushUrl('https://u:p@sctapi.ftqq.com/SCTa.send'), null)
  assert.equal(buildPushUrl('https://sctapi.ftqq.com/SCTa.send?x=1'), null)
  assert.equal(buildPushUrl('https://sctapi.ftqq.com/SCTa.send#fragment'), null)
  assert.equal(buildPushUrl('https://sctapi.ftqq.com/not-a-send'), null)
  assert.equal(buildPushUrl('https://42.push.ft07.com/send/sctp43tX.send'), null)
  assert.equal(buildPushUrl('not-a-sendkey'), null)
})

test('describeQuestionCall parses a question payload', () => {
  const raw = JSON.stringify({ questions: [{ id: 'q1', question: '继续吗？' }] })
  assert.deepEqual(describeQuestionCall(raw), { kind: 'question', detail: '继续吗？' })
})

test('describeQuestionCall detects a plan-review intent', () => {
  const raw = JSON.stringify({
    questions: [{ id: 'q1', question: '请审查该计划', intent: { kind: 'plan-review', approve: '批准' } }],
  })
  assert.deepEqual(describeQuestionCall(raw), { kind: 'plan-review', detail: '请审查该计划' })
})

test('describeQuestionCall rejects garbage and empty question lists', () => {
  assert.equal(describeQuestionCall('not json'), null)
  assert.equal(describeQuestionCall('{}'), null)
  assert.equal(describeQuestionCall(JSON.stringify({ questions: [] })), null)
})

test('describeExitPlanCall samples the plan text and never fails', () => {
  const raw = JSON.stringify({ plan: '# Implement the widget\n\nDo the thing.' })
  assert.equal(describeExitPlanCall(raw), '计划审查：# Implement the widget Do the thing.')
  assert.equal(describeExitPlanCall('garbage'), '计划审查（无计划文本）')
  assert.equal(describeExitPlanCall(JSON.stringify({})), '计划审查（无计划文本）')
})

test('PendingTracker fires once after the threshold', async () => {
  const fired: string[] = []
  const tracker = new PendingTracker({ thresholdMs: 20, repeatMs: 0, onFire: p => { fired.push(p.id) } })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.deepEqual(fired, ['q:1'])
  tracker.dispose()
})

test('PendingTracker.stop() before the threshold suppresses the push', async () => {
  const fired: string[] = []
  const tracker = new PendingTracker({ thresholdMs: 20, repeatMs: 0, onFire: p => { fired.push(p.id) } })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  tracker.stop('q:1')
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.deepEqual(fired, [])
})

test('PendingTracker repeats while active and stops after stop()', async () => {
  const fired: string[] = []
  const tracker = new PendingTracker({ thresholdMs: 15, repeatMs: 15, onFire: p => { fired.push(p.id) } })
  tracker.start({ id: 'a:9', kind: 'approval', sessionId: 's', detail: 'd' })
  await new Promise(resolve => setTimeout(resolve, 70))
  tracker.stop('a:9')
  const count = fired.length
  assert.ok(count >= 2, `expected at least 2 pushes, got ${count}`)
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(fired.length, count)
  tracker.dispose()
})

test('PendingTracker.start is idempotent and stop of unknown id is a no-op', async () => {
  const fired: string[] = []
  const tracker = new PendingTracker({ thresholdMs: 20, repeatMs: 0, onFire: p => { fired.push(p.id) } })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  assert.equal(tracker.size, 1)
  tracker.stop('q:unknown')
  assert.equal(tracker.size, 1)
  tracker.dispose()
})

test('PendingTracker.has reflects the active set', () => {
  const tracker = new PendingTracker({ thresholdMs: 1000, repeatMs: 0, onFire: () => {} })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  assert.equal(tracker.has('q:1'), true)
  tracker.stop('q:1')
  assert.equal(tracker.has('q:1'), false)
  tracker.dispose()
})

test('PendingTracker uses an injected clock', () => {
  let now = 1_000
  const tracker = new PendingTracker({
    thresholdMs: 1000,
    repeatMs: 0,
    now: () => now,
    after: () => undefined,
    cancel: () => undefined,
    onFire: () => {},
  })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  assert.equal(tracker.list()[0]?.startedAt, 1_000)
  now = 5_000
  assert.equal(tracker.list()[0]?.startedAt, 1_000)
  tracker.dispose()
})

test('PendingTracker re-reads a dynamic threshold per start', async () => {
  let thresholdMs = 50
  const fired: string[] = []
  const tracker = new PendingTracker({
    thresholdMs: () => thresholdMs,
    repeatMs: 0,
    onFire: p => { fired.push(p.id) },
  })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  thresholdMs = 5_000
  await new Promise(resolve => setTimeout(resolve, 90))
  assert.deepEqual(fired, ['q:1']) // fired with the value at start time (50ms)
  tracker.dispose()
})

test('PendingTracker re-reads a dynamic repeat interval per fire', async () => {
  // Deterministic fake clock: manual ticks (microtask-flushed) leave no real timers behind.
  let clock = 0
  let repeatMs = 15
  const todos: Array<{ at: number; fn: () => void; done: boolean }> = []
  const fired: string[] = []
  const tracker = new PendingTracker({
    thresholdMs: 15,
    repeatMs: () => repeatMs,
    now: () => clock,
    after: (ms, fn) => {
      const entry = { at: clock + ms, fn, done: false }
      todos.push(entry)
      return entry
    },
    cancel: entry => { (entry as { done: boolean }).done = true },
    onFire: p => { fired.push(p.id) },
  })
  tracker.start({ id: 'a:2', kind: 'approval', sessionId: 's', detail: 'd' })
  const tick = async (): Promise<void> => {
    clock += 1
    for (const entry of [...todos]) {
      if (!entry.done && entry.at <= clock) {
        entry.done = true
        entry.fn()
      }
    }
    // fire() is async: its repeat-scheduling continuation lands in a microtask
    await new Promise(resolve => setImmediate(resolve))
  }
  // threshold fire at 15, then repeats at 30/45 with the 15ms cadence
  for (let i = 0; i < 45; i += 1) await tick()
  assert.ok(fired.length >= 3)
  repeatMs = 60_000
  // the repeat already scheduled at clock 60 still fires once; the cadence
  // re-read at fire time prevents anything after it.
  for (let i = 0; i < 30; i += 1) await tick()
  const count = fired.length
  for (let i = 0; i < 200; i += 1) await tick()
  assert.equal(fired.length, count)
  tracker.dispose()
})

test('minutesValue accepts integer minutes within range only', () => {
  assert.equal(minutesValue(5, 1, 1440), 5)
  assert.equal(minutesValue(1440, 1, 1440), 1440)
  assert.equal(minutesValue(0, 0, 1440), 0)
  assert.equal(minutesValue(0, 1, 1440), null)
  assert.equal(minutesValue(1441, 0, 1440), null)
  assert.equal(minutesValue(2.5, 1, 1440), null)
  assert.equal(minutesValue('5', 1, 1440), null)
  assert.equal(minutesValue(undefined, 1, 1440), null)
  assert.equal(minutesValue(Infinity, 1, 1440), null)
})

test('PendingTracker retries after a failed fire and stops after success', async () => {
  let clock = 0
  const todos: Array<{ at: number; fn: () => void; done: boolean }> = []
  const fired: string[] = []
  const tracker = new PendingTracker({
    thresholdMs: 10,
    repeatMs: 0,
    retryMs: 20,
    now: () => clock,
    after: (ms, fn) => {
      const entry = { at: clock + ms, fn, done: false }
      todos.push(entry)
      return entry
    },
    cancel: entry => { (entry as { done: boolean }).done = true },
    // first attempt fails, the retry succeeds → no further timers
    onFire: () => {
      fired.push('x')
      return fired.length < 2 ? false : true
    },
  })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  const tick = async (): Promise<void> => {
    clock += 1
    for (const entry of [...todos]) {
      if (!entry.done && entry.at <= clock) {
        entry.done = true
        entry.fn()
      }
    }
    await new Promise(resolve => setImmediate(resolve))
  }
  for (let i = 0; i < 40; i += 1) await tick()
  assert.equal(fired.length, 2)
  tracker.dispose()
})

test('PendingTracker bounds retryable failures to the initial attempt plus two retries', async () => {
  let clock = 0
  const todos: Array<{ at: number; fn: () => void; done: boolean }> = []
  const attempts: number[] = []
  const tracker = new PendingTracker({
    thresholdMs: 1,
    repeatMs: 0,
    retryMs: 1,
    now: () => clock,
    after: (ms, fn) => { const entry = { at: clock + ms, fn, done: false }; todos.push(entry); return entry },
    cancel: entry => { (entry as { done: boolean }).done = true },
    onFire: pending => { attempts.push(pending.pushes); return 'retryable-failure' },
  })
  tracker.start({ id: 'q:bounded', kind: 'question', sessionId: 's', detail: 'd' })
  for (let i = 0; i < 10; i += 1) {
    clock += 1
    for (const entry of [...todos]) if (!entry.done && entry.at <= clock) { entry.done = true; entry.fn() }
    await new Promise(resolve => setImmediate(resolve))
  }
  assert.deepEqual(attempts, [1, 1, 1])
  assert.equal(tracker.has('q:bounded'), false)
  tracker.dispose()
})

test('PendingTracker stops immediately after a terminal failure', async () => {
  const scheduled: Array<() => void> = []
  const tracker = new PendingTracker({
    thresholdMs: 1,
    repeatMs: 10,
    retryMs: 10,
    after: (_ms, fn) => { scheduled.push(fn); return fn },
    cancel: () => {},
    onFire: () => 'terminal-failure',
  })
  tracker.start({ id: 'q:terminal', kind: 'question', sessionId: 's', detail: 'd' })
  scheduled[0]?.()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(tracker.has('q:terminal'), false)
  assert.equal(scheduled.length, 1)
})

test('PendingTracker never re-arms after stop while a fire is in flight', async () => {
  for (const settle of ['resolve', 'reject'] as const) {
    const scheduled: Array<() => void> = []
    let resolveFire!: (value: 'retryable-failure') => void
    let rejectFire!: (reason: Error) => void
    const inFlight = new Promise<'retryable-failure'>((resolve, reject) => {
      resolveFire = resolve
      rejectFire = reject
    })
    const tracker = new PendingTracker({
      thresholdMs: 1,
      repeatMs: 10,
      retryMs: 10,
      after: (_ms, fn) => { scheduled.push(fn); return fn },
      cancel: () => {},
      onFire: () => inFlight,
    })
    tracker.start({ id: `q:${settle}`, kind: 'question', sessionId: 's', detail: 'd' })
    scheduled[0]?.()
    await new Promise(resolve => setImmediate(resolve))
    tracker.stop(`q:${settle}`)
    if (settle === 'resolve') resolveFire('retryable-failure')
    else rejectFire(new Error('boom'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(tracker.has(`q:${settle}`), false)
    assert.equal(scheduled.length, 1)
  }
})

test('PendingTracker numbers successful repeated deliveries monotonically', async () => {
  const scheduled: Array<() => void> = []
  const seen: number[] = []
  const tracker = new PendingTracker({
    thresholdMs: 1,
    repeatMs: 1,
    after: (_ms, fn) => { scheduled.push(fn); return fn },
    cancel: () => {},
    onFire: pending => { seen.push(pending.pushes); return 'delivered' },
  })
  tracker.start({ id: 'q:repeat-number', kind: 'question', sessionId: 's', detail: 'd' })
  scheduled[0]?.()
  await new Promise(resolve => setImmediate(resolve))
  scheduled[1]?.()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(seen, [1, 2])
  tracker.dispose()
})

test('PendingTracker does not spend retry budget while deferred and commits pushes only on delivery', async () => {
  let clock = 0
  const todos: Array<{ at: number; fn: () => void; done: boolean }> = []
  const seen: number[] = []
  let calls = 0
  const tracker = new PendingTracker({
    thresholdMs: 1,
    repeatMs: 0,
    retryMs: 1,
    now: () => clock,
    after: (ms, fn) => { const entry = { at: clock + ms, fn, done: false }; todos.push(entry); return entry },
    cancel: entry => { (entry as { done: boolean }).done = true },
    onFire: pending => {
      seen.push(pending.pushes)
      calls += 1
      return calls < 3 ? 'deferred' : 'delivered'
    },
  })
  tracker.start({ id: 'q:defer', kind: 'question', sessionId: 's', detail: 'd' })
  for (let i = 0; i < 6; i += 1) {
    clock += 1
    for (const entry of [...todos]) if (!entry.done && entry.at <= clock) { entry.done = true; entry.fn() }
    await new Promise(resolve => setImmediate(resolve))
  }
  assert.deepEqual(seen, [1, 1, 1])
  assert.equal(tracker.list()[0]?.pushes, 1)
  tracker.dispose()
})

test('PendingTracker restores a recovered interaction with remaining threshold', async () => {
  let clock = 10_000
  const delays: number[] = []
  const tracker = new PendingTracker({
    thresholdMs: 5_000,
    repeatMs: 0,
    now: () => clock,
    after: (ms, fn) => { delays.push(ms); return { ms, fn } },
    cancel: () => {},
    onFire: () => 'delivered',
  })
  tracker.start({ id: 'q:recovered', kind: 'question', sessionId: 's', detail: 'd', startedAt: 8_000 })
  assert.deepEqual(delays, [3_000])
  tracker.dispose()
})

test('PendingTracker bounds detail exposed by status snapshots', () => {
  const tracker = new PendingTracker({ thresholdMs: 1000, repeatMs: 0, onFire: () => 'delivered' })
  tracker.start({ id: 'q:long', kind: 'question', sessionId: 's', detail: 'x'.repeat(5000) })
  assert.equal(tracker.list()[0]?.detail.length, 500)
  assert.ok(tracker.list()[0]?.detail.endsWith('…'))
  tracker.dispose()
})

test('PendingTracker does not retry a successful single push', async () => {
  let clock = 0
  const todos: Array<{ at: number; fn: () => void; done: boolean }> = []
  const fired: string[] = []
  const tracker = new PendingTracker({
    thresholdMs: 10,
    repeatMs: 0,
    retryMs: 5,
    now: () => clock,
    after: (ms, fn) => {
      const entry = { at: clock + ms, fn, done: false }
      todos.push(entry)
      return entry
    },
    cancel: entry => { (entry as { done: boolean }).done = true },
    onFire: p => { fired.push(p.id); return true },
  })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's', detail: 'd' })
  const tick = async (): Promise<void> => {
    clock += 1
    for (const entry of [...todos]) {
      if (!entry.done && entry.at <= clock) {
        entry.done = true
        entry.fn()
      }
    }
    await new Promise(resolve => setImmediate(resolve))
  }
  for (let i = 0; i < 30; i += 1) await tick()
  assert.equal(fired.length, 1)
  tracker.dispose()
})

test('PendingTracker.stopWhere clears one session', () => {
  const tracker = new PendingTracker({ thresholdMs: 1000, repeatMs: 0, onFire: () => {} })
  tracker.start({ id: 'q:1', kind: 'question', sessionId: 's1', detail: 'd' })
  tracker.start({ id: 'a:2', kind: 'approval', sessionId: 's2', detail: 'd' })
  tracker.stopWhere(pending => pending.sessionId === 's1')
  assert.equal(tracker.size, 1)
  assert.equal(tracker.list()[0]?.id, 'a:2')
  tracker.dispose()
})

test('recoverPending seeds unclosed ask/approval pairs only', () => {
  const events = [
    { type: 'tool/call', time: 1000, data: { callId: 'c1', name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ id: 'q', question: '继续吗？' }] }) } },
    { type: 'tool/result', time: 2000, data: { message: { source: { kind: 'tool', callId: 'c1' } } } },
    { type: 'tool/call', time: 3000, data: { callId: 'c2', name: 'exit_plan_mode', arguments: JSON.stringify({ plan: '# 计划' }) } },
    { type: 'approval/asked', time: 4000, data: { id: 'a1', toolName: 'write', reason: '写文件' } },
    { type: 'approval/decided', time: 5000, data: { id: 'a1', outcome: 'allowed-once' } },
    { type: 'approval/asked', time: 6000, data: { id: 'a2', toolName: 'bash' } },
  ]
  const seeds = recoverPending(events, 's1')
  assert.deepEqual(seeds.map(seed => seed.id), ['q:c2', 'a:a2'])
  assert.equal(seeds[0]?.startedAt, 3000)
  assert.equal(seeds[0]?.kind, 'plan-review')
  assert.equal(seeds[1]?.startedAt, 6000)
  assert.equal(seeds[1]?.kind, 'approval')
})
