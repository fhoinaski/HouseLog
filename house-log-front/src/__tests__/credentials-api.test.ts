import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

describe('credentials API client', () => {
  it('usa somente POST /reveal para revelar credenciais', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const sourcePath = path.resolve(testDir, '../lib/api/credentials.ts');
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('method: \'POST\'');
    expect(source).toContain('/properties/${propertyId}/credentials/${id}/reveal');
    expect(source).not.toContain('/secret');
  });
});
