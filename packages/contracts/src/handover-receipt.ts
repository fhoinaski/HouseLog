import type { HandoverPackagePublic } from './schemas/handover';

export type PublicHandoverAcceptancePrintData = {
  title: 'Comprovante de aceite digital';
  status: 'Recebimento confirmado';
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  packageTitle: string;
  issuedAt: string | null;
  acceptedAt: string;
  acceptedByName: string;
  acceptedByEmailMasked: string;
  acceptanceNotes: string | null;
  responsibleDisplay: string | null;
};

export function hasPublicHandoverAcceptanceReceipt(
  handoverPackage: HandoverPackagePublic
): handoverPackage is HandoverPackagePublic & { acceptanceReceipt: NonNullable<HandoverPackagePublic['acceptanceReceipt']> } {
  return handoverPackage.status === 'accepted' && handoverPackage.acceptanceReceipt !== null;
}

function resolveResponsibleDisplay(handoverPackage: HandoverPackagePublic): string | null {
  const companyName = handoverPackage.companyName?.trim() || null;
  const responsibleName = handoverPackage.responsibleName?.trim() || handoverPackage.issuerName?.trim() || null;
  const role = handoverPackage.issuerRole?.trim() || null;

  if (companyName && responsibleName) {
    return role ? `${companyName} - ${responsibleName}, ${role}` : `${companyName} - ${responsibleName}`;
  }

  if (companyName) return companyName;
  if (responsibleName) return role ? `${responsibleName}, ${role}` : responsibleName;
  return null;
}

export function buildPublicHandoverAcceptancePrintData(
  handoverPackage: HandoverPackagePublic
): PublicHandoverAcceptancePrintData | null {
  if (!hasPublicHandoverAcceptanceReceipt(handoverPackage)) {
    return null;
  }

  const receipt = handoverPackage.acceptanceReceipt;

  return {
    title: 'Comprovante de aceite digital',
    status: 'Recebimento confirmado',
    propertyName: receipt.propertySummary.name,
    propertyAddress: handoverPackage.snapshot_json.property.address,
    propertyCity: receipt.propertySummary.city,
    packageTitle: receipt.packageTitle,
    issuedAt: receipt.issuedAt,
    acceptedAt: receipt.acceptedAt,
    acceptedByName: receipt.acceptedByName,
    acceptedByEmailMasked: receipt.acceptedByEmailMasked,
    acceptanceNotes: receipt.acceptanceNotes,
    responsibleDisplay: resolveResponsibleDisplay(handoverPackage),
  };
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
