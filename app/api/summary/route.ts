import { NextResponse } from "next/server";
import { fetchDailyNews } from "@/lib/news";
import { reviewAndGroupNews, summarizeAllNews } from "@/lib/summarize";

export async function GET() {
  try {
    const news = await fetchDailyNews();
    const reviewedNews = await reviewAndGroupNews(news);
    const { summaries, dailySummary } = await summarizeAllNews(reviewedNews);

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      dailySummary,
      summaries,
      news: reviewedNews,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
