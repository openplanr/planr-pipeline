/**
 * SPEC-017 / T-001 — unit tests for the persistent, attributed feedback model.
 *
 * Covers the pure model layer in lib/design-engine/feedback.mjs:
 *   - generateStableId       — deterministic, content-keyed, 12-char hex
 *   - normalizeLegacy        — legacy (unattributed) → Anonymous + stable id + roster
 *   - mergeFeedback          — non-destructive, idempotent, two-author merge
 *   - schema validation      — merged + normalized output validates against the extended schema
 *
 * Zero third-party deps: node:test + node:assert + the in-repo schema validator.
 */

import assert from 'node:assert/strict';
import {
  readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { validate } from '../conformance/json-schema-validate.mjs';
import { createDaemon } from '../lib/design-engine/daemon.mjs';
import {
  mergeFeedback,
  normalizeLegacy,
  generateStableId,
  DEFAULT_AUTHOR,
} from '../lib/design-engine/feedback.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const feedbackSchema = JSON.parse(
  readFileSync(join(here, '..', 'schemas/v1.0.0/design-feedback.schema.json'), 'utf-8'),
);

/** A minimal valid base store (no pins yet). */
const emptyStore = () => ({
  schema_version: '1.0.0',
  boardId: 'collab-2026-06-17',
  publishedAt: '2026-06-17T10:00:00Z',
  regenerated: false,
  ratings: {},
  comments: {},
  pins: [],
});

const pin = (over) => ({
  variant: 's-dashboard',
  x: 0.1,
  y: 0.2,
  w: 0.05,
  h: 0.05,
  comment: 'tighten this spacing',
  intent: 'fix',
  ...over,
});

// ── generateStableId ──────────────────────────────────────────────────────

test('generateStableId: deterministic 12-char hex, content-keyed', () => {
  const a = generateStableId({ author: 'Dana', createdAt: '2026-06-17T10:00:00Z', comment: 'fix this' });
  const b = generateStableId({ author: 'Dana', createdAt: '2026-06-17T10:00:00Z', comment: 'fix this' });
  assert.equal(a, b, 'same content → same id (idempotent)');
  assert.equal(a.length, 12);
  assert.match(a, /^[0-9a-f]{12}$/, '12-char lowercase hex prefix');

  const diff = generateStableId({ author: 'Ravi', createdAt: '2026-06-17T10:00:00Z', comment: 'fix this' });
  assert.notEqual(a, diff, 'different author → different id');
});

// ── normalizeLegacy ───────────────────────────────────────────────────────

test('normalizeLegacy: legacy file with no id/author maps to Anonymous + stable id', () => {
  const legacy = {
    ...emptyStore(),
    pins: [pin({ comment: 'legacy note one' }), pin({ comment: 'legacy note two', intent: 'improve' })],
  };
  const norm = normalizeLegacy(legacy);

  for (const p of norm.pins) {
    assert.equal(p.author, DEFAULT_AUTHOR, 'unattributed pin → Anonymous');
    assert.match(p.id, /^[0-9a-f]{12}$/, 'stable id assigned');
  }
  // roster reconstructed from pins
  assert.deepEqual(norm.authors.map((a) => a.name), [DEFAULT_AUTHOR]);
});

test('normalizeLegacy: preserves all existing fields and does not mutate the input', () => {
  const legacy = {
    ...emptyStore(),
    overall: 'lean darker',
    ratings: { A: 4 },
    pins: [pin({ comment: 'keep my fields', screen: 's-hero' })],
  };
  const before = JSON.parse(JSON.stringify(legacy));
  const norm = normalizeLegacy(legacy);

  assert.deepEqual(legacy, before, 'input is not mutated (pure)');
  assert.equal(norm.overall, 'lean darker');
  assert.deepEqual(norm.ratings, { A: 4 });
  assert.equal(norm.pins[0].screen, 's-hero');
  assert.equal(norm.pins[0].comment, 'keep my fields');
});

test('normalizeLegacy: an existing id/author on a pin is left intact', () => {
  const attributed = {
    ...emptyStore(),
    pins: [pin({ id: 'deadbeef0001', author: 'Dana', comment: 'already attributed' })],
  };
  const norm = normalizeLegacy(attributed);
  assert.equal(norm.pins[0].id, 'deadbeef0001');
  assert.equal(norm.pins[0].author, 'Dana');
});

// ── mergeFeedback ─────────────────────────────────────────────────────────

