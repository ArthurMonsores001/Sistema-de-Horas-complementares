# Sistema de Horas Complementares

Sistema web para gerenciamento de horas complementares de estudantes universitários da Universidade de Vassouras, desenvolvido com Next.js e Supabase.

## Objetivo

Facilitar o controle e acompanhamento das horas complementares exigidas pela grade curricular, permitindo que cada estudante registre seus certificados, acompanhe o progresso por categoria e exporte relatórios.

## O que o sistema faz

- **Cadastro de estudantes** — cada conta gerencia um ou mais perfis de matrícula com dados pessoais (nome, CPF, curso e carga horária exigida).
- **Registro de certificados** — adição de atividades com descrição, horas, data, local e anexo (PDF/imagem). O sistema analisa automaticamente o arquivo e sugere a categoria correspondente.
- **Categorias de atividades** — as horas são organizadas em 4 grupos conforme as regras da Univassouras:
  - Cidadania
  - Científico-Acadêmico
  - Capacitação, Empreendedorismo e Inovação
  - Atividades Complementares Externas
- **Dashboard** — visão geral do progresso total e por categoria, com indicação de horas efetivas e excedentes por atividade.
- **Sincronização** — dados salvos no Supabase, isolados por conta de usuário. Suporte a backup e restauração local (JSON) e exportação para Excel.

## Tecnologias

- [Next.js 14](https://nextjs.org/) — framework React com App Router
- [Supabase](https://supabase.com/) — autenticação e banco de dados (PostgreSQL)
- [PDF.js](https://mozilla.github.io/pdf.js/) — extração de texto de certificados em PDF
- [xlsx](https://github.com/SheetJS/sheetjs) — exportação para Excel
- [Tailwind CSS](https://tailwindcss.com/) — estilização
