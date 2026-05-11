import { describe, expect, it } from 'vitest';
import {
  roomCreateSchema, roomUpdateSchema,
  documentCreateSchema,
  PropertyDocumentExtractionSchema,
  SourceEvidenceSchema,
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
  CreateDocumentIngestionJobInputSchema,
  ListDocumentIngestionJobsQuerySchema,
  ReviewDocumentExtractionInputSchema,
  ReviewDocumentExtractionCandidateInputSchema,
  DocumentExtractionCandidateSchema,
  DocumentExtractionCandidateStatusSchema,
  DocumentExtractionCandidateTargetEntityTypeSchema,
  DocumentExtractionCandidateTypeSchema,
  GenerateDocumentExtractionCandidatesInputSchema,
  ListDocumentExtractionCandidatesQuerySchema,
  DocumentIngestionJobStatusSchema,
  DocumentIngestionProviderSchema,
  DocumentIngestionSummarySchema,
  PropertyDocumentIngestionSummarySchema,
  DocumentExtractionDetailSchema,
  DocumentExtractionReviewStatusSchema,
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

describe('PropertyDocumentExtractionSchema', () => {
  const validExtraction = {
    documentType: 'manual',
    confidenceScore: 0.91,
    schemaVersion: 'v1',
    technicalSystems: [
      {
        type: 'electrical',
        name: 'Quadro geral',
        confidenceScore: 0.84,
      },
    ],
    warranties: [
      {
        title: 'Garantia do pressurizador',
        warrantyType: 'equipment',
        confidenceScore: 0.77,
      },
    ],
    inventoryItems: [
      {
        category: 'plumbing',
        name: 'Registro de esfera',
        confidenceScore: 0.72,
      },
    ],
    maintenanceRecommendations: [
      {
        systemType: 'plumbing',
        title: 'Revisar pressurizacao',
        recommendedIntervalMonths: 12,
        priority: 'medium',
        confidenceScore: 0.7,
      },
    ],
    detectedDates: [
      {
        label: 'Entrega tecnica',
        value: '2025-03-10',
        confidenceScore: 0.8,
      },
    ],
    evidence: [
      {
        pageNumber: 4,
        text: 'Revisar pressurizador anualmente.',
        confidenceScore: 0.88,
        fieldPath: 'maintenanceRecommendations.0.title',
      },
    ],
  };

  it('aceita extracao normalizada e aplica defaults em arrays', () => {
    const result = PropertyDocumentExtractionSchema.safeParse({
      documentType: 'inspection_report',
      confidenceScore: 0.9,
      schemaVersion: 'v1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.technicalSystems).toEqual([]);
      expect(result.data.warranties).toEqual([]);
      expect(result.data.inventoryItems).toEqual([]);
      expect(result.data.maintenanceRecommendations).toEqual([]);
      expect(result.data.detectedDates).toEqual([]);
      expect(result.data.warnings).toEqual([]);
      expect(result.data.evidence).toEqual([]);
    }
  });

  it('reutiliza enums compativeis com sistemas, garantias e inventario', () => {
    expect(PropertyDocumentExtractionSchema.safeParse(validExtraction).success).toBe(true);
    expect(PropertyDocumentExtractionSchema.safeParse({
      ...validExtraction,
      technicalSystems: [{ type: 'unknown', name: 'X', confidenceScore: 0.5 }],
    }).success).toBe(false);
    expect(PropertyDocumentExtractionSchema.safeParse({
      ...validExtraction,
      warranties: [{ title: 'X', warrantyType: 'insurance', confidenceScore: 0.5 }],
    }).success).toBe(false);
    expect(PropertyDocumentExtractionSchema.safeParse({
      ...validExtraction,
      inventoryItems: [{ category: 'furniture', name: 'X', confidenceScore: 0.5 }],
    }).success).toBe(false);
  });

  it('rejeita confidenceScore fora de 0 a 1', () => {
    expect(SourceEvidenceSchema.safeParse({ text: 'Trecho', confidenceScore: 1.1 }).success).toBe(false);
    expect(PropertyDocumentExtractionSchema.safeParse({
      documentType: 'manual',
      confidenceScore: -0.1,
      schemaVersion: 'v1',
    }).success).toBe(false);
  });

  it('rejeita campos server-only e chaves privadas por modo estrito', () => {
    const blockedFields = [
      'tenantId',
      'propertyId',
      'documentId',
      'jobId',
      'createdBy',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'r2Key',
    ];

    for (const field of blockedFields) {
      expect(PropertyDocumentExtractionSchema.safeParse({
        documentType: 'manual',
        confidenceScore: 0.9,
        schemaVersion: 'v1',
        [field]: 'server-only',
      }).success).toBe(false);
    }
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

// ── document ingestion jobs ───────────────────────────────────────────────────

describe('CreateDocumentIngestionJobInputSchema', () => {
  it('aceita input minimo vazio', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({}).success).toBe(true);
  });

  it('aceita provider e modelName opcionais', () => {
    const result = CreateDocumentIngestionJobInputSchema.safeParse({
      provider: 'anthropic',
      modelName: 'claude-3-5-haiku',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita tenantId por modo estrito', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ tenantId: 'ten_123' }).success).toBe(false);
  });

  it('rejeita propertyId por modo estrito', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ propertyId: 'prop_123' }).success).toBe(false);
  });

  it('rejeita documentId por modo estrito', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ documentId: 'doc_123' }).success).toBe(false);
  });

  it('rejeita status por modo estrito', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ status: 'queued' }).success).toBe(false);
  });

  it('rejeita attempts por modo estrito', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ attempts: 0 }).success).toBe(false);
  });

  it('rejeita createdAt por modo estrito', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ createdAt: '2025-01-01' }).success).toBe(false);
  });

  it('rejeita updatedAt por modo estrito', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ updatedAt: '2025-01-01' }).success).toBe(false);
  });

  it('rejeita provider invalido', () => {
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ provider: 'cohere' }).success).toBe(false);
    expect(CreateDocumentIngestionJobInputSchema.safeParse({ provider: 'azure' }).success).toBe(false);
  });
});

