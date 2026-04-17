'use client';
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1pt solid #e2e8f0' },
  logo: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  subtitle: { fontSize: 11, color: '#64748b', marginBottom: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8, paddingBottom: 4, borderBottom: '0.5pt solid #e2e8f0', color: '#475569', textTransform: 'uppercase' },
  row: { flexDirection: 'row', marginBottom: 6 },
  label: { width: 140, color: '#64748b', fontSize: 9.5 },
  value: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  desc: { color: '#475569', lineHeight: 1.5, fontSize: 9.5 },
  checkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  checkBox: { width: 10, height: 10, border: '1pt solid #94a3b8', borderRadius: 2, marginRight: 6 },
  checkBoxDone: { width: 10, height: 10, backgroundColor: '#10b981', borderRadius: 2, marginRight: 6 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8', borderTop: '0.5pt solid #e2e8f0', paddingTop: 8 },
});

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada', approved: 'Aprovada', in_progress: 'Em Andamento',
  completed: 'Concluída', verified: 'Verificada',
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente', normal: 'Normal', preventive: 'Preventiva',
};
const SYSTEM_LABELS: Record<string, string> = {
  electrical: 'Elétrica', plumbing: 'Hidráulica', structural: 'Estrutural',
  waterproofing: 'Impermeabilização', painting: 'Pintura',
  flooring: 'Revestimento', roofing: 'Cobertura', general: 'Geral',
};

interface Props {
  order: {
    id: string; title: string; description?: string | null; status: string;
    priority: string; system_type: string; room_name?: string | null;
    requested_by_name: string; assigned_to_name?: string | null;
    cost?: number | null; warranty_until?: string | null;
    scheduled_at?: string | null; completed_at?: string | null;
    created_at: string; checklist: string;
    before_photos: string; after_photos: string;
  };
  propertyName: string;
}

function fmt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function ServiceOrderPDF({ order, propertyName }: Props) {
  const checklist = (() => { try { return JSON.parse(order.checklist || '[]') as { item: string; done: boolean }[]; } catch { return []; } })();
  const beforePhotos = (() => { try { return JSON.parse(order.before_photos || '[]') as string[]; } catch { return []; } })();
  const afterPhotos = (() => { try { return JSON.parse(order.after_photos || '[]') as string[]; } catch { return []; } })();

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
        <Text style={styles.title}>{order.title}</Text>
        <Text style={styles.subtitle}>{propertyName}</Text>

        {/* Badges row */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
          <Text style={[styles.badge, { backgroundColor: '#f1f5f9', color: '#475569' }]}>
            {STATUS_LABELS[order.status] ?? order.status}
          </Text>
          <Text style={[styles.badge, { backgroundColor: '#fef2f2', color: '#dc2626' }]}>
            {PRIORITY_LABELS[order.priority] ?? order.priority}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalhes</Text>
          {[
            ['Sistema', SYSTEM_LABELS[order.system_type] ?? order.system_type],
            ['Cômodo', order.room_name ?? '—'],
            ['Solicitado por', order.requested_by_name],
            ['Atribuído a', order.assigned_to_name ?? '—'],
            ['Criada em', fmt(order.created_at)],
            ['Agendado para', fmt(order.scheduled_at)],
            ['Concluída em', fmt(order.completed_at)],
            ['Custo', order.cost ? `R$ ${order.cost.toFixed(2)}` : '—'],
            ['Garantia até', fmt(order.warranty_until)],
          ].map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        {order.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descrição</Text>
            <Text style={styles.desc}>{order.description}</Text>
          </View>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Checklist</Text>
            {checklist.map((c, i) => (
              <View key={i} style={styles.checkItem}>
                <View style={c.done ? styles.checkBoxDone : styles.checkBox} />
                <Text style={{ fontSize: 9.5, color: c.done ? '#94a3b8' : '#0f172a', textDecoration: c.done ? 'line-through' : 'none' }}>
                  {c.item}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Photo counts */}
        {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotos</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Antes</Text>
              <Text style={styles.value}>{beforePhotos.length} foto{beforePhotos.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Depois</Text>
              <Text style={styles.value}>{afterPhotos.length} foto{afterPhotos.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>HouseLog — Gestão de Ativos Imobiliários</Text>
          <Text>OS #{order.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </Page>
    </Document>
  );
}
