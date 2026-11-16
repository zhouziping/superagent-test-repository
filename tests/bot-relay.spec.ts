import { describe, expect, it, vi } from 'vitest'
import { Engine, MemoryRepositories, UserError, key } from '../src/core/index.ts'
import type { Candidate, OutboundMessage } from '../src/core/index.ts'
import { SettingsSchema, assessmentOutcome, settingsPolicy } from '../src/policy.ts'
import type { Assessment, Settings } from '../src/policy.ts'
import { SourceRegistry } from '../src/sources/registry.ts'
import { feishuKind, feishuTrigger } from '../src/sources/feishu.ts'

const CHAT = 'oc_team'
const BOT = 'cli_relay'
const SELF = 'ou_agent'
const TEXT = 'Alice requests: change the Save label to Save changes in the settings form.'
const base = SettingsSchema.parse({
  eval: { mode: 'auto' },
  sources: { feishu: { enabled: true, config: { chats: [{ chatId: CHAT, listen: 'all' }], directMessages: false } } },
  policy: {
    sources: { feishu: { allowed: [{ id: 'ou_alice' }], bots: [{ id: BOT, name: 'Relay' }] } },
    rules: [{ id: 'copy', name: 'Copy', enabled: true, instruction: 'Implement requested, fully specified copy changes.' }],
  },
})
function relay(id = 'om_1', { sender = BOT, chat = CHAT, mentioned = false, root = 'om_1' } = {}) {
  return feishuTrigger({ message_id: id, chat_id: chat, chat_type: 'group', sender_id: sender, sender_type: 'bot',
    content: TEXT, create_time: '1794800000000', root_id: root,
    mentions: mentioned ? [{ id: SELF }] : [] }, SELF, 'cli_agent')!
}
function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return { decision: 'accept', title: 'Update Save label', scope: 'Change only the settings form Save label to Save changes.',
    reason: 'The relay carries a fully specified copy request.', intent_evidence: TEXT, acknowledgement: 'On it',
    rule_assessments: [{ rule_id: 'copy', matched: true, reason: 'A specific replacement label is requested.' }],
    direction: { implementation_requested: true, target_basis: 'specified', requires_design_decision: false, evidence: TEXT },
    ...overrides }
}
function harness(settings: Settings = base) {
  const sources = new SourceRegistry(() => settings)
  sources.register(feishuKind)
  const policy = settingsPolicy(settings, sources)
  const repo = new MemoryRepositories()
  const requests: Candidate[] = []
  const outbox: OutboundMessage[] = []
  const executor = { start: vi.fn(), deliver: vi.fn(), stop: vi.fn() }
  const engine = new Engine({ repo, scope: sources, policy: () => policy,
    assessor: { request: candidate => { requests.push(candidate) }, release: vi.fn() }, executor,
    outbox: { send: message => { outbox.push(message) }, status: id => outbox.some(message => message.id === id) ? 'pending' : undefined, withdraw: vi.fn() },
    now: () => '2026-11-16T09:00:00.000Z' })
  const receive = (trigger = relay()) => { const result = engine.receive(trigger); engine.evaluateDue(); return result }
  const decide = (value = assessment()) => {
    const candidate = requests.at(-1)!
    return engine.decide(candidate.triggers[0]!.id, { ...assessmentOutcome(value, settings, candidate.strength), evalId: candidate.evalId })
  }
  const accept = () => {
    receive()
    const decision = decide()
    expect(decision.kind).toBe('accept')
    const ticketId = decision.ticketId!
    engine.assignmentStarted(ticketId, repo.tickets.get(ticketId)!.assignments[0]!.id)
    return ticketId
  }
  return { sources, policy, repo, requests, outbox, executor, engine, receive, decide, accept }
}

