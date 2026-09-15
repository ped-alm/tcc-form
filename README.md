# tcc-form

Form builder for the TCC project, based on [OpenForm](https://github.com/dabit3/openform) (an open-source TypeForm
alternative) and integrated with the Supabase project already configured in this repository.

Forms are answered one question at a time, and every response is stored in Supabase.

## Features

- **6 themes** - Midnight, Ocean, Sunset, Forest, Lavender, Minimal
- **13 question types** - Text, dropdown, checkboxes, rating, opinion scale, file upload, and more
- **Keyboard navigation** - Enter, arrow keys, and scroll wheel
- **Supabase authentication** - Google OAuth and Magic Link
- **Response dashboard** - View, search, filter, and export to CSV
- **Example form** - Themed movie survey rendered on the homepage and seeded into Supabase (`/f/filme-interestelar`)

## Tech stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database / Auth**: Supabase (PostgreSQL + Supabase Auth)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Animations**: Framer Motion
- **File storage**: Cloudflare R2 (optional, falls back to base64)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

`.env.local` already points to the Supabase project used by this repo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Use `.env.example` as reference when deploying elsewhere.

### 3. Create the database objects

In the Supabase Dashboard, open the **SQL Editor** and run, in this order:

1. `supabase/schema.sql` - creates `profiles`, `forms` and `responses`, plus indexes, triggers and RLS policies.
2. `supabase/seed-example-form.sql` - creates the example movie form (run it **after** signing in at least once, see below).

### 4. Configure authentication

- **Authentication → URL Configuration**
  - Site URL: `http://localhost:3000`
  - Redirect URL: `http://localhost:3000/auth/callback`
- **Authentication → Providers → Google** (optional): enable it and add your Google OAuth credentials with the
  redirect URI `https://YOUR_PROJECT.supabase.co/auth/v1/callback`. Magic Link works without extra setup.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to answer the example form; sign in at `/login` and the dashboard is
at `/dashboard`.

## Example form integrated with Supabase

The homepage (`app/page.tsx`) is the example form itself: a themed opinion survey about the movie
*Interestelar (2014)*, asking whether the respondent liked it, what score (1-10) they would give it, the soundtrack
rating, where they watched it and an open comment.

- The questions live in `lib/example-form.ts` and are mirrored by `supabase/seed-example-form.sql`, which inserts the
  same **published** form with the slug `filme-interestelar` (also reachable at `/f/filme-interestelar`).
- Until the seed is applied, the homepage renders the local definition, so the form always shows up; after the seed it
  is loaded straight from Supabase.
- The form is owned by the first user in `auth.users`, so **sign in once before running the seed**.
- The script is idempotent: running it again updates the existing form instead of duplicating it.
- Submitted answers land in `public.responses` and are visible at `/forms/<form-id>/responses`.

Row Level Security policies ship enabled in `supabase/schema.sql` (public read for published forms, anonymous
inserts into `responses`, owner-only access to everything else) and can be adjusted later as needed.

## File uploads (optional)

Add Cloudflare R2 credentials to `.env.local` to store uploaded files in R2; without them the file upload
question falls back to inline base64 data URLs:

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=openform-uploads
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

## Project structure

```
tcc-form/
├── app/
│   ├── (auth)/              # Login page
│   ├── (dashboard)/         # Protected pages (dashboard, form builder, responses, settings)
│   ├── page.tsx             # Homepage = example movie form
│   ├── api/upload/          # File upload endpoint (Cloudflare R2)
│   ├── auth/callback/       # Supabase auth callback
│   └── f/[slug]/            # Public form pages
├── components/
│   ├── dashboard/           # Dashboard components
│   ├── form-builder/        # Form builder components
│   ├── form-player/         # Form answering experience
│   ├── responses/           # Response dashboard
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── supabase/            # Browser, server and middleware clients
│   ├── database.types.ts    # Database and question types
│   ├── example-form.ts      # Example movie form rendered on the homepage
│   ├── questions.ts         # Question type definitions
│   └── themes.ts            # Theme configurations
├── middleware.ts            # Session refresh + route protection
└── supabase/
    ├── schema.sql           # Database schema, triggers and RLS policies
    └── seed-example-form.sql# Example movie form seed (/f/filme-interestelar)
```

## Credits

Based on [OpenForm](https://github.com/dabit3/openform) by Nader Dabit, MIT licensed.
