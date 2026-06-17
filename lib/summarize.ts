import { GoogleGenAI } from "@google/genai";
import {
  CategorizedNews,
  CategoryKey,
  NewsItem,
  NewsTopic,
  ReviewedCategorizedNews,
  ReviewedNewsItem,
} from "./types";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY in environment variables.");
}

const ai = new GoogleGenAI({ apiKey });

const MODEL = "gemini-2.5-flash-lite";
const REQUEST_DELAY_MS = Number.parseInt(
  process.env.GEMINI_REQUEST_DELAY_MS ?? "2000",
  10
);
const RETRY_DELAYS_MS = [3000, 8000, 15000];

const categoryLabels: Record<CategoryKey, string> = {
  nation: "台灣政治／社會",
  sports: "體育",
  business: "財經",
  technology: "科技",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const status = (error as GeminiErrorLike).status;
  const message = error.message.toLowerCase();

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("high demand") ||
    message.includes("unavailable") ||
    message.includes("rate limit")
  );
}

async function generateTextWithRetry(prompt: string, label: string): Promise<string> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await sleep(REQUEST_DELAY_MS);

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
      });

      return response.text?.trim() || "\u672a\u53d6\u5f97\u6458\u8981\u3002";
    } catch (error) {
      const shouldRetry =
        attempt < RETRY_DELAYS_MS.length && isRetryableGeminiError(error);

      if (!shouldRetry) {
        throw error;
      }

      const delayMs = RETRY_DELAYS_MS[attempt];
      console.warn(
        `Gemini ${label} failed with a retryable error; retrying in ${delayMs}ms...`,
        error
      );
      await sleep(delayMs);
    }
  }

  return "\u672a\u53d6\u5f97\u6458\u8981\u3002";
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return a JSON object.");
  }

  return candidate.slice(start, end + 1);
}

async function generateJsonWithRetry<T>(prompt: string, label: string): Promise<T> {
  const text = await generateTextWithRetry(prompt, label);

  return JSON.parse(extractJsonObject(text)) as T;
}

function fallbackSummary(article: NewsItem): string {
  return article.description || article.title;
}

function fallbackReviewCategory(
  category: CategoryKey,
  articles: NewsItem[]
): NewsTopic[] {
  return articles.slice(0, 8).map((article, index) => ({
    id: `${category}-${index + 1}`,
    title: article.title,
    summary: fallbackSummary(article),
    articles: [
      {
        ...article,
        aiSummary: fallbackSummary(article),
      },
    ],
  }));
}

