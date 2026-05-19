import { describe, expect, it } from 'vitest';
import {
  normalizePropertyDetailTab,
  PROPERTY_DETAIL_TAB_IDS,
  PROPERTY_DETAIL_TABS,
} from '@/components/properties/property-tabs-model';

describe('property-tabs-model', () => {
  it('expõe a ordem e os ids das tabs do perfil 360', () => {
    expect(PROPERTY_DETAIL_TAB_IDS).toEqual([
      'overview',
      'rooms',
      'tickets',
      'services',
      'history',
      'photos',
      'documents',
      'warranties',
      'inventory',
      'handover',
    ]);
    expect(PROPERTY_DETAIL_TABS.map((tab) => tab.label)).toEqual([
      'Visão geral',
      'Ambientes',
      'Chamados',
      'Ordens de serviço',
      'Histórico',
      'Fotos',
      'Documentos',
      'Garantias',
      'Inventário',
      'Dossiê',
    ]);
  });

  it('normaliza query param inválido para overview', () => {
    expect(normalizePropertyDetailTab(undefined)).toBe('overview');
    expect(normalizePropertyDetailTab(null)).toBe('overview');
    expect(normalizePropertyDetailTab('')).toBe('overview');
    expect(normalizePropertyDetailTab('invalid')).toBe('overview');
    expect(normalizePropertyDetailTab('documents')).toBe('documents');
    expect(normalizePropertyDetailTab('service-requests')).toBe('tickets');
    expect(normalizePropertyDetailTab('report')).toBe('handover');
  });
});