'use client';

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COLOR_PALETTE } from '@/lib/color-palette';
import type { DossiePayload } from '@houselog/contracts';

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 40,
    paddingBottom: 56,
    color: COLOR_PALETTE.neutral900,
    backgroundColor: COLOR_PALETTE.white,
  },

  // Cover
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 48,
    paddingBottom: 56,
    color: COLOR_PALETTE.neutral900,
    backgroundColor: COLOR_PALETTE.white,
    justifyContent: 'space-between',
  },
  coverAccent: {
    width: 48,
    height: 4,
    backgroundColor: COLOR_PALETTE.primary,
    marginBottom: 32,
  },
  coverLogo: {
    fontSize: 13,
    fontFamily: 'Helvetica',
    color: COLOR_PALETTE.neutral600,
    marginBottom: 48,
  },
  coverTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica',
    color: COLOR_PALETTE.neutral900,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  coverSubtitle: {
    fontSize: 11,
    color: COLOR_PALETTE.primary,
    marginBottom: 32,
    fontFamily: 'Helvetica',
  },
  coverMeta: {
    fontSize: 9,
    color: COLOR_PALETTE.neutral600,
    marginBottom: 4,
  },
  coverDivider: {
    height: 0.5,
    backgroundColor: COLOR_PALETTE.neutral100,
    marginVertical: 20,
  },
  coverConfidential: {
    fontSize: 8,
    color: COLOR_PALETTE.neutral400,
    textAlign: 'center',
    borderTop: `0.5pt solid ${COLOR_PALETTE.neutral100}`,
    paddingTop: 12,
  },

  // Header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: `0.5pt solid ${COLOR_PALETTE.neutral100}`,
  },
  pageHeaderLeft: { fontSize: 8, color: COLOR_PALETTE.neutral600 },
  pageHeaderRight: { fontSize: 8, color: COLOR_PALETTE.neutral400 },

  // Section
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: COLOR_PALETTE.neutral600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${COLOR_PALETTE.neutral100}`,
  },

  // Property info grid
  propGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  propCell: {
    width: '30%',
    padding: 8,
    backgroundColor: COLOR_PALETTE.neutral50,
    borderRadius: 4,
  },
  propCellLabel: { fontSize: 7, color: COLOR_PALETTE.neutral600, marginBottom: 2 },
  propCellValue: { fontSize: 9, fontFamily: 'Helvetica', color: COLOR_PALETTE.neutral900 },

  // Score chip
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: '6 10',
    backgroundColor: COLOR_PALETTE.primaryLight,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  scoreChipLabel: { fontSize: 8, color: COLOR_PALETTE.neutral600 },
  scoreChipValue: { fontSize: 12, fontFamily: 'Helvetica', color: COLOR_PALETTE.primary },

  // Table
  table: { marginBottom: 4 },
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
  thCell: { fontSize: 7, fontFamily: 'Helvetica', color: COLOR_PALETTE.neutral600 },
  tdCell: { fontSize: 8, color: COLOR_PALETTE.neutral900 },

  // Status badges
  badgeActive: {
    fontSize: 7,
    color: COLOR_PALETTE.success,
    backgroundColor: COLOR_PALETTE.successLight,
    padding: '2 5',
    borderRadius: 3,
  },
  badgeExpired: {
    fontSize: 7,
    color: COLOR_PALETTE.danger,
    backgroundColor: COLOR_PALETTE.dangerLight,
    padding: '2 5',
    borderRadius: 3,
  },
  badgeOther: {
    fontSize: 7,
    color: COLOR_PALETTE.neutral600,
    backgroundColor: COLOR_PALETTE.neutral50,
    padding: '2 5',
    borderRadius: 3,
  },

  // Timeline
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  timelineDate: { fontSize: 7, color: COLOR_PALETTE.neutral400, width: 72 },
  timelineType: { fontSize: 7, color: COLOR_PALETTE.neutral600, width: 72 },
  timelineTitle: { fontSize: 8, color: COLOR_PALETTE.neutral900, flex: 1 },

  // Footer
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apt: 'Apartamento',
  house: 'Casa',
  commercial: 'Comercial',
  warehouse: 'Galpão',
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const TIMELINE_TYPE_LABELS: Record<string, string> = {
  service_order: 'Serviço',
  renovation: 'Reforma',
  document: 'Documento',
  warranty: 'Garantia',
};

const TIMELINE_COLORS: Record<string, string> = {
  service_order: COLOR_PALETTE.primary,
  renovation: COLOR_PALETTE.warning,
  document: COLOR_PALETTE.neutral400,
  warranty: COLOR_PALETTE.success,
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.slice(0, 10).split('-');
  if (parts.length !== 3) return d.slice(0, 10);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  const style =
    status === 'active' ? S.badgeActive
    : status === 'expired' || status === 'cancelled' ? S.badgeExpired
    : S.badgeOther;
  const labels: Record<string, string> = {
    active: 'Ativa', expired: 'Expirada', claimed: 'Acionada',
    void: 'Nula', completed: 'Concluída', in_progress: 'Em andamento',
    planned: 'Planejada', cancelled: 'Cancelada', verified: 'Verificada',
  };
  return <Text style={style}>{labels[status] ?? status}</Text>;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader({ propertyName, tenantName }: { propertyName: string; tenantName: string }) {
  return (
    <View style={S.pageHeader} fixed>
      <Text style={S.pageHeaderLeft}>HouseLog · Dossiê Técnico · {propertyName}</Text>
      <Text style={S.pageHeaderRight}>{tenantName}</Text>
    </View>
  );
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={S.footer} fixed>
      <Text>DOCUMENTO CONFIDENCIAL — HouseLog</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      <Text>Emitido em {fmtDate(generatedAt)}</Text>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  dossie: DossiePayload;
}

export function PropertyDossieDocument({ dossie }: Props) {
  const { property, tenant_name, issuer_name, generated_at } = dossie;
  const propertyTypeLabel = PROPERTY_TYPE_LABELS[property.type] ?? property.type;

  return (
    <Document>
      {/* ── Capa ─────────────────────────────────────────────────────────── */}
      <Page size="A4" style={S.coverPage}>
        <View>
          <Text style={S.coverLogo}>HouseLog</Text>
          <View style={S.coverAccent} />
          <Text style={S.coverTitle}>DOSSIÊ TÉCNICO</Text>
          <Text style={S.coverTitle}>DO IMÓVEL</Text>
          <Text style={S.coverSubtitle}>{property.name}</Text>
          <View style={S.coverDivider} />
          <Text style={S.coverMeta}>{property.address}</Text>
          <Text style={S.coverMeta}>{property.city}</Text>
          <Text style={S.coverMeta}>{propertyTypeLabel}{property.area_m2 ? ` · ${property.area_m2} m²` : ''}{property.year_built ? ` · Construído em ${property.year_built}` : ''}</Text>
          <View style={S.coverDivider} />
          <Text style={S.coverMeta}>Organização: {tenant_name}</Text>
          <Text style={S.coverMeta}>Responsável pela emissão: {issuer_name}</Text>
          <Text style={S.coverMeta}>Data de emissão: {fmtDate(generated_at)}</Text>
        </View>
        <Text style={S.coverConfidential}>
          DOCUMENTO CONFIDENCIAL — Este dossiê técnico contém informações proprietárias e é destinado exclusivamente ao destinatário autorizado.
          A reprodução, distribuição ou divulgação sem autorização expressa é proibida.
        </Text>
      </Page>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <PageHeader propertyName={property.name} tenantName={tenant_name} />

        {/* Score de saúde */}
        {property.health_score != null && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Score de saúde</Text>
            <View style={S.scoreChip}>
              <Text style={S.scoreChipLabel}>Score atual</Text>
              <Text style={S.scoreChipValue}>{property.health_score}/100</Text>
            </View>
          </View>
        )}

        {/* Dados do imóvel */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Dados do imóvel</Text>
          <View style={S.propGrid}>
            {[
              { label: 'Tipo', value: propertyTypeLabel },
              { label: 'Endereço', value: property.address },
              { label: 'Cidade', value: property.city },
              property.area_m2 != null && { label: 'Área', value: `${property.area_m2} m²` },
              property.year_built != null && { label: 'Ano de construção', value: String(property.year_built) },
              property.structure && { label: 'Estrutura', value: property.structure },
              property.floors != null && { label: 'Pavimentos', value: String(property.floors) },
            ]
              .filter(Boolean)
              .map((item, i) => (
                <View key={i} style={S.propCell}>
                  <Text style={S.propCellLabel}>{(item as { label: string }).label}</Text>
                  <Text style={S.propCellValue}>{(item as { value: string }).value}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* Ambientes */}
        {dossie.rooms.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Ambientes ({dossie.rooms.length})</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.thCell, { flex: 2 }]}>Ambiente</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Tipo</Text>
                <Text style={[S.thCell, { width: 60 }]}>Pavimento</Text>
                <Text style={[S.thCell, { width: 60 }]}>Área (m²)</Text>
              </View>
              {dossie.rooms.map((r, i) => (
                <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tdCell, { flex: 2 }]}>{r.name}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{r.type}</Text>
                  <Text style={[S.tdCell, { width: 60 }]}>{r.floor ?? 0}</Text>
                  <Text style={[S.tdCell, { width: 60 }]}>{r.area_m2 != null ? `${r.area_m2}` : '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Inventário técnico */}
        {dossie.inventory_items.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Inventário técnico ({dossie.inventory_items.length} itens)</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.thCell, { flex: 2 }]}>Item</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Categoria</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Ambiente</Text>
                <Text style={[S.thCell, { width: 50 }]}>Qtd.</Text>
                <Text style={[S.thCell, { width: 70 }]}>Garantia até</Text>
              </View>
              {dossie.inventory_items.map((item, i) => (
                <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tdCell, { flex: 2 }]}>{item.name}{item.brand ? ` (${item.brand})` : ''}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{item.category}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{item.room_name ?? '—'}</Text>
                  <Text style={[S.tdCell, { width: 50 }]}>{item.quantity != null ? `${item.quantity} ${item.unit ?? ''}` : '—'}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtDate(item.warranty_until)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Garantias */}
        {dossie.warranties.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Garantias ({dossie.warranties.length})</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.thCell, { flex: 2 }]}>Garantia</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Tipo</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Fornecedor</Text>
                <Text style={[S.thCell, { width: 70 }]}>Início</Text>
                <Text style={[S.thCell, { width: 70 }]}>Vencimento</Text>
                <Text style={[S.thCell, { width: 55 }]}>Status</Text>
              </View>
              {dossie.warranties.map((w, i) => (
                <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tdCell, { flex: 2 }]}>{w.title}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{w.warranty_type}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{w.provider_name ?? '—'}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtDate(w.start_date)}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtDate(w.end_date)}</Text>
                  <View style={{ width: 55 }}>{statusBadge(w.status)}</View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reformas */}
        {dossie.renovations.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Reformas ({dossie.renovations.length})</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.thCell, { flex: 2 }]}>Reforma</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Categoria</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Responsável</Text>
                <Text style={[S.thCell, { width: 70 }]}>Início</Text>
                <Text style={[S.thCell, { width: 70 }]}>Conclusão</Text>
                <Text style={[S.thCell, { width: 70 }]}>Custo</Text>
                <Text style={[S.thCell, { width: 55 }]}>Status</Text>
              </View>
              {dossie.renovations.map((r, i) => (
                <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tdCell, { flex: 2 }]}>{r.title}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{r.category}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{r.contractor_name ?? '—'}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtDate(r.started_at)}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtDate(r.completed_at)}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtCurrency(r.cost)}</Text>
                  <View style={{ width: 55 }}>{statusBadge(r.status)}</View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ordens de serviço concluídas */}
        {dossie.service_orders.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Serviços concluídos ({dossie.service_orders.length})</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.thCell, { flex: 2 }]}>Serviço</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Sistema</Text>
                <Text style={[S.thCell, { width: 55 }]}>Prioridade</Text>
                <Text style={[S.thCell, { width: 80 }]}>Conclusão</Text>
                <Text style={[S.thCell, { width: 70 }]}>Custo</Text>
              </View>
              {dossie.service_orders.map((s, i) => (
                <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tdCell, { flex: 2 }]}>{s.title}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{s.system_type}</Text>
                  <Text style={[S.tdCell, { width: 55 }]}>{s.priority}</Text>
                  <Text style={[S.tdCell, { width: 80 }]}>{fmtDate(s.completed_at)}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtCurrency(s.cost)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Planos de manutenção */}
        {dossie.maintenance_schedules.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Planos de manutenção ({dossie.maintenance_schedules.length})</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.thCell, { flex: 2 }]}>Plano</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Sistema</Text>
                <Text style={[S.thCell, { width: 65 }]}>Frequência</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Responsável</Text>
                <Text style={[S.thCell, { width: 70 }]}>Última exec.</Text>
                <Text style={[S.thCell, { width: 70 }]}>Próxima</Text>
              </View>
              {dossie.maintenance_schedules.map((m, i) => (
                <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tdCell, { flex: 2 }]}>{m.title}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{m.system_type}</Text>
                  <Text style={[S.tdCell, { width: 65 }]}>{FREQUENCY_LABELS[m.frequency] ?? m.frequency}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{m.responsible ?? '—'}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtDate(m.last_done)}</Text>
                  <Text style={[S.tdCell, { width: 70 }]}>{fmtDate(m.next_due)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Documentos */}
        {dossie.documents.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Documentos ({dossie.documents.length})</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.thCell, { flex: 2 }]}>Documento</Text>
                <Text style={[S.thCell, { flex: 1 }]}>Tipo</Text>
                <Text style={[S.thCell, { width: 80 }]}>Emissão</Text>
                <Text style={[S.thCell, { width: 80 }]}>Vencimento</Text>
              </View>
              {dossie.documents.map((d, i) => (
                <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tdCell, { flex: 2 }]}>{d.title}</Text>
                  <Text style={[S.tdCell, { flex: 1 }]}>{d.type}</Text>
                  <Text style={[S.tdCell, { width: 80 }]}>{fmtDate(d.issue_date)}</Text>
                  <Text style={[S.tdCell, { width: 80 }]}>{fmtDate(d.expiry_date)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Linha do tempo */}
        {dossie.timeline.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Linha do tempo ({dossie.timeline.length} eventos)</Text>
            {dossie.timeline.map((event, i) => (
              <View key={i} style={S.timelineRow}>
                <View style={[S.timelineDot, { backgroundColor: TIMELINE_COLORS[event.type] ?? COLOR_PALETTE.neutral400 }]} />
                <Text style={S.timelineDate}>{fmtDate(event.date)}</Text>
                <Text style={S.timelineType}>{TIMELINE_TYPE_LABELS[event.type] ?? event.type}</Text>
                <Text style={S.timelineTitle}>{event.title}</Text>
              </View>
            ))}
          </View>
        )}

        <Footer generatedAt={generated_at} />
      </Page>
    </Document>
  );
}
