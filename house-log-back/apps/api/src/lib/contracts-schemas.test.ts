import { describe, expect, it } from 'vitest';
import {
  roomCreateSchema, roomUpdateSchema,
  documentCreateSchema,
  expenseCategorySchema, expenseCreateSchema,
  inventoryCategorySchema, inventoryCreateSchema,
  maintenanceFrequencySchema, maintenanceCreateSchema,
  credentialCategorySchema, credentialCreateSchema,
} from '@houselog/contracts';

// ── room ─────────────────────────────────────────────────────────────────────

describe('roomCreateSchema', () => {
  it('aceita payload mínimo válido', () => {
    const result = roomCreateSchema.safeParse({ name: 'Sala', type: 'living' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.floor).toBe(0);
  });

  it('rejeita type inválido', () => {
    const result = roomCreateSchema.safeParse({ name: 'X', type: 'dungeon' });
    expect(result.success).toBe(false);
  });

  it('rejeita name vazio', () => {
    expect(roomCreateSchema.safeParse({ name: '', type: 'other' }).success).toBe(false);
  });

  it('roomUpdateSchema aceita objeto vazio (todos opcionais)', () => {
    expect(roomUpdateSchema.safeParse({}).success).toBe(true);
  });
});

// ── document ─────────────────────────────────────────────────────────────────

describe('documentCreateSchema', () => {
  it('aceita payload mínimo', () => {
    const result = documentCreateSchema.safeParse({ type: 'invoice', title: 'NF-001' });
    expect(result.success).toBe(true);
  });

  it('aceita amount via coerce de string numérica', () => {
    const result = documentCreateSchema.safeParse({ type: 'manual', title: 'Manual', amount: '150.50' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(150.5);
  });

  it('rejeita type inválido', () => {
    expect(documentCreateSchema.safeParse({ type: 'receipt', title: 'X' }).success).toBe(false);
  });

  it('rejeita amount negativo', () => {
    expect(documentCreateSchema.safeParse({ type: 'invoice', title: 'X', amount: -10 }).success).toBe(false);
  });
});

// ── finance / expenses ────────────────────────────────────────────────────────

describe('expenseCategorySchema', () => {
  it('aceita todas as categorias válidas', () => {
    const valid = ['water', 'electricity', 'gas', 'condo', 'iptu', 'insurance', 'cleaning', 'garden', 'security', 'other'];
    for (const cat of valid) {
      expect(expenseCategorySchema.safeParse(cat).success).toBe(true);
    }
  });

  it('rejeita categoria fora do enum', () => {
    expect(expenseCategorySchema.safeParse('rent').success).toBe(false);
  });
});

describe('expenseCreateSchema', () => {
  it('aceita payload válido com defaults', () => {
    const result = expenseCreateSchema.safeParse({
      category: 'water', amount: 120.5, reference_month: '2025-03',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('expense');
      expect(result.data.is_recurring).toBe(false);
    }
  });

  it('rejeita reference_month malformado', () => {
    expect(expenseCreateSchema.safeParse({ category: 'gas', amount: 50, reference_month: '03/2025' }).success).toBe(false);
  });

  it('rejeita amount zero', () => {
    expect(expenseCreateSchema.safeParse({ category: 'gas', amount: 0, reference_month: '2025-03' }).success).toBe(false);
  });
});

// ── inventory ─────────────────────────────────────────────────────────────────

describe('inventoryCategorySchema', () => {
  it('aceita todas as categorias válidas', () => {
    const valid = ['paint', 'tile', 'waterproof', 'plumbing', 'electrical', 'hardware', 'adhesive', 'sealant', 'other'];
    for (const cat of valid) {
      expect(inventoryCategorySchema.safeParse(cat).success).toBe(true);
    }
  });

  it('rejeita categoria desconhecida', () => {
    expect(inventoryCategorySchema.safeParse('furniture').success).toBe(false);
  });
});

describe('inventoryCreateSchema', () => {
  it('aceita payload mínimo com defaults', () => {
    const result = inventoryCreateSchema.safeParse({ category: 'paint', name: 'Tinta Branca' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(0);
      expect(result.data.unit).toBe('un');
      expect(result.data.reserve_qty).toBe(0);
    }
  });

  it('rejeita name vazio', () => {
    expect(inventoryCreateSchema.safeParse({ category: 'tile', name: '' }).success).toBe(false);
  });

  it('rejeita price_paid negativo', () => {
    expect(inventoryCreateSchema.safeParse({ category: 'tile', name: 'Cerâmica', price_paid: -5 }).success).toBe(false);
  });
});

// ── maintenance ───────────────────────────────────────────────────────────────

describe('maintenanceFrequencySchema', () => {
  it('aceita todas as frequências válidas', () => {
    const valid = ['weekly', 'monthly', 'quarterly', 'semiannual', 'annual'];
    for (const f of valid) {
      expect(maintenanceFrequencySchema.safeParse(f).success).toBe(true);
    }
  });

  it('rejeita frequência desconhecida', () => {
    expect(maintenanceFrequencySchema.safeParse('daily').success).toBe(false);
  });
});

describe('maintenanceCreateSchema', () => {
  it('aceita payload válido', () => {
    const result = maintenanceCreateSchema.safeParse({
      system_type: 'plumbing', title: 'Revisão de encanamento', frequency: 'annual',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.auto_create_os).toBe(false);
  });

  it('rejeita system_type vazio', () => {
    expect(maintenanceCreateSchema.safeParse({ system_type: '', title: 'X', frequency: 'monthly' }).success).toBe(false);
  });

  it('rejeita frequency inválida', () => {
    expect(maintenanceCreateSchema.safeParse({ system_type: 'electrical', title: 'X', frequency: 'daily' }).success).toBe(false);
  });
});

// ── credential ────────────────────────────────────────────────────────────────

describe('credentialCategorySchema', () => {
  it('aceita todas as categorias válidas', () => {
    const valid = ['wifi', 'alarm', 'smart_lock', 'gate', 'app', 'other'];
    for (const cat of valid) {
      expect(credentialCategorySchema.safeParse(cat).success).toBe(true);
    }
  });

  it('rejeita categoria desconhecida', () => {
    expect(credentialCategorySchema.safeParse('biometric').success).toBe(false);
  });
});

describe('credentialCreateSchema', () => {
  it('aceita payload mínimo com default de category', () => {
    const result = credentialCreateSchema.safeParse({ label: 'Wi-Fi Casa', secret: 'senha123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('other');
      expect(result.data.share_with_os).toBe(false);
    }
  });

  it('rejeita secret vazio', () => {
    expect(credentialCreateSchema.safeParse({ label: 'Wi-Fi', secret: '' }).success).toBe(false);
  });

  it('rejeita label vazio', () => {
    expect(credentialCreateSchema.safeParse({ label: '', secret: 'abc' }).success).toBe(false);
  });

  it('aceita integration_type intelbras', () => {
    const result = credentialCreateSchema.safeParse({
      label: 'Alarme', secret: '1234', integration_type: 'intelbras',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita integration_type inválido', () => {
    expect(credentialCreateSchema.safeParse({ label: 'X', secret: 'y', integration_type: 'ajax' }).success).toBe(false);
  });
});
