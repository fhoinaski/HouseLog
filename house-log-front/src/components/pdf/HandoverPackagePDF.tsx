'use client';

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { HandoverPackage, HandoverPackageSnapshot } from '@houselog/contracts';
import { COLOR_PALETTE } from '@/lib/color-palette';

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 40,
    paddingBottom: 56,
    color: COLOR_PALETTE.neutral900,
    backgroundColor: COLOR_PALETTE.white,
  },
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 48,
    paddingBottom: 56,
    color: COLOR_PALETTE.neutral900,
    backgroundColor: COLOR_PALETTE.white,
    justifyContent: 'space-between',
  },
  coverLogo: { fontSize: 13, color: COLOR_PALETTE.neutral600, marginBottom: 48 },
  coverAccent: { width: 48, height: 4, backgroundColor: COLOR_PALETTE.primary, marginBottom: 32 },
  coverTitle: { fontSize: 22, color: COLOR_PALETTE.neutral900, marginBottom: 6 },
  coverSubtitle: { fontSize: 11, color: COLOR_PALETTE.primary, marginBottom: 28 },
  coverMeta: { fontSize: 9, color: COLOR_PALETTE.neutral600, marginBottom: 4 },
  coverDivider: { height: 0.5, backgroundColor: COLOR_PALETTE.neutral100, marginVertical: 18 },
  coverConfidential: {
    fontSize: 8,
    color: COLOR_PALETTE.neutral400,
    textAlign: 'center',
    borderTop: `0.5pt solid ${COLOR_PALETTE.neutral100}`,
    paddingTop: 12,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: `0.5pt solid ${COLOR_PALETTE.neutral100}`,
  },
  headerLeft: { fontSize: 8, color: COLOR_PALETTE.neutral600 },
  headerRight: { fontSize: 8, color: COLOR_PALETTE.neutral400 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 8,
    color: COLOR_PALETTE.neutral600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${COLOR_PALETTE.neutral100}`,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    width: '31%',
    padding: 8,
    backgroundColor: COLOR_PALETTE.neutral50,
    borderRadius: 4,
  },
  cellLabel: { fontSize: 7, color: COLOR_PALETTE.neutral600, marginBottom: 2 },
  cellValue: { fontSize: 9, color: COLOR_PALETTE.neutral900 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLOR_PALETTE.neutral50,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `0.3pt solid ${COLOR_PALETTE.neutral100}`,
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `0.3pt solid ${COLOR_PALETTE.neutral100}`,
    backgroundColor: COLOR_PALETTE.neutral50,
  },
  th: { fontSize: 7, color: COLOR_PALETTE.neutral600 },
  td: { fontSize: 8, color: COLOR_PALETTE.neutral900 },
  note: { fontSize: 8, lineHeight: 1.5, color: COLOR_PALETTE.neutral600 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 7,
    color: COLOR_PALETTE.neutral400,
    borderTop: `0.3pt solid ${COLOR_PALETTE.neutral100}`,
    paddingTop: 6,
  },
});

function fmtDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = value.slice(0, 10);
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function Header({ propertyName, packageTitle }: { propertyName: string; packageTitle: string }) {
  return (
    <View style={S.pageHeader} fixed>
      <Text style={S.headerLeft}>HouseLog - Handover Digital - {propertyName}</Text>
      <Text style={S.headerRight}>{packageTitle}</Text>
    </View>
  );
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={S.footer} fixed>
      <Text>Documento de handover - HouseLog</Text>
      <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
      <Text>Gerado em {fmtDate(generatedAt)}</Text>
    </View>
  );
}

function SectionTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Array<Record<string, string>>;
  columns: Array<{ key: string; label: string; flex?: number; width?: number }>;
}) {
  if (rows.length === 0) return null;

  return (
    <View style={S.section}>
      <Text style={S.sectionTitle}>{title} ({rows.length})</Text>
      <View style={S.tableHeader}>
        {columns.map((column) => (
          <Text key={column.key} style={[S.th, column.width ? { width: column.width } : { flex: column.flex ?? 1 }]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={index} style={index % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          {columns.map((column) => (
            <Text key={column.key} style={[S.td, column.width ? { width: column.width } : { flex: column.flex ?? 1 }]}>
              {row[column.key] ?? '-'}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function HandoverPackagePDF({
  handoverPackage,
  snapshot,
}: {
  handoverPackage: HandoverPackage;
  snapshot: HandoverPackageSnapshot;
}) {
  const property = snapshot.property;

  return (
    <Document>
      <Page size="A4" style={S.coverPage}>
        <View>
          <Text style={S.coverLogo}>HouseLog</Text>
          <View style={S.coverAccent} />
          <Text style={S.coverTitle}>HANDOVER DIGITAL</Text>
          <Text style={S.coverTitle}>DO IMOVEL</Text>
          <Text style={S.coverSubtitle}>{property.name}</Text>
          <View style={S.coverDivider} />
          <Text style={S.coverMeta}>{property.address}</Text>
          <Text style={S.coverMeta}>{property.city}</Text>
          <Text style={S.coverMeta}>Pacote: {handoverPackage.title} - versao {handoverPackage.version}</Text>
          <Text style={S.coverMeta}>Emitido em: {fmtDate(handoverPackage.issued_at ?? snapshot.generatedAt)}</Text>
          <Text style={S.coverMeta}>Validade: {fmtDate(handoverPackage.expires_at)}</Text>
        </View>
        <Text style={S.coverConfidential}>
          Documento gerado a partir do snapshot emitido do handover. Nao inclui tokens publicos, URLs privadas, R2 keys ou identificadores internos.
        </Text>
      </Page>

      <Page size="A4" style={S.page}>
        <Header propertyName={property.name} packageTitle={handoverPackage.title} />

        <View style={S.section}>
          <Text style={S.sectionTitle}>Resumo do imovel</Text>
          <View style={S.grid}>
            {[
              { label: 'Tipo', value: property.type },
              { label: 'Endereco', value: property.address },
              { label: 'Cidade', value: property.city },
              { label: 'Area', value: property.areaM2 != null ? `${property.areaM2} m2` : null },
              { label: 'Ano', value: property.yearBuilt },
              { label: 'Estrutura', value: property.structure },
              { label: 'Pavimentos', value: property.floors },
              { label: 'Saude tecnica', value: `${property.healthScore}/100` },
              { label: 'Snapshot', value: fmtDate(snapshot.generatedAt) },
            ].map((item) => (
              <View key={item.label} style={S.cell}>
                <Text style={S.cellLabel}>{item.label}</Text>
                <Text style={S.cellValue}>{fmtValue(item.value)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>Resumo do pacote</Text>
          <Text style={S.note}>
            Este PDF consolida documentos, garantias, sistemas tecnicos, inventario, manutencoes recomendadas e checklist fixados no momento da emissao.
          </Text>
        </View>

        <SectionTable
          title="Ambientes"
          rows={snapshot.rooms.map((room) => ({
            name: room.name,
            type: room.type,
            floor: fmtValue(room.floor),
            area: room.areaM2 != null ? `${room.areaM2}` : '-',
          }))}
          columns={[
            { key: 'name', label: 'Ambiente', flex: 2 },
            { key: 'type', label: 'Tipo', flex: 1 },
            { key: 'floor', label: 'Pav.', width: 45 },
            { key: 'area', label: 'Area', width: 55 },
          ]}
        />

        <SectionTable
          title="Documentos"
          rows={snapshot.documents.map((document) => ({
            title: document.title,
            type: document.type,
            issue: fmtDate(document.issueDate),
            expiry: fmtDate(document.expiryDate),
          }))}
          columns={[
            { key: 'title', label: 'Documento', flex: 2 },
            { key: 'type', label: 'Tipo', flex: 1 },
            { key: 'issue', label: 'Emissao', width: 70 },
            { key: 'expiry', label: 'Validade', width: 70 },
          ]}
        />

        <SectionTable
          title="Garantias"
          rows={snapshot.warranties.map((warranty) => ({
            title: warranty.title,
            type: warranty.warrantyType,
            provider: warranty.providerName ?? '-',
            end: fmtDate(warranty.endDate),
            status: warranty.status,
          }))}
          columns={[
            { key: 'title', label: 'Garantia', flex: 2 },
            { key: 'type', label: 'Tipo', flex: 1 },
            { key: 'provider', label: 'Responsavel', flex: 1 },
            { key: 'end', label: 'Fim', width: 60 },
            { key: 'status', label: 'Status', width: 55 },
          ]}
        />

        <SectionTable
          title="Sistemas tecnicos"
          rows={snapshot.technicalSystems.map((system) => ({
            name: system.name,
            type: system.type,
            status: system.status,
            location: system.locationSummary ?? '-',
            inspection: fmtDate(system.lastInspectionAt),
          }))}
          columns={[
            { key: 'name', label: 'Sistema', flex: 2 },
            { key: 'type', label: 'Tipo', flex: 1 },
            { key: 'status', label: 'Status', width: 55 },
            { key: 'location', label: 'Local', flex: 1 },
            { key: 'inspection', label: 'Revisao', width: 65 },
          ]}
        />

        <SectionTable
          title="Inventario tecnico"
          rows={snapshot.inventoryItems.map((item) => ({
            name: item.name,
            category: item.category,
            quantity: item.quantity != null ? `${item.quantity} ${item.unit ?? 'un'}` : '-',
            warranty: fmtDate(item.warrantyUntil),
          }))}
          columns={[
            { key: 'name', label: 'Item', flex: 2 },
            { key: 'category', label: 'Categoria', flex: 1 },
            { key: 'quantity', label: 'Qtd.', width: 65 },
            { key: 'warranty', label: 'Garantia', width: 70 },
          ]}
        />

        <SectionTable
          title="Manutencoes recomendadas"
          rows={snapshot.maintenanceSchedules.map((schedule) => ({
            title: schedule.title,
            system: schedule.systemType,
            frequency: schedule.frequency ?? '-',
            responsible: schedule.responsible ?? '-',
            next: fmtDate(schedule.nextDue),
          }))}
          columns={[
            { key: 'title', label: 'Rotina', flex: 2 },
            { key: 'system', label: 'Sistema', flex: 1 },
            { key: 'frequency', label: 'Freq.', width: 60 },
            { key: 'responsible', label: 'Resp.', flex: 1 },
            { key: 'next', label: 'Proxima', width: 65 },
          ]}
        />

        <SectionTable
          title="Checklist de entrega"
          rows={snapshot.checklistItems.map((item) => ({
            title: item.title,
            category: item.category,
            status: item.status,
            required: item.required ? 'Sim' : 'Nao',
            condition: item.condition ?? '-',
          }))}
          columns={[
            { key: 'title', label: 'Item', flex: 2 },
            { key: 'category', label: 'Categoria', flex: 1 },
            { key: 'status', label: 'Status', width: 65 },
            { key: 'required', label: 'Obrig.', width: 45 },
            { key: 'condition', label: 'Condicao', width: 65 },
          ]}
        />

        <Footer generatedAt={snapshot.generatedAt} />
      </Page>
    </Document>
  );
}
