export const PROVIDER_CATEGORY_VALUES = [
  'electrical',
  'plumbing',
  'structural',
  'waterproofing',
  'painting',
  'flooring',
  'roofing',
  'hvac',
  'solar',
  'pool',
  'gardening',
  'cleaning',
  'locksmith',
  'carpentry',
  'masonry',
  'automation',
  'alarm_cctv',
  'internet_network',
  'appliances',
  'pest_control',
  'glazing',
  'welding',
  'drywall',
  'drainage',
  'gas',
  'elevator',
  'facade',
  'general',
] as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORY_VALUES)[number];

const VALID = new Set<string>(PROVIDER_CATEGORY_VALUES);

const ALIASES: Record<string, ProviderCategory> = {
  eletrica: 'electrical',
  eletrica_predial: 'electrical',
  electrical: 'electrical',

  hidraulica: 'plumbing',
  plumbing: 'plumbing',

  estrutural: 'structural',
  structural: 'structural',

  impermeabilizacao: 'waterproofing',
  waterproofing: 'waterproofing',

  pintura: 'painting',
  painting: 'painting',

  piso: 'flooring',
  flooring: 'flooring',

  telhado: 'roofing',
  roofing: 'roofing',

  ar_condicionado: 'hvac',
  climatizacao: 'hvac',
  hvac: 'hvac',

  solar: 'solar',
  piscina: 'pool',
  pool: 'pool',
  jardinagem: 'gardening',
  gardening: 'gardening',
  limpeza: 'cleaning',
  cleaning: 'cleaning',
  chaveiro: 'locksmith',
  locksmith: 'locksmith',
  marcenaria: 'carpentry',
  carpentry: 'carpentry',
  alvenaria: 'masonry',
  masonry: 'masonry',
  automacao: 'automation',
  automation: 'automation',
  cftv: 'alarm_cctv',
  alarm: 'alarm_cctv',
  alarm_cctv: 'alarm_cctv',
  rede: 'internet_network',
  internet_network: 'internet_network',
  eletrodomesticos: 'appliances',
  appliances: 'appliances',
  dedetizacao: 'pest_control',
  pest_control: 'pest_control',
  vidracaria: 'glazing',
  glazing: 'glazing',
  serralheria: 'welding',
  welding: 'welding',
  drywall: 'drywall',
  drenagem: 'drainage',
  drainage: 'drainage',
  gas: 'gas',
  elevador: 'elevator',
  elevator: 'elevator',
  fachada: 'facade',
  facade: 'facade',
  geral: 'general',
  general: 'general',
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeProviderCategories(values: string[] | null | undefined): ProviderCategory[] {
  if (!values || values.length === 0) return [];
  const normalized = values
    .map(normalizeToken)
    .map((v) => ALIASES[v] ?? (VALID.has(v) ? (v as ProviderCategory) : null))
    .filter((v): v is ProviderCategory => Boolean(v));
  return Array.from(new Set(normalized));
}