test('mergeFeedback: two authors → both items preserved, neither overwritten', () => {
  const danaPin = pin({ author: 'Dana', createdAt: '2026-06-17T10:01:00Z', comment: 'dana fix' });
  const danaPinId = generateStableId(danaPin);
  const stored = {
    ...emptyStore(),
    authors: [{ name: 'Dana' }],
    pins: [{ ...danaPin, id: danaPinId }],
  };

  const raviPin = pin({ author: 'Ravi', createdAt: '2026-06-17T10:02:00Z', comment: 'ravi improve', intent: 'improve' });
  const contribution = {
    ...emptyStore(),
    authors: [{ name: 'Ravi', color: '--avatar-3' }],
    pins: [{ ...raviPin, id: generateStableId(raviPin) }],
  };

  const merged = mergeFeedback(stored, contribution);

  assert.equal(merged.pins.length, 2, 'both authors\' pins survive the merge');
  const byAuthor = merged.pins.map((p) => p.author).sort();
  assert.deepEqual(byAuthor, ['Dana', 'Ravi']);
  assert.equal(merged.authors.length, 2, 'both authors in the roster, once each');
  assert.ok(merged.authors.find((a) => a.name === 'Ravi').color === '--avatar-3', 'roster fields merged');
});

test('mergeFeedback: idempotent re-submit of the same item → exactly one pin', () => {
  const danaPin = pin({ author: 'Dana', createdAt: '2026-06-17T10:01:00Z', comment: 'same content' });
  const withId = { ...danaPin, id: generateStableId(danaPin) };
  const stored = { ...emptyStore(), authors: [{ name: 'Dana' }], pins: [withId] };

  // resubmitting the identical contribution must not duplicate the pin
  const contribution = { ...emptyStore(), authors: [{ name: 'Dana' }], pins: [withId] };
  const once = mergeFeedback(stored, contribution);
  assert.equal(once.pins.length, 1, 'idempotent — no duplicate item');

  // a second pass over the result is still stable
  const twice = mergeFeedback(once, contribution);
  assert.equal(twice.pins.length, 1, 'still one item after a second merge');
});

test('mergeFeedback: editing an item is last-write-wins per item (no duplicate)', () => {
  const base = pin({ author: 'Dana', createdAt: '2026-06-17T10:01:00Z', comment: 'first take' });
  const id = generateStableId(base);
  const stored = { ...emptyStore(), authors: [{ name: 'Dana' }], pins: [{ ...base, id, status: 'open' }] };

  // same id+author, edited fields (status, intent)
  const edited = { ...base, id, status: 'resolved', intent: 'improve' };
  const contribution = { ...emptyStore(), authors: [{ name: 'Dana' }], pins: [edited] };
  const merged = mergeFeedback(stored, contribution);

  assert.equal(merged.pins.length, 1, 'edit replaces in place, no duplicate');
  assert.equal(merged.pins[0].status, 'resolved', 'last write wins per item');
  assert.equal(merged.pins[0].intent, 'improve');
});

test('mergeFeedback: a contribution never removes a stored item it omits', () => {
  const a = pin({ author: 'Dana', createdAt: '2026-06-17T10:01:00Z', comment: 'keep me' });
  const aId = generateStableId(a);
  const stored = { ...emptyStore(), authors: [{ name: 'Dana' }], pins: [{ ...a, id: aId }] };

  // contribution carries only Ravi's pin and an empty pins-free author roster touch
  const b = pin({ author: 'Ravi', createdAt: '2026-06-17T10:05:00Z', comment: 'add me' });
  const contribution = { ...emptyStore(), authors: [{ name: 'Ravi' }], pins: [{ ...b, id: generateStableId(b) }] };

  const merged = mergeFeedback(stored, contribution);
  assert.ok(merged.pins.some((p) => p.id === aId), 'Dana\'s omitted pin is retained');
  assert.equal(merged.pins.length, 2);
});

test('mergeFeedback: per-variant ratings/comments merge key-by-key (no clobber)', () => {
  const stored = { ...emptyStore(), ratings: { A: 5 }, comments: { A: 'great' } };
  const contribution = { ...emptyStore(), ratings: { B: 3 }, comments: { B: 'meh' } };
  const merged = mergeFeedback(stored, contribution);
  assert.deepEqual(merged.ratings, { A: 5, B: 3 }, 'A rating survives, B added');
  assert.deepEqual(merged.comments, { A: 'great', B: 'meh' });
});

test('mergeFeedback: is pure — neither argument is mutated', () => {
  const stored = { ...emptyStore(), pins: [{ ...pin({ author: 'Dana', comment: 'x' }), id: 'aaaaaaaaaaaa' }] };
  const contribution = { ...emptyStore(), pins: [{ ...pin({ author: 'Ravi', comment: 'y' }), id: 'bbbbbbbbbbbb' }] };
  const storedBefore = JSON.parse(JSON.stringify(stored));
  const contribBefore = JSON.parse(JSON.stringify(contribution));

  mergeFeedback(stored, contribution);

  assert.deepEqual(stored, storedBefore, 'stored not mutated');
  assert.deepEqual(contribution, contribBefore, 'contribution not mutated');
});

// ── schema validation of the merged / normalized output ─────────────────────

test('mergeFeedback output validates against the extended design-feedback schema', () => {
  const danaPin = pin({ author: 'Dana', createdAt: '2026-06-17T10:01:00Z', comment: 'dana', status: 'open' });
  const raviPin = pin({
    author: 'Ravi',
    createdAt: '2026-06-17T10:02:00Z',
    comment: 'ravi',
    intent: 'question',
    status: 'resolved',
    replies: [{ author: 'Dana', comment: 'agreed', createdAt: '2026-06-17T10:03:00Z' }],
  });
  const stored = {
    ...emptyStore(),
    authors: [{ name: 'Dana', color: '--avatar-1', initials: 'D' }],
    pins: [{ ...danaPin, id: generateStableId(danaPin) }],
  };
  const contribution = {
    ...emptyStore(),
    authors: [{ name: 'Ravi', color: '--avatar-2', initials: 'R' }],
    pins: [{ ...raviPin, id: generateStableId(raviPin) }],
  };

  const merged = mergeFeedback(stored, contribution);
  const errs = validate(merged, feedbackSchema);
  assert.equal(errs.length, 0, `merged output should validate, got: ${JSON.stringify(errs)}`);
});

test('legacy file validates against the extended schema AFTER normalizeLegacy', () => {
  // a file written by the previous (unattributed) board version — no id/author on pins
  const legacy = {
    ...emptyStore(),
    pins: [pin({ comment: 'old note' }), pin({ comment: 'another old note', intent: 'question' })],
  };
  // raw legacy is missing required id/author → should NOT validate yet
  assert.ok(validate(legacy, feedbackSchema).length > 0, 'raw legacy lacks required id/author');

  const norm = normalizeLegacy(legacy);
  const errs = validate(norm, feedbackSchema);
  assert.equal(errs.length, 0, `normalized legacy should validate, got: ${JSON.stringify(errs)}`);
});

// ── T-002: daemon GET + merge-safe POST integration ─────────────────────────
//
// These exercise the real HTTP daemon (lib/design-engine/daemon.mjs) end-to-end:
//   - GET  /boards/<id>/api/feedback returns the durable record (empty when absent)
//   - POST /boards/<id>/api/feedback MERGES under the per-board mutex — two authors
//     (sequential AND async-parallel) both survive, neither clobbers the other.
// Zero third-party deps: node:test + global fetch + a tmp board dir.

/** Spin up a daemon on an ephemeral port with an isolated PLANR_HOME + board dir. */
async function startBoard() {
  const home = mkdtempSync(join(tmpdir(), 'planr-collab-home-'));
  const boardDir = mkdtempSync(join(tmpdir(), 'planr-collab-board-'));
  // The daemon requires board.html to exist before it will register the dir.
  writeFileSync(join(boardDir, 'board.html'), '<!doctype html><title>board</title>');

  const daemon = createDaemon({ env: { PLANR_HOME: home } });
  const port = await daemon.listen(0);
  const base = `http://127.0.0.1:${port}`;
  const id = `collab--${'a'.repeat(24)}`;

  const reg = await fetch(`${base}/api/boards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, dir: boardDir }),
  });
  assert.equal(reg.status, 200, 'board registers');

  const cleanup = async () => {
    await daemon.close();
    rmSync(home, { recursive: true, force: true });
    rmSync(boardDir, { recursive: true, force: true });
  };
  return { base, id, boardDir, cleanup };
}

/** A complete, schema-valid feedback contribution for one author's single pin. */
const contributionFor = (author, comment, over = {}) => ({
  schema_version: '1.0.0',
  boardId: 'collab-2026-06-17',
  publishedAt: '2026-06-17T10:00:00Z',
  regenerated: false,
  ratings: {},
  comments: {},
  authors: [{ name: author }],
  pins: [
    {
      author,
      createdAt: `2026-06-17T10:0${Math.floor(Math.random() * 9)}:00Z`,
      variant: 's-dashboard',
      x: 0.1,
      y: 0.2,
      w: 0.05,
      h: 0.05,
      comment,
      intent: 'fix',
      ...over,
    },
  ],
});

const postFeedback = (base, id, feedback) =>
  fetch(`${base}/boards/${encodeURIComponent(id)}/api/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'submit', feedback }),
  });

const getFeedback = (base, id) =>
  fetch(`${base}/boards/${encodeURIComponent(id)}/api/feedback`).then((r) => r.json());

test('daemon GET /api/feedback returns an empty valid record before any submit', async () => {
  const { base, id, cleanup } = await startBoard();
  try {
    const res = await fetch(`${base}/boards/${encodeURIComponent(id)}/api/feedback`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { authors: [], items: [] }, 'no file yet → designed empty record');
  } finally {
    await cleanup();
  }
});

test('daemon: two sequential POSTs from different authors both survive + GET returns the merge', async () => {
  const { base, id, boardDir, cleanup } = await startBoard();
  try {
    const a = await postFeedback(base, id, contributionFor('Author A', 'A says fix this'));
    assert.equal(a.status, 200, 'Author A POST ok');
    // GET immediately after the first POST already reflects the merged record (T-002.5b)
    const afterA = await getFeedback(base, id);
    assert.equal(afterA.pins.length, 1, 'GET after first POST shows A\'s pin');
    assert.ok(afterA.pins.some((p) => p.author === 'Author A'));

    const b = await postFeedback(base, id, contributionFor('Author B', 'B says improve this', { intent: 'improve' }));
    assert.equal(b.status, 200, 'Author B POST ok');

    const merged = await getFeedback(base, id);
    const authors = merged.pins.map((p) => p.author).sort();
    assert.deepEqual(authors, ['Author A', 'Author B'], 'both authors\' pins survive — neither overwritten');
    assert.equal(merged.authors.length, 2, 'both authors in the roster, once each');

    // The durable file on disk is the source of truth and stays schema-valid.
    const onDisk = JSON.parse(readFileSync(join(boardDir, 'feedback.json'), 'utf-8'));
    assert.equal(validate(onDisk, feedbackSchema).length, 0, 'durable file validates against the schema');
    assert.equal(onDisk.pins.length, 2);
  } finally {
    await cleanup();
  }
});

test('daemon: async-parallel POSTs (Promise.all) do not corrupt the file or drop an item', async () => {
  const { base, id, boardDir, cleanup } = await startBoard();
  try {
    // Five distinct authors fire concurrently — the per-board mutex must serialize the
    // read-merge-write so the final file is valid JSON with every contribution present.
    const authors = ['A', 'B', 'C', 'D', 'E'];
    const results = await Promise.all(
      authors.map((name) => postFeedback(base, id, contributionFor(`Author ${name}`, `${name} pin`))),
    );
    for (const r of results) assert.equal(r.status, 200, 'every concurrent POST ok');

    const merged = await getFeedback(base, id);
    const got = merged.pins.map((p) => p.author).sort();
    assert.deepEqual(
      got,
      authors.map((n) => `Author ${n}`),
      'no missing item after concurrent merge',
    );

    // No JSON parse error: the durable file is well-formed and schema-valid.
    const raw = readFileSync(join(boardDir, 'feedback.json'), 'utf-8');
    const onDisk = JSON.parse(raw); // throws on corruption — that is the assertion
    assert.equal(onDisk.pins.length, authors.length, 'all 5 pins persisted, none clobbered');
    assert.equal(validate(onDisk, feedbackSchema).length, 0, 'concurrent-merged file still validates');
  } finally {
    await cleanup();
  }
});

