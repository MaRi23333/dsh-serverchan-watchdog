import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PendingTracker, buildPushUrl, describeExitPlanCall, describeQuestionCall, minutesValue } from '../src/core.ts'

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

test('buildPushUrl: malformed credentials are rejected', () => {
  assert.equal(buildPushUrl('sctp-no-uid'), null)
  assert.equal(buildPushUrl(''), null)
  assert.equal(buildPushUrl('   '), null)
})

test('buildPushUrl: uppercase SCTP is rejected, not misrouted to the classic endpoint', () => {
  assert.equal(buildPushUrl('SCTP123tAb'), null)
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
