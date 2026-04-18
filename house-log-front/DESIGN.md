# Guia de Execucao Visual: HouseLog - Echelon Slate

Este documento detalha os padroes de UI/UX para a implementacao consistente do HouseLog.

## 1. Paleta de Cores (Tokens Semanticos)

### Modo Escuro (Dark Mode)
- **Background Principal:** `#0b1326` (Profundo, arquitetonico)
- **Surface (Cards/Containers):** `#131b2e` (Contraste suave)
- **Primary Accent:** `#2E5BFF` (Azul eletrico vibrante)
- **Secondary Accent:** `#4edea3` (Verde esmeralda para sucessos/health score)
- **Muted/Bordas:** `#31394d` (Definicao discreta)
- **Texto Primario:** `#FFFFFF` (Puro)
- **Texto Secundario:** `#b8c3ff` (Azul acinzentado para hierarquia)

### Modo Claro (Light Mode)
- **Background Principal:** `#F8FAFC`
- **Surface:** `#FFFFFF`
- **Bordas:** `#E2E8F0`
- **Texto Primario:** `#0F172A`

## 2. Tipografia
- **Familia:** Inter (Sans-serif geometrica)
- **Pesos:** Light (300), Regular (400), Medium (500), SemiBold (600), Black (900)
- **H1 (Display):** 32px / Leading 1.1 / Black / Tracking -0.05em
- **H2 (Title):** 24px / Leading 1.2 / Bold
- **Body:** 16px / Leading 1.5 / Regular
- **Label/Caption:** 12px / Uppercase / Tracking 0.1em / Bold

## 3. Botoes (Buttons)
- **Radius:** 12px (Round Eight)
- **Primario:** Background `#2E5BFF`, Texto Branco, Shadow sutil.
- **Secundario (Ghost):** Borda `#31394d`, Background transparente, Hover com leve brilho.
- **Estados:**
  - *Default:* Escala 1.0
  - *Hover/Focus:* Escala 1.02, Brilho +10%
  - *Active:* Escala 0.95 (Feedback tatil)

## 4. Inputs & Formularios
- **Background:** `#1a233b` (Dark) / `#F1F5F9` (Light)
- **Borda:** 1.5px solida `#31394d`
- **Altura:** 52px (Mobile-optimized touch target)
- **Focus State:** Borda `#2E5BFF`, Glow suave (ring) de 3px.
- **Placeholder:** `#4b5563`

## 5. Cards & Sombras (Shadows)
- **Elevated Card:**
  - Background: Glassmorphism (bg-opacity 60% + Backdrop Blur 20px)
  - Borda: 1px solida `rgba(255,255,255,0.05)` (Inner glow)
  - Shadow: `0 20px 40px -15px rgba(6,14,32,0.4)`
- **Interactive Card:** Escala para 1.02 ao tocar/passar o mouse.

## 6. Navegacao (Menus)
- **Bottom Bar:** Floating Island (flutuante), 24px de margem das bordas, blur intenso, icones ativos com background tonal (ex: `#2E5BFF1A`).
- **Top Bar:** Sticky, blur de 40px, separacao por gradiente tonal em vez de linha rigida.

## 7. Regra de Precedencia
- Este guia substitui qualquer guideline visual anterior.
- Em caso de conflito, prevalece **Echelon Slate**.
- Todas as interfaces devem manter texto em portugues (pt-BR).
