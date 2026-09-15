import { Form, QuestionConfig } from './database.types'

// Example form used as the app homepage.
// Seeded with the TCC research survey about Software Engineering practices in Game Development.
export const EXAMPLE_FORM_ID = '11111111-1111-4111-8111-111111111111'
export const EXAMPLE_FORM_SLUG = 'praticas-es-jogos'

export const exampleFormQuestionsPT: QuestionConfig[] = [
  {
    id: 'q01-consentimento',
    type: 'dropdown',
    displayNumber: 1,
    title: 'Você leu as informações acima e concorda voluntariamente em participar?',
    description: 'Esta pesquisa busca compreender o que profissionais de jogos conhecem e utilizam em engenharia de software. A participação é voluntária e anônima. Os resultados serão apresentados em conjunto e utilizados para fins acadêmicos.',
    required: true,
    options: [
      'Sim, concordo.',
      'Não concordo.',
    ],
  },
  {
    id: 'q02-atuacao-software',
    type: 'dropdown',
    displayNumber: 2,
    title: 'Você atuou diretamente no software de pelo menos um jogo?',
    description: 'Considere programação, arquitetura, testes de software, ferramentas, automação ou liderança técnica. Atuação exclusivamente artística, sonora, narrativa ou administrativa não atende a esse critério.',
    required: true,
    options: [
      'Sim.',
      'Não.',
    ],
  },
  {
    id: 'q03-formacao-academica',
    type: 'dropdown',
    displayNumber: 3,
    title: 'Qual alternativa descreve melhor sua formação acadêmica?',
    required: true,
    options: [
      'Ensino médio incompleto ou escolaridade anterior.',
      'Ensino médio ou técnico concluído.',
      'Graduação em andamento.',
      'Graduação concluída.',
      'Pós-graduação concluída.',
    ],
  },
  {
    id: 'q04-formacao-computacao',
    type: 'dropdown',
    displayNumber: 4,
    title: 'Sua formação principal é relacionada à computação ou ao desenvolvimento de software?',
    required: true,
    options: [
      'Sim.',
      'Parcialmente.',
      'Não.',
      'Não curso nem concluí formação técnica ou superior.',
    ],
  },
  {
    id: 'q05-estudou-es',
    type: 'dropdown',
    displayNumber: 5,
    title: 'Você estudou engenharia de software em alguma disciplina, curso ou treinamento estruturado?',
    description: 'Inclua cursos online. Leitura ou prática por conta própria, sem curso ou treinamento, não conta nesta pergunta.',
    required: true,
    options: [
      'Sim.',
      'Não.',
      'Não tenho certeza.',
    ],
  },
  {
    id: 'q06-experiencia-jogos',
    type: 'dropdown',
    displayNumber: 6,
    title: 'Quanto tempo de experiência você acumula no desenvolvimento de jogos?',
    required: true,
    options: [
      'Menos de 1 ano.',
      '1 a menos de 3 anos.',
      '3 a menos de 6 anos.',
      '6 a menos de 10 anos.',
      '10 anos ou mais.',
    ],
  },
  {
    id: 'q07-experiencia-outros-softwares',
    type: 'dropdown',
    displayNumber: 7,
    title: 'Antes de começar a trabalhar com jogos, você teve experiência profissional desenvolvendo outros tipos de software?',
    required: true,
    options: [
      'Não.',
      'Sim, por menos de 1 ano.',
      'Sim, por 1 a menos de 3 anos.',
      'Sim, por 3 anos ou mais.',
    ],
  },
  {
    id: 'q08-tamanho-equipe',
    type: 'dropdown',
    displayNumber: 8,
    title: 'Qual era o tamanho aproximado da equipe principal do projeto de jogo mais recente em que você atuou?',
    required: true,
    options: [
      'Sozinho.',
      '2 a 5 (Micro).',
      '6 a 15 (Pequeno).',
      '16 a 50 (Médio).',
      'Mais de 50 (Grande).',
    ],
  },
  {
    id: 'q09-conhecimento-topicos',
    type: 'matrix',
    displayNumber: 9,
    title: 'Como você avalia seu conhecimento atual sobre cada tópico?',
    description: 'Marque uma opção por linha, mesmo que não tenha aplicado o tópico nesse projeto.\n1 Nenhum: não conheço o tópico. | 2 Reconheço: já ouvi falar, mas não sei explicar. | 3 Básico: compreendo noções básicas. | 4 Bom: compreendo os principais conceitos e suas relações. | 5 Avançado: consigo explicar detalhes e orientar outras pessoas.',
    required: true,
    matrixColumns: [
      { id: '1', label: '1 - Nenhum: não conheço o tópico', shortLabel: '1 Nenhum' },
      { id: '2', label: '2 - Reconheço: já ouvi falar, mas não sei explicar', shortLabel: '2 Reconheço' },
      { id: '3', label: '3 - Básico: compreendo noções básicas', shortLabel: '3 Básico' },
      { id: '4', label: '4 - Bom: compreendo os principais conceitos e suas relações', shortLabel: '4 Bom' },
      { id: '5', label: '5 - Avançado: consigo explicar detalhes e orientar outras pessoas', shortLabel: '5 Avançado' },
    ],
    matrixRows: [
      { id: 'processos', label: 'Processos de desenvolvimento', description: 'Organizar e acompanhar o trabalho.' },
      { id: 'requisitos', label: 'Requisitos', description: 'Registrar e acompanhar o que o jogo deve fazer.' },
      { id: 'modelagem', label: 'Modelagem', description: 'Representar soluções técnicas com diagramas ou modelos.' },
      { id: 'padroes', label: 'Princípios e padrões de projeto', description: 'Organizar o código e usar soluções de projeto reutilizáveis.' },
      { id: 'arquitetura', label: 'Arquitetura de software', description: 'Definir módulos, componentes e responsabilidades.' },
      { id: 'testes', label: 'Testes de software', description: 'Verificar falhas manualmente ou por automação.' },
      { id: 'refatoracao', label: 'Refatoração', description: 'Melhorar a estrutura do código sem alterar seu comportamento.' },
      { id: 'devops', label: 'DevOps', description: 'Automatizar builds, integração ou entrega do jogo.' },
      { id: 'versionamento', label: 'Versionamento', description: 'Controlar e integrar alterações com Git, Perforce ou equivalente.' },
    ],
  },
  {
    id: 'q10-frequencia-aplicacao',
    type: 'matrix',
    displayNumber: 10,
    title: 'Com que frequência você aplicou pessoalmente cada tópico em seus projetos de desenvolvimento de jogos?',
    description: '1 Nunca. | 2 Raramente. | 3 Às vezes. | 4 Frequentemente. | 5 Sempre ou quase sempre. | NS Não sei avaliar.',
    required: true,
    matrixColumns: [
      { id: '1', label: '1 - Nunca', shortLabel: '1 Nunca' },
      { id: '2', label: '2 - Raro', shortLabel: '2 Raro' },
      { id: '3', label: '3 - Às vezes', shortLabel: '3 Às vezes' },
      { id: '4', label: '4 - Freq.', shortLabel: '4 Freq.' },
      { id: '5', label: '5 - Sempre*', shortLabel: '5 Sempre*' },
      { id: 'ns', label: 'NS - Não sei avaliar', shortLabel: 'NS' },
    ],
    matrixRows: [
      { id: 'processos', label: 'Processos de desenvolvimento' },
      { id: 'requisitos', label: 'Requisitos' },
      { id: 'modelagem', label: 'Modelagem' },
      { id: 'padroes', label: 'Princípios e padrões de projeto' },
      { id: 'arquitetura', label: 'Arquitetura de software' },
      { id: 'testes', label: 'Testes de software' },
      { id: 'refatoracao', label: 'Refatoração' },
      { id: 'devops', label: 'DevOps' },
      { id: 'versionamento', label: 'Versionamento' },
    ],
  },
  {
    id: 'q13-topicos-dificeis',
    type: 'checkboxes',
    displayNumber: 13,
    title: 'Entre os tópicos que você aplicou ou tentou aplicar nesse projeto, quais foram os mais difíceis de adotar?',
    description: 'Selecione todas as opções que se aplicam.',
    required: false,
    options: [
      'Processos de desenvolvimento',
      'Requisitos',
      'Modelagem',
      'Princípios e padrões de projeto',
      'Arquitetura de software',
      'Testes de software',
      'Refatoração',
      'DevOps',
      'Versionamento',
      'Não tive dificuldade nos tópicos que apliquei ou tentei aplicar.',
      'Não apliquei nem tentei aplicar esses tópicos.',
      'Não sei avaliar.',
    ],
    exclusiveOptions: [
      'Não tive dificuldade nos tópicos que apliquei ou tentei aplicar.',
      'Não apliquei nem tentei aplicar esses tópicos.',
      'Não sei avaliar.',
    ],
  },
  {
    id: 'q14-principais-barreiras',
    type: 'checkboxes',
    displayNumber: 14,
    title: 'Quais foram as principais barreiras para aplicar essas práticas nesse projeto?',
    description: 'Selecione até 3. Se escolher uma das duas últimas opções, marque somente ela.',
    required: false,
    maxSelect: 3,
    options: [
      'Falta de tempo ou prazos curtos.',
      'Falta de conhecimento ou capacitação.',
      'Equipe insuficiente para o trabalho.',
      'Falta de recursos financeiros.',
      'Baixa prioridade dessas práticas na equipe.',
      'Dificuldade de adaptar as práticas às características do jogo.',
      'Limitações do motor ou das ferramentas.',
      'Outra barreira.',
      'Não encontrei barreiras.',
      'Não sei avaliar.',
    ],
    exclusiveOptions: [
      'Não encontrei barreiras.',
      'Não sei avaliar.',
    ],
  },
  {
    id: 'q15-correspondencia-conteudos',
    type: 'dropdown',
    displayNumber: 15,
    title: 'Em que medida os conteúdos de engenharia de software que você estudou correspondiam às necessidades desse projeto?',
    required: true,
    options: [
      'Totalmente.',
      'Em grande parte.',
      'Em pequena parte.',
      'Não correspondiam.',
      'Não estudei esses conteúdos.',
      'Não sei avaliar.',
    ],
  },
]

