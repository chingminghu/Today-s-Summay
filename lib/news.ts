import { CategorizedNews, CategoryKey, NewsItem } from "./types";

const BASE_URL = "https://newsapi.org/v2/top-headlines";

const categories: CategoryKey[] = ["general", "sports", "business", "technology"];

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
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing NEWS_API_KEY in environment variables.");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("country", "us");
  url.searchParams.set("category", category);
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NewsAPI request failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  const articles = Array.isArray(data.articles) ? data.articles : [];

  return articles
    .map((article: any) => normalizeArticle(article, category))
    .filter(Boolean) as NewsItem[];
}

export async function fetchDailyNews(): Promise<CategorizedNews> {
  const result: CategorizedNews = {
    general: [],
    sports: [],
    business: [],
    technology: [],
  };

  const settled = await Promise.allSettled(
    categories.map(async (category) => {
      const items = await fetchCategoryNews(category);
      return { category, items };
    })
  );

  for (const item of settled) {
    if (item.status === "fulfilled") {
      result[item.value.category] = item.value.items;
    } else {
      console.error("Fetch category failed:", item.reason);
    }
  }

  return result;
}