test('daemon: a "pending" round is reconciled into the durable store, never destructively deleted', async () => {
  const { base, id, boardDir, cleanup } = await startBoard();
  try {
    // Seed a durable record + a leftover pending round on disk, then re-register the board
    // (which triggers reconcilePending). The pending pin must be merged in, not dropped.
    const stored = contributionFor('Author A', 'durable pin');
    writeFileSync(join(boardDir, 'feedback.json'), `${JSON.stringify(stored, null, 2)}\n`);
    const pending = contributionFor('Author B', 'pending pin', { intent: 'question' });
    writeFileSync(join(boardDir, 'feedback-pending.json'), `${JSON.stringify(pending, null, 2)}\n`);

    const reg = await fetch(`${base}/api/boards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, dir: boardDir }),
    });
    assert.equal(reg.status, 200);
    // Reconciliation is mutex-serialized + fire-and-forget on register; poll the durable
    // record until the pending author has been folded in (bounded — fails loudly otherwise).
    let merged;
    for (let i = 0; i < 50; i += 1) {
      merged = await getFeedback(base, id);
      if ((merged.pins ?? []).some((p) => p.author === 'Author B')) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    const authors = merged.pins.map((p) => p.author).sort();
    assert.deepEqual(authors, ['Author A', 'Author B'], 'pending round folded into the durable store');

    // The pending file still exists (emptied, not deleted) so a stale round can't double-apply.
    const pendingRaw = JSON.parse(readFileSync(join(boardDir, 'feedback-pending.json'), 'utf-8'));
    assert.deepEqual(pendingRaw.pins, [], 'pending file emptied after reconciliation, not deleted destructively');
  } finally {
    await cleanup();
  }
});

// ── T-004: author identity is wired into the contribution submit path ────────
//
// The board client (lib/design-engine/board.mjs) stamps the reviewer's identity onto
// every outgoing contribution before POST /api/feedback: the per-pin `author` is the
// display-name STRING (the schema's pin.author + the daemon merge key), the per-pin
// `createdAt` anchors the stable id, and the full { name, initials, color } object lives
// once in the payload's authors[] roster. This mirrors that exact payload shape and
// asserts the attribution survives into the stored feedback file (T-004.4 + DoD).

/** A board-client-shaped, attributed submit payload (mirrors board.mjs payload()). */
const attributedContribution = (name, comment, initials, color) => ({
  schema_version: '1.0.0',
  boardId: 'collab-2026-06-17',
  publishedAt: '2026-06-17T10:00:00Z',
  regenerated: false,
  ratings: {},
  comments: {},
  // authors[] roster: the full { name, initials, color } object, once per author.
  authors: [{ name, initials, color, lastSeen: '2026-06-17T10:00:00Z' }],
  pins: [
    {
      author: name,
      createdAt: '2026-06-17T10:01:00Z',
      variant: 's-dashboard',
      x: 0.1,
      y: 0.2,
      w: 0.05,
      h: 0.05,
      comment,
      intent: 'fix',
    },
  ],
});

test('T-004: a POSTed item carries author + createdAt, and the authors roster carries name/initials/color in the stored file', async () => {
  const { base, id, boardDir, cleanup } = await startBoard();
  try {
    const fb = attributedContribution('Alice Chen', 'tighten this spacing', 'AC', '#4f46e5');

    // Pre-condition: the simulated POST payload itself carries the full attribution the
    // board client stamps on (author.name + initials + color in the roster, createdAt on the pin).
    assert.equal(fb.authors[0].name, 'Alice Chen', 'payload roster carries author.name');
    assert.equal(fb.authors[0].initials, 'AC', 'payload roster carries author.initials');
    assert.equal(fb.authors[0].color, '#4f46e5', 'payload roster carries author.color');
    assert.equal(fb.pins[0].author, 'Alice Chen', 'payload pin carries author (display name)');
    assert.ok(fb.pins[0].createdAt, 'payload pin carries createdAt');

    const res = await postFeedback(base, id, fb);
    assert.equal(res.status, 200, 'attributed submit accepted');

    // The stored feedback file is the durable record — the attribution must survive into it.
    const onDisk = JSON.parse(readFileSync(join(boardDir, 'feedback.json'), 'utf-8'));
    assert.equal(validate(onDisk, feedbackSchema).length, 0, 'stored file validates against the schema');

    const storedPin = onDisk.pins.find((p) => p.comment === 'tighten this spacing');
    assert.ok(storedPin, 'the POSTed pin is in the stored file');
    assert.equal(storedPin.author, 'Alice Chen', 'stored pin carries author.name (the display name)');
    assert.ok(storedPin.createdAt, 'stored pin carries createdAt');
    assert.match(storedPin.id, /^[0-9a-f]{12}$/, 'stored pin has a stable id');

    const rosterEntry = onDisk.authors.find((a) => a.name === 'Alice Chen');
    assert.ok(rosterEntry, 'the author appears once in the authors roster');
    assert.equal(rosterEntry.name, 'Alice Chen', 'roster carries author.name');
    assert.equal(rosterEntry.initials, 'AC', 'roster carries author.initials');
    assert.equal(rosterEntry.color, '#4f46e5', 'roster carries author.color');

    // GET drives the authors-seen cluster on the next load — the roster must be returned too.
    const reloaded = await getFeedback(base, id);
    assert.ok(
      (reloaded.authors ?? []).some((a) => a.name === 'Alice Chen'),
      'GET returns the authors roster that drives the top-bar seen cluster',
    );
  } finally {
    await cleanup();
  }
});

// ── T-006: pin-drop wire-up — load on open + persist each drop (round-trip) ──────
//
// The board client (lib/design-engine/board.mjs) now POSTs each dropped pin to
// /api/feedback as a single-pin merge contribution carrying the fully-attributed item
// payload — { id, author, x, y, w, h, intent, comment, status:'open', createdAt, replies:[] }
// — with the reviewer's authors[] roster entry, computing the stable id client-side with
// the SAME sha256(author\ncreatedAt\ncomment) prefix the daemon derives. These tests mirror
// that exact wire payload against the real HTTP daemon and prove the load + persist round-trip:
//   - GET /api/feedback after a drop contains the pin with all fields intact;
//   - the pin survives a refresh / re-serve (a fresh GET, and re-register, both see it);
//   - the client-computed id equals the daemon's canonical id (idempotent re-submit → no dup).

/** The exact single-pin merge contribution the board client POSTs on a pin drop. */
const droppedPinContribution = (name, item) => ({
  schema_version: '1.0.0',
  boardId: 'collab-2026-06-17',
  publishedAt: '2026-06-17T10:00:00Z',
  regenerated: false,
  ratings: {},
  comments: {},
  authors: [{ name, initials: 'DR', color: '#4f46e5', lastSeen: '2026-06-17T10:00:00Z' }],
  pins: [item],
});

/** A fully-attributed dropped-pin item — the shape T-006.2 builds at click time. */
const droppedItem = (name, comment, over = {}) => ({
  id: generateStableId({ author: name, createdAt: '2026-06-17T10:01:00Z', comment }),
  author: name,
  variant: 's-board',
  x: 0.42,
  y: 0.18,
  w: 0,
  h: 0,
  comment,
  intent: 'improve',
  status: 'open',
  createdAt: '2026-06-17T10:01:00Z',
  replies: [],
  ...over,
});

test('T-006: a dropped pin POSTed to /api/feedback is returned by a subsequent GET with all fields intact', async () => {
  const { base, id, cleanup } = await startBoard();
  try {
    // Open: before any drop, GET returns the designed empty record (the load half).
    const initial = await getFeedback(base, id);
    assert.deepEqual(initial, { authors: [], items: [] }, 'open on an empty board → designed empty record');

    const item = droppedItem('Dana Reviewer', 'lift the contrast on this label', { screen: 's-board' });
    const res = await postFeedback(base, id, droppedPinContribution('Dana Reviewer', item));
    assert.equal(res.status, 200, 'pin-drop POST accepted');
    const posted = await res.json();
    assert.ok(posted.feedback, 'daemon returns the merged durable record on a drop');

    // GET after the drop carries the pin with every field intact.
    const after = await getFeedback(base, id);
    const stored = after.pins.find((p) => p.comment === 'lift the contrast on this label');
    assert.ok(stored, 'the dropped pin is loaded by GET /api/feedback');
    assert.equal(stored.author, 'Dana Reviewer', 'author intact');
    assert.equal(stored.intent, 'improve', 'intent intact');
    assert.equal(stored.status, 'open', 'status intact');
    assert.equal(stored.createdAt, '2026-06-17T10:01:00Z', 'createdAt intact');
    assert.equal(stored.x, 0.42, 'x intact'); assert.equal(stored.y, 0.18, 'y intact');
    assert.deepEqual(stored.replies, [], 'replies intact');
    assert.match(stored.id, /^[0-9a-f]{12}$/, 'stable id present');
    assert.equal(stored.id, item.id, 'the client-computed id is the daemon\'s canonical id (idempotent)');

    // The roster the GET returns drives the authors-seen cluster on the next load.
    assert.ok((after.authors ?? []).some((a) => a.name === 'Dana Reviewer'), 'author in the returned roster');
  } finally {
    await cleanup();
  }
});

test('T-006: a pin persists across a refresh and a board re-serve (load on open never starts empty)', async () => {
  const { base, id, boardDir, cleanup } = await startBoard();
  try {
    const item = droppedItem('Dana Reviewer', 'persist me across refresh');
    const res = await postFeedback(base, id, droppedPinContribution('Dana Reviewer', item));
    assert.equal(res.status, 200, 'pin-drop POST accepted');

    // "Refresh the tab" = a fresh GET against the same daemon — the pin is still there.
    const afterRefresh = await getFeedback(base, id);
    assert.ok(
      afterRefresh.pins.some((p) => p.comment === 'persist me across refresh'),
      'a refresh (re-GET) re-loads the dropped pin — the board is never empty',
    );

    // "Re-serve the board" = re-register the same dir (a new daemon would read the same file).
    const reg = await fetch(`${base}/api/boards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, dir: boardDir }),
    });
    assert.equal(reg.status, 200, 'board re-registers');
    const afterReserve = await getFeedback(base, id);
    assert.ok(
      afterReserve.pins.some((p) => p.comment === 'persist me across refresh'),
      'the pin survives a re-serve — the durable file is the source of truth',
    );

    // The durable file on disk holds the pin and validates against the schema.
    const onDisk = JSON.parse(readFileSync(join(boardDir, 'feedback.json'), 'utf-8'));
    assert.equal(validate(onDisk, feedbackSchema).length, 0, 'durable file validates against the schema');
    assert.ok(onDisk.pins.some((p) => p.comment === 'persist me across refresh'));
  } finally {
    await cleanup();
  }
});

