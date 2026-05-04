import { describe, expect, it } from 'vitest';
import {
  roomCreateSchema, roomUpdateSchema,
  documentCreateSchema,
  expenseCategorySchema, expenseCreateSchema,
  inventoryCategorySchema, inventoryCreateSchema,
  maintenanceFrequencySchema, maintenanceCreateSchema,
  credentialCategorySchema, credentialCreateSchema,
  warrantyCreateSchema, warrantyStatusSchema, warrantyTypeSchema, warrantyUpdateSchema,
  renovationCategorySchema, renovationCreateSchema, renovationStatusSchema, renovationUpdateSchema,
  handoverPackageCreateSchema, handoverPackageStatusSchema, handoverPackageTypeSchema, handoverPackageUpdateSchema,
  handoverChecklistItemCategorySchema,
  handoverChecklistItemConditionSchema,
  handoverChecklistItemCreateSchema,
  handoverChecklistItemStatusSchema,
  handoverChecklistItemStatusUpdateSchema,
  handoverChecklistItemUpdateSchema,
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

// ── warranty ───────────────────────────────────────────────────────────────

describe('warrantyTypeSchema', () => {
  it('aceita todos os tipos validos', () => {
    const valid = ['service', 'equipment', 'material', 'structural', 'appliance', 'finish', 'other'];
    for (const type of valid) {
      expect(warrantyTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('rejeita tipo desconhecido', () => {
    expect(warrantyTypeSchema.safeParse('insurance').success).toBe(false);
  });
});

describe('warrantyStatusSchema', () => {
  it('aceita todos os status validos', () => {
    const valid = ['active', 'expired', 'claimed', 'void'];
    for (const status of valid) {
      expect(warrantyStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejeita status desconhecido', () => {
    expect(warrantyStatusSchema.safeParse('pending').success).toBe(false);
  });
});

describe('warrantyCreateSchema', () => {
  const valid = {
    title: 'Garantia da impermeabilizacao',
    warranty_type: 'service',
    end_date: '2027-05-04',
  };

  it('aceita payload minimo com default de status', () => {
    const result = warrantyCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('active');
  });

  it('rejeita titulo vazio', () => {
    expect(warrantyCreateSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rejeita tipo invalido', () => {
    expect(warrantyCreateSchema.safeParse({ ...valid, warranty_type: 'insurance' }).success).toBe(false);
  });

  it('rejeita status invalido', () => {
    expect(warrantyCreateSchema.safeParse({ ...valid, status: 'pending' }).success).toBe(false);
  });

  it('rejeita payload sem end_date', () => {
    expect(warrantyCreateSchema.safeParse({ title: 'X', warranty_type: 'service' }).success).toBe(false);
  });

  it('warrantyUpdateSchema aceita objeto parcial', () => {
    expect(warrantyUpdateSchema.safeParse({ coverage: 'Pecas e mao de obra' }).success).toBe(true);
  });
});

// ── renovation ──────────────────────────────────────────────────────────────

describe('renovationCategorySchema', () => {
  it('aceita todas as categorias validas', () => {
    const valid = [
      'structural',
      'electrical',
      'plumbing',
      'finishing',
      'layout',
      'roofing',
      'waterproofing',
      'painting',
      'flooring',
      'other',
    ];
    for (const category of valid) {
      expect(renovationCategorySchema.safeParse(category).success).toBe(true);
    }
  });

  it('rejeita categoria desconhecida', () => {
    expect(renovationCategorySchema.safeParse('gardening').success).toBe(false);
  });
});

describe('renovationStatusSchema', () => {
  it('aceita todos os status validos', () => {
    const valid = ['planned', 'in_progress', 'completed', 'cancelled'];
    for (const status of valid) {
      expect(renovationStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejeita status desconhecido', () => {
    expect(renovationStatusSchema.safeParse('paused').success).toBe(false);
  });
});

describe('renovationCreateSchema', () => {
  const valid = {
    title: 'Reforma do banheiro social',
    category: 'plumbing',
  };

  it('aceita payload minimo com default de status e fotos', () => {
    const result = renovationCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('planned');
      expect(result.data.before_photos).toEqual([]);
      expect(result.data.after_photos).toEqual([]);
    }
  });

  it('rejeita enum de categoria invalido', () => {
    expect(renovationCreateSchema.safeParse({ ...valid, category: 'gardening' }).success).toBe(false);
  });

  it('rejeita enum de status invalido', () => {
    expect(renovationCreateSchema.safeParse({ ...valid, status: 'paused' }).success).toBe(false);
  });

  it('rejeita cost negativo', () => {
    expect(renovationCreateSchema.safeParse({ ...valid, cost: -1 }).success).toBe(false);
  });

  it('renovationUpdateSchema aceita objeto parcial', () => {
    expect(renovationUpdateSchema.safeParse({ notes: 'Troca de registros concluida' }).success).toBe(true);
  });
});

// ── handover package ────────────────────────────────────────────────────────

describe('handoverPackageTypeSchema', () => {
  it('aceita todos os tipos validos', () => {
    const valid = ['handover', 'move_in', 'move_out', 'inspection'];
    for (const type of valid) {
      expect(handoverPackageTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('rejeita tipo desconhecido', () => {
    expect(handoverPackageTypeSchema.safeParse('delivery').success).toBe(false);
  });
});

describe('handoverPackageStatusSchema', () => {
  it('aceita todos os status validos', () => {
    const valid = ['draft', 'in_review', 'approved', 'completed', 'archived'];
    for (const status of valid) {
      expect(handoverPackageStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejeita status desconhecido', () => {
    expect(handoverPackageStatusSchema.safeParse('signed').success).toBe(false);
  });
});

describe('handoverPackageCreateSchema', () => {
  it('aceita payload minimo com defaults', () => {
    const result = handoverPackageCreateSchema.safeParse({ title: 'Dossie de entrega' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('handover');
      expect(result.data.status).toBe('draft');
      expect(result.data.version).toBe(1);
    }
  });

  it('rejeita titulo vazio', () => {
    expect(handoverPackageCreateSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejeita type invalido', () => {
    expect(handoverPackageCreateSchema.safeParse({ title: 'X', type: 'delivery' }).success).toBe(false);
  });

  it('rejeita status invalido', () => {
    expect(handoverPackageCreateSchema.safeParse({ title: 'X', status: 'signed' }).success).toBe(false);
  });

  it('rejeita version menor que 1', () => {
    expect(handoverPackageCreateSchema.safeParse({ title: 'X', version: 0 }).success).toBe(false);
  });

  it('handoverPackageUpdateSchema aceita objeto parcial', () => {
    expect(handoverPackageUpdateSchema.safeParse({ status: 'in_review' }).success).toBe(true);
  });
});

// ── handover checklist item ─────────────────────────────────────────────────

describe('handoverChecklistItem enums', () => {
  it('aceita categorias validas', () => {
    const valid = ['keys', 'documents', 'utilities', 'inventory', 'cleaning', 'maintenance', 'safety', 'general'];
    for (const category of valid) {
      expect(handoverChecklistItemCategorySchema.safeParse(category).success).toBe(true);
    }
  });

  it('rejeita categoria invalida', () => {
    expect(handoverChecklistItemCategorySchema.safeParse('paint').success).toBe(false);
  });

  it('aceita status validos', () => {
    const valid = ['pending', 'done', 'issue', 'not_applicable'];
    for (const status of valid) {
      expect(handoverChecklistItemStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejeita status invalido', () => {
    expect(handoverChecklistItemStatusSchema.safeParse('approved').success).toBe(false);
  });

  it('aceita condicoes validas', () => {
    const valid = ['new', 'good', 'fair', 'poor', 'damaged'];
    for (const condition of valid) {
      expect(handoverChecklistItemConditionSchema.safeParse(condition).success).toBe(true);
    }
  });

  it('rejeita condition invalida', () => {
    expect(handoverChecklistItemConditionSchema.safeParse('broken').success).toBe(false);
  });
});

describe('handoverChecklistItemCreateSchema', () => {
  it('aceita payload minimo com defaults', () => {
    const result = handoverChecklistItemCreateSchema.safeParse({ title: 'Entregar chaves da porta social' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('general');
      expect(result.data.required).toBe(true);
      expect(result.data.status).toBe('pending');
      expect(result.data.evidence_urls).toEqual([]);
      expect(result.data.sort_order).toBe(0);
    }
  });

  it('rejeita titulo vazio', () => {
    expect(handoverChecklistItemCreateSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejeita sortOrder negativo', () => {
    expect(handoverChecklistItemCreateSchema.safeParse({ title: 'X', sort_order: -1 }).success).toBe(false);
  });

  it('handoverChecklistItemUpdateSchema aceita objeto parcial', () => {
    expect(handoverChecklistItemUpdateSchema.safeParse({ notes: 'Pendente vistoria final' }).success).toBe(true);
  });

  it('handoverChecklistItemStatusUpdateSchema rejeita status invalido', () => {
    expect(handoverChecklistItemStatusUpdateSchema.safeParse({ status: 'approved' }).success).toBe(false);
  });
});
