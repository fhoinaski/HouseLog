import { describe, expect, it } from 'vitest';
import { createTechnicalPointSchema } from '@houselog/contracts';

const validPoint = {
  name: 'Registro geral',
  type: 'valve',
  risk_level: 'medium',
  floor: 0,
};

describe('createTechnicalPointSchema', () => {
  it('accepts coordinates inside the relative 0-100 range', () => {
    const result = createTechnicalPointSchema.safeParse({
      ...validPoint,
      position_x: 42.5,
      position_y: 80,
    });

    expect(result.success).toBe(true);
  });

  it('rejects coordinates below 0', () => {
    const result = createTechnicalPointSchema.safeParse({
      ...validPoint,
      position_x: -1,
      position_y: 10,
    });

    expect(result.success).toBe(false);
  });

  it('rejects coordinates above 100', () => {
    const result = createTechnicalPointSchema.safeParse({
      ...validPoint,
      position_x: 10,
      position_y: 101,
    });

    expect(result.success).toBe(false);
  });
});