test('T-006: dropping a second pin merges in without clobbering the first (per-pin POST is non-destructive)', async () => {
  const { base, id, cleanup } = await startBoard();
  try {
    const first = droppedItem('Dana Reviewer', 'first dropped pin');
    await postFeedback(base, id, droppedPinContribution('Dana Reviewer', first));

    // A second drop POSTs ONLY the new pin (the client sends a single-pin contribution);
    // the non-destructive daemon merge must keep the first pin.
    const second = droppedItem('Dana Reviewer', 'second dropped pin', { intent: 'question' });
    const res = await postFeedback(base, id, droppedPinContribution('Dana Reviewer', second));
    assert.equal(res.status, 200);

    const after = await getFeedback(base, id);
    const comments = after.pins.map((p) => p.comment).sort();
    assert.deepEqual(
      comments,
      ['first dropped pin', 'second dropped pin'],
      'both dropped pins survive — a single-pin POST never wipes the earlier pin',
    );

    // Idempotent: re-POSTing the identical first pin does not duplicate it.
    await postFeedback(base, id, droppedPinContribution('Dana Reviewer', first));
    const afterDup = await getFeedback(base, id);
    assert.equal(afterDup.pins.length, 2, 're-submitting an unchanged pin is a no-op (idempotent)');
  } finally {
    await cleanup();
  }
});

