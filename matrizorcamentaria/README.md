# Matriz Orçamentária UTFPR-CT

Estrutura inicial para evolução da página como webapp sem perder compatibilidade com o site atual.

## Estrutura

- `index.html`: layout e carregamento dos assets.
- `styles.css`: estilos da aplicação.
- `app.js`: fluxo principal (estado, eventos, renderização e persistência).
- `services/supabase.js`: configuração do Supabase e catálogo fallback de departamentos.
- `modules/formatters.js`: funções utilitárias de formatação/conversão numérica.

## Convenções para próximos arquivos

- Coloque integrações externas em `services/`.
- Coloque lógica reutilizável em `modules/`.
- Evite adicionar CSS e JS inline no HTML.
- Preserve links relativos com `../` ao referenciar arquivos da raiz do diretório `af/`.

## Compatibilidade

A URL antiga `matrizorcamentariact.html` continua funcionando por redirecionamento para `matrizorcamentaria/`.