function buildReviewPrompt(category: CategoryKey, articles: NewsItem[]): string {
  const label = categoryLabels[category];
  const articleText = articles
    .map((article, index) => {
      return [
        `Index: ${index + 1}`,
        `Title: ${article.title}`,
        `Description: ${article.description || "None"}`,
        `Source: ${article.source}`,
        `Published at: ${article.publishedAt || "Unknown"}`,
        `URL: ${article.url}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `
You are reviewing candidate news articles for the "${label}" section of a Taiwan daily news digest.

Tasks:
1. Remove low-quality, vague, spammy, stale, or off-topic articles.
2. Write a Traditional Chinese summary for each kept article. This summary will appear under the article title on the website.
3. Group articles that refer to the same underlying event into one topic.
4. When two or more articles refer to the same event, refine the topic summary using all included articles and keep all article references under that topic.
5. Prefer concrete Taiwan-relevant news. Do not invent facts not present in the article data.
6. Summaries may use light Markdown when helpful, especially **bold** for key names or numbers. Do not use headings in JSON summary fields.

Return only valid JSON in this exact shape:
{
  "topics": [
    {
      "title": "Traditional Chinese topic title, 10-24 characters",
      "summary": "Traditional Chinese topic summary, 60-120 characters, light Markdown allowed",
      "articles": [
        {
          "index": 1,
          "summary": "Traditional Chinese article summary, 40-90 characters, light Markdown allowed"
        }
      ]
    }
  ]
}

Candidate articles:
${articleText}
`;
}

function normalizeReviewOutput(
  category: CategoryKey,
  articles: NewsItem[],
  output: ReviewOutput
): NewsTopic[] {
  const usedIndexes = new Set<number>();

  const topics = (output.topics ?? [])
    .map((topic, topicIndex): NewsTopic | null => {
      const reviewedArticles = (topic.articles ?? [])
        .map((item): ReviewedNewsItem | null => {
          const articleIndex = Number(item.index) - 1;
          const article = articles[articleIndex];

          if (!article || usedIndexes.has(articleIndex)) return null;

          usedIndexes.add(articleIndex);

          return {
            ...article,
            aiSummary: String(item.summary || fallbackSummary(article)).trim(),
          };
        })
        .filter(Boolean) as ReviewedNewsItem[];

      if (reviewedArticles.length === 0) return null;

      return {
        id: `${category}-${topicIndex + 1}`,
        title: String(topic.title || reviewedArticles[0].title).trim(),
        summary: String(topic.summary || reviewedArticles[0].aiSummary).trim(),
        articles: reviewedArticles,
      };
    })
    .filter(Boolean) as NewsTopic[];

  return topics.length > 0 ? topics : fallbackReviewCategory(category, articles);
}

async function reviewCategoryNews(
  category: CategoryKey,
  articles: NewsItem[]
): Promise<NewsTopic[]> {
  if (articles.length === 0) return [];

  try {
    console.log(`Reviewing category: ${category} with ${articles.length} articles...`);
    const output = await generateJsonWithRetry<ReviewOutput>(
      buildReviewPrompt(category, articles),
      `${category} review`
    );

    return normalizeReviewOutput(category, articles, output);
  } catch (error) {
    console.error(`Review category failed: ${category}`, error);
    return fallbackReviewCategory(category, articles);
  }
}

export async function reviewAndGroupNews(
  news: CategorizedNews
): Promise<ReviewedCategorizedNews> {
  const result: ReviewedCategorizedNews = {
    nation: [],
    sports: [],
    business: [],
    technology: [],
  };

  const categories = Object.keys(news) as CategoryKey[];

  for (const category of categories) {
    result[category] = await reviewCategoryNews(category, news[category]);
  }

  return result;
}

function buildCategorySummaryPrompt(category: CategoryKey, topics: NewsTopic[]) {
  const label = categoryLabels[category];

  const topicText = topics
    .map((topic, index) => {
      const articleText = topic.articles
        .map((article) => `- ${article.source}: ${article.aiSummary}`)
        .join("\n");

      return `${index + 1}. ${topic.title}
Topic summary: ${topic.summary}
Articles:
${articleText}`;
    })
    .join("\n\n");

  return `
You are a professional news editor. Based on the reviewed "${label}" topics below, write one Traditional Chinese paragraph for the section summary.

Requirements:
1. Focus on the most important events, impact, and possible follow-up.
2. Do not invent facts not present in the topic summaries.
3. Length: 140-220 Chinese characters.
4. Neutral, concise, suitable for a daily digest.
5. You may use light Markdown when it improves readability, such as **bold** for important entities or numbers.
6. Output one concise section summary. No title.

Reviewed topics:
${topicText}
`;
}

async function summarizeCategory(
  category: CategoryKey,
  topics: NewsTopic[]
): Promise<string> {
  if (topics.length === 0) {
    return "\u4eca\u5929\u6b64\u5206\u985e\u66ab\u7121\u53ef\u7528\u65b0\u805e\u8cc7\u6599\u3002";
  }

  try {
    return await generateTextWithRetry(
      buildCategorySummaryPrompt(category, topics),
      `${category} summary`
    );
  } catch (error) {
    console.error(`Summarize category failed: ${category}`, error);
    return "\u6b64\u5206\u985e\u6458\u8981\u76ee\u524d\u7121\u6cd5\u7522\u751f\uff0c\u8acb\u7a0d\u5f8c\u518d\u8a66\u3002";
  }
}

export async function summarizeAllNews(news: ReviewedCategorizedNews) {
  const categories = Object.keys(news) as CategoryKey[];
  const summaries = {} as Record<CategoryKey, string>;

  for (const category of categories) {
    console.log(`Summarizing category: ${category} with ${news[category].length} articles...`);
    summaries[category] = await summarizeCategory(category, news[category]);
  }

  const combinedInput = categories
    .map((category) => {
      return `${categoryLabels[category]}\u6458\u8981\uff1a\n${summaries[category]}`;
    })
    .join("\n\n");

  console.log("Generating daily summary...");

  try {
    const dailySummary = await generateTextWithRetry(
      `
Based on the following section summaries, write a slightly more detailed Traditional Chinese "today overview" for the top of the page.

Requirements:
1. 120-180 Chinese characters.
2. Focus on the most important changes, shared themes, and why they matter.
3. Concise, neutral, editorial tone.
4. You may use light Markdown when it improves readability, such as **bold** for important entities, numbers, or themes.
5. No title.

${combinedInput}
`,
      "daily summary"
    );

    return {
      summaries,
      dailySummary,
    };
  } catch (error) {
    console.error("Generate daily summary failed:", error);

    return {
      summaries,
      dailySummary:
        "\u4eca\u65e5\u6458\u8981\u5df2\u6574\u7406\u5404\u5206\u985e\u91cd\u9ede\uff0c\u4f46\u6574\u9ad4\u65b0\u805e\u91cd\u9ede\u76ee\u524d\u7121\u6cd5\u7522\u751f\u3002",
    };
  }
}