export const exampleFormQuestionsEN: QuestionConfig[] = [
  {
    id: 'q01-consentimento',
    type: 'dropdown',
    displayNumber: 1,
    title: 'Have you read the information above and voluntarily agree to participate?',
    description: 'This research aims to understand what game development professionals know and use in software engineering. Participation is voluntary and anonymous. Results will be presented in aggregate and used for academic purposes.',
    required: true,
    options: [
      'Yes, I agree.',
      'I do not agree.',
    ],
  },
  {
    id: 'q02-atuacao-software',
    type: 'dropdown',
    displayNumber: 2,
    title: 'Have you directly worked on the software of at least one game?',
    description: 'Consider programming, architecture, software testing, tooling, automation, or technical leadership. Exclusively artistic, audio, narrative, or administrative roles do not meet this criterion.',
    required: true,
    options: [
      'Yes.',
      'No.',
    ],
  },
  {
    id: 'q03-formacao-academica',
    type: 'dropdown',
    displayNumber: 3,
    title: 'Which option best describes your academic background?',
    required: true,
    options: [
      'Some high school or lower.',
      'High school diploma or technical/vocational education completed.',
      'Undergraduate degree in progress.',
      'Undergraduate degree completed (Bachelor’s / Licentiate).',
      'Postgraduate degree completed (Specialization, Master’s, or PhD).',
    ],
  },
  {
    id: 'q04-formacao-computacao',
    type: 'dropdown',
    displayNumber: 4,
    title: 'Is your primary academic education related to computing or software development?',
    required: true,
    options: [
      'Yes.',
      'Partially.',
      'No.',
      'I am not enrolled in and have not completed technical or higher education.',
    ],
  },
  {
    id: 'q05-estudou-es',
    type: 'dropdown',
    displayNumber: 5,
    title: 'Have you studied software engineering in any formal academic course, class, or structured training?',
    description: 'Include online courses. Self-directed reading or practice without a course or training does not count for this question.',
    required: true,
    options: [
      'Yes.',
      'No.',
      'I am not sure.',
    ],
  },
  {
    id: 'q06-experiencia-jogos',
    type: 'dropdown',
    displayNumber: 6,
    title: 'How much total experience do you have in game development?',
    required: true,
    options: [
      'Less than 1 year.',
      '1 to less than 3 years.',
      '3 to less than 6 years.',
      '6 to less than 10 years.',
      '10 years or more.',
    ],
  },
  {
    id: 'q07-experiencia-outros-softwares',
    type: 'dropdown',
    displayNumber: 7,
    title: 'Before starting to work with games, did you have professional experience developing other types of software?',
    required: true,
    options: [
      'No.',
      'Yes, for less than 1 year.',
      'Yes, for 1 to less than 3 years.',
      'Yes, for 3 years or more.',
    ],
  },
  {
    id: 'q08-tamanho-equipe',
    type: 'dropdown',
    displayNumber: 8,
    title: 'What was the approximate size of the core team in the most recent game project you worked on?',
    required: true,
    options: [
      'Solo.',
      '2 to 5 (Micro).',
      '6 to 15 (Small).',
      '16 to 50 (Medium).',
      'More than 50 (Large).',
    ],
  },
  {
    id: 'q09-conhecimento-topicos',
    type: 'matrix',
    displayNumber: 9,
    title: 'How do you evaluate your current knowledge of each topic?',
    description: 'Select one option per row, even if you did not apply the topic in this project.\n1 None: I do not know the topic. | 2 Recognize: I have heard of it, but cannot explain it. | 3 Basic: I understand basic concepts. | 4 Good: I understand the main concepts and their relationships. | 5 Advanced: I can explain details and guide others.',
    required: true,
    matrixColumns: [
      { id: '1', label: '1 - None: I do not know the topic', shortLabel: '1 None' },
      { id: '2', label: '2 - Recognize: Heard of it, cannot explain', shortLabel: '2 Recognize' },
      { id: '3', label: '3 - Basic: Understand basic concepts', shortLabel: '3 Basic' },
      { id: '4', label: '4 - Good: Understand main concepts & relations', shortLabel: '4 Good' },
      { id: '5', label: '5 - Advanced: Can explain details & guide others', shortLabel: '5 Advanced' },
    ],
    matrixRows: [
      { id: 'processos', label: 'Development processes', description: 'Organizing and tracking work.' },
      { id: 'requisitos', label: 'Requirements', description: 'Recording and tracking what the game should do.' },
      { id: 'modelagem', label: 'Modeling', description: 'Representing technical solutions with diagrams or models.' },
      { id: 'padroes', label: 'Design principles and patterns', description: 'Structuring code and using reusable design solutions.' },
      { id: 'arquitetura', label: 'Software architecture', description: 'Defining modules, components, and responsibilities.' },
      { id: 'testes', label: 'Software testing', description: 'Verifying defects manually or through automation.' },
      { id: 'refatoracao', label: 'Refactoring', description: 'Improving code structure without altering its external behavior.' },
      { id: 'devops', label: 'DevOps', description: 'Automating builds, integration, or delivery of the game.' },
      { id: 'versionamento', label: 'Version control', description: 'Managing and integrating changes with Git, Perforce, or equivalent.' },
    ],
  },
  {
    id: 'q10-frequencia-aplicacao',
    type: 'matrix',
    displayNumber: 10,
    title: 'How often have you personally applied each topic in your game development projects?',
    description: '1 Never. | 2 Rarely. | 3 Sometimes. | 4 Frequently. | 5 Always or almost always. | NS Cannot evaluate.',
    required: true,
    matrixColumns: [
      { id: '1', label: '1 - Never', shortLabel: '1 Never' },
      { id: '2', label: '2 - Rarely', shortLabel: '2 Rarely' },
      { id: '3', label: '3 - Sometimes', shortLabel: '3 Sometimes' },
      { id: '4', label: '4 - Freq.', shortLabel: '4 Freq.' },
      { id: '5', label: '5 - Always*', shortLabel: '5 Always*' },
      { id: 'ns', label: 'NS - Cannot evaluate', shortLabel: 'NS' },
    ],
    matrixRows: [
      { id: 'processos', label: 'Development processes' },
      { id: 'requisitos', label: 'Requirements' },
      { id: 'modelagem', label: 'Modeling' },
      { id: 'padroes', label: 'Design principles and patterns' },
      { id: 'arquitetura', label: 'Software architecture' },
      { id: 'testes', label: 'Software testing' },
      { id: 'refatoracao', label: 'Refactoring' },
      { id: 'devops', label: 'DevOps' },
      { id: 'versionamento', label: 'Version control' },
    ],
  },
  {
    id: 'q13-topicos-dificeis',
    type: 'checkboxes',
    displayNumber: 13,
    title: 'Among the topics you applied or attempted to apply in this project, which were the most difficult to adopt?',
    description: 'Select all options that apply.',
    required: false,
    options: [
      'Development processes',
      'Requirements',
      'Modeling',
      'Design principles and patterns',
      'Software architecture',
      'Software testing',
      'Refactoring',
      'DevOps',
      'Version control',
      'I had no difficulty with the topics I applied or attempted to apply.',
      'I did not apply nor attempt to apply these topics.',
      'Cannot evaluate.',
    ],
    exclusiveOptions: [
      'I had no difficulty with the topics I applied or attempted to apply.',
      'I did not apply nor attempt to apply these topics.',
      'Cannot evaluate.',
    ],
  },
  {
    id: 'q14-principais-barreiras',
    type: 'checkboxes',
    displayNumber: 14,
    title: 'What were the main barriers to applying these practices in this project?',
    description: 'Select up to 3. If choosing either of the last two options, select only that one.',
    required: false,
    maxSelect: 3,
    options: [
      'Lack of time or tight deadlines.',
      'Lack of knowledge or training.',
      'Insufficient team size for the workload.',
      'Lack of financial resources.',
      'Low priority given to these practices within the team.',
      'Difficulty adapting practices to game characteristics.',
      'Engine or tooling limitations.',
      'Other barrier.',
      'I encountered no barriers.',
      'Cannot evaluate.',
    ],
    exclusiveOptions: [
      'I encountered no barriers.',
      'Cannot evaluate.',
    ],
  },
  {
    id: 'q15-correspondencia-conteudos',
    type: 'dropdown',
    displayNumber: 15,
    title: 'To what extent did the software engineering content you studied correspond to the needs of this project?',
    required: true,
    options: [
      'Completely.',
      'To a large extent.',
      'To a small extent.',
      'Did not correspond.',
      'I did not study these topics.',
      'Cannot evaluate.',
    ],
  },
]

