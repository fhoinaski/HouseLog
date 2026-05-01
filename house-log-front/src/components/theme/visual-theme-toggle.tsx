'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  VISUAL_THEME_OPTIONS,
  type VisualThemePreview,
  useVisualThemePreview,
} from '@/components/theme/theme-preview-provider';

export function VisualThemeToggle() {
  const { theme, setTheme } = useVisualThemePreview();

  function handleThemeChange(value: string) {
    setTheme(value as VisualThemePreview);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Prévia visual</CardTitle>
            <CardDescription>Teste a direção CRM premium sem alterar o padrão do sistema.</CardDescription>
          </div>
          <Badge variant="warning">Experimental</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="visual-theme-preview">Tema de prévia</Label>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger id="visual-theme-preview" aria-label="Prévia visual">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISUAL_THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-text-secondary">
          A opção Atual remove o atributo data-theme customizado e mantém The Architectural Lens como padrão.
        </p>
      </CardContent>
    </Card>
  );
}