// ── T-007: feedback rail / inbox + detail card render (s-inbox + s-thread) ───────
//
// The board client (lib/design-engine/board.mjs) renders the persistent right rail
// (header + filter bar + grouped items) and the pin detail card (author, intent badge,
// comment, reply thread, reply input, Resolve). These render checks assert the s-inbox /
// s-thread structure ships, that the wiring functions exist, that the palette stays on the
// §1 tokens (no off-palette hex in the T-007 CSS), and that a reply payload the card POSTs is
// schema-valid + merges non-destructively against the real daemon.

const { renderBoardHtml } = await import('../lib/design-engine/board.mjs');
const boardHtml = () => renderBoardHtml({
  boardId: 'collab-2026-06-17',
  title: 'collab review',
  mode: 'review',
  variants: [{ id: 'A', label: 'screen', src: 'a.svg', type: 'svg' }],
});

test('T-007: the board ships the feedback rail (s-inbox) — header, filter bar, grouped items', () => {
  const html = boardHtml();
  for (const hook of [
    'rb-feedback-rail', 'rb-rail-header', 'rb-rail-title', 'rbRailOpenCount', 'rbRailResolvedChip',
    'rb-filter-bar', 'rbFilterBar', 'rb-rail-list', 'rbRailList',
    'rb-filter-chip', 'rb-filter-chip--active', 'rb-rail-item', 'rb-rail-item--active',
  ]) {
    assert.ok(html.includes(hook), `s-inbox ships ${hook}`);
  }
  // CSS classes the filter/item list need at runtime (built in JS) are present in the stylesheet.
  for (const cls of ['rb-badge--fix', 'rb-badge--improve', 'rb-badge--question', 'rb-badge--open', 'rb-badge--resolved']) {
    assert.ok(html.includes(cls), `intent/status badge class ${cls} is styled`);
  }
});

test('T-007: the board ships the detail card (s-thread) — thread, reply input, resolve, delete', () => {
  const html = boardHtml();
  for (const hook of [
    'rb-detail-card', 'rbDetailCard', 'rb-thread-list', 'rbThreadList',
    'rb-reply-input', 'rbReplyText', 'rbReplySend', 'rb-resolve-btn', 'rbResolveBtn',
    'rb-delete-btn', 'rbDeleteBtn', 'rbDetailClose',
  ]) {
    assert.ok(html.includes(hook), `s-thread ships ${hook}`);
  }
  // detail card caps at 600px with an internal scroll (DoD)
  assert.match(html, /\.rb-detail-card\s*\{[^}]*max-height:600px/, 'detail card caps at 600px');
  assert.match(html, /\.rb-detail-body\s*\{[^}]*overflow-y:auto/, 'detail body scrolls internally');
});