export const exampleFormQuestions = exampleFormQuestionsPT

export type SurveyLanguage = 'pt' | 'en'

export interface SurveyTranslationStrings {
  title: string
  badge: string
  description: string
  startButton: string
  pressEnter: string
  enterKey: string
  languagePrompt: string
  selectLanguage: string
  ptOption: string
  enOption: string
  questions: QuestionConfig[]
  nextButton: string
  submitButton: string
  submittingButton: string
  backToStart: string
  requiredFieldError: string
  selectAtLeastOneError: string
  rateAllTopicsError: string
  validEmailError: string
  validUrlError: string
  validPhoneError: string
  maxSelectError: (max: number) => string
  completedSuccessTitle: string
  completedSuccessDesc: string
  completedConsentDeclinedTitle: string
  completedConsentDeclinedDesc: string
  completedNotEligibleTitle: string
  completedNotEligibleDesc: string
  progressTooltip: (percent: number) => string
}

export const surveyTranslations: Record<SurveyLanguage, SurveyTranslationStrings> = {
  pt: {
    title: 'Práticas de engenharia de software no desenvolvimento de jogos',
    badge: 'Pesquisa de TCC • PUC Minas • ~7 min',
    description:
      'Pesquisa de TCC da PUC Minas  |  Tempo estimado de resposta de até 7 minutos\n\nEsta pesquisa busca compreender o que profissionais de jogos conhecem e utilizam em engenharia de software. A participação é voluntária. O formulário não solicita nome, e-mail, empresa ou jogo. Os resultados serão apresentados em conjunto e utilizados para fins acadêmicos.\n\nResponsável: Pedro Henrique de Almeida Costa. Contato: pedro.costa.1217022@sga.pucminas.br.',
    startButton: 'Iniciar pesquisa',
    pressEnter: 'pressione',
    enterKey: 'Enter ↵',
    languagePrompt: 'Prefere responder em qual idioma?',
    selectLanguage: 'Idioma / Language',
    ptOption: 'Português',
    enOption: 'English',
    questions: exampleFormQuestionsPT,
    nextButton: 'OK',
    submitButton: 'Enviar',
    submittingButton: 'Enviando...',
    backToStart: 'Voltar ao início',
    requiredFieldError: 'Este campo é obrigatório',
    selectAtLeastOneError: 'Selecione pelo menos uma opção',
    rateAllTopicsError: 'Por favor, avalie todos os tópicos antes de continuar',
    validEmailError: 'Por favor, insira um e-mail válido',
    validUrlError: 'Por favor, insira uma URL válida',
    validPhoneError: 'Por favor, insira um telefone válido',
    maxSelectError: (max: number) => `Você pode selecionar no máximo ${max} opções`,
    completedSuccessTitle: 'Pesquisa concluída!',
    completedSuccessDesc:
      'Obrigado pela sua participação! Suas respostas foram registradas com sucesso e contribuirão para a pesquisa acadêmica.',
    completedConsentDeclinedTitle: 'Agradecemos o seu tempo',
    completedConsentDeclinedDesc: 'Você optou por não participar da pesquisa. Nenhuma resposta foi registrada.',
    completedNotEligibleTitle: 'Agradecemos o seu interesse',
    completedNotEligibleDesc:
      'Esta pesquisa tem como público-alvo profissionais que atuaram diretamente no desenvolvimento de software de pelo menos um jogo digital. Como você indicou que não atende a esse critério, o questionário foi encerrado.',
    progressTooltip: (percent: number) => `Progresso: ${percent}% concluído`,
  },
  en: {
    title: 'Software Engineering Practices in Game Development',
    badge: 'Bachelor Thesis Research • PUC Minas • ~7 min',
    description:
      'PUC Minas Undergraduate Thesis Research  |  Estimated response time: up to 7 minutes\n\nThis research aims to understand what game development professionals know and use in software engineering. Participation is voluntary. The form does not request name, email, company, or game title. Results will be presented in aggregate and used for academic purposes.\n\nResponsible: Pedro Henrique de Almeida Costa. Contact: pedro.costa.1217022@sga.pucminas.br.',
    startButton: 'Start survey',
    pressEnter: 'press',
    enterKey: 'Enter ↵',
    languagePrompt: 'Preferred survey language:',
    selectLanguage: 'Language / Idioma',
    ptOption: 'Português',
    enOption: 'English',
    questions: exampleFormQuestionsEN,
    nextButton: 'OK',
    submitButton: 'Submit',
    submittingButton: 'Submitting...',
    backToStart: 'Back to start',
    requiredFieldError: 'This field is required',
    selectAtLeastOneError: 'Please select at least one option',
    rateAllTopicsError: 'Please rate all topics before continuing',
    validEmailError: 'Please enter a valid email address',
    validUrlError: 'Please enter a valid URL',
    validPhoneError: 'Please enter a valid phone number',
    maxSelectError: (max: number) => `You can select up to ${max} options`,
    completedSuccessTitle: 'Survey completed!',
    completedSuccessDesc:
      'Thank you for your participation! Your answers have been successfully recorded and will contribute to academic research.',
    completedConsentDeclinedTitle: 'Thank you for your time',
    completedConsentDeclinedDesc: 'You chose not to participate in the research. No answers were recorded.',
    completedNotEligibleTitle: 'Thank you for your interest',
    completedNotEligibleDesc:
      'This survey targets professionals who have worked directly on the software of at least one digital game. Since you indicated that you do not meet this criterion, the survey has been concluded.',
    progressTooltip: (percent: number) => `Progress: ${percent}% completed`,
  },
}

