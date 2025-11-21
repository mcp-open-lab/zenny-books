# Turbo Invoice

AI-powered receipt scanning and management. Fast, simple receipt capture → AI extraction → CSV export.

## Quick Start

```bash
npm install
npm run db:push
npm run dev
```

## Environment Variables

Create `.env.local`:

```env
POSTGRES_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
UPLOADTHING_TOKEN=sk_live_...
UPLOADTHING_APP_ID=...
GOOGLE_AI_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run db:push` - Push schema changes
- `npm run db:studio` - Database UI
