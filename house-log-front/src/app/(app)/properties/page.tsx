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
    <div className="safe-bottom space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-text-primary">Seus imóveis</h1>
          <p className="mt-1 text-sm text-text-secondary">Veja todos os imóveis cadastrados e abra os módulos de cada um.</p>
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
            <div key={i} className="hl-skeleton h-44 rounded-xl" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-text-accent" />
            <p className="mt-3 text-md font-medium text-text-primary">Nenhum imóvel cadastrado</p>
            <p className="mt-1 text-sm text-text-secondary">Crie seu primeiro imóvel para gerenciar inventário, serviços e finanças.</p>
            <Button className="mt-5" asChild>
              <Link href="/properties/new">Cadastrar imóvel</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => (
              <Card key={property.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-md font-medium text-text-primary">{property.name}</h2>
                      <p className="mt-1 text-sm text-text-secondary">{property.address}, {property.city}</p>
                    </div>
                    <Badge variant="in_progress">
                      {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/properties/${property.id}/inventory`} className="rounded-lg border-half border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary transition-all hover:bg-bg-subtle active:scale-[0.98]">
                      <span className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-text-warning" /> Inventário</span>
                    </Link>
                    <Link href={`/properties/${property.id}/services`} className="rounded-lg border-half border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary transition-all hover:bg-bg-subtle active:scale-[0.98]">
                      <span className="inline-flex items-center gap-2"><Hammer className="h-4 w-4 text-text-accent" /> Serviços</span>
                    </Link>
                    <Link href={`/properties/${property.id}/financial`} className="rounded-lg border-half border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary transition-all hover:bg-bg-subtle active:scale-[0.98]">
                      <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-text-success" /> Financeiro</span>
                    </Link>
                    <Link href={`/properties/${property.id}/documents`} className="rounded-lg border-half border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary transition-all hover:bg-bg-subtle active:scale-[0.98]">
                      <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-text-accent" /> Documentos</span>
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
