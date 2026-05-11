import type { HandoverPackagePublic } from './schemas/handover';

export function hasPublicHandoverAcceptanceReceipt(
  handoverPackage: HandoverPackagePublic
): handoverPackage is HandoverPackagePublic & { acceptanceReceipt: NonNullable<HandoverPackagePublic['acceptanceReceipt']> } {
  return handoverPackage.status === 'accepted' && handoverPackage.acceptanceReceipt !== null;
}

export function buildPublicHandoverAcceptanceSummary(handoverPackage: HandoverPackagePublic): string {
  if (!hasPublicHandoverAcceptanceReceipt(handoverPackage)) {
    return 'Comprovante de aceite digital indisponivel para este pacote.';
  }

  const receipt = handoverPackage.acceptanceReceipt;
  const lines = [
    'Comprovante de aceite digital - HouseLog',
    `Status: Recebimento confirmado`,
    `Pacote: ${receipt.packageTitle}`,
    `Imovel: ${receipt.propertySummary.name} - ${receipt.propertySummary.city}`,
    `Aceito por: ${receipt.acceptedByName}`,
    `Email: ${receipt.acceptedByEmailMasked}`,
    `Aceito em: ${receipt.acceptedAt}`,
    `Emitido em: ${receipt.issuedAt ?? 'Nao informado'}`,
    `Validade: ${receipt.expiresAt ?? 'Nao informada'}`,
  ];

  if (receipt.acceptanceNotes) {
    lines.push(`Observacoes: ${receipt.acceptanceNotes}`);
  }

  return lines.join('\n');
}
