export type CategoryKey = "nation" | "world" | "sports" | "business" | "technology" | "entertainment";

export type NewsItem = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: CategoryKey;
};

export type CategorizedNews = Partial<Record<CategoryKey, NewsItem[]>>;