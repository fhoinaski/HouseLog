# Direcao visual CRM premium

## Diagnostico do visual atual

O HouseLog tem uma base visual consistente no design system The Architectural Lens, com tokens semanticos, componentes reutilizaveis e boa cobertura para estados operacionais. A identidade atual comunica produto tecnico, controle e profundidade, mas ainda tende a parecer um SaaS dark/tech pesado para o novo posicionamento premium do produto.

Como memoria tecnica digital e prontuario tecnico de imoveis de alto padrao, o produto precisa transmitir confianca documental, clareza operacional e valor patrimonial. A interface deve se aproximar mais de um CRM premium claro, com leitura rapida de dados, historico, status e rastreabilidade, sem perder a capacidade tecnica para gestores, engenheiros e prestadores.

## Problemas

- Excesso de dark mode como padrao: a percepcao inicial fica mais tecnica e menos institucional, o que pode afastar cliente final premium, construtoras e incorporadoras.
- Excesso de cores e accents competindo: muitos estados coloridos simultaneos reduzem hierarquia e deixam telas operacionais mais ruidosas.
- Falta de sensacao CRM: algumas telas priorizam composicao de cards e impacto visual, mas o uso diario pede comparacao, busca, filtros, historico e listas densas.
- Cards demais em telas operacionais: cards funcionam bem para resumo, alertas e insights, mas em rotinas de servicos, documentos, orcamentos e manutencao podem reduzir escaneabilidade.
- Pouca densidade util em listagens: telas de operacao precisam mostrar mais informacao por dobra, com colunas, status discretos e acoes previsiveis.

## Nova direcao

- CRM premium claro como experiencia padrao.
- Dark mode apenas como opcao tecnica, para uso em campo, auditoria, visualizacao avancada ou preferencias pessoais.
- Paleta sobria, com base clara, texto forte, bordas discretas e accent premium controlado.
- Layout documental, aproximando o produto de prontuario, dossie tecnico, CRM patrimonial e portal de entrega.
- Foco em dados, status e rastreabilidade: quem fez, quando fez, em qual sistema, com quais documentos, custos, garantias e evidencias.

Esta direcao nao substitui The Architectural Lens. Ela deve ser tratada como uma evolucao da camada visual, usando os mesmos nomes semanticos de tokens e preservando componentes existentes.

## Publico-alvo visual

- Cliente alto padrao.
- Construtora.
- Incorporadora.
- Engenheiro.
- Arquiteto.
- Gestor patrimonial.

## Principios de interface

- Menos decoracao, mais clareza.
- Cor so para hierarquia e status.
- Branco/off-white como base.
- Accent premium discreto.
- Tabelas e listas para operacao.
- Cards para resumo, alertas, indicadores e insights.
- Tipografia contida, com hierarquia documental.
- Bordas e separadores como estrutura, nao como decoracao.
- Estados de status legiveis sem dominar a tela.
- Mobile com foco em acao contextual e leitura de campo.

## Paleta recomendada

| Papel | Cor |
| --- | --- |
| Background | `#F6F4EF` |
| Surface | `#FFFFFF` |
| Text | `#1E252B` |
| Muted | `#6B7280` |
| Border | `#E5E1DA` |
| Primary | `#233142` |
| Accent | `#B88A5A` |
| Success | `#2F7D57` |
| Warning | `#B7791F` |
| Danger | `#B42318` |
| Info | `#2F5F98` |

## Como aplicar sem quebrar

1. Revisar a proposta visual em `house-log-front/src/app/tokens.crm-premium.css` sem importa-la globalmente.
2. Testar a troca visual primeiro em ambiente local ou branch de experimentacao.
3. Migrar por superficies: dashboard, lista de imoveis, detalhe do imovel, modulos operacionais e mobile.
4. Preferir ajustes por tokens antes de alterar componentes.
5. Usar cards apenas onde existe resumo ou insight; para operacao recorrente, priorizar listas, tabelas compactas e agrupamentos documentais.
6. Manter tokens de status sobrios e reservados para estados reais de negocio.

## Checklist de migracao visual

- [ ] Testar dashboard.
- [ ] Testar lista de imoveis.
- [ ] Testar detalhe do imovel.
- [ ] Testar sistemas tecnicos.
- [ ] Testar servicos.
- [ ] Testar orcamentos.
- [ ] Testar documentos.
- [ ] Testar mobile bottom nav.
- [ ] Testar contraste AA.
- [ ] Testar dark mode se existir.

## Fora de escopo neste commit

- Nao alterar `globals.css`.
- Nao alterar `tokens.css`.
- Nao refatorar componentes.
- Nao alterar backend.
- Nao alterar contratos de API.
- Nao aplicar a nova identidade globalmente sem revisao visual.
