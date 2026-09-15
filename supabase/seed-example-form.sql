-- Example form seed for tcc-form (OpenForm)
-- Run this in the Supabase SQL Editor AFTER supabase/schema.sql.
--
-- Themed form: Pesquisa de TCC - Práticas de engenharia de software no desenvolvimento de jogos.
-- The same id, slug and questions live in lib/example-form.ts, which is used as
-- the local fallback when this seed has not been applied yet.
--
-- The form is owned by the first user found in auth.users, so sign in at least
-- once (/login) before running this script.
-- After running it, the form is available at / and at /f/praticas-es-jogos

do $$
declare
  owner_id uuid;
  owner_email text;
  example_form_id uuid := '11111111-1111-4111-8111-111111111111';
begin
  select id, email
    into owner_id, owner_email
    from auth.users
   order by created_at
   limit 1;

  if owner_id is null then
    raise exception 'No user found in auth.users. Sign in once (Google or Magic Link) and run this script again.';
  end if;

  -- The profile is normally created by the on_auth_user_created trigger,
  -- but make sure it exists for users created before the trigger was installed.
  insert into public.profiles (id, email)
  values (owner_id, coalesce(owner_email, ''))
  on conflict (id) do nothing;

  insert into public.forms (
    id,
    user_id,
    title,
    description,
    slug,
    status,
    theme,
    thank_you_message,
    questions
  )
  values (
    example_form_id,
    owner_id,
    'Práticas de engenharia de software no desenvolvimento de jogos',
    'Pesquisa de TCC da PUC Minas  |  Tempo estimado de resposta de até 7 minutos

Esta pesquisa busca compreender o que profissionais de jogos conhecem e utilizam em engenharia de software. A participação é voluntária. O formulário não solicita nome, e-mail, empresa ou jogo. Os resultados serão apresentados em conjunto e utilizados para fins acadêmicos.

Responsável: Pedro Henrique de Almeida Costa. Contato: pedro.costa.1217022@sga.pucminas.br.',
    'praticas-es-jogos',
    'published',
    'ocean',
    'Obrigado pela participação!',
    '[
      {
        "id": "q01-consentimento",
        "type": "dropdown",
        "displayNumber": 1,
        "title": "Você leu as informações acima e concorda voluntariamente em participar?",
        "description": "Esta pesquisa busca compreender o que profissionais de jogos conhecem e utilizam em engenharia de software. A participação é voluntária e anônima. Os resultados serão apresentados em conjunto e utilizados para fins acadêmicos.",
        "required": true,
        "options": ["Sim, concordo.", "Não concordo."]
      },
      {
        "id": "q02-atuacao-software",
        "type": "dropdown",
        "displayNumber": 2,
        "title": "Você atuou diretamente no software de pelo menos um jogo?",
        "description": "Considere programação, arquitetura, testes de software, ferramentas, automação ou liderança técnica. Atuação exclusivamente artística, sonora, narrativa ou administrativa não atende a esse critério.",
        "required": true,
        "options": ["Sim.", "Não."]
      },
      {
        "id": "q03-formacao-academica",
        "type": "dropdown",
        "displayNumber": 3,
        "title": "Qual alternativa descreve melhor sua formação acadêmica?",
        "required": true,
        "options": [
          "Ensino médio incompleto ou escolaridade anterior.",
          "Ensino médio ou técnico concluído.",
          "Graduação em andamento.",
          "Graduação concluída.",
          "Pós-graduação concluída."
        ]
      },
      {
        "id": "q04-formacao-computacao",
        "type": "dropdown",
        "displayNumber": 4,
        "title": "Sua formação principal é relacionada à computação ou ao desenvolvimento de software?",
        "required": true,
        "options": [
          "Sim.",
          "Parcialmente.",
          "Não.",
          "Não curso nem concluí formação técnica ou superior."
        ]
      },
      {
        "id": "q05-estudou-es",
        "type": "dropdown",
        "displayNumber": 5,
        "title": "Você estudou engenharia de software em alguma disciplina, curso ou treinamento estruturado?",
        "description": "Inclua cursos online. Leitura ou prática por conta própria, sem curso ou treinamento, não conta nesta pergunta.",
        "required": true,
        "options": ["Sim.", "Não.", "Não tenho certeza."]
      },
      {
        "id": "q06-experiencia-jogos",
        "type": "dropdown",
        "displayNumber": 6,
        "title": "Quanto tempo de experiência você acumula no desenvolvimento de jogos?",
        "required": true,
        "options": [
          "Menos de 1 ano.",
          "1 a menos de 3 anos.",
          "3 a menos de 6 anos.",
          "6 a menos de 10 anos.",
          "10 anos ou mais."
        ]
      },
      {
        "id": "q07-experiencia-outros-softwares",
        "type": "dropdown",
        "displayNumber": 7,
        "title": "Antes de começar a trabalhar com jogos, você teve experiência profissional desenvolvendo outros tipos de software?",
        "required": true,
        "options": [
          "Não.",
          "Sim, por menos de 1 ano.",
          "Sim, por 1 a menos de 3 anos.",
          "Sim, por 3 anos ou mais."
        ]
      },
      {
        "id": "q08-tamanho-equipe",
        "type": "dropdown",
        "displayNumber": 8,
        "title": "Qual era o tamanho aproximado da equipe principal do projeto de jogo mais recente em que você atuou?",
        "required": true,
        "options": [
          "Sozinho.",
          "2 a 5 (Micro).",
          "6 a 15 (Pequeno).",
          "16 a 50 (Médio).",
          "Mais de 50 (Grande)."
        ]
      },
      {
        "id": "q09-conhecimento-topicos",
        "type": "matrix",
        "displayNumber": 9,
        "title": "Como você avalia seu conhecimento atual sobre cada tópico?",
        "description": "Marque uma opção por linha, mesmo que não tenha aplicado o tópico nesse projeto.\n1 Nenhum: não conheço o tópico. | 2 Reconheço: já ouvi falar, mas não sei explicar. | 3 Básico: compreendo noções básicas. | 4 Bom: compreendo os principais conceitos e suas relações. | 5 Avançado: consigo explicar detalhes e orientar outras pessoas.",
        "required": true,
        "matrixColumns": [
          { "id": "1", "label": "1 - Nenhum: não conheço o tópico", "shortLabel": "1 Nenhum" },
          { "id": "2", "label": "2 - Reconheço: já ouvi falar, mas não sei explicar", "shortLabel": "2 Reconheço" },
          { "id": "3", "label": "3 - Básico: compreendo noções básicas", "shortLabel": "3 Básico" },
          { "id": "4", "label": "4 - Bom: compreendo os principais conceitos e suas relações", "shortLabel": "4 Bom" },
          { "id": "5", "label": "5 - Avançado: consigo explicar detalhes e orientar outras pessoas", "shortLabel": "5 Avançado" }
        ],
        "matrixRows": [
          { "id": "processos", "label": "Processos de desenvolvimento", "description": "Organizar e acompanhar o trabalho." },
          { "id": "requisitos", "label": "Requisitos", "description": "Registrar e acompanhar o que o jogo deve fazer." },
          { "id": "modelagem", "label": "Modelagem", "description": "Representar soluções técnicas com diagramas ou modelos." },
          { "id": "padroes", "label": "Princípios e padrões de projeto", "description": "Organizar o código e usar soluções de projeto reutilizáveis." },
          { "id": "arquitetura", "label": "Arquitetura de software", "description": "Definir módulos, componentes e responsabilidades." },
          { "id": "testes", "label": "Testes de software", "description": "Verificar falhas manualmente ou por automação." },
          { "id": "refatoracao", "label": "Refatoração", "description": "Melhorar a estrutura do código sem alterar seu comportamento." },
          { "id": "devops", "label": "DevOps", "description": "Automatizar builds, integração ou entrega do jogo." },
          { "id": "versionamento", "label": "Versionamento", "description": "Controlar e integrar alterações com Git, Perforce ou equivalente." }
        ]
      },
      {
        "id": "q10-frequencia-aplicacao",
        "type": "matrix",
        "displayNumber": 10,
        "title": "Com que frequência você aplicou pessoalmente cada tópico em seus projetos de desenvolvimento de jogos?",
        "description": "1 Nunca. | 2 Raramente. | 3 Às vezes. | 4 Frequentemente. | 5 Sempre ou quase sempre. | NS Não sei avaliar.",
        "required": true,
        "matrixColumns": [
          { "id": "1", "label": "1 - Nunca", "shortLabel": "1 Nunca" },
          { "id": "2", "label": "2 - Raro", "shortLabel": "2 Raro" },
          { "id": "3", "label": "3 - Às vezes", "shortLabel": "3 Às vezes" },
          { "id": "4", "label": "4 - Freq.", "shortLabel": "4 Freq." },
          { "id": "5", "label": "5 - Sempre*", "shortLabel": "5 Sempre*" },
          { "id": "ns", "label": "NS - Não sei avaliar", "shortLabel": "NS" }
        ],
        "matrixRows": [
          { "id": "processos", "label": "Processos de desenvolvimento" },
          { "id": "requisitos", "label": "Requisitos" },
          { "id": "modelagem", "label": "Modelagem" },
          { "id": "padroes", "label": "Princípios e padrões de projeto" },
          { "id": "arquitetura", "label": "Arquitetura de software" },
          { "id": "testes", "label": "Testes de software" },
          { "id": "refatoracao", "label": "Refatoração" },
          { "id": "devops", "label": "DevOps" },
          { "id": "versionamento", "label": "Versionamento" }
        ]
      },
      {
        "id": "q13-topicos-dificeis",
        "type": "checkboxes",
        "displayNumber": 13,
        "title": "Entre os tópicos que você aplicou ou tentou aplicar nesse projeto, quais foram os mais difíceis de adotar?",
        "description": "Selecione todas as opções que se aplicam.",
        "required": false,
        "options": [
          "Processos de desenvolvimento",
          "Requisitos",
          "Modelagem",
          "Princípios e padrões de projeto",
          "Arquitetura de software",
          "Testes de software",
          "Refatoração",
          "DevOps",
          "Versionamento",
          "Não tive dificuldade nos tópicos que apliquei ou tentei aplicar.",
          "Não apliquei nem tentei aplicar esses tópicos.",
          "Não sei avaliar."
        ],
        "exclusiveOptions": [
          "Não tive dificuldade nos tópicos que apliquei ou tentei aplicar.",
          "Não apliquei nem tentei aplicar esses tópicos.",
          "Não sei avaliar."
        ]
      },
      {
        "id": "q14-principais-barreiras",
        "type": "checkboxes",
        "displayNumber": 14,
        "title": "Quais foram as principais barreiras para aplicar essas práticas nesse projeto?",
        "description": "Selecione até 3. Se escolher uma das duas últimas opções, marque somente ela.",
        "required": false,
        "maxSelect": 3,
        "options": [
          "Falta de tempo ou prazos curtos.",
          "Falta de conhecimento ou capacitação.",
          "Equipe insuficiente para o trabalho.",
          "Falta de recursos financeiros.",
          "Baixa prioridade dessas práticas na equipe.",
          "Dificuldade de adaptar as práticas às características do jogo.",
          "Limitações do motor ou das ferramentas.",
          "Outra barreira.",
          "Não encontrei barreiras.",
          "Não sei avaliar."
        ],
        "exclusiveOptions": [
          "Não encontrei barreiras.",
          "Não sei avaliar."
        ]
      },
      {
        "id": "q15-correspondencia-conteudos",
        "type": "dropdown",
        "displayNumber": 15,
        "title": "Em que medida os conteúdos de engenharia de software que você estudou correspondiam às necessidades desse projeto?",
        "required": true,
        "options": [
          "Totalmente.",
          "Em grande parte.",
          "Em pequena parte.",
          "Não correspondiam.",
          "Não estudei esses conteúdos.",
          "Não sei avaliar."
        ]
      }
    ]'::jsonb
  )
  on conflict (user_id, slug) do update
    set title             = excluded.title,
        description       = excluded.description,
        status            = excluded.status,
        theme             = excluded.theme,
        thank_you_message = excluded.thank_you_message,
        questions         = excluded.questions;

  raise notice 'TCC survey form ready at / and /f/praticas-es-jogos (owner: %)', coalesce(owner_email, owner_id::text);
end $$;
