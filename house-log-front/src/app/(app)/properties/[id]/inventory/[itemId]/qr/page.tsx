'use client';

import { use, useEffect, useState } from 'react';
import useSWR from 'swr';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import Link from 'next/link';
import { inventoryApi } from '@/lib/api';
import { generateQRCodeDataURL } from '@/lib/qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { INVENTORY_CATEGORY_LABELS } from '@/lib/utils';

export default function QrCodePage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = use(params);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data, isLoading } = useSWR(
    ['inventory-item', id, itemId],
    () => inventoryApi.get(id, itemId)
  );
  const item = data?.item;

  useEffect(() => {
    if (!itemId) return;
    generateQRCodeDataURL(`houselog://inventory/${itemId}`).then(setQrDataUrl);
  }, [itemId]);

  if (isLoading || !item) {
    return (
      <div className="max-w-lg mx-auto space-y-6 px-4 py-6">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-200 animate-pulse" />
            <div className="h-6 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="h-9 w-24 rounded-lg bg-slate-200 animate-pulse" />
        </div>
        {/* Card skeleton */}
        <div className="rounded-2xl border border-slate-200 p-8 flex flex-col items-center gap-6">
          <div className="h-48 w-48 rounded-xl bg-slate-200 animate-pulse" />
          <div className="space-y-2 w-full flex flex-col items-center">
            <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="w-full rounded-xl bg-slate-100 h-24 animate-pulse" />
        </div>
      </div>
    );
  }

  const filename = `qr-${item.name.toLowerCase().replace(/\s+/g, '-')}-${itemId.slice(0, 8)}.png`;

  return (
    <div className="max-w-lg mx-auto space-y-6 px-4 py-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/properties/${id}/inventory`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">QR Code</h1>
        </div>
        <div className="flex items-center gap-2">
          {qrDataUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={qrDataUrl} download={filename}>
                <Download className="h-4 w-4" />
                Baixar QR
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Print card */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 flex flex-col items-center gap-6">
          {/* QR image */}
          <div className="flex items-center justify-center h-56 w-56 rounded-xl border border-slate-200 bg-white p-3">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR Code — ${item.name}`} className="h-full w-full" />
            ) : (
              <div className="h-full w-full rounded-lg bg-slate-100 animate-pulse" />
            )}
          </div>

          {/* Item info */}
          <div className="text-center space-y-1 w-full">
            <p className="text-lg font-bold">{item.name}</p>
            {item.brand && (
              <p className="text-sm text-slate-500">
                {item.brand}{item.model ? ` · ${item.model}` : ''}
              </p>
            )}
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

          <p className="text-xs text-slate-300 font-mono">{item.id}</p>
        </CardContent>
      </Card>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:shadow-none, .print\\:shadow-none * { visibility: visible; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}
