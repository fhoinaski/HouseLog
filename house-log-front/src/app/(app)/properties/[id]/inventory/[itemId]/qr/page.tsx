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
            <div className="hl-skeleton h-9 w-9 rounded-lg" />
            <div className="hl-skeleton h-6 w-24 rounded" />
          </div>
          <div className="hl-skeleton h-9 w-24 rounded-lg" />
        </div>
        {/* Card skeleton */}
        <div className="flex flex-col items-center gap-6 rounded-2xl border-half border-border-subtle p-8">
          <div className="hl-skeleton h-48 w-48 rounded-xl" />
          <div className="space-y-2 w-full flex flex-col items-center">
            <div className="hl-skeleton h-5 w-40 rounded" />
            <div className="hl-skeleton h-4 w-24 rounded" />
          </div>
          <div className="hl-skeleton h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const filename = `qr-${item.name.toLowerCase().replace(/\s+/g, '-')}-${itemId.slice(0, 8)}.png`;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/properties/${id}/inventory`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-medium">QR code</h1>
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
          <div className="flex h-56 w-56 items-center justify-center rounded-xl border-half border-border-subtle bg-bg-surface p-3">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR Code — ${item.name}`} className="h-full w-full" />
            ) : (
              <div className="hl-skeleton h-full w-full rounded-lg" />
            )}
          </div>

          {/* Item info */}
          <div className="text-center space-y-1 w-full">
            <p className="text-lg font-medium">{item.name}</p>
            {item.brand && (
              <p className="text-sm text-text-secondary">
                {item.brand}{item.model ? ` · ${item.model}` : ''}
              </p>
            )}
            <p className="text-xs text-text-tertiary">
              {INVENTORY_CATEGORY_LABELS[item.category] ?? item.category}
              {item.room_name ? ` · ${item.room_name}` : ''}
            </p>
          </div>

          {/* Detail rows */}
          <div className="w-full divide-y divide-border-subtle rounded-xl bg-bg-subtle text-sm">
            {item.color_code && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-text-secondary">Cor</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-5 w-5 rounded-full border-half border-border-subtle"
                    style={{ background: item.color_code }}
                  />
                  <span className="font-mono text-xs">{item.color_code}</span>
                </div>
              </div>
            )}
            {item.lot_number && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-text-secondary">Lote</span>
                <span className="font-mono text-xs">{item.lot_number}</span>
              </div>
            )}
            {item.supplier && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-text-secondary">Fornecedor</span>
                <span className="text-xs">{item.supplier}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-text-secondary">Quantidade</span>
              <span className="font-medium">{item.quantity} {item.unit}</span>
            </div>
            {item.storage_loc && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-text-secondary">Localização</span>
                <span className="text-xs">{item.storage_loc}</span>
              </div>
            )}
          </div>

          <p className="font-mono text-xs text-text-disabled">{item.id}</p>
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
