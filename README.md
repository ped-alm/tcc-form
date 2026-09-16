# tcc-form

Form application for the TCC project, providing a clean, accessible form player interface and saving responses directly into Supabase.

Forms are answered one question at a time, and every response is stored in Supabase. Data can be accessed directly from the Supabase database.

## Features

- **Themes** - Midnight, Ocean, Sunset, Forest, Lavender, Minimal
- **Interactive question types** - Single choice, multiple choice, matrix/rating, scale, text, and more
- **Bilingual support** - Portuguese and English survey questions
- **Keyboard & gesture navigation** - Enter, arrow keys, and scroll navigation
- **Direct Supabase integration** - Anonymous response submission protected by Row Level Security (RLS)

## Tech stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Animations**: Framer Motion

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Set your Supabase credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Optional: For administrative server operations and pre-checks bypassing RLS
```

> **Security & Row Level Security (RLS)**: Public anonymous respondents are permitted to `INSERT` responses to published forms, but `SELECT` on `responses` is strictly restricted to authenticated administrators to safeguard respondent privacy. Form submissions are processed securely via the `submit_survey_response` RPC function (`SECURITY DEFINER`) or direct fallback insert with database unique constraint deduplication (`idx_responses_unique_respondent`). Supplying `SUPABASE_SERVICE_ROLE_KEY` is optional for respondent submissions, but enables administrative server-side pre-checks and operations without RLS restrictions.

### 3. Create database objects

In the Supabase Dashboard, open the **SQL Editor** and run:

1. `supabase/schema.sql` - canonical database schema: creates `forms` and `responses` tables, normalized question tables (`questions`, `question_options`, `question_matrix_rows`, `question_matrix_columns`), sync triggers, analytical views, indexes, RPC deduplication function, and RLS policies.
2. `supabase/seed-example-form.sql` - seeds the survey form.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to answer the form directly.

## Accessing Response Data

Since the application is focused purely on the respondent experience, response data is stored in the `responses` table in Supabase. You can query, inspect, and export responses directly using the Supabase Table Editor or SQL Editor:

```sql
SELECT
  id,
  form_id,
  answers,
  submitted_at
FROM public.responses
ORDER BY submitted_at DESC;
```

## Project structure

```
tcc-form/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage form
│   └── f/[slug]/            # Form page by slug
├── components/
│   ├── form-player/         # Form answering experience
│   └── ui/                  # UI components
├── lib/
│   ├── supabase/            # Supabase browser & server clients
│   ├── database.types.ts    # Database and question types
│   ├── example-form.ts      # Survey questions & translations
│   └── themes.ts            # Theme presets and CSS variables
└── supabase/
    ├── schema.sql           # Canonical database schema & RLS policies
    └── seed-example-form.sql# Form seed script
```