test('T-007: two-way selection + lifecycle wiring functions are present in the client', () => {
  const html = boardHtml();
  for (const fn of [
    'function renderRail', 'function selectPin', 'function selectRailItem',
    'function openDetailCard', 'function submitReply', 'function resolvePin', 'function deletePin',
  ]) {
    assert.ok(html.includes(fn), `client wires ${fn}`);
  }
  // container-query reflow (rail moves below the stage on narrow widths)
  assert.ok(html.includes('@container rb-screen (max-width: 1023px)'), 'rail reflows ≤1023px');
});

test('T-007: the T-007 rail/detail CSS stays on the §1 palette tokens (no off-palette raw hex)', () => {
  const html = boardHtml();
  // isolate the T-007 feedback-rail CSS section (from its banner to </style>) and assert no raw
  // hex literals appear in its rule bodies — every colour is a var(--rb-*)/var(--pin-*) token.
  const start = html.indexOf('SPEC-017 T-007: feedback rail / inbox (design-spec');
  assert.ok(start > 0, 'T-007 CSS section is present');
  const end = html.indexOf('</style>', start);
  const section = html.slice(start, end);
  const rawHex = section.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  assert.equal(rawHex.length, 0, `T-007 CSS uses only palette tokens, found raw hex: ${rawHex.join(', ')}`);
});

test('T-007: a reply the detail card POSTs is schema-valid and merges non-destructively', async () => {
  const { base, id, boardDir, cleanup } = await startBoard();
  try {
    // seed a durable pin (Dana), then submit the FULL item with a reply appended (the exact
    // single-item merge contribution submitReply builds) and assert the thread persists.
    const item = droppedItem('Dana Reviewer', 'thread me');
    await postFeedback(base, id, droppedPinContribution('Dana Reviewer', item));

    const replied = {
      ...item,
      replies: [{ author: 'Ravi', comment: 'on it', createdAt: '2026-06-17T11:00:00Z' }],
    };
    const contribution = {
      schema_version: '1.0.0',
      boardId: 'collab-2026-06-17',
      publishedAt: '2026-06-17T11:00:00Z',
      regenerated: false,
      ratings: {},
      comments: {},
      authors: [{ name: 'Ravi', initials: 'R', color: '#0e7490', lastSeen: '2026-06-17T11:00:00Z' }],
      pins: [replied],
    };
    assert.equal(validate(contribution, feedbackSchema).length, 0, 'reply contribution is schema-valid');

    const res = await postFeedback(base, id, contribution);
    assert.equal(res.status, 200, 'reply POST accepted');

    const after = await getFeedback(base, id);
    const stored = after.pins.find((p) => p.comment === 'thread me');
    assert.ok(stored, 'the pin survives the reply merge (non-destructive)');
    assert.equal(stored.replies.length, 1, 'reply appended to the thread');
    assert.equal(stored.replies[0].comment, 'on it');
    assert.equal(after.pins.length, 1, 'no duplicate pin — last-write-wins per item');
  } finally {
    await cleanup();
  }
});

test('T-007: resolve sets status to resolved and persists, leaving other items intact', async () => {
  const { base, id, cleanup } = await startBoard();
  try {
    const a = droppedItem('Dana Reviewer', 'resolve me', { intent: 'fix' });
    const b = droppedItem('Dana Reviewer', 'keep me open', { intent: 'improve' });
    await postFeedback(base, id, droppedPinContribution('Dana Reviewer', a));
    await postFeedback(base, id, droppedPinContribution('Dana Reviewer', b));

    // resolvePin POSTs the full item with status:'resolved'.
    const resolved = { ...a, status: 'resolved' };
    const res = await postFeedback(base, id, droppedPinContribution('Dana Reviewer', resolved));
    assert.equal(res.status, 200, 'resolve POST accepted');

    const after = await getFeedback(base, id);
    const r = after.pins.find((p) => p.comment === 'resolve me');
    const open = after.pins.find((p) => p.comment === 'keep me open');
    assert.equal(r.status, 'resolved', 'the resolved pin persists status=resolved');
    assert.notEqual(open.status, 'resolved', 'the other pin stays open (resolve is per-item)');
    assert.equal(after.pins.length, 2, 'no item dropped by the resolve merge');
  } finally {
    await cleanup();
  }
});
