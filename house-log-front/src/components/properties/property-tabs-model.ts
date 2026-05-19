export const PROPERTY_DETAIL_TAB_IDS = [
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
] as const;

export type PropertyDetailTabId = (typeof PROPERTY_DETAIL_TAB_IDS)[number];

export type PropertyDetailTab = {
  id: PropertyDetailTabId;
  label: string;
};

export const PROPERTY_DETAIL_TABS: PropertyDetailTab[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'rooms', label: 'Ambientes' },
  { id: 'tickets', label: 'Chamados' },
  { id: 'services', label: 'Ordens de serviço' },
  { id: 'history', label: 'Histórico' },
  { id: 'photos', label: 'Fotos' },
  { id: 'documents', label: 'Documentos' },
  { id: 'warranties', label: 'Garantias' },
  { id: 'inventory', label: 'Inventário' },
  { id: 'handover', label: 'Dossiê' },
];

export function normalizePropertyDetailTab(value: string | null | undefined): PropertyDetailTabId {
  if (!value) return 'overview';
  const normalized = value.trim().toLowerCase();
  if ((PROPERTY_DETAIL_TAB_IDS as readonly string[]).includes(normalized)) {
    return normalized as PropertyDetailTabId;
  }
  if (normalized === 'requests' || normalized === 'service-requests') return 'tickets';
  if (normalized === 'dossier' || normalized === 'report') return 'handover';
  return 'overview';
}