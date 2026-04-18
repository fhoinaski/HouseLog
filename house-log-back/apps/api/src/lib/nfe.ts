// Parser mínimo de NFe XML (NF-e 4.0). Não faz validação XSD nem schema completo —
// apenas extrai os campos que importam para o HouseLog (chave, emitente, total).

export type NfeParsed = {
  chaveAcesso: string | null;
  cnpjEmitente: string | null;
  nomeEmitente: string | null;
  valorTotal: number | null;
  dataEmissao: string | null;
  items: Array<{ descricao: string; quantidade: number; valor: number }>;
};

function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = re.exec(xml);
  return m ? m[1]!.trim() : null;
}

function allTags(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]!);
  return out;
}

export function parseNfeXml(xml: string): NfeParsed {
  // Chave pode vir em <chNFe> (protNFe) ou em Id="NFe{44}"
  let chave = tag(xml, 'chNFe');
  if (!chave) {
    const mId = /Id=["']NFe(\d{44})["']/i.exec(xml);
    chave = mId ? mId[1]! : null;
  }

  const emitBlock = tag(xml, 'emit') ?? '';
  const cnpj = tag(emitBlock, 'CNPJ') ?? tag(emitBlock, 'CPF');
  const nome = tag(emitBlock, 'xNome');

  const totalBlock = tag(xml, 'ICMSTot') ?? '';
  const vNF = tag(totalBlock, 'vNF') ?? tag(xml, 'vNF');
  const valor = vNF ? Number(vNF) : null;

  const dh = tag(xml, 'dhEmi') ?? tag(xml, 'dEmi');

  const items = allTags(xml, 'det').map((det) => {
    const prod = tag(det, 'prod') ?? '';
    return {
      descricao: tag(prod, 'xProd') ?? '',
      quantidade: Number(tag(prod, 'qCom') ?? '0'),
      valor: Number(tag(prod, 'vProd') ?? '0'),
    };
  });

  return {
    chaveAcesso: chave,
    cnpjEmitente: cnpj,
    nomeEmitente: nome,
    valorTotal: Number.isFinite(valor) ? valor : null,
    dataEmissao: dh,
    items,
  };
}
