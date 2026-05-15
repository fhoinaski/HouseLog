import { describe, expect, it } from 'vitest';
import { createId, isUuidV4 } from './id';

describe('secure id generation', () => {
  it('creates UUID v4 ids', () => {
    const id = createId();

    expect(isUuidV4(id)).toBe(true);
  });

  it('does not accept short or sequential ids as UUID v4', () => {
    expect(isUuidV4('1')).toBe(false);
    expect(isUuidV4('prop-123')).toBe(false);
    expect(isUuidV4('018f4f6d-0b74-7000-8000-000000000000')).toBe(false);
  });

  it('does not repeat ids across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()));

    expect(ids.size).toBe(100);
  });
});
