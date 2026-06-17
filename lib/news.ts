import { CategorizedNews, CategoryKey, NewsItem } from "./types";
import { getDaysAgoISO } from "./utils";

const TOP_HEADLINES_URL = "https://gnews.io/api/v4/top-headlines";
const SEARCH_URL = "https://gnews.io/api/v4/search";
const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const MIN_ARTICLES_PER_CATEGORY = 8;
const MAX_ARTICLES_PER_CATEGORY = 10;
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
    "\u53f0\u7063 OR \u653f\u6cbb OR \u793e\u6703 OR \u6c11\u751f OR \u7acb\u6cd5\u9662",
  sports:
    "\u53f0\u7063 OR \u68d2\u7403 OR \u7c43\u7403 OR \u904b\u52d5 OR \u8cfd\u4e8b",
  business:
    "\u53f0\u7063 OR \u8ca1\u7d93 OR \u80a1\u5e02 OR \u7522\u696d OR \u7d93\u6fdf",
  technology:
    "\u53f0\u7063 OR \u79d1\u6280 OR \u534a\u5c0e\u9ad4 OR AI OR \u53f0\u7a4d\u96fb",
};

const googleNewsRssQueries: Record<ActiveCategoryKey, string> = {
  nation:
    "\u53f0\u7063 \u653f\u6cbb OR \u53f0\u7063 \u793e\u6703 OR \u53f0\u7063 \u6c11\u751f",
  sports:
    "\u53f0\u7063 \u904b\u52d5 OR \u53f0\u7063 \u68d2\u7403 OR \u53f0\u7063 \u7c43\u7403",
  business:
    "\u53f0\u7063 \u8ca1\u7d93 OR \u53f0\u80a1 OR \u53f0\u7063 \u7522\u696d",
  technology:
    "\u53f0\u7063 \u79d1\u6280 OR \u53f0\u7063 \u534a\u5c0e\u9ad4 OR \u53f0\u7a4d\u96fb OR AI",
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  url.searchParams.set("max", String(MAX_ARTICLES_PER_CATEGORY));
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
  url.searchParams.set("max", String(MAX_ARTICLES_PER_CATEGORY));
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

  let articles: NewsItem[] = [];

  try {
    articles = await fetchTopHeadlines(category, apiKey);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn(`Skipping ${category} top headlines after GNews rate limit.`);
    } else {
      throw error;
    }
  }

  if (articles.length < MIN_ARTICLES_PER_CATEGORY) {
    console.log(
      `Only ${articles.length} ${category} headlines found; fetching Google News RSS fallback...`
    );

    try {
      const rssItems = await fetchGoogleNewsRss(category);
      articles = dedupeArticles([...articles, ...rssItems]);
    } catch (error) {
      console.error(`Fetch ${category} Google News RSS failed:`, error);
    }
  }

  if (articles.length < MIN_ARTICLES_PER_CATEGORY) {
    console.log(
      `Only ${articles.length} ${category} articles found; fetching GNews search fallback...`
    );

    try {
      const gnewsSearchItems = await fetchSearchFallback(category, apiKey);
      articles = dedupeArticles([...articles, ...gnewsSearchItems]);
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn(
          `Keeping ${articles.length} ${category} articles after GNews search rate limit.`
        );
      } else {
        throw error;
      }
    }
  }

  return dedupeArticles(articles).slice(0, MAX_ARTICLES_PER_CATEGORY);
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
