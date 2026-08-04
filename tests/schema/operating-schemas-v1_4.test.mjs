import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

import {
  assertOperatingDraftApproved,
  assertOperatingRuntimeMatch,
  createOperatingAdapterHandoff,
  createOperatingMandate,
  createOperatingMaterializedDraft,
  createOperatingResearchMandate,
  createOperatingRuntimeBinding,
  listProtocolSchemas,
  qualifyOperatingDraftCandidates,
  validateAgentNativeAdvisorResponse,
} from '../../lib/pipeline/index.mjs';

const digest = (character) => `sha256:${character.repeat(64)}`;
const revision = 'a'.repeat(40);
const citation = {
  kind: 'repository',
  path: 'src/index.ts',
  startLine: 1,
  endLine: 4,
  revision,
};

test('Protocol v1.4 schema catalog exactly covers its packaged directory', () => {
  const files = readdirSync(new URL('../../schemas/v1.4.0', import.meta.url))
    .filter((name) => name.endsWith('.schema.json'))
    .sort();
  const registered = listProtocolSchemas()
    .filter(({ protocolVersion }) => protocolVersion === '1.4.0')
    .map(({ path }) => path.split('/').at(-1))
    .sort();
  assert.deepEqual(registered, files);
});

test('Claude, Codex, and Cursor produce sticky runtime-governed bindings', () => {
  for (const runtime of ['claude-code', 'codex', 'cursor']) {
    const binding = createOperatingRuntimeBinding(runtime);
    assert.equal(binding.runtime, runtime);
    assert.equal(binding.runtimeBinding, 'required');
    assert.equal(binding.crossRuntimeFallback, false);
    assert.equal(binding.assurance, 'runtime-governed');
  }
  const codex = createOperatingRuntimeBinding('codex');
  assert.equal(codex.toolIsolation, 'advisory');
  assert.equal(codex.executionMode, 'native-agent');
  assert.throws(
    () => assertOperatingRuntimeMatch(codex, 'claude-code'),
    (error) => error?.code === 'E_OPERATE_RUNTIME_MISMATCH',
  );
});

test('research and role mandates contain roots and procedures, never repository bodies', () => {
  const research = createOperatingResearchMandate({
    cycleId: 'CYCLE-001',
    runtime: 'codex',
    roots: ['.', '.planr'],
  });
  assert.equal(research.researchMode, 'local');
  assert.equal(research.runtimeBinding.runtime, 'codex');
  assert.ok(!('evidence' in research));
  assert.ok(!('evidenceIndex' in research));
  assert.throws(
    () => createOperatingResearchMandate({
      cycleId: 'CYCLE-002', runtime: 'codex', researchMode: 'connected',
    }),
    (error) => error?.code === 'E_OPERATE_CONNECTED_RESEARCH_CONSENT_REQUIRED',
  );

  const mandate = createOperatingMandate('technology-risk', {
    runtime: 'codex',
    roots: ['.'],
  });
  assert.equal(mandate.protocolVersion, '1.4.0');
  assert.equal(mandate.procedure, 'procedures/operate/advisor.md');
  assert.equal(mandate.runtimeBinding.runtime, 'codex');
  assert.ok(!('evidence' in mandate));
  assert.ok(!('evidenceIndex' in mandate));
});

test('agent-native responses preserve expressive analysis and typed cited actions', () => {
  const response = validateAgentNativeAdvisorResponse({
    outcome: 'actions',
    analysisMarkdown: '## CTO analysis\n\nThe current boundary needs a focused reliability pass.',
    claims: [{
      id: 'claim-1',
      statement: 'The service has one retry boundary.',
      epistemicStatus: 'observed',
      confidence: 4,
      citations: [citation],
    }],
    actions: [{
      actionKey: 'retry-boundary',
      title: 'Make retry behavior explicit',
      summary: 'Add a bounded retry policy and failure telemetry.',
      lane: 'DEV',
      routeKind: 'quick-task',
      horizon: 'immediate',
      confidence: 4,
      impact: 4,
      ease: 3,
      citations: [citation],
    }],
    gaps: [],
    conflicts: [],
  });
  assert.match(response.analysisMarkdown, /CTO analysis/);
  assert.equal(response.actions[0].routeKind, 'quick-task');
  assert.throws(
    () => validateAgentNativeAdvisorResponse({ ...response, actions: [{ ...response.actions[0], citations: [] }] }),
    (error) => error?.code === 'E_PROTOCOL_ARTIFACT_INVALID',
  );
});

