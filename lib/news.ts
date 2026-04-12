import { CategorizedNews, CategoryKey, NewsItem } from "./types";

const BASE_URL = "https://gnews.io/api/v4/top-headlines";

const categories: CategoryKey[] = ["nation", "sports", "business", "technology"];

function normalizeArticle(article: any, category: CategoryKey): NewsItem | null {
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

async function fetchCategoryNews(category: CategoryKey): Promise<NewsItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GNEWS_API_KEY in environment variables.");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("country", "tw");
  url.searchParams.set("lang", "zh");
  url.searchParams.set("category", category);
  url.searchParams.set("max", "10");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GNews request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const articles = Array.isArray(data.articles) ? data.articles : [];

  return articles
    .map((article: any) => normalizeArticle(article, category))
    .filter(Boolean) as NewsItem[];
}

export async function fetchDailyNews(): Promise<CategorizedNews> {
  const result: CategorizedNews = {
    nation: [],
    sports: [],
    business: [],
    technology: [],
  };

  for (const category of categories) {
    try {
      const items = await fetchCategoryNews(category);

      result[category] = items;

      // 🔥 關鍵：加延遲
      await new Promise((res) => setTimeout(res, 1500));
    } catch (err) {
      console.error("Fetch category failed:", err);
    }
  }

  return result;
}