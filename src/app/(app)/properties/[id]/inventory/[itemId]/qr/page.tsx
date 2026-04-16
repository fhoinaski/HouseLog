'use client';

import { use, useRef } from 'react';
import useSWR from 'swr';
import { ArrowLeft, Printer, Package } from 'lucide-react';
import Link from 'next/link';
import { inventoryApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { INVENTORY_CATEGORY_LABELS } from '@/lib/utils';

export default function QrCodePage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = use(params);
  const printRef = useRef<HTMLDivElement>(null);

  const { data } = useSWR(['inventory-item', id, itemId], () => inventoryApi.get(id, itemId));
  const item = data?.item;

  function handlePrint() {
    window.print();
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  // The qr_code field on the item is base64 SVG/PNG stored by the backend
  // Fallback: generate a data-URL from the qr_content if qr_code is absent
  const qrDataUrl = (item as typeof item & { qr_code?: string }).qr_code
    ? `data:image/png;base64,${(item as typeof item & { qr_code?: string }).qr_code}`
    : null;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Toolbar – hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/properties/${id}/inventory`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">QR Code</h1>
        </div>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Print card */}
      <div ref={printRef}>
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8 flex flex-col items-center gap-6">
            {/* QR image */}
            <div className="flex items-center justify-center h-48 w-48 rounded-xl border border-slate-200 bg-white p-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code" className="h-full w-full" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Package className="h-12 w-12" />
                  <p className="text-xs text-center">QR não gerado.<br />Use o botão na lista.</p>
                </div>
              )}
            </div>

            {/* Item info */}
            <div className="text-center space-y-1 w-full">
              <p className="text-lg font-bold">{item.name}</p>
              {item.brand && <p className="text-sm text-slate-500">{item.brand}{item.model ? ` · ${item.model}` : ''}</p>}
              <p className="text-xs text-slate-400">
                {INVENTORY_CATEGORY_LABELS[item.category] ?? item.category}
                {item.room_name ? ` · ${item.room_name}` : ''}
              </p>
            </div>

            {/* Detail rows */}
            <div className="w-full rounded-xl bg-slate-50 divide-y divide-slate-100 text-sm">
              {item.color_code && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-500">Cor</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded-full border border-slate-200"
                      style={{ background: item.color_code }}
                    />
                    <span className="font-mono text-xs">{item.color_code}</span>
                  </div>
                </div>
              )}
              {item.lot_number && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-500">Lote</span>
                  <span className="font-mono text-xs">{item.lot_number}</span>
                </div>
              )}
              {item.supplier && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-500">Fornecedor</span>
                  <span className="text-xs">{item.supplier}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500">Quantidade</span>
                <span className="font-semibold">{item.quantity} {item.unit}</span>
              </div>
              {item.storage_loc && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-500">Localização</span>
                  <span className="text-xs">{item.storage_loc}</span>
                </div>
              )}
            </div>

            {/* Item ID for scanning reference */}
            <p className="text-xs text-slate-300 font-mono">{item.id}</p>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-print-area], [data-print-area] * { visibility: visible; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}
