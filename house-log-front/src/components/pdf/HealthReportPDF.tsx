'use client';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1pt solid #e2e8f0' },
  logo: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#64748b', marginBottom: 24 },
  scoreBox: { alignItems: 'center', marginBottom: 24, padding: 20, backgroundColor: '#f8fafc', borderRadius: 8 },
  scoreNum: { fontSize: 48, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  scoreLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 10, paddingBottom: 4, borderBottom: '0.5pt solid #e2e8f0', color: '#475569', textTransform: 'uppercase' },
  factorRow: { marginBottom: 10 },
  factorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  factorName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  factorScore: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  barBg: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  factorDesc: { fontSize: 8.5, color: '#94a3b8', marginTop: 2 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statBox: { width: '30%', padding: 10, backgroundColor: '#f8fafc', borderRadius: 6 },
  statLabel: { fontSize: 8.5, color: '#64748b', marginBottom: 3 },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8', borderTop: '0.5pt solid #e2e8f0', paddingTop: 8 },
});

const FACTOR_LABELS: Record<string, { label: string; max: number; description: string }> = {
  maintenance_compliance: { label: 'Compliance de Manutenção', max: 30, description: 'Manutenções preventivas realizadas no prazo' },
  service_backlog: { label: 'Backlog de Serviços', max: 20, description: 'Penalidade por OS urgentes em aberto' },
  preventive_ratio: { label: 'Índice Preventivo', max: 20, description: 'Proporção de OS preventivas vs corretivas' },
  age_penalty: { label: 'Penalidade de Idade', max: 15, description: 'Depreciação baseada no ano de construção' },
  document_completeness: { label: 'Completude Documental', max: 15, description: 'Cobertura de documentos obrigatórios' },
};

function scoreColor(score: number) {
  if (score >= 80) return '#3b82f6';
  if (score >= 60) return '#10b981';
  if (score >= 30) return '#f59e0b';
  return '#f43f5e';
}

interface Props {
  score: number;
  breakdown: Record<string, number>;
  valuation: {
    property: { name: string; address: string; city: string; area_m2?: number | null; year_built?: number | null; type: string };
    expenses_total: number;
    services_total: number;
    inventory_items: number;
    generated_at: string;
  };
}

export function HealthReportPDF({ score, breakdown, valuation }: Props) {
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 30 ? 'Atenção' : 'Crítico';
  const color = scoreColor(score);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>HouseLog</Text>
          <Text style={{ fontSize: 8, color: '#94a3b8' }}>
            Gerado em {new Date().toLocaleDateString('pt-BR')}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Relatório de Saúde do Imóvel</Text>
        <Text style={styles.subtitle}>{valuation.property.name} — {valuation.property.address}, {valuation.property.city}</Text>

        {/* Score */}
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreNum, { color }]}>{score}</Text>
          <Text style={[styles.scoreLabel, { color }]}>{label}</Text>
          <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>Score de Saúde (0–100)</Text>
        </View>

        {/* Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fatores de Avaliação</Text>
          {Object.entries(breakdown).map(([key, value]) => {
            const meta = FACTOR_LABELS[key];
            if (!meta) return null;
            const pct = (value / meta.max) * 100;
            return (
              <View key={key} style={styles.factorRow}>
                <View style={styles.factorHeader}>
                  <Text style={styles.factorName}>{meta.label}</Text>
                  <Text style={[styles.factorScore, { color: scoreColor(pct) }]}>{value}/{meta.max}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: scoreColor(pct) }]} />
                </View>
                <Text style={styles.factorDesc}>{meta.description}</Text>
              </View>
            );
          })}
        </View>

        {/* Property details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do Imóvel</Text>
          <View style={styles.statGrid}>
            {[
              { label: 'Tipo', value: valuation.property.type },
              { label: 'Área', value: valuation.property.area_m2 ? `${valuation.property.area_m2} m²` : '—' },
              { label: 'Ano', value: String(valuation.property.year_built ?? '—') },
              { label: 'Total Despesas', value: `R$ ${valuation.expenses_total.toFixed(2)}` },
              { label: 'Total Serviços', value: `R$ ${valuation.services_total.toFixed(2)}` },
              { label: 'Itens Inventário', value: String(valuation.inventory_items) },
            ].map(({ label, value }) => (
              <View key={label} style={styles.statBox}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>HouseLog — Relatório de Saúde</Text>
          <Text>Gerado em {new Date().toLocaleDateString('pt-BR')}</Text>
        </View>
      </Page>
    </Document>
  );
}
