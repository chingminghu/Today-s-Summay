export type CategoryKey = "nation" | "sports" | "business" | "technology";

export type NewsItem = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: CategoryKey;
};

export type CategorizedNews = Record<CategoryKey, NewsItem[]>;