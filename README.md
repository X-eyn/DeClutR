# DeClutR — Temporal Dashboard

A personal productivity dashboard for managing deadlines, tasks, events, and reminders with a focus on temporal clarity.

## Features

- **Dashboard overview** — stat cards, timeline gantt, agenda, deadline list, and insight widgets
- **Calendar** — full month grid with item pills, day-panel drill-down, and item creation
- **Tasks** — tabbed view (All / Active / Overdue / Completed) with checklist support and priority badges
- **Reminders** — grouped by urgency (Overdue / Today / This Week / Later) with dismiss and edit
- **Notes** — masonry grid with search
- **Timeline** — gantt-style view of upcoming items
- **Insights** — completion rates, type breakdown, and activity charts
- **Settings** — profile, Google Calendar integration, preferences, and danger zone

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6 |
| Auth | NextAuth v5 (Google OAuth2) |
| Styling | CSS custom properties (no external UI library) |
| Date utils | date-fns |

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/X-eyn/DeClutR.git
cd DeClutR
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required variables:

```
DATABASE_URL=          # Supabase session-mode pooler (port 5432)
DIRECT_URL=            # Supabase direct connection (port 5432, no pooler)
NEXTAUTH_SECRET=       # Any random string (openssl rand -base64 32)
NEXTAUTH_URL=          # http://localhost:3000
GOOGLE_CLIENT_ID=      # From Google Cloud Console
GOOGLE_CLIENT_SECRET=  # From Google Cloud Console
```

### 3. Database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Seed demo data

Sign in, then hit the **"Load demo data"** button on the empty dashboard, or POST to `/api/seed`.

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
4. Enable the **Google Calendar API** and **Google Tasks API** in your project
5. Paste the client ID and secret into `.env.local`

## Project Structure

```
app/
  dashboard/
    calendar/       # Month-grid calendar
    tasks/          # Task manager
    reminders/      # Reminder manager
    notes/          # Notes grid
    insights/       # Analytics
    settings/       # User settings
    sync/           # Google sync & logs
  api/
    items/          # CRUD for temporal items
    seed/           # Demo data endpoint
    google/         # Google Calendar/Tasks integration
components/
  dashboard/
    widgets/        # Stat cards, agenda, timeline, etc.
lib/                # Prisma client, auth, time utilities
prisma/
  schema.prisma     # Data model
types/              # Shared TypeScript types
```

## License

MIT
