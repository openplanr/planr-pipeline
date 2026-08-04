import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { validateOperatingCheckpoint } from '../operate/reducer.mjs';
import { assertProtocolArtifact } from '../protocol/contracts.mjs';

const PROJECTION_RELATIVE_PATH = 'operate/projections/state.json';
const CHECKPOINT_RELATIVE_PATH = 'operate/checkpoints/current.json';
// Internal CLI state layout. Its presence proves an operate cycle ran; its
// contents are a private CLI contract, so this reader only observes existence
// and mtime — it never parses or renders `.state/state.json`.
const LEGACY_STATE_RELATIVE_PATH = 'operate/.state/state.json';
const DEFAULT_MAX_BYTES = 1024 * 1024;

function result(status, extra = {}) {
  return {
    available: status !== 'absent' && status !== 'legacy-state-present',
    readOnly: true,
    status,
    path: `.planr/${PROJECTION_RELATIVE_PATH}`,
    ...extra,
  };
}

function safeReadJson(path, maxBytes) {
  const stats = statSync(path);
  if (!stats.isFile()) throw new Error('projection path is not a regular file');
  if (stats.size > maxBytes) throw new Error(`projection exceeds ${maxBytes} bytes`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Read the reducer-generated Operating projection only. This function never
 * replays, repairs, or writes state. A checkpoint mismatch is surfaced as
 * `stale`, leaving CLI/doctor as the only authority for recovery.
 *
 * When the public projection is absent but the CLI's internal `.state`
 * layout exists, the result is `legacy-state-present` (distinct from `absent`,
 * which means operate never ran) with an actionable `hint`. The private
 * `.state` contents are never read — only existence and mtime are observed.
 */
export function readOperatingProjection(planrDir, {
  maxBytes = DEFAULT_MAX_BYTES,
  expectedEventHead = null,
} = {}) {
  const projectionPath = join(planrDir, PROJECTION_RELATIVE_PATH);
  if (!existsSync(projectionPath)) {
    const legacyStatePath = join(planrDir, LEGACY_STATE_RELATIVE_PATH);
    if (existsSync(legacyStatePath)) {
      return result('legacy-state-present', {
        state: null,
        hint: 'An operate cycle exists on disk (internal CLI `.state` layout) but no dashboard projection was written. Upgrade the CLI or re-run an operate cycle to emit .planr/operate/projections/state.json.',
        legacyStateMtime: statSync(legacyStatePath).mtime.toISOString(),
      });
    }
    return result('absent', { state: null });
  }
  let state;
  try {
    state = safeReadJson(projectionPath, maxBytes);
    assertProtocolArtifact('operating-state', state);
  } catch (error) {
    return result('invalid', {
      state: null,
      error: String(error?.message ?? error),
      recovery: 'Run `planr operate integrity status`; do not edit the projection by hand.',
    });
  }

  let expected = expectedEventHead;
  const checkpointPath = join(planrDir, CHECKPOINT_RELATIVE_PATH);
  if (!expected && existsSync(checkpointPath)) {
    try {
      const checkpoint = safeReadJson(checkpointPath, maxBytes);
      validateOperatingCheckpoint(checkpoint);
      expected = checkpoint.eventHead;
    } catch (error) {
      return result('invalid', {
        state: null,
        error: `checkpoint: ${String(error?.message ?? error)}`,
        recovery: 'Run `planr operate integrity status`, then `planr operate cycles recover`; do not delete checkpoints manually.',
      });
    }
  }

  if (
    expected
    && (state.eventHead.sequence !== expected.sequence || state.eventHead.hash !== expected.hash)
  ) {
    return result('stale', {
      state,
      expectedEventHead: structuredClone(expected),
      actualEventHead: structuredClone(state.eventHead),
      recovery: 'Run `planr operate integrity status`, then `planr operate cycles recover` and explicitly approve recovery.',
    });
  }

  return result('ready', { state });
}

export {
  CHECKPOINT_RELATIVE_PATH as OPERATING_CHECKPOINT_RELATIVE_PATH,
  DEFAULT_MAX_BYTES as OPERATING_PROJECTION_MAX_BYTES,
};
