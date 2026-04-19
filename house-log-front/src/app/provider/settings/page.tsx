'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { KeyRound, Medal, Plus, Settings2, Star, Trash2 } from 'lucide-react';
import { authApi, marketplaceApi, PROVIDER_CATEGORY_OPTIONS } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { chipVariants } from '@/components/ui/visual-system';
import { toast } from 'sonner';
import { cn, formatDate } from '@/lib/utils';
import styles from './provider-settings.module.css';

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function listToText(value: string[] | undefined): string {
  return (value ?? []).join('\n');
}

type EducationEntry = {
  institution: string;
  title: string;
  type: 'college' | 'technical' | 'course' | 'certification' | 'other';
  status: 'in_progress' | 'completed';
  certificationUrl?: string;
};

type PortfolioCase = {
  title: string;
  description?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
};

export default function ProviderSettingsPage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [selected, setSelected] = useState<string[]>(() => user?.provider_categories ?? []);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? '');
  const [serviceArea, setServiceArea] = useState(user?.service_area ?? '');
  const [pixKey, setPixKey] = useState(user?.pix_key ?? '');
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>(
    (user?.pix_key_type as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | undefined) ?? 'email'
  );
  const [bio, setBio] = useState(user?.provider_bio ?? '');
  const [coursesText, setCoursesText] = useState(listToText(user?.provider_courses));
  const [specializationsText, setSpecializationsText] = useState(listToText(user?.provider_specializations));
  const [portfolioText, setPortfolioText] = useState(listToText(user?.provider_portfolio));
  const [education, setEducation] = useState<EducationEntry[]>(user?.provider_education ?? []);
  const [portfolioCases, setPortfolioCases] = useState<PortfolioCase[]>(user?.provider_portfolio_cases ?? []);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { data: profileData, mutate: mutateProfile, error: profileError } = useSWR(
    user?.id ? ['provider-public-profile', user.id] : null,
    () => marketplaceApi.providerProfile(user!.id)
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function addEducation() {
    setEducation((prev) => [
      ...prev,
      { institution: '', title: '', type: 'course', status: 'in_progress', certificationUrl: '' },
    ]);
  }

  function updateEducation(index: number, patch: Partial<EducationEntry>) {
    setEducation((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeEducation(index: number) {
    setEducation((prev) => prev.filter((_, i) => i !== index));
  }

  function addPortfolioCase() {
    setPortfolioCases((prev) => [...prev, { title: '', description: '', beforeImageUrl: '', afterImageUrl: '' }]);
  }

  function updatePortfolioCase(index: number, patch: Partial<PortfolioCase>) {
    setPortfolioCases((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removePortfolioCase(index: number) {
    setPortfolioCases((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    try {
      const validEducation = education.filter((e) => e.institution.trim() && e.title.trim());
      const validCases = portfolioCases.filter((c) => c.title.trim());

      await authApi.updateProfile({
        phone,
        whatsapp,
        service_area: serviceArea,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        provider_bio: bio,
        provider_courses: parseList(coursesText),
        provider_specializations: parseList(specializationsText),
        provider_portfolio: parseList(portfolioText),
        provider_education: validEducation,
        provider_portfolio_cases: validCases,
        provider_categories: selected,
      });
      await mutateProfile();
      toast.success('Perfil do prestador atualizado com sucesso');
    } catch (e) {
      toast.error('Erro ao salvar perfil', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      toast.error('Informe senha atual e nova senha');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Senha alterada com sucesso');
    } catch (e) {
      toast.error('Erro ao trocar senha', { description: (e as Error).message });
    } finally {
      setSavingPassword(false);
    }
  }

  const score = profileData?.score;
  const filledProfileFields =
    [
      phone,
      whatsapp,
      serviceArea,
      bio,
      coursesText,
      specializationsText,
      portfolioText,
    ].filter((value) => value.trim().length > 0).length +
    selected.length +
    education.length +
    portfolioCases.length;

  return (
    <div className={cn('mx-auto max-w-5xl space-y-5 pb-8 sm:space-y-6', styles.shell)}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Provider lens</p>
          <h1 className="mt-2 text-[24px] font-medium leading-tight text-text-primary sm:text-[28px]">Perfil do prestador</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Portfólio profissional com leitura rápida, foco operacional e evidências antes/depois.
          </p>
        </div>
        <div className={styles.heroSignal} aria-label="Campos preenchidos no perfil">
          <span>{filledProfileFields}</span>
          <small>sinais preenchidos</small>
        </div>
      </div>

      <Card variant="tonal" density="comfortable">
        <CardHeader className={styles.cardHeader}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Medal className="h-4 w-4" />
            Pontuação e avaliações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileError ? (
            <div className={styles.statePanel}>
              Não foi possível carregar a pontuação agora. As alterações do perfil continuam disponíveis.
            </div>
          ) : score ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Nota média</p>
                  <p className="flex items-center gap-1 text-lg font-medium">
                    <Star className="h-4 w-4 text-(--color-warning)" />
                    {(score.avg_stars ?? 0).toFixed(1)}
                  </p>
                </div>
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Avaliações</p>
                  <p className="text-lg font-medium">{score.total_ratings}</p>
                </div>
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Endossos</p>
                  <p className="text-lg font-medium">{score.endorsements}</p>
                </div>
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Top score</p>
                  <p className="text-lg font-medium">{score.top_score.toFixed(0)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Comentários recentes (anônimos)</p>
                {(profileData?.reviews ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem comentários ainda.</p>
                ) : (
                  (profileData?.reviews ?? []).slice(0, 5).map((review, idx) => (
                    <div key={`${review.created_at}-${idx}`} className="rounded-xl bg-(--surface-container-low) p-3">
                      <p className="text-xs text-muted-foreground">{formatDate(review.created_at)} · {review.stars}★</p>
                      <p className="text-sm mt-1">{review.comment || 'Sem comentário textual'}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className={styles.statePanel}>Carregando pontuação...</div>
          )}
        </CardContent>
      </Card>

      <Card variant="tonal" density="comfortable">
        <CardHeader className={styles.cardHeader}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Perfil profissional e serviços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="provider-phone" className={styles.fieldLabel}>Telefone</Label>
              <Input id="provider-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-whatsapp" className={styles.fieldLabel}>WhatsApp</Label>
              <Input id="provider-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-area" className={styles.fieldLabel}>Local/área de atendimento</Label>
            <Input id="provider-area" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="Ex.: São Paulo capital e ABC" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="provider-pix-key" className={styles.fieldLabel}>Chave PIX</Label>
              <Input id="provider-pix-key" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="cpf, email, telefone, etc" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-pix-type" className={styles.fieldLabel}>Tipo da chave PIX</Label>
              <Select
                value={pixKeyType}
                onValueChange={(value) => setPixKeyType(value as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random')}
              >
                <SelectTrigger id="provider-pix-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-bio" className={styles.fieldLabel}>Resumo profissional</Label>
            <Textarea id="provider-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte sua experiência e diferenciais" />
          </div>

          <div className="space-y-1.5">
            <Label className={styles.fieldLabel}>Hard skills (clique para ativar)</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PROVIDER_CATEGORY_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => toggle(item.value)}
                className={cn(chipVariants({ active: selectedSet.has(item.value) }), styles.skillChip)}
              >
                {item.label}
              </button>
            ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="provider-courses" className={styles.fieldLabel}>Cursos (um por linha)</Label>
              <Textarea
                id="provider-courses"
                rows={4}
                value={coursesText}
                onChange={(e) => setCoursesText(e.target.value)}
                placeholder="NR-10\nInstalações elétricas prediais"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-specializations" className={styles.fieldLabel}>Especializações (uma por linha)</Label>
              <Textarea
                id="provider-specializations"
                rows={4}
                value={specializationsText}
                onChange={(e) => setSpecializationsText(e.target.value)}
                placeholder="Quadros de distribuição\nReforma de banheiros"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-portfolio" className={styles.fieldLabel}>Serviços executados / portfólio (um por linha)</Label>
            <Textarea
              id="provider-portfolio"
              rows={4}
              value={portfolioText}
              onChange={(e) => setPortfolioText(e.target.value)}
              placeholder="Reforma elétrica completa - apto 120m²\nTroca de encanamento prédio residencial"
            />
          </div>

          <div className={cn('space-y-3 p-3', styles.sectionPanel)}>
            <div className={styles.sectionHeader}>
              <Label className={cn('text-sm', styles.fieldLabel)}>Formação acadêmica/técnica e certificações</Label>
              <Button type="button" size="sm" variant="outline" onClick={addEducation} className={styles.sectionAction}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
            {education.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma formação adicionada.</p>
            ) : (
              <div className="space-y-3">
                {education.map((entry, idx) => (
                  <div key={`education-${idx}`} className={cn('p-3 space-y-2', styles.entryCard)}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={entry.institution}
                        onChange={(e) => updateEducation(idx, { institution: e.target.value })}
                        placeholder="Instituição"
                      />
                      <Input
                        value={entry.title}
                        onChange={(e) => updateEducation(idx, { title: e.target.value })}
                        placeholder="Curso/Formação"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Select
                        value={entry.type}
                        onValueChange={(value) => updateEducation(idx, { type: value as EducationEntry['type'] })}
                      >
                        <SelectTrigger aria-label="Tipo de formação">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="college">Faculdade</SelectItem>
                          <SelectItem value="technical">Técnico</SelectItem>
                          <SelectItem value="course">Curso</SelectItem>
                          <SelectItem value="certification">Certificação</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={entry.status}
                        onValueChange={(value) => updateEducation(idx, { status: value as EducationEntry['status'] })}
                      >
                        <SelectTrigger aria-label="Status da formação">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_progress">Cursando</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={entry.certificationUrl ?? ''}
                        onChange={(e) => updateEducation(idx, { certificationUrl: e.target.value })}
                        placeholder="Link do comprovante/certificado"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeEducation(idx)}>
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cn('space-y-3 p-3', styles.sectionPanel)}>
            <div className={styles.sectionHeader}>
              <Label className={cn('text-sm', styles.fieldLabel)}>Portfólio visual (antes e depois)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addPortfolioCase} className={styles.sectionAction}>
                <Plus className="h-4 w-4" />
                Adicionar caso
              </Button>
            </div>
            {portfolioCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum caso de portfólio adicionado.</p>
            ) : (
              <div className="space-y-3">
                {portfolioCases.map((item, idx) => (
                  <div key={`portfolio-case-${idx}`} className={cn('p-3 space-y-2', styles.entryCard)}>
                    <Input
                      value={item.title}
                      onChange={(e) => updatePortfolioCase(idx, { title: e.target.value })}
                      placeholder="Título do serviço executado"
                    />
                    <Textarea
                      rows={2}
                      value={item.description ?? ''}
                      onChange={(e) => updatePortfolioCase(idx, { description: e.target.value })}
                      placeholder="Descrição do que foi feito"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={item.beforeImageUrl ?? ''}
                        onChange={(e) => updatePortfolioCase(idx, { beforeImageUrl: e.target.value })}
                        placeholder="URL imagem antes"
                      />
                      <Input
                        value={item.afterImageUrl ?? ''}
                        onChange={(e) => updatePortfolioCase(idx, { afterImageUrl: e.target.value })}
                        placeholder="URL imagem depois"
                      />
                    </div>
                    {(item.beforeImageUrl || item.afterImageUrl) && (
                      <div className={styles.mediaGrid}>
                        <div className={styles.mediaFrame}>
                          <span className={styles.mediaTag}>Antes</span>
                          {item.beforeImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.beforeImageUrl} alt="Antes" className={styles.mediaImage} />
                          ) : <div className={styles.mediaEmpty} />}
                        </div>
                        <div className={styles.mediaFrame}>
                          <span className={styles.mediaTag}>Depois</span>
                          {item.afterImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.afterImageUrl} alt="Depois" className={styles.mediaImage} />
                          ) : <div className={styles.mediaEmpty} />}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => removePortfolioCase(idx)}>
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.actionRow}>
            <Button type="button" onClick={() => void save()} loading={saving} className={styles.actionButton}>
              Salvar perfil
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="tonal" density="comfortable">
        <CardHeader className={styles.cardHeader}>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Trocar senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <div className={styles.actionRow}>
            <Button type="button" variant="outline" onClick={() => void changePassword()} loading={savingPassword} className={styles.actionButton}>
              Atualizar senha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
