-- Example form seed for tcc-form (OpenForm)
-- Run this in the Supabase SQL Editor AFTER supabase/schema.sql.
--
-- Themed form: movie opinion survey ("Interestelar").
-- The same id, slug and questions live in lib/example-form.ts, which is used as
-- the local fallback when this seed has not been applied yet.
--
-- The form is owned by the first user found in auth.users, so sign in at least
-- once (/login) before running this script.
-- After running it, the form is available at / and at /f/filme-interestelar

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
    'O que você achou de Interestelar (2014)?',
    'Uma pesquisa rápida de opinião sobre o filme.',
    'filme-interestelar',
    'published',
    'midnight',
    'Obrigado por avaliar o filme!',
    '[
      {
        "id": "a1000000-0000-4000-8000-000000000001",
        "type": "yes_no",
        "title": "Você gostou do filme Interestelar (2014)?",
        "description": "Responda pensando na sua impressão geral sobre o filme.",
        "required": true
      },
      {
        "id": "a1000000-0000-4000-8000-000000000002",
        "type": "opinion_scale",
        "title": "Que nota você daria para o filme?",
        "description": "1 é a pior nota e 10 é a melhor.",
        "required": true,
        "minValue": 1,
        "maxValue": 10
      },
      {
        "id": "a1000000-0000-4000-8000-000000000003",
        "type": "checkboxes",
        "title": "O que mais chamou sua atenção?",
        "description": "Selecione quantas opções quiser.",
        "required": false,
        "options": ["Roteiro e história", "Trilha sonora", "Efeitos visuais", "Atuações", "O final"]
      },
      {
        "id": "a1000000-0000-4000-8000-000000000004",
        "type": "dropdown",
        "title": "Onde você assistiu ao filme?",
        "required": false,
        "options": ["No cinema", "Em streaming", "Na TV aberta", "Em DVD/Blu-ray"]
      },
      {
        "id": "a1000000-0000-4000-8000-000000000005",
        "type": "rating",
        "title": "Quantas estrelas você daria para a trilha sonora?",
        "required": false,
        "minValue": 1,
        "maxValue": 5
      },
      {
        "id": "a1000000-0000-4000-8000-000000000006",
        "type": "yes_no",
        "title": "Você recomendaria o filme para um amigo?",
        "required": false
      },
      {
        "id": "a1000000-0000-4000-8000-000000000007",
        "type": "long_text",
        "title": "Quer comentar algo sobre o filme?",
        "required": false,
        "placeholder": "Escreva aqui o que você achou..."
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

  raise notice 'Example movie form ready at / and /f/filme-interestelar (owner: %)', coalesce(owner_email, owner_id::text);
end $$;
