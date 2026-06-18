import { GoogleGenAI } from "@google/genai";
import { JSDOM } from "jsdom";
import { categoryLabels, sleep } from "./utils";
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
const ARTICLE_FETCH_TIMEOUT_MS = Number.parseInt(
  process.env.ARTICLE_FETCH_TIMEOUT_MS ?? "12000",
  10
);
const ARTICLE_TEXT_MAX_CHARS = Number.parseInt(
  process.env.ARTICLE_TEXT_MAX_CHARS ?? "6000",
  10
);
const TOPIC_ARTICLE_TEXT_TOTAL_MAX_CHARS = Number.parseInt(
  process.env.TOPIC_ARTICLE_TEXT_TOTAL_MAX_CHARS ?? "16000",
  10
);

type GeminiErrorLike = {
  status?: number;
  message?: string;
};

type ReviewTopicOutput = {
  title?: string;
  summary?: string;
  articles?: {
    index?: number;
    summary?: string;
  }[];
};

type ReviewOutput = {
  topics?: ReviewTopicOutput[];
};

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

      return response.text?.trim() || "未取得摘要。";
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

  return "未取得摘要。";
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractArticleText(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  document
    .querySelectorAll("script, style, noscript, svg, iframe, header, footer, nav, aside")
    .forEach((element) => element.remove());

  const metaDescription =
    document
      .querySelector('meta[property="og:description"], meta[name="description"]')
      ?.getAttribute("content") ?? "";
  const containers = Array.from(
    document.querySelectorAll("article, main, [role='main'], .article, .post, .content")
  );
  const sourceElements = containers.length > 0 ? containers : [document.body];
  const paragraphText = sourceElements
    .flatMap((element) => Array.from(element.querySelectorAll("p")))
    .map((paragraph) => normalizeWhitespace(paragraph.textContent ?? ""))
    .filter((text) => text.length >= 20)
    .join("\n");

  return normalizeWhitespace([metaDescription, paragraphText].filter(Boolean).join("\n\n"))
    .slice(0, ARTICLE_TEXT_MAX_CHARS);
}

async function fetchArticleContent(url: string): Promise<{
  finalUrl: string;
  text: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; TodaySummaryBot/1.0; +https://localhost)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Article fetch failed: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error(`Unsupported article content type: ${contentType || "unknown"}`);
    }

    const html = await response.text();

    return {
      finalUrl: response.url || url,
      text: extractArticleText(html),
    };
  } finally {
    clearTimeout(timeout);
  }
}

type TopicArticleContent = {
  article: ReviewedNewsItem;
  text: string;
};

function buildTopicSummaryPrompt(
  topic: NewsTopic,
  articleContents: TopicArticleContent[]
): string {
  let usedChars = 0;
  const articleTextParts: string[] = [];

  for (const { article, text } of articleContents) {
    const remaining = TOPIC_ARTICLE_TEXT_TOTAL_MAX_CHARS - usedChars;
    if (remaining <= 0) break;

    const trimmedText = text.slice(0, remaining);
    usedChars += trimmedText.length;

    articleTextParts.push(`${articleTextParts.length + 1}. ${article.title}
Source: ${article.source}
Published at: ${article.publishedAt || "Unknown"}
URL: ${article.url}
Original description: ${article.description || "None"}
Article text:
${trimmedText}`);
  }

  const articleText = articleTextParts.join("\n\n---\n\n");

  return `
You are writing the summary for one grouped news topic in a Taiwan daily digest.

Read the article text below and rewrite the topic summary in Traditional Chinese.

Requirements:
1. Synthesize the shared event across the articles instead of listing each article.
2. Use only facts supported by the article text or provided metadata.
3. Keep it under 100 Chinese characters.
4. Neutral, concise, news-editor tone.
5. You may use light Markdown, especially **bold** for important names or numbers.
6. Output only the summary, no title.

Current topic title: ${topic.title}
Current topic summary: ${topic.summary}

Articles:
${articleText}
`;
}

async function summarizeTopicFromArticleBodies(topic: NewsTopic): Promise<NewsTopic> {
  const articleContents: TopicArticleContent[] = [];
  const articles: ReviewedNewsItem[] = [];

  for (const article of topic.articles) {
    try {
      console.log(`Fetching article body for topic summary: ${article.title}`);
      const { finalUrl, text } = await fetchArticleContent(article.url);
      const updatedArticle = {
        ...article,
        url: finalUrl,
      };

      articles.push(updatedArticle);

      if (text) {
        articleContents.push({
          article: updatedArticle,
          text,
        });
      }
    } catch (error) {
      console.error(`Fetch article body failed: ${article.url}`, error);
      articles.push(article);
    }
  }

  if (articleContents.length === 0) {
    return {
      ...topic,
      articles,
    };
  }

  try {
    const summary = await generateTextWithRetry(
      buildTopicSummaryPrompt(
        {
          ...topic,
          articles,
        },
        articleContents
      ),
      `${topic.id} topic body summary`
    );

    return {
      ...topic,
      summary: summary || topic.summary,
      articles,
    };
  } catch (error) {
    console.error(`Summarize topic from article bodies failed: ${topic.id}`, error);

    return {
      ...topic,
      articles,
    };
  }
}

async function summarizeTopicsFromArticleBodies(topics: NewsTopic[]): Promise<NewsTopic[]> {
  const summarizedTopics: NewsTopic[] = [];

  for (const topic of topics) {
    summarizedTopics.push(await summarizeTopicFromArticleBodies(topic));
  }

  return summarizedTopics;
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

    return summarizeTopicsFromArticleBodies(normalizeReviewOutput(category, articles, output));
  } catch (error) {
    console.error(`Review category failed: ${category}`, error);
    return summarizeTopicsFromArticleBodies(fallbackReviewCategory(category, articles));
  }
}

export async function reviewAndGroupNews(
  news: CategorizedNews
): Promise<ReviewedCategorizedNews> {
  const result: ReviewedCategorizedNews = {};
  const categories = Object.keys(news) as CategoryKey[];

  for (const category of categories) {
    result[category] = await reviewCategoryNews(category, news[category] ?? []);
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
    return "今天此分類暫無可用新聞資料。";
  }

  try {
    return await generateTextWithRetry(
      buildCategorySummaryPrompt(category, topics),
      `${category} summary`
    );
  } catch (error) {
    console.error(`Summarize category failed: ${category}`, error);
    return "此分類摘要目前無法產生，請稍後再試。";
  }
}

export async function summarizeAllNews(news: ReviewedCategorizedNews) {
  const categories = Object.keys(news) as CategoryKey[];
  const summaries: Partial<Record<CategoryKey, string>> = {};

  for (const category of categories) {
    const topics = news[category] ?? [];
    console.log(`Summarizing category: ${category} with ${topics.length} topics...`);
    summaries[category] = await summarizeCategory(category, topics);
  }

  const combinedInput = categories
    .map((category) => {
      return `${categoryLabels[category]}摘要：\n${summaries[category] ?? ""}`;
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
        "今日摘要已整理各分類重點，但整體新聞重點目前無法產生。",
    };
  }
}
