# Today-s-summary

Today-s-summary is a Next.js daily news digest app. It collects Taiwan-focused news from several categories, asks Gemini to review and group related articles, generates Traditional Chinese summaries, and stores the result as a daily digest in SQLite.

## What It Does

- Fetches Taiwan news from GNews top headlines, Google News RSS fallback, and GNews search fallback.
- Organizes articles into four active categories: Taiwan news, sports, business, and technology.
- Uses Gemini to filter low-quality items, group duplicate or related reports into topics, and write article-level summaries.
- Produces category summaries and an overall daily overview in Traditional Chinese.
- Saves one digest per Taiwan date with Prisma and SQLite, using upsert so rerunning the generator updates the same day.
- Displays the latest daily digest in a Next.js UI with expandable category sections and source links.

## Tech Stack

- Next.js 16 with React 19 and TypeScript
- Prisma 7 with SQLite through `better-sqlite3`
- Gemini via `@google/genai`
- GNews API and Google News RSS
- Tailwind CSS 4

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
DATABASE_URL="file:./prisma/dev.db"
GNEWS_API_KEY="your-gnews-api-key"
GEMINI_API_KEY="your-gemini-api-key"
```

Optional rate-limit tuning:

```bash
GNEWS_REQUEST_DELAY_MS=5000
GNEWS_RATE_LIMIT_RETRY_DELAY_MS=15000
GEMINI_REQUEST_DELAY_MS=2000
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Generate A Daily Digest

With the development server running, call:

```bash
curl -X POST http://localhost:3000/api/generate-digest
```

The generator will:

1. Determine today's date in the Asia/Taipei timezone.
2. Fetch candidate articles for each category.
3. Ask Gemini to review, summarize, and group articles into topics.
4. Generate category summaries and a daily overview.
5. Save the digest to SQLite.

After it finishes, refresh the home page to view the generated digest.

## API Routes

- `GET /api/news` fetches raw categorized news without saving it.
- `GET /api/summary` fetches news and returns generated summaries without saving them.
- `GET /api/digest` returns the latest saved digest.
- `GET /api/digest?date=YYYY-MM-DD` returns the saved digest for a specific Taiwan date.
- `POST /api/generate-digest` creates or updates today's saved digest.

## Project Structure

- `app/` contains the Next.js pages and API routes.
- `components/DigestPage.tsx` renders the digest UI.
- `lib/news.ts` fetches and deduplicates news articles.
- `lib/summarize.ts` handles Gemini review, grouping, and summary prompts.
- `lib/digest.ts` reads and writes daily digests.
- `lib/prisma.ts` configures the Prisma client and SQLite adapter.
- `prisma/schema.prisma` defines the `DailyDigest` model.

## Database

The app stores generated digests in the `DailyDigest` table. Each record includes the digest date, overall summary, category summaries, and the reviewed raw news JSON used to render topic and article details.

For local development, the SQLite database is expected at:

```bash
prisma/dev.db
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