test('conflicts express action-vs-action and action-vs-commitment tensions', () => {
  const base = {
    outcome: 'actions',
    analysisMarkdown: '## Chair synthesis\n\nOne action contradicts a published promise.',
    claims: [],
    actions: [{
      actionKey: 'ship-usage-telemetry',
      title: 'Ship opt-in usage telemetry',
      summary: 'Measure adoption to satisfy the charter metric.',
      lane: 'DEV',
      routeKind: 'spec',
      horizon: 'next',
      confidence: 4,
      citations: [citation],
    }],
    gaps: [],
  };
  const commitmentRef = {
    path: 'docs/CROSS_RUNTIME_SETUP.md',
    statement: 'No telemetry is added',
  };

  // The two-action floor still holds for a classic action-vs-action conflict.
  const actionVsAction = validateAgentNativeAdvisorResponse({
    ...base,
    conflicts: [{ id: 'conflict-1', summary: 'Two actions compete for the same lane.', actionKeys: ['ship-usage-telemetry', 'defer-telemetry'] }],
  });
  assert.equal(actionVsAction.conflicts[0].actionKeys.length, 2);

  // The new form: one action versus a published commitment, one-action floor.
  const actionVsCommitment = validateAgentNativeAdvisorResponse({
    ...base,
    conflicts: [{
      id: 'conflict-2',
      summary: 'Shipping telemetry contradicts the published no-telemetry commitment.',
      actionKeys: ['ship-usage-telemetry'],
      commitmentRef,
    }],
  });
  assert.equal(actionVsCommitment.conflicts[0].commitmentRef.statement, 'No telemetry is added');

  // The floor did not silently vanish: one action with no commitmentRef is rejected.
  assert.throws(
    () => validateAgentNativeAdvisorResponse({
      ...base,
      conflicts: [{ id: 'conflict-3', summary: 'Lone action, no commitment.', actionKeys: ['ship-usage-telemetry'] }],
    }),
    (error) => error?.code === 'E_PROTOCOL_ARTIFACT_INVALID',
  );

  // commitmentRef is closed: unknown members and traversal paths are refused.
  assert.throws(
    () => validateAgentNativeAdvisorResponse({
      ...base,
      conflicts: [{ id: 'conflict-4', summary: 'Extra field.', actionKeys: ['ship-usage-telemetry'], commitmentRef: { ...commitmentRef, note: 'x' } }],
    }),
    (error) => error?.code === 'E_PROTOCOL_ARTIFACT_INVALID',
  );
  assert.throws(
    () => validateAgentNativeAdvisorResponse({
      ...base,
      conflicts: [{ id: 'conflict-5', summary: 'Traversal path.', actionKeys: ['ship-usage-telemetry'], commitmentRef: { path: '../secret.md', statement: 'x' } }],
    }),
    (error) => error?.code === 'E_PROTOCOL_ARTIFACT_INVALID',
  );
});

test('v1.4 Codex handoffs use harness actions and runtime-governed dispatch', () => {
  const handoff = createOperatingAdapterHandoff({
    protocolVersion: '1.4.0',
    phase: 'advisors',
    state: 'record-required',
    cycleId: 'CYCLE-003',
    evidenceDigest: digest('a'),
    runtime: 'codex',
    idempotencyKey: 'idem-12345678901234567890123456789012',
    lease: 'lease-12345678901234567890123456789012',
    expiresAt: '2026-08-02T12:00:00.000Z',
    roles: [{ roleId: 'strategy-finance', status: 'pending', inputDigest: digest('b') }],
  });
  assert.equal(handoff.next[0].action, 'harness.record');
  assert.equal(handoff.next[0].dispatch.runtime, 'codex');
  assert.equal(handoff.next[0].dispatch.assurance, 'runtime-governed');
  assert.equal(handoff.next[0].dispatch.toolIsolation, 'advisory');
  assert.ok(!JSON.stringify(handoff).includes('unsupported'));
  assert.ok(!JSON.stringify(handoff).includes('claude'));
});

test('draft qualification is bounded, idempotent, and approval-gated', () => {
  const action = {
    actionKey: 'activation-gap',
    title: 'Close the activation gap',
    summary: 'Create a guided first-run flow.',
    lane: 'DEV',
    routeKind: 'spec',
    horizon: 'next',
    confidence: 4,
    citations: [citation],
  };
  const first = qualifyOperatingDraftCandidates([action]);
  assert.equal(first.eligible.length, 1);
  assert.equal(
    qualifyOperatingDraftCandidates([action], { existingDigests: [first.eligible[0].digest] })
      .rejected[0].reason,
    'duplicate',
  );
  const draft = createOperatingMaterializedDraft({
    draftId: 'DRAFT-001',
    cycleId: 'CYCLE-004',
    actionKey: action.actionKey,
    artifactKind: 'spec',
    path: '.planr/specs/SPEC-005-activation/SPEC-005-activation.md',
    artifactDigest: digest('c'),
    findingIds: ['FND-001'],
    citationDigests: [digest('d')],
  });
  assert.throws(
    () => assertOperatingDraftApproved(draft),
    (error) => error?.code === 'E_OPERATE_DRAFT_UNAPPROVED',
  );
  assert.equal(assertOperatingDraftApproved({ ...draft, status: 'approved' }).status, 'approved');
});