describe('registered Feishu bot relay', () => {
  it('assesses an unaddressed observed relay as inferred, retains its original source, skips acknowledgement and supports a ready result', () => {
    const h = harness()
    const original = relay()
    expect(original).toMatchObject({ human: false, actor: { source: 'feishu', id: BOT }, text: TEXT })
    expect(original.addressed).toBeUndefined()
    expect(h.sources.scope(original)).toEqual({ listened: true, observed: true, row: CHAT })
    const ticketId = h.accept()
    expect(h.requests).toHaveLength(1)
    expect(h.requests[0]).toMatchObject({ strength: 'inferred', triggers: [original] })
    expect(h.repo.triggers.get(original.id)).toEqual(original)
    expect(h.repo.tickets.get(ticketId)).toMatchObject({
      origin: { triggerId: original.id, triggerIds: [original.id] }, channels: [original.channel],
      mandate: { strength: 'inferred', actor: original.actor, basis: { via: 'bot', source: 'feishu', row: CHAT,
        observation: { mode: 'auto' }, rules: ['copy'], scope: original.meta } },
    })
    expect(h.policy.revalidate(h.repo.tickets.get(ticketId)!.mandate)).toBe(true)
    expect(h.executor.start).toHaveBeenCalledOnce()
    // The assessment supplied an acknowledgement, but bots are not people to acknowledge.
    expect(h.outbox).toEqual([])
    expect(() => h.engine.reply({ purpose: 'acknowledgement', ticketId, triggerId: original.id, text: 'On it' }))
      .toThrow(new UserError('ackNotPerson'))
    expect(() => h.engine.reply({ purpose: 'result', ticketId, text: 'Updated the label.' })).toThrow(new UserError('notReady'))
    h.engine.report(ticketId, { state: 'ready', summary: 'Updated the label.' })
    expect(h.engine.reply({ purpose: 'result', ticketId, text: 'Updated the label.' })).toMatchObject({ status: 'pending' })
    expect(h.outbox).toEqual([expect.objectContaining({ channel: original.channel, ticketId, kind: 'reply', text: 'Updated the label.' })])
    expect(h.outbox.some(message => message.id === key('ack', original.id))).toBe(false)
  })

  it.each(['observe', 'off'] as const)('starts no work in %s mode, even for a positively assessed relay', mode => {
    const h = harness({ ...base, eval: { ...base.eval, mode } })
    h.receive()
    if (mode === 'observe') {
      expect(h.requests).toHaveLength(1)
      expect(h.requests[0]!.strength).toBe('inferred')
      expect(h.decide()).toMatchObject({ kind: 'ignore', audit: { would_accept: true } })
    } else expect(h.requests).toEqual([])
    expect(h.repo.tickets.list()).toEqual([])
    expect(h.executor.start).not.toHaveBeenCalled()
    expect(h.outbox).toEqual([])
  })

  it.each(['disabled rule', 'nonmatching rule', 'unsettled direction'] as const)('starts no work for a %s', failure => {
    const settings = failure === 'disabled rule'
      ? { ...base, policy: { ...base.policy, rules: base.policy.rules.map(rule => ({ ...rule, enabled: false })) } } : base
    const h = harness(settings)
    h.receive()
    expect(h.requests[0]!.strength).toBe('inferred')
    const value = failure === 'disabled rule' ? assessment({ rule_assessments: [] })
      : failure === 'nonmatching rule' ? assessment({ rule_assessments: [{ rule_id: 'copy', matched: false, reason: 'Not a copy request.' }] })
      : assessment({ direction: { implementation_requested: true, target_basis: 'undetermined', requires_design_decision: true, evidence: 'Choose a better label.' } })
    expect(h.decide(value)).toMatchObject({ kind: 'ignore', reason: [{ code: failure === 'unsettled direction' ? 'directionUnsettled' : 'noRuleMatched' }] })
    expect(h.repo.tickets.list()).toEqual([])
    expect(h.executor.start).not.toHaveBeenCalled()
    expect(h.outbox).toEqual([])
  })

  it('gives neither an unregistered bot nor a registered bot in another chat authority', () => {
    const h = harness()
    expect(h.receive(relay('om_unknown', { sender: 'cli_unknown', mentioned: true }))).toBe('stored')
    expect(h.requests).toEqual([])
    expect(h.repo.decisions.byThread('feishu:oc_team:om_1')).toEqual([expect.objectContaining({ kind: 'ignore' })])
    expect(h.receive(relay('om_elsewhere', { chat: 'oc_other', mentioned: true }))).toBe('filtered')
    expect(h.repo.triggers.disposition(relay('om_elsewhere').id)?.filtered).toEqual({ code: 'chat_not_allowed' })
    expect(h.requests).toEqual([])
    expect(h.repo.tickets.list()).toEqual([])
    expect(h.executor.start).not.toHaveBeenCalled()
    expect(h.outbox).toEqual([])
  })

  it('cannot turn a bot mention into an explicit instruction to stop a live ticket', () => {
    const h = harness()
    const ticketId = h.accept()
    const stop = relay('om_stop', { mentioned: true })
    h.receive(stop)
    expect(h.requests.at(-1)).toMatchObject({ strength: 'inferred', triggers: [stop] })
    expect(h.engine.decide(stop.id, { kind: 'stop', ticketId, reason: 'Stop this ticket.', evalId: h.requests.at(-1)!.evalId }))
      .toMatchObject({ kind: 'ignore', strength: 'inferred', reason: [{ code: 'stopNotExplicit' }] })
    expect(h.repo.tickets.get(ticketId)!.ended).toBeUndefined()
    expect(h.executor.stop).not.toHaveBeenCalled()
  })

  it.each(['executor', 'human'] as const)('does not resume a ticket ended by %s on a bot message or attachment', by => {
    const h = harness()
    const ticketId = h.accept()
    if (by === 'human') h.engine.stopTicket(ticketId)
    else h.engine.report(ticketId, { state: 'ready', summary: 'Done' })
    const ended = h.repo.tickets.get(ticketId)!.ended
    expect(ended).toMatchObject({ by })
    const followup = relay('om_followup')
    h.receive(followup)
    if (by === 'human') expect(() => h.engine.attach(ticketId, followup.id)).toThrow(new UserError('ticketStopped'))
    else h.engine.attach(ticketId, followup.id)
    h.engine.evaluateDue()
    expect(h.repo.tickets.get(ticketId)).toMatchObject({ ended, assignments: [expect.anything()] })
    expect(h.executor.start).toHaveBeenCalledOnce()
    expect(h.repo.tickets.get(ticketId)!.inputs.some(input => input.kind === 'resumed')).toBe(false)
  })
})
