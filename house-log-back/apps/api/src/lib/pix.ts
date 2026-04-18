// Gera BR Code (Pix copia-e-cola) estático conforme Manual BCB.
// Formato EMVCo TLV com CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF).

export type PixInput = {
  pixKey: string;           // chave do recebedor (cpf/cnpj/email/phone/random)
  merchantName: string;     // até 25 chars, sem acentos
  merchantCity: string;     // até 15 chars, sem acentos
  amountCents: number;      // centavos (> 0)
  txid: string;             // até 25 chars alfanuméricos
  description?: string;     // opcional, até 40 chars
};

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildBrCode(input: PixInput): string {
  const name = stripAccents(input.merchantName).toUpperCase().slice(0, 25);
  const city = stripAccents(input.merchantCity).toUpperCase().slice(0, 15);
  const txid = (input.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const amount = (input.amountCents / 100).toFixed(2);

  const gui = tlv('00', 'br.gov.bcb.pix');
  const key = tlv('01', input.pixKey);
  const desc = input.description
    ? tlv('02', stripAccents(input.description).slice(0, 40))
    : '';
  const merchantInfo = tlv('26', gui + key + desc);

  const addl = tlv('62', tlv('05', txid));

  const payload =
    tlv('00', '01') +            // Payload Format Indicator
    tlv('01', '11') +            // Point of Initiation — 11 = estático single-use-ish
    merchantInfo +
    tlv('52', '0000') +          // Merchant Category Code
    tlv('53', '986') +           // Moeda BRL
    tlv('54', amount) +
    tlv('58', 'BR') +
    tlv('59', name) +
    tlv('60', city) +
    addl +
    '6304';                      // CRC TLV sem valor — calcula sobre tudo acima

  const crc = crc16(payload);
  return payload + crc;
}

export function validatePixKey(key: string, type: string): boolean {
  const k = key.trim();
  if (type === 'cpf') return /^\d{11}$/.test(k.replace(/\D/g, ''));
  if (type === 'cnpj') return /^\d{14}$/.test(k.replace(/\D/g, ''));
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k);
  if (type === 'phone') return /^\+?\d{10,14}$/.test(k.replace(/\D/g, ''));
  if (type === 'random') return /^[0-9a-f-]{32,36}$/i.test(k);
  return false;
}
