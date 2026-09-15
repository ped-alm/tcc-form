import { Form, QuestionConfig } from './database.types'

// Example form used as the app homepage.
// The same id, slug and questions are seeded by supabase/seed-example-form.sql,
// so the form keeps working after the seed is applied to Supabase.
export const EXAMPLE_FORM_ID = '11111111-1111-4111-8111-111111111111'
export const EXAMPLE_FORM_SLUG = 'filme-interestelar'

export const EXAMPLE_MOVIE = 'Interestelar (2014)'

export const exampleFormQuestions: QuestionConfig[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    type: 'yes_no',
    title: `Você gostou do filme ${EXAMPLE_MOVIE}?`,
    description: 'Responda pensando na sua impressão geral sobre o filme.',
    required: true,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    type: 'opinion_scale',
    title: 'Que nota você daria para o filme?',
    description: '1 é a pior nota e 10 é a melhor.',
    required: true,
    minValue: 1,
    maxValue: 10,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    type: 'checkboxes',
    title: 'O que mais chamou sua atenção?',
    description: 'Selecione quantas opções quiser.',
    required: false,
    options: [
      'Roteiro e história',
      'Trilha sonora',
      'Efeitos visuais',
      'Atuações',
      'O final',
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    type: 'dropdown',
    title: 'Onde você assistiu ao filme?',
    required: false,
    options: ['No cinema', 'Em streaming', 'Na TV aberta', 'Em DVD/Blu-ray'],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    type: 'rating',
    title: 'Quantas estrelas você daria para a trilha sonora?',
    required: false,
    minValue: 1,
    maxValue: 5,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    type: 'yes_no',
    title: 'Você recomendaria o filme para um amigo?',
    required: false,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000007',
    type: 'long_text',
    title: 'Quer comentar algo sobre o filme?',
    required: false,
    placeholder: 'Escreva aqui o que você achou...',
  },
]

export const exampleForm: Form = {
  id: EXAMPLE_FORM_ID,
  user_id: '00000000-0000-4000-8000-000000000000',
  title: `O que você achou de ${EXAMPLE_MOVIE}?`,
  description: 'Uma pesquisa rápida de opinião sobre o filme.',
  slug: EXAMPLE_FORM_SLUG,
  status: 'published',
  theme: 'midnight',
  questions: exampleFormQuestions,
  thank_you_message: 'Obrigado por avaliar o filme!',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}
