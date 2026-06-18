import { CategorizedNews, CategoryKey, NewsItem } from "./types";
import { getDaysAgoISO, sleep } from "./utils";

const TOP_HEADLINES_URL = "https://gnews.io/api/v4/top-headlines";
const SEARCH_URL = "https://gnews.io/api/v4/search";
const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const FINAL_ARTICLES_PER_CATEGORY = 15;
const GNEWS_ARTICLES_PER_REQUEST = Number.parseInt(
  process.env.GNEWS_ARTICLES_PER_REQUEST ?? "20",
  10
);
const GNEWS_REQUEST_DELAY_MS = Number.parseInt(
  process.env.GNEWS_REQUEST_DELAY_MS ?? "5000",
  10
);
const GNEWS_RATE_LIMIT_RETRY_DELAY_MS = Number.parseInt(
  process.env.GNEWS_RATE_LIMIT_RETRY_DELAY_MS ?? "15000",
  10
);

const categories = ["nation", "sports", "business", "technology"] as const satisfies CategoryKey[];
type ActiveCategoryKey = (typeof categories)[number];

const gnewsSearchQueries: Record<ActiveCategoryKey, string> = {
  nation:
    "台灣 OR 政治 OR 社會 OR 民生 OR 立法院",
  sports:
    "台灣 OR 棒球 OR 籃球 OR 運動 OR 賽事",
  business:
    "台灣 OR 財經 OR 股市 OR 產業 OR 經濟",
  technology:
    "台灣 OR 科技 OR 半導體 OR AI OR 台積電",
};

const googleNewsRssQueries: Record<ActiveCategoryKey, string> = {
  nation:
    "台灣 政治 OR 台灣 社會 OR 台灣 民生",
  sports:
    "台灣 運動 OR 台灣 棒球 OR 台灣 籃球",
  business:
    "台灣 財經 OR 台股 OR 台灣 產業",
  technology:
    "台灣 科技 OR 台灣 半導體 OR 台積電 OR AI",
};

type GNewsArticle = {
  title?: string;
  description?: string | null;
  url?: string;
  source?: {
    name?: string | null;
  } | null;
  publishedAt?: string | null;
};

class GNewsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "GNewsRequestError";
  }
}

let lastGNewsRequestAt = 0;

async function waitForGNewsSlot(): Promise<void> {
  const elapsed = Date.now() - lastGNewsRequestAt;
  const waitMs = GNEWS_REQUEST_DELAY_MS - elapsed;

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastGNewsRequestAt = Date.now();
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof GNewsRequestError && error.status === 429;
}

function normalizeArticle(
  article: GNewsArticle,
  category: CategoryKey
): NewsItem | null {
  if (!article?.title || !article?.url) return null;

  return {
    title: article.title,
    description: article.description ?? "",
    url: article.url,
    source: article.source?.name ?? "Unknown",
    publishedAt: article.publishedAt ?? "",
    category,
  };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getXmlTagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));

  return match ? decodeXmlEntities(match[1]).trim() : "";
}

function getRssItems(xml: string): string[] {
  return xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

async function fetchGNews(
  url: URL,
  category: CategoryKey,
  label: string
): Promise<NewsItem[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForGNewsSlot();

    console.log(`Fetching ${category} ${label} from GNews API...`);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    console.log(`GNews API response for ${category} ${label}:`, res.status);

    if (res.status === 429 && attempt === 0) {
      console.warn(
        `GNews rate limit hit for ${category} ${label}; retrying after ${GNEWS_RATE_LIMIT_RETRY_DELAY_MS}ms...`
      );
      await sleep(GNEWS_RATE_LIMIT_RETRY_DELAY_MS);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new GNewsRequestError(
        `GNews request failed: ${res.status} ${text}`,
        res.status
      );
    }

    const data = await res.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];

    return (articles as GNewsArticle[])
      .map((article) => normalizeArticle(article, category))
      .filter(Boolean) as NewsItem[];
  }

  return [];
}

function dedupeArticles(articles: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return articles.filter((article) => {
    const titleKey = normalizeTitle(article.title);

    if (seenUrls.has(article.url) || seenTitles.has(titleKey)) return false;

    seenUrls.add(article.url);
    seenTitles.add(titleKey);
    return true;
  });
}

async function fetchTopHeadlines(
  category: ActiveCategoryKey,
  apiKey: string
): Promise<NewsItem[]> {
  const url = new URL(TOP_HEADLINES_URL);
  url.searchParams.set("country", "tw");
  url.searchParams.set("lang", "zh");
  url.searchParams.set("category", category);
  url.searchParams.set("max", String(GNEWS_ARTICLES_PER_REQUEST));
  url.searchParams.set("from", getDaysAgoISO(7));
  url.searchParams.set("apikey", apiKey);

  return fetchGNews(url, category, "top headlines");
}

async function fetchGoogleNewsRss(category: ActiveCategoryKey): Promise<NewsItem[]> {
  const url = new URL(GOOGLE_NEWS_RSS_URL);
  url.searchParams.set("q", googleNewsRssQueries[category]);
  url.searchParams.set("hl", "zh-TW");
  url.searchParams.set("gl", "TW");
  url.searchParams.set("ceid", "TW:zh-Hant");

  console.log(`Fetching ${category} Google News RSS fallback...`);
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
    },
    cache: "no-store",
  });
  console.log(`Google News RSS response for ${category}:`, res.status);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google News RSS request failed: ${res.status} ${text}`);
  }

  const xml = await res.text();

  return getRssItems(xml)
    .map((item): NewsItem | null => {
      const title = stripHtml(getXmlTagValue(item, "title"));
      const url = getXmlTagValue(item, "link");

      if (!title || !url) return null;

      return {
        title,
        description: stripHtml(getXmlTagValue(item, "description")),
        url,
        source: getXmlTagValue(item, "source") || "Google News",
        publishedAt: getXmlTagValue(item, "pubDate"),
        category,
      };
    })
    .filter(Boolean) as NewsItem[];
}

async function fetchSearchFallback(
  category: ActiveCategoryKey,
  apiKey: string
): Promise<NewsItem[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", gnewsSearchQueries[category]);
  url.searchParams.set("country", "tw");
  url.searchParams.set("lang", "zh");
  url.searchParams.set("max", String(GNEWS_ARTICLES_PER_REQUEST));
  url.searchParams.set("from", getDaysAgoISO(7));
  url.searchParams.set("sortby", "publishedAt");
  url.searchParams.set("apikey", apiKey);

  return fetchGNews(url, category, "search fallback");
}

async function fetchCategoryNews(category: ActiveCategoryKey): Promise<NewsItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GNEWS_API_KEY in environment variables.");
  }

  const articles: NewsItem[] = [];

  try {
    const topHeadlines = await fetchTopHeadlines(category, apiKey);
    console.log(`${category} top headlines fetched: ${topHeadlines.length}`);
    articles.push(...topHeadlines);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn(`Skipping ${category} top headlines after GNews rate limit.`);
    } else {
      throw error;
    }
  }

  try {
    const rssItems = await fetchGoogleNewsRss(category);
    console.log(`${category} Google News RSS fetched: ${rssItems.length}`);
    articles.push(...rssItems);
  } catch (error) {
    console.error(`Fetch ${category} Google News RSS failed:`, error);
  }

  try {
    const gnewsSearchItems = await fetchSearchFallback(category, apiKey);
    console.log(`${category} GNews search fetched: ${gnewsSearchItems.length}`);
    articles.push(...gnewsSearchItems);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn(
        `Keeping ${articles.length} ${category} articles after GNews search rate limit.`
      );
    } else {
      throw error;
    }
  }

  const dedupedArticles = dedupeArticles(articles);
  console.log(
    `${category} total unique articles fetched: ${dedupedArticles.length}; using first ${FINAL_ARTICLES_PER_CATEGORY}.`
  );

  return dedupedArticles.slice(0, FINAL_ARTICLES_PER_CATEGORY);
}

export async function fetchDailyNews(): Promise<CategorizedNews> {
  const result: CategorizedNews = {};

  for (const category of categories) {
    try {
      const items = await fetchCategoryNews(category);

      result[category] = items;
    } catch (err) {
      console.error("Fetch category failed:", err);
    }
  }

  return result;
}
