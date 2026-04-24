'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { KeyRound, Medal, Plus, Settings2, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { chipVariants } from '@/components/ui/visual-system';
import { authApi, providerNetworkApi, PROVIDER_CATEGORY_OPTIONS } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
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

const labelClass = 'text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary';

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
    () => providerNetworkApi.providerProfile(user!.id)
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const score = profileData?.score;
  const filledProfileFields =
    [phone, whatsapp, serviceArea, bio, coursesText, specializationsText, portfolioText].filter(
      (value) => value.trim().length > 0
    ).length +
    selected.length +
    education.length +
    portfolioCases.length;

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  }

  function addEducation() {
    setEducation((prev) => [
      ...prev,
      { institution: '', title: '', type: 'course', status: 'in_progress', certificationUrl: '' },
    ]);
  }

  function updateEducation(index: number, patch: Partial<EducationEntry>) {
    setEducation((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeEducation(index: number) {
    setEducation((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function addPortfolioCase() {
    setPortfolioCases((prev) => [...prev, { title: '', description: '', beforeImageUrl: '', afterImageUrl: '' }]);
  }

  function updatePortfolioCase(index: number, patch: Partial<PortfolioCase>) {
    setPortfolioCases((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removePortfolioCase(index: number) {
    setPortfolioCases((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function save() {
    setSaving(true);
    try {
      const validEducation = education.filter((item) => item.institution.trim() && item.title.trim());
      const validCases = portfolioCases.filter((item) => item.title.trim());

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

  return (
    <div className="safe-bottom mx-auto max-w-5xl space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="editorial"
        eyebrow="Rede homologada"
        title="Perfil profissional"
        description="Dados de elegibilidade, sinais tecnicos e evidencias que sustentam sua atuacao na operacao privada HouseLog."
        actions={
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface-strong)] px-4 py-3 text-left">
            <p className="text-xl font-medium leading-none text-text-primary">{filledProfileFields}</p>
            <p className="mt-1 text-xs text-text-tertiary">sinais preenchidos</p>
          </div>
        }
      />

      <PageSection
        title="Pontuacao e confianca"
        description="Indicadores publicos usados para leitura de reputacao dentro da rede homologada."
        tone="strong"
        density="editorial"
        actions={<Badge variant="outline">Provider network</Badge>}
      >
        {profileError ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Pontuacao indisponivel"
            description="Nao foi possivel carregar a pontuacao agora. As alteracoes do perfil continuam disponiveis."
            tone="subtle"
            density="compact"
          />
        ) : score ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={Star}
                label="Nota media"
                value={(score.avg_stars ?? 0).toFixed(1)}
                tone="warning"
              />
              <MetricCard label="Avaliacoes" value={score.total_ratings} tone="default" />
              <MetricCard label="Endossos" value={score.endorsements} tone="success" />
              <MetricCard label="Top score" value={score.top_score.toFixed(0)} tone="accent" />
            </div>

            <div className="space-y-2">
              <p className={labelClass}>Comentarios recentes anonimos</p>
              {(profileData?.reviews ?? []).length === 0 ? (
                <EmptyState
                  icon={<Medal className="h-5 w-5" />}
                  title="Sem comentarios ainda"
                  description="Quando avaliacoes forem registradas, os comentarios recentes aparecerao aqui."
                  tone="subtle"
                  density="compact"
                />
              ) : (
                (profileData?.reviews ?? []).slice(0, 5).map((review, index) => (
                  <article key={`${review.created_at}-${index}`} className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4">
                    <p className="text-xs text-text-tertiary">
                      {formatDate(review.created_at)} - {review.stars} estrelas
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      {review.comment || 'Sem comentario textual'}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
        )}
      </PageSection>

      <PageSection
        title="Perfil profissional e servicos"
        description="Mantenha dados, especialidades e evidencias atualizados para qualificar sua elegibilidade operacional."
        tone="surface"
        density="editorial"
        actions={<Settings2 className="h-4 w-4 text-text-tertiary" />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider-phone" className={labelClass}>Telefone</Label>
            <Input id="provider-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider-whatsapp" className={labelClass}>WhatsApp</Label>
            <Input id="provider-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider-area" className={labelClass}>Area de atendimento</Label>
          <Input id="provider-area" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="Ex.: Sao Paulo capital e ABC" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider-pix-key" className={labelClass}>Chave PIX</Label>
            <Input id="provider-pix-key" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="cpf, email, telefone, etc" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider-pix-type" className={labelClass}>Tipo da chave PIX</Label>
            <Select value={pixKeyType} onValueChange={(value) => setPixKeyType(value as typeof pixKeyType)}>
              <SelectTrigger id="provider-pix-type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Aleatoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider-bio" className={labelClass}>Resumo profissional</Label>
          <Textarea id="provider-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte sua experiencia e diferenciais" />
        </div>

        <div className="space-y-2">
          <Label className={labelClass}>Hard skills</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDER_CATEGORY_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => toggle(item.value)}
                className={cn(chipVariants({ active: selectedSet.has(item.value) }), 'focus-visible:outline-none')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider-courses" className={labelClass}>Cursos</Label>
            <Textarea
              id="provider-courses"
              rows={4}
              value={coursesText}
              onChange={(e) => setCoursesText(e.target.value)}
              placeholder={'NR-10\nInstalacoes eletricas prediais'}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider-specializations" className={labelClass}>Especializacoes</Label>
            <Textarea
              id="provider-specializations"
              rows={4}
              value={specializationsText}
              onChange={(e) => setSpecializationsText(e.target.value)}
              placeholder={'Quadros de distribuicao\nReforma de banheiros'}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider-portfolio" className={labelClass}>Servicos executados / portfolio</Label>
          <Textarea
            id="provider-portfolio"
            rows={4}
            value={portfolioText}
            onChange={(e) => setPortfolioText(e.target.value)}
            placeholder={'Reforma eletrica completa - apto 120m2\nTroca de encanamento predio residencial'}
          />
        </div>

        <div className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Label className={labelClass}>Formacao e certificacoes</Label>
              <p className="mt-1 text-sm leading-6 text-text-secondary">Registre evidencias formais de qualificacao tecnica.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addEducation} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>

          {education.length === 0 ? (
            <EmptyState
              icon={<Medal className="h-5 w-5" />}
              title="Nenhuma formacao adicionada"
              description="Adicione cursos, certificacoes ou formacao tecnica relevantes."
              tone="subtle"
              density="compact"
            />
          ) : (
            <div className="space-y-3">
              {education.map((entry, index) => (
                <div key={`education-${index}`} className="space-y-2 rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={entry.institution}
                      onChange={(e) => updateEducation(index, { institution: e.target.value })}
                      placeholder="Instituicao"
                    />
                    <Input
                      value={entry.title}
                      onChange={(e) => updateEducation(index, { title: e.target.value })}
                      placeholder="Curso/Formacao"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Select value={entry.type} onValueChange={(value) => updateEducation(index, { type: value as EducationEntry['type'] })}>
                      <SelectTrigger aria-label="Tipo de formacao">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="college">Faculdade</SelectItem>
                        <SelectItem value="technical">Tecnico</SelectItem>
                        <SelectItem value="course">Curso</SelectItem>
                        <SelectItem value="certification">Certificacao</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={entry.status} onValueChange={(value) => updateEducation(index, { status: value as EducationEntry['status'] })}>
                      <SelectTrigger aria-label="Status da formacao">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_progress">Cursando</SelectItem>
                        <SelectItem value="completed">Concluido</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={entry.certificationUrl ?? ''}
                      onChange={(e) => updateEducation(index, { certificationUrl: e.target.value })}
                      placeholder="Link do comprovante"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeEducation(index)}>
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Label className={labelClass}>Portfolio visual</Label>
              <p className="mt-1 text-sm leading-6 text-text-secondary">Casos antes/depois ajudam a qualificar confianca e aderencia tecnica.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addPortfolioCase} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Adicionar caso
            </Button>
          </div>

          {portfolioCases.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Nenhum caso de portfolio"
              description="Adicione exemplos reais para reforcar a leitura tecnica do seu perfil."
              tone="subtle"
              density="compact"
            />
          ) : (
            <div className="space-y-3">
              {portfolioCases.map((item, index) => (
                <div key={`portfolio-case-${index}`} className="space-y-2 rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3">
                  <Input
                    value={item.title}
                    onChange={(e) => updatePortfolioCase(index, { title: e.target.value })}
                    placeholder="Titulo do servico executado"
                  />
                  <Textarea
                    rows={2}
                    value={item.description ?? ''}
                    onChange={(e) => updatePortfolioCase(index, { description: e.target.value })}
                    placeholder="Descricao do que foi feito"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={item.beforeImageUrl ?? ''}
                      onChange={(e) => updatePortfolioCase(index, { beforeImageUrl: e.target.value })}
                      placeholder="URL imagem antes"
                    />
                    <Input
                      value={item.afterImageUrl ?? ''}
                      onChange={(e) => updatePortfolioCase(index, { afterImageUrl: e.target.value })}
                      placeholder="URL imagem depois"
                    />
                  </div>
                  {(item.beforeImageUrl || item.afterImageUrl) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { label: 'Antes', url: item.beforeImageUrl },
                        { label: 'Depois', url: item.afterImageUrl },
                      ].map((media) => (
                        <div key={media.label} className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-strong)]">
                          <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                            {media.label}
                          </p>
                          {media.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={media.url} alt={media.label} className="h-32 w-full object-cover" />
                          ) : (
                            <div className="h-32 bg-[var(--surface-base)]" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removePortfolioCase(index)}>
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void save()} loading={saving} className="w-full sm:w-auto">
            Salvar perfil
          </Button>
        </div>
      </PageSection>

      <PageSection
        title="Seguranca da conta"
        description="Atualize sua senha mantendo o acesso alinhado a uma operacao privada e controlada."
        tone="strong"
        density="editorial"
        actions={<KeyRound className="h-4 w-4 text-text-tertiary" />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className={labelClass}>Senha atual</Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className={labelClass}>Nova senha</Label>
            <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => void changePassword()} loading={savingPassword} className="w-full sm:w-auto">
            Atualizar senha
          </Button>
        </div>
      </PageSection>
    </div>
  );
}
