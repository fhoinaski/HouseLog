export type RoomTemplate = {
  name: string;
  type: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'garage' | 'laundry' | 'external' | 'roof' | 'other';
  floor: number;
};

export type MaintenanceTemplate = {
  title: string;
  system_type: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  description?: string;
};

export type PropertyTemplate = {
  label: string;
  rooms: RoomTemplate[];
  maintenance: MaintenanceTemplate[];
};

export const PROPERTY_TEMPLATES: Record<string, PropertyTemplate> = {
  house: {
    label: 'Casa',
    rooms: [
      { name: 'Sala de Estar', type: 'living', floor: 0 },
      { name: 'Cozinha', type: 'kitchen', floor: 0 },
      { name: 'Quarto Principal', type: 'bedroom', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
      { name: 'Garagem', type: 'garage', floor: 0 },
      { name: 'Área de Serviço', type: 'laundry', floor: 0 },
    ],
    maintenance: [
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Limpeza de Calhas', system_type: 'Calhas', frequency: 'semiannual', description: 'Limpeza e desobstrução de calhas' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico e fiações' },
      { title: 'Revisão Hidráulica', system_type: 'Hidráulica', frequency: 'annual', description: 'Inspeção de encanamentos e válvulas' },
    ],
  },
  apt: {
    label: 'Apartamento',
    rooms: [
      { name: 'Sala', type: 'living', floor: 0 },
      { name: 'Cozinha', type: 'kitchen', floor: 0 },
      { name: 'Quarto Principal', type: 'bedroom', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
    ],
    maintenance: [
      { title: 'Manutenção Ar-Condicionado', system_type: 'Climatização', frequency: 'semiannual', description: 'Limpeza de filtros e revisão do sistema' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico e tomadas' },
    ],
  },
  commercial: {
    label: 'Comercial',
    rooms: [
      { name: 'Recepção', type: 'living', floor: 0 },
      { name: 'Escritório', type: 'other', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
      { name: 'Copa', type: 'kitchen', floor: 0 },
    ],
    maintenance: [
      { title: 'Manutenção Ar-Condicionado', system_type: 'Climatização', frequency: 'quarterly', description: 'Limpeza de filtros e revisão do sistema' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico' },
    ],
  },
  warehouse: {
    label: 'Galpão',
    rooms: [
      { name: 'Área de Carga', type: 'other', floor: 0 },
      { name: 'Escritório', type: 'other', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
    ],
    maintenance: [
      { title: 'Revisão Estrutural', system_type: 'Estrutura', frequency: 'annual', description: 'Inspeção de telhado, piso e estrutura' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e roedores' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico industrial' },
    ],
  },
};

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};
