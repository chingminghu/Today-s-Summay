# Today-s-summary

Today-s-summary is a Next.js daily news digest app for Taiwan-focused news. It gathers articles from multiple news sources, reads article pages during review, asks Gemini to group related reports into topics, and stores a daily Traditional Chinese digest in SQLite.

## What It Does

- Fetches news for four active categories: Taiwan news, sports, business, and technology.
- Pulls candidates from GNews top headlines, Google News RSS, and GNews search for each category.
- Deduplicates articles by URL and title, logs how many unique articles each category fetched, then keeps the first 20 articles for review.
- Opens each selected article URL during the review step and extracts readable article text from the HTML.
- Uses Gemini to filter low-quality items, group articles that describe the same event, and generate each topic title and topic summary from article text.
- Generates one category summary per section and one overall daily overview.
- Saves one digest per Taiwan date with Prisma and SQLite, using upsert so rerunning the generator updates the same day.
- Displays the saved digest with expandable categories, topic summaries, article titles, sources, timestamps, and original article links.

## Tech Stack

- Next.js 16 with React 19 and TypeScript
- Prisma 7 with SQLite through `better-sqlite3`
- Gemini via `@google/genai`
- GNews API and Google News RSS
- JSDOM for extracting text from article HTML
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

Optional tuning:

```bash
GNEWS_ARTICLES_PER_REQUEST=20
GNEWS_REQUEST_DELAY_MS=5000
GNEWS_RATE_LIMIT_RETRY_DELAY_MS=15000
GEMINI_REQUEST_DELAY_MS=2000
GEMINI_RETRY_DELAYS_MS=3000,8000,15000,30000,60000,90000
ARTICLE_FETCH_TIMEOUT_MS=12000
ARTICLE_TEXT_MAX_CHARS=6000
TOPIC_ARTICLE_TEXT_TOTAL_MAX_CHARS=16000
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
2. Fetch candidate articles for each category from all configured sources.
3. Deduplicate articles and keep the first 20 per category.
4. Open each selected article page and extract article text.
5. Ask Gemini to review articles, remove weak candidates, group related articles into topics, and generate topic titles and summaries.
6. Generate category summaries and a daily overview.
7. Save the digest to SQLite.

After it finishes, refresh the home page to view the generated digest.

## API Routes

- `GET /api/news` fetches raw categorized news without saving it.
- `GET /api/summary` fetches news, reviews article bodies, and returns generated summaries without saving them.
- `GET /api/digest` returns the latest saved digest.
- `GET /api/digest?date=YYYY-MM-DD` returns the saved digest for a specific Taiwan date.
- `POST /api/generate-digest` creates or updates today's saved digest.

## Data Flow

```txt
fetchDailyNews()
  -> fetch GNews top headlines
  -> fetch Google News RSS
  -> fetch GNews search
  -> dedupe and keep first 20 per category

reviewAndGroupNews()
  -> open selected article URLs
  -> extract article body text
  -> ask Gemini to group articles into topics
  -> generate topic titles and topic summaries

summarizeAllNews()
  -> generate category summaries
  -> generate daily overview

saveDailyDigest()
  -> upsert the digest into SQLite
```

## Project Structure

- `app/` contains the Next.js pages and API routes.
- `components/DigestPage.tsx` renders the digest UI.
- `lib/news.ts` fetches, logs, deduplicates, and limits candidate news articles.
- `lib/summarize.ts` extracts article text, reviews articles with Gemini, groups topics, and creates summaries.
- `lib/digest.ts` reads and writes daily digests.
- `lib/prisma.ts` configures the Prisma client and SQLite adapter.
- `lib/types.ts` defines the shared news and digest data shapes.
- `prisma/schema.prisma` defines the `DailyDigest` model.

## Database

The app stores generated digests in the `DailyDigest` table. Each record includes the digest date, overall summary, category summaries, and reviewed topic JSON used to render article details.

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
