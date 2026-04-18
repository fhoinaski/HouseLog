'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { KeyRound, Medal, Plus, Settings2, Star, Trash2 } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { authApi, marketplaceApi, PROVIDER_CATEGORY_OPTIONS } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const skillChip = cva(
  'rounded-xl border p-2.5 text-left text-sm transition-all duration-200 skill-chip focus-visible:outline-none',
  {
    variants: {
      active: {
        true: 'bg-[var(--provider-accent)] border-[var(--provider-accent)] text-white shadow-sm',
        false: 'border-border text-foreground hover:bg-[var(--provider-surface)]',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

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

  const { data: profileData, mutate: mutateProfile } = useSWR(
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

  return (
    <div className={cn('space-y-5 max-w-4xl', styles.shell)}>
      <div className={styles.hero}>
        <h1 className="text-2xl font-bold">Configurações do Prestador</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-200">Portfólio profissional com visual unificado para serviços, formação e evidências antes/depois.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Medal className="h-4 w-4" />
            Pontuação e avaliações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {score ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Nota média</p>
                  <p className="text-lg font-semibold flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500" />
                    {(score.avg_stars ?? 0).toFixed(1)}
                  </p>
                </div>
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Avaliações</p>
                  <p className="text-lg font-semibold">{score.total_ratings}</p>
                </div>
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Endossos</p>
                  <p className="text-lg font-semibold">{score.endorsements}</p>
                </div>
                <div className={cn('p-3', styles.metricCard)}>
                  <p className="text-xs text-muted-foreground">Top score</p>
                  <p className="text-lg font-semibold">{score.top_score.toFixed(0)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Comentários recentes (anônimos)</p>
                {(profileData?.reviews ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem comentários ainda.</p>
                ) : (
                  (profileData?.reviews ?? []).slice(0, 5).map((review, idx) => (
                    <div key={`${review.created_at}-${idx}`} className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">{formatDate(review.created_at)} · {review.stars}★</p>
                      <p className="text-sm mt-1">{review.comment || 'Sem comentário textual'}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando pontuação...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
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
              <select
                id="provider-pix-type"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random')}
                className={styles.nativeSelect}
              >
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">Email</option>
                <option value="phone">Telefone</option>
                <option value="random">Aleatória</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-bio" className={styles.fieldLabel}>Resumo profissional</Label>
            <Textarea id="provider-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte sua experiência e diferenciais" />
          </div>

          <div className="space-y-1.5">
            <Label className={styles.fieldLabel}>Hard skills (clique para ativar)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PROVIDER_CATEGORY_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => toggle(item.value)}
                className={cn(skillChip({ active: selectedSet.has(item.value) }), styles.skillChip)}
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
                      <select
                        value={entry.type}
                        onChange={(e) => updateEducation(idx, { type: e.target.value as EducationEntry['type'] })}
                        className={styles.nativeSelect}
                      >
                        <option value="college">Faculdade</option>
                        <option value="technical">Técnico</option>
                        <option value="course">Curso</option>
                        <option value="certification">Certificação</option>
                        <option value="other">Outro</option>
                      </select>
                      <select
                        value={entry.status}
                        onChange={(e) => updateEducation(idx, { status: e.target.value as EducationEntry['status'] })}
                        className={styles.nativeSelect}
                      >
                        <option value="in_progress">Cursando</option>
                        <option value="completed">Concluído</option>
                      </select>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
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