describe('DocumentIngestionJobStatusSchema', () => {
  it('aceita todos os status validos de job', () => {
    const valid = ['queued', 'processing', 'needs_review', 'completed', 'failed', 'cancelled'];
    for (const status of valid) {
      expect(DocumentIngestionJobStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejeita status invalido de job', () => {
    expect(DocumentIngestionJobStatusSchema.safeParse('pending').success).toBe(false);
    expect(DocumentIngestionJobStatusSchema.safeParse('running').success).toBe(false);
  });
});

describe('DocumentIngestionProviderSchema', () => {
  it('aceita todos os providers validos', () => {
    const valid = ['cloudflare_ai', 'openai', 'anthropic', 'gemini', 'manual', 'none'];
    for (const provider of valid) {
      expect(DocumentIngestionProviderSchema.safeParse(provider).success).toBe(true);
    }
  });

  it('rejeita provider invalido', () => {
    expect(DocumentIngestionProviderSchema.safeParse('cohere').success).toBe(false);
    expect(DocumentIngestionProviderSchema.safeParse('').success).toBe(false);
  });
});

describe('ListDocumentIngestionJobsQuerySchema', () => {
  it('query vazia aplica default de limit 20', () => {
    const result = ListDocumentIngestionJobsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it('aceita status e cursor opcionais', () => {
    const result = ListDocumentIngestionJobsQuerySchema.safeParse({
      status: 'completed',
      cursor: 'tok_abc',
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('coerce string "50" para numero 50', () => {
    const result = ListDocumentIngestionJobsQuerySchema.safeParse({ limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });

  it('rejeita limit "0" via coerce', () => {
    expect(ListDocumentIngestionJobsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('rejeita limit "101" via coerce', () => {
    expect(ListDocumentIngestionJobsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('aceita limit maximo de 100', () => {
    expect(ListDocumentIngestionJobsQuerySchema.safeParse({ limit: 100 }).success).toBe(true);
  });

  it('rejeita campo desconhecido por modo estrito', () => {
    expect(ListDocumentIngestionJobsQuerySchema.safeParse({ tenantId: 'ten_123' }).success).toBe(false);
  });
});

// ── document extraction review ────────────────────────────────────────────────

describe('DocumentExtractionReviewStatusSchema', () => {
  it('aceita todos os status validos de review', () => {
    const valid = ['pending', 'approved', 'rejected', 'partially_applied'];
    for (const status of valid) {
      expect(DocumentExtractionReviewStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejeita status invalido de review', () => {
    expect(DocumentExtractionReviewStatusSchema.safeParse('done').success).toBe(false);
  });
});

describe('ReviewDocumentExtractionInputSchema', () => {
  it('aceita review aprovado', () => {
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'approved' }).success).toBe(true);
  });

  it('aceita review rejeitado', () => {
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'rejected' }).success).toBe(true);
  });

  it('aceita review parcialmente aplicado', () => {
    const result = ReviewDocumentExtractionInputSchema.safeParse({
      status: 'partially_applied',
      notes: 'Apenas sistemas tecnicos foram aplicados.',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita status invalido', () => {
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'pending' }).success).toBe(false);
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'done' }).success).toBe(false);
  });

  it('rejeita reviewedBy por modo estrito', () => {
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'approved', reviewedBy: 'usr_123' }).success).toBe(false);
  });

  it('rejeita reviewedAt por modo estrito', () => {
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'approved', reviewedAt: '2025-01-01' }).success).toBe(false);
  });

  it('rejeita tenantId por modo estrito', () => {
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'approved', tenantId: 'ten_123' }).success).toBe(false);
  });

  it('rejeita propertyId por modo estrito', () => {
    expect(ReviewDocumentExtractionInputSchema.safeParse({ status: 'approved', propertyId: 'prop_123' }).success).toBe(false);
  });
});

