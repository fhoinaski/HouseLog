export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(apiKey: string, opts: EmailOptions): Promise<void> {
  if (!apiKey) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'HouseLog <noreply@houselog.app>', to: [opts.to], subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${await res.text()}`);
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada', approved: 'Aprovada', in_progress: 'Em Andamento',
  completed: 'Concluída', verified: 'Verificada',
};
const STATUS_COLORS: Record<string, string> = {
  requested: '#64748b', approved: '#3b82f6', in_progress: '#f59e0b',
  completed: '#10b981', verified: '#8b5cf6',
};

function base(title: string, content: string, appUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#1e293b;padding:24px 32px">
      <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.5px">HouseLog</span>
    </div>
    <div style="padding:32px">${content}</div>
    <div style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center">
      <p style="color:#94a3b8;font-size:12px;margin:0">
        <a href="${appUrl}" style="color:#3b82f6;text-decoration:none">HouseLog</a> — Gestão inteligente de imóveis
      </p>
    </div>
  </div>
</body></html>`;
}

export function emailOsStatusChanged(p: {
  recipientName: string; orderTitle: string; oldStatus: string; newStatus: string;
  propertyName: string; appUrl: string; serviceUrl: string;
}): string {
  const color = STATUS_COLORS[p.newStatus] ?? '#3b82f6';
  const label = STATUS_LABELS[p.newStatus] ?? p.newStatus;
  const oldLabel = STATUS_LABELS[p.oldStatus] ?? p.oldStatus;
  return base('Status da OS atualizado', `
    <p style="color:#475569;margin:0 0 4px;font-size:14px">Olá, ${p.recipientName}</p>
    <h1 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 24px">Status da OS atualizado</h1>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:600">ORDEM DE SERVIÇO</p>
      <p style="margin:0;color:#0f172a;font-size:16px;font-weight:600">${p.orderTitle}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px">${p.propertyName}</p>
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
      <div style="text-align:center">
        <p style="margin:0 0 4px;font-size:11px;color:#94a3b8">De</p>
        <span style="background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:500">${oldLabel}</span>
      </div>
      <span style="color:#94a3b8;font-size:20px">→</span>
      <div style="text-align:center">
        <p style="margin:0 0 4px;font-size:11px;color:#94a3b8">Para</p>
        <span style="background:${color}20;color:${color};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600">${label}</span>
      </div>
    </div>
    <a href="${p.serviceUrl}" style="display:block;background:#3b82f6;color:#fff;text-align:center;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver Ordem de Serviço</a>
  `, p.appUrl);
}

export function emailMaintenanceDue(p: {
  recipientName: string;
  schedules: { title: string; days_until_due: number }[];
  propertyName: string;
  appUrl: string;
  maintenanceUrl: string;
}): string {
  const rows = p.schedules.map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px">${s.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">
        <span style="background:${s.days_until_due <= 0 ? '#fef2f2' : '#fef9c3'};color:${s.days_until_due <= 0 ? '#dc2626' : '#ca8a04'};padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600">
          ${s.days_until_due <= 0 ? 'Vencida' : `Em ${s.days_until_due} dia${s.days_until_due !== 1 ? 's' : ''}`}
        </span>
      </td>
    </tr>`).join('');
  return base('Manutenções pendentes', `
    <p style="color:#475569;margin:0 0 4px;font-size:14px">Olá, ${p.recipientName}</p>
    <h1 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 8px">Manutenções pendentes</h1>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">${p.propertyName} tem ${p.schedules.length} manutenção${p.schedules.length !== 1 ? 'ões' : ''} que precisam de atenção.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Manutenção</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b">Prazo</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <a href="${p.maintenanceUrl}" style="display:block;background:#3b82f6;color:#fff;text-align:center;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver Manutenções</a>
  `, p.appUrl);
}

export function emailNewBid(p: {
  ownerName: string; providerName: string; orderTitle: string; amount: number;
  notes: string; propertyName: string; serviceUrl: string; appUrl: string;
}): string {
  return base('Novo orçamento recebido', `
    <p style="color:#475569;margin:0 0 4px;font-size:14px">Olá, ${p.ownerName}</p>
    <h1 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 24px">Novo orçamento recebido</h1>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 4px;color:#166534;font-size:24px;font-weight:700">R$ ${p.amount.toFixed(2)}</p>
      <p style="margin:0;color:#15803d;font-size:13px">por ${p.providerName}</p>
    </div>
    <dl style="margin:0 0 24px;padding:0">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
        <dt style="color:#64748b;font-size:13px">Serviço</dt><dd style="margin:0;color:#0f172a;font-size:13px;font-weight:500">${p.orderTitle}</dd>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
        <dt style="color:#64748b;font-size:13px">Imóvel</dt><dd style="margin:0;color:#0f172a;font-size:13px;font-weight:500">${p.propertyName}</dd>
      </div>
      ${p.notes ? `<div style="padding:8px 0"><dt style="color:#64748b;font-size:13px;margin-bottom:4px">Notas</dt><dd style="margin:0;color:#475569;font-size:13px">${p.notes}</dd></div>` : ''}
    </dl>
    <a href="${p.serviceUrl}" style="display:block;background:#3b82f6;color:#fff;text-align:center;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver Orçamento</a>
  `, p.appUrl);
}