// Convert answers between languages without data loss
export function convertAnswersLanguage(
  answers: Record<string, any>,
  fromLang: SurveyLanguage,
  toLang: SurveyLanguage
): Record<string, any> {
  if (fromLang === toLang) return answers

  const fromQuestions = surveyTranslations[fromLang].questions
  const toQuestions = surveyTranslations[toLang].questions
  const converted: Record<string, any> = { ...answers }

  for (const qFrom of fromQuestions) {
    const qTo = toQuestions.find(q => q.id === qFrom.id)
    if (!qTo || !qFrom.options || !qTo.options) continue

    const val = answers[qFrom.id]
    if (val === undefined || val === null) continue

    if (typeof val === 'string') {
      const idx = qFrom.options.indexOf(val)
      if (idx >= 0 && qTo.options[idx]) {
        converted[qFrom.id] = qTo.options[idx]
      }
    } else if (Array.isArray(val)) {
      converted[qFrom.id] = val.map(item => {
        if (typeof item === 'string') {
          const idx = qFrom.options!.indexOf(item)
          return idx >= 0 && qTo.options![idx] ? qTo.options![idx] : item
        }
        return item
      })
    }
  }

  return converted
}

export const exampleForm: Form = {
  id: EXAMPLE_FORM_ID,
  user_id: '00000000-0000-4000-8000-000000000000',
  title: 'Práticas de engenharia de software no desenvolvimento de jogos',
  description: 'Pesquisa de TCC da PUC Minas  |  Tempo estimado de resposta de até 7 minutos\n\nEsta pesquisa busca compreender o que profissionais de jogos conhecem e utilizam em engenharia de software. A participação é voluntária. O formulário não solicita nome, e-mail, empresa ou jogo. Os resultados serão apresentados em conjunto e utilizados para fins acadêmicos.\n\nResponsável: Pedro Henrique de Almeida Costa. Contato: pedro.costa.1217022@sga.pucminas.br.',
  slug: EXAMPLE_FORM_SLUG,
  status: 'published',
  theme: 'ocean',
  questions: exampleFormQuestions,
  thank_you_message: 'Obrigado pela participação!',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}
