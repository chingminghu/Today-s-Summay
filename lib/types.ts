export type CategoryKey = "nation" | "world" | "sports" | "business" | "technology" | "entertainment";

export type NewsItem = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: CategoryKey;
};

export type CategorizedNews = Record<CategoryKey, NewsItem[]>;

export type ReviewedNewsItem = NewsItem & {
  aiSummary: string;
};

export type NewsTopic = {
  id: string;
  title: string;
  summary: string;
  articles: ReviewedNewsItem[];
};

export type ReviewedCategorizedNews = Record<CategoryKey, NewsTopic[]>;
