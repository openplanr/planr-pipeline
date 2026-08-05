import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createOperatingAdvisorBrief,
  listOperatingAdvisorBriefs,
  sha256Jcs,
} from '../../lib/pipeline/index.mjs';

test('executive advisor briefs are registry-derived, distinct, and digest-bound', () => {
  const ceo = createOperatingAdvisorBrief('strategy-finance', { protocolVersion: '1.2.0' });
  const cto = createOperatingAdvisorBrief('technology-risk', { protocolVersion: '1.2.0' });

  assert.equal(ceo.role.displayLabel, 'CEO');
  assert.equal(cto.role.displayLabel, 'CTO');
  assert.match(ceo.role.mandate, /pricing and packaging/);
  assert.match(cto.role.mandate, /security/);
  assert.notEqual(ceo.briefDigest, cto.briefDigest);
  assert.equal(
    ceo.briefDigest,
    sha256Jcs(Object.fromEntries(Object.entries(ceo).filter(([key]) => key !== 'briefDigest'))),
  );
  assert.ok(ceo.authority.sharedBoundaries.some((boundary) => /untrusted data/.test(boundary)));
  assert.ok(cto.authority.forbiddenRecommendationCategories.includes('production-write'));
  assert.equal(ceo.output.schema, 'operating-advisor-response@1.2.0');
  assert.deepEqual(ceo.output.jsonSchema.required, [
    'outcome',
    'proposals',
    'gaps',
    'conflicts',
  ]);
  assert.deepEqual(ceo.output.jsonSchema.properties.outcome.enum, ['proposals', 'quiet']);
  assert.deepEqual(ceo.output.jsonSchema.examples[0], {
    outcome: 'quiet',
    proposals: [],
    gaps: [],
    conflicts: [],
  });
  assert.deepEqual(ceo.output.allowedProposalTypes, ['data-gap', 'decision', 'finding']);
});

test('chair brief is consolidation-only and cannot assign deterministic state', () => {
  const chair = createOperatingAdvisorBrief('chair', { protocolVersion: '1.2.0' });
  assert.deepEqual(chair.output.allowedProposalTypes, ['merge', 'sequence']);
  assert.equal(chair.output.scoring, null);
  assert.ok(chair.output.requiredBehavior.some((rule) => /Never assign persistent IDs/.test(rule)));
  assert.ok(chair.boundaries.permittedKinds.includes('verified-advisor-result'));
  assert.ok(chair.boundaries.investigationMandate.examine.length > 0);
});

test('all six launch lenses expose canonical role briefs', () => {
  const briefs = listOperatingAdvisorBriefs();
  assert.deepEqual(
    briefs.map((brief) => brief.role.displayLabel).sort(),
    ['CEO', 'CMO', 'COO', 'CPO', 'CTO', 'Chair'].sort(),
  );
  assert.throws(
    () => createOperatingAdvisorBrief('delivery-agent', { protocolVersion: '1.2.0' }),
    (error) => error.code === 'E_OPERATE_ROLE_UNKNOWN',
  );
});

test('a pack-style brief refuses to guess its protocol version', () => {
  // The silent '1.2.0' default was the defect: a caller that forgot to name its
  // protocol received a legacy contract instead of an error, which is how a v1.2
  // brief reached a v1.4 mandate path. Omitting the version must fail closed.
  for (const options of [undefined, {}, { protocolVersion: undefined }]) {
    assert.throws(
      () => createOperatingAdvisorBrief('strategy-finance', options),
      (error) => error.code === 'E_OPERATE_LEGACY_BRIEF_VERSION_REQUIRED',
      `createOperatingAdvisorBrief must refuse options ${JSON.stringify(options ?? null)}`,
    );
  }
});

test('the 1.3.0 brief branch resolves the 1.3 response contract, not a relabeled 1.2', () => {
  const v12 = createOperatingAdvisorBrief('strategy-finance', { protocolVersion: '1.2.0' });
  const v13 = createOperatingAdvisorBrief('strategy-finance', { protocolVersion: '1.3.0' });

  assert.equal(v12.protocolVersion, '1.2.0');
  assert.equal(v12.output.schema, 'operating-advisor-response@1.2.0');
  assert.equal(v13.protocolVersion, '1.3.0');
  assert.equal(v13.output.schema, 'operating-advisor-response@1.3.0');

  // v1.2 proposals reference pre-loaded evidence IDs; v1.3 proposals carry
  // resolvable citations. Asserting the embedded JSON Schema actually differs is
  // what proves the accepted 1.3.0 version is wired through the body.
  const properties = (brief) => brief.output.jsonSchema.properties.proposals.items.properties;
  assert.ok('evidenceRefs' in properties(v12));
  assert.ok(!('citations' in properties(v12)));
  assert.ok('citations' in properties(v13));
  assert.ok(!('evidenceRefs' in properties(v13)));
  assert.notEqual(v12.briefDigest, v13.briefDigest);
});
