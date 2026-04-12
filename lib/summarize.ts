import { GoogleGenAI } from "@google/genai";
import { CategorizedNews, CategoryKey, NewsItem } from "./types";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY in environment variables.");
}

const ai = new GoogleGenAI({ apiKey });

const MODEL = "gemini-2.5-flash";

const categoryLabels: Record<CategoryKey, string> = {
  nation: "台灣政治／社會",
  sports: "體育",
  business: "財經",
  technology: "科技",
};

function buildCategoryPrompt(category: CategoryKey, articles: NewsItem[]) {
  const label = categoryLabels[category];

  const articleText = articles
    .slice(0, 8)
    .map((article, index) => {
      return `${index + 1}. 標題：${article.title}
簡介：${article.description || "無"}
來源：${article.source}`;
    })
    .join("\n\n");

  return `
你是一位專業新聞編輯。請根據以下 ${label} 類別新聞，
用繁體中文整理成一段「今日${label}摘要」。

要求：
1. 語氣客觀、中立、簡潔
2. 不要編造新聞中沒有提到的資訊
3. 控制在 120 到 180 字
4. 優先整合共同主題，不要逐條重述
5. 不要使用條列式，請寫成一段自然摘要

新聞資料如下：
${articleText}
`;
}

async function summarizeCategory(
  category: CategoryKey,
  articles: NewsItem[]
): Promise<string> {
  if (articles.length === 0) {
    return "今天此分類暫無可用新聞資料。";
  }

  const prompt = buildCategoryPrompt(category, articles);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return response.text?.trim() || "摘要生成失敗。";
}

export async function summarizeAllNews(news: CategorizedNews) {
  const categories = Object.keys(news) as CategoryKey[];
  const summaries = {} as Record<CategoryKey, string>;

  for (const category of categories) {
    console.log(`Summarizing category: ${category} with ${news[category].length} articles...`);
    summaries[category] = await summarizeCategory(category, news[category]);
  }

  const combinedInput = categories
    .map((category) => {
      return `${categoryLabels[category]}摘要：\n${summaries[category]}`;
    })
    .join("\n\n");

  console.log("Generating daily summary...");
  const dailyResponse = await ai.models.generateContent({
    model: MODEL,
    contents: `
請根據以下各類新聞摘要，
用繁體中文整理成一句「今日整體新聞重點」。

要求：
1. 40 到 80 字
2. 客觀、中立
3. 能概括今天整體局勢
4. 不要用條列式

${combinedInput}
`,
  });

  const dailySummary = dailyResponse.text?.trim() || "今日整體摘要生成失敗。";

  return {
    summaries,
    dailySummary,
  };
}