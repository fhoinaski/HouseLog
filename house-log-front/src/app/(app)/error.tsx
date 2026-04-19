'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-danger-light)">
        <AlertCircle className="h-7 w-7 text-(--color-danger)" />
      </div>
      <div>
        <h2 className="text-lg font-medium">Algo deu errado</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error.message || 'Erro inesperado. Tente novamente.'}</p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
