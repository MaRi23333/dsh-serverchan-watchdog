import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PendingTracker, buildPushUrl, describeExitPlanCall, describeQuestionCall } from '../src/core.ts'

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
