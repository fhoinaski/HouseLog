'use client';

import Link from 'next/link';
import { Building2, ChevronRight, FileText, Hammer, Package, Plus, Wallet } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { type Property } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PROPERTY_TYPE_LABELS } from '@/lib/utils';

export default function PropertiesPage() {
  const {
    data: properties,
    isLoading,
    hasMore,
    isLoadingMore,
    loadMore,
  } = usePagination<Property>('/properties');

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#dae2fd]">Seus imóveis</h1>
          <p className="mt-1 text-sm text-[#c4c5d9]">Veja todos os imóveis cadastrados e abra os módulos de cada um.</p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="h-4 w-4" />
            Novo imóvel
          </Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-zinc-700/40" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <Card className="border-zinc-500/20 bg-zinc-700/60">
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-primary-400" />
            <p className="mt-3 text-xl font-semibold text-[#dae2fd]">Nenhum imóvel cadastrado</p>
            <p className="mt-1 text-sm text-[#c4c5d9]">Crie seu primeiro imóvel para gerenciar inventário, serviços e finanças.</p>
            <Button className="mt-5" asChild>
              <Link href="/properties/new">Cadastrar imóvel</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => (
              <Card key={property.id} className="border-zinc-500/20 bg-zinc-700/60 shadow-[0_20px_40px_rgba(6,14,32,0.22)]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold text-[#dae2fd]">{property.name}</h2>
                      <p className="mt-1 text-sm text-[#c4c5d9]">{property.address}, {property.city}</p>
                    </div>
                    <Badge variant="secondary" className="bg-primary-400/10 text-primary-300">
                      {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/properties/${property.id}/inventory`} className="rounded-xl border border-zinc-500/20 bg-zinc-800/40 px-3 py-2 text-sm text-[#dae2fd] transition-colors hover:bg-zinc-800/70">
                      <span className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-amber-400" /> Inventário</span>
                    </Link>
                    <Link href={`/properties/${property.id}/services`} className="rounded-xl border border-zinc-500/20 bg-zinc-800/40 px-3 py-2 text-sm text-[#dae2fd] transition-colors hover:bg-zinc-800/70">
                      <span className="inline-flex items-center gap-2"><Hammer className="h-4 w-4 text-primary-400" /> Serviços</span>
                    </Link>
                    <Link href={`/properties/${property.id}/financial`} className="rounded-xl border border-zinc-500/20 bg-zinc-800/40 px-3 py-2 text-sm text-[#dae2fd] transition-colors hover:bg-zinc-800/70">
                      <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-400" /> Financeiro</span>
                    </Link>
                    <Link href={`/properties/${property.id}/documents`} className="rounded-xl border border-zinc-500/20 bg-zinc-800/40 px-3 py-2 text-sm text-[#dae2fd] transition-colors hover:bg-zinc-800/70">
                      <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-violet-400" /> Documentos</span>
                    </Link>
                  </div>

                  <div className="mt-4">
                    <Button variant="ghost" className="w-full" asChild>
                      <Link href={`/properties/${property.id}`}>
                        Abrir imóvel
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} loading={isLoadingMore}>
                Carregar mais imóveis
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