// ── document extraction detail ────────────────────────────────────────────────

describe('DocumentExtractionDetailSchema', () => {
  const validSummaryBase = {
    id: 'ext_001',
    documentId: 'doc_001',
    jobId: 'job_001',
    schemaVersion: 'v1',
    createdAt: '2025-03-01T00:00:00Z',
    hasRawText: true,
    hasRawJson: true,
    hasNormalizedJson: true,
  };

  it('aceita detail completo com normalizedJson compativel com PropertyDocumentExtractionSchema', () => {
    const result = DocumentExtractionDetailSchema.safeParse({
      ...validSummaryBase,
      confidenceScore: 0.87,
      rawText: 'Conteudo extraido do documento.',
      rawJson: { pages: 4, lang: 'pt' },
      normalizedJson: {
        documentType: 'manual',
        confidenceScore: 0.87,
        schemaVersion: 'v1',
      },
    });
    expect(result.success).toBe(true);
  });

  it('aceita detail sem campos opcionais', () => {
    expect(DocumentExtractionDetailSchema.safeParse(validSummaryBase).success).toBe(true);
  });

  it('aceita normalizedJson nulo', () => {
    expect(DocumentExtractionDetailSchema.safeParse({ ...validSummaryBase, normalizedJson: null }).success).toBe(true);
  });

  it('rejeita confidenceScore acima de 1', () => {
    expect(DocumentExtractionDetailSchema.safeParse({ ...validSummaryBase, confidenceScore: 1.1 }).success).toBe(false);
  });

  it('rejeita confidenceScore negativo', () => {
    expect(DocumentExtractionDetailSchema.safeParse({ ...validSummaryBase, confidenceScore: -0.1 }).success).toBe(false);
  });

  it('rejeita normalizedJson com documentType invalido', () => {
    const result = DocumentExtractionDetailSchema.safeParse({
      ...validSummaryBase,
      normalizedJson: {
        documentType: 'unknown_type',
        confidenceScore: 0.5,
        schemaVersion: 'v1',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejeita normalizedJson com confidenceScore fora de 0..1', () => {
    const result = DocumentExtractionDetailSchema.safeParse({
      ...validSummaryBase,
      normalizedJson: {
        documentType: 'invoice',
        confidenceScore: 2.0,
        schemaVersion: 'v1',
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('DocumentExtractionCandidate contracts', () => {
  const validCandidate = {
    id: 'cand_001',
    documentId: 'doc_001',
    jobId: 'job_001',
    extractionId: 'ext_001',
    candidateType: 'technical_system',
    status: 'pending',
    targetEntityType: 'technical_system',
    targetEntityId: null,
    sourcePath: 'technicalSystems[0]',
    payloadJson: { name: 'Quadro geral', type: 'electrical', confidenceScore: 0.9 },
    confidenceScore: 0.9,
    reviewNotes: null,
    createdAt: '2026-05-08T12:00:00.000Z',
    updatedAt: '2026-05-08T12:00:00.000Z',
    appliedAt: null,
    appliedBy: null,
  };

  it('aceita enums de candidates', () => {
    for (const type of ['technical_system', 'warranty', 'inventory_item', 'maintenance_recommendation']) {
      expect(DocumentExtractionCandidateTypeSchema.safeParse(type).success).toBe(true);
    }
    for (const status of ['pending', 'approved', 'rejected', 'applied', 'superseded']) {
      expect(DocumentExtractionCandidateStatusSchema.safeParse(status).success).toBe(true);
    }
    for (const target of ['technical_system', 'warranty', 'inventory_item', 'maintenance_schedule', 'none']) {
      expect(DocumentExtractionCandidateTargetEntityTypeSchema.safeParse(target).success).toBe(true);
    }
  });

  it('retorna DTO sem tenantId', () => {
    const result = DocumentExtractionCandidateSchema.safeParse(validCandidate);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty('tenantId');
  });

  it('rejeita confidenceScore invalido', () => {
    expect(DocumentExtractionCandidateSchema.safeParse({ ...validCandidate, confidenceScore: 1.1 }).success).toBe(false);
  });

  it('input de generate nao aceita tenantId nem campos server-only', () => {
    expect(GenerateDocumentExtractionCandidatesInputSchema.safeParse({}).success).toBe(true);
    expect(GenerateDocumentExtractionCandidatesInputSchema.safeParse({ tenantId: 'ten_123' }).success).toBe(false);
    expect(GenerateDocumentExtractionCandidatesInputSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('query de list aceita apenas status opcional', () => {
    expect(ListDocumentExtractionCandidatesQuerySchema.safeParse({ status: 'pending' }).success).toBe(true);
    expect(ListDocumentExtractionCandidatesQuerySchema.safeParse({ tenantId: 'ten_123' }).success).toBe(false);
  });

  it('review input aceita apenas approved ou rejected', () => {
    expect(ReviewDocumentExtractionCandidateInputSchema.safeParse({ status: 'approved' }).success).toBe(true);
    expect(ReviewDocumentExtractionCandidateInputSchema.safeParse({ status: 'rejected' }).success).toBe(true);
    expect(ReviewDocumentExtractionCandidateInputSchema.safeParse({ status: 'pending' }).success).toBe(false);
    expect(ReviewDocumentExtractionCandidateInputSchema.safeParse({ status: 'applied' }).success).toBe(false);
    expect(ReviewDocumentExtractionCandidateInputSchema.safeParse({ status: 'superseded' }).success).toBe(false);
  });

  it('review input aceita reviewNotes opcional', () => {
    const result = ReviewDocumentExtractionCandidateInputSchema.safeParse({
      status: 'approved',
      reviewNotes: 'Validado para aplicacao futura.',
    });
    expect(result.success).toBe(true);
  });

  it('review input rejeita campos de escopo, server-only e aplicacao por modo estrito', () => {
    const blockedFields = [
      'tenantId',
      'propertyId',
      'documentId',
      'jobId',
      'extractionId',
      'candidateId',
      'targetEntityId',
      'appliedAt',
      'appliedBy',
      'createdAt',
      'updatedAt',
    ];

    for (const field of blockedFields) {
      expect(ReviewDocumentExtractionCandidateInputSchema.safeParse({
        status: 'approved',
        [field]: 'server-only',
      }).success).toBe(false);
    }
  });
});

describe('DocumentIngestionSummarySchema', () => {
  const validSummary = {
    totalJobs: 2,
    latestJobStatus: 'completed',
    totalExtractions: 1,
    totalReviews: 1,
    pendingReviews: 0,
    totalCandidates: 4,
    pendingCandidates: 1,
    approvedCandidates: 1,
    rejectedCandidates: 1,
    appliedCandidates: 1,
    failedJobs: 1,
    lastIngestionAt: '2026-05-08T12:00:00.000Z',
  };

  it('aceita resumo agregado sem dados brutos', () => {
    const result = DocumentIngestionSummarySchema.safeParse(validSummary);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('tenantId');
      expect(result.data).not.toHaveProperty('rawText');
      expect(result.data).not.toHaveProperty('rawJson');
      expect(result.data).not.toHaveProperty('normalizedJson');
      expect(result.data).not.toHaveProperty('payloadJson');
    }
  });

  it('aceita resumo vazio sem ingestion', () => {
    expect(DocumentIngestionSummarySchema.safeParse({
      totalJobs: 0,
      latestJobStatus: null,
      totalExtractions: 0,
      totalReviews: 0,
      pendingReviews: 0,
      totalCandidates: 0,
      pendingCandidates: 0,
      approvedCandidates: 0,
      rejectedCandidates: 0,
      appliedCandidates: 0,
      failedJobs: 0,
      lastIngestionAt: null,
    }).success).toBe(true);
  });

  it('rejeita campos negativos e status invalido', () => {
    expect(DocumentIngestionSummarySchema.safeParse({ ...validSummary, totalJobs: -1 }).success).toBe(false);
    expect(DocumentIngestionSummarySchema.safeParse({ ...validSummary, latestJobStatus: 'pending' }).success).toBe(false);
  });
});

describe('PropertyDocumentIngestionSummarySchema', () => {
  const validSummary = {
    totalDocuments: 10,
    documentsWithIngestion: 6,
    totalJobs: 8,
    processingJobs: 2,
    failedJobs: 1,
    needsReviewJobs: 1,
    totalExtractions: 4,
    pendingExtractionReviews: 1,
    totalCandidates: 7,
    pendingCandidates: 2,
    approvedCandidates: 2,
    rejectedCandidates: 1,
    appliedCandidates: 2,
    lastIngestionAt: '2026-05-08T12:00:00.000Z',
    latestStatus: 'completed',
  };

  it('aceita resumo agregado de imovel sem dados brutos', () => {
    const result = PropertyDocumentIngestionSummarySchema.safeParse(validSummary);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('tenantId');
      expect(result.data).not.toHaveProperty('rawText');
      expect(result.data).not.toHaveProperty('rawJson');
      expect(result.data).not.toHaveProperty('normalizedJson');
      expect(result.data).not.toHaveProperty('payloadJson');
    }
  });

  it('aceita resumo vazio para imovel sem ingestao', () => {
    expect(PropertyDocumentIngestionSummarySchema.safeParse({
      totalDocuments: 0,
      documentsWithIngestion: 0,
      totalJobs: 0,
      processingJobs: 0,
      failedJobs: 0,
      needsReviewJobs: 0,
      totalExtractions: 0,
      pendingExtractionReviews: 0,
      totalCandidates: 0,
      pendingCandidates: 0,
      approvedCandidates: 0,
      rejectedCandidates: 0,
      appliedCandidates: 0,
      lastIngestionAt: null,
      latestStatus: null,
    }).success).toBe(true);
  });

  it('rejeita contagem negativa e status invalido', () => {
    expect(PropertyDocumentIngestionSummarySchema.safeParse({ ...validSummary, totalDocuments: -1 }).success).toBe(false);
    expect(PropertyDocumentIngestionSummarySchema.safeParse({ ...validSummary, latestStatus: 'pending' }).success).toBe(false);
  });
});
