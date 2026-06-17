import { NextResponse } from "next/server";
import { fetchDailyNews } from "@/lib/news";
import { reviewAndGroupNews, summarizeAllNews } from "@/lib/summarize";
import { saveDailyDigest } from "@/lib/digest";

function getTaiwanDateString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

export async function POST() {
  try {
    const digestDate = getTaiwanDateString();

    const news = await fetchDailyNews();
    const reviewedNews = await reviewAndGroupNews(news);
    const { summaries, dailySummary } = await summarizeAllNews(reviewedNews);

    const saved = await saveDailyDigest({
      digestDate,
      dailySummary,
      summaries,
      news: reviewedNews,
    });

    return NextResponse.json({
      success: true,
      digestDate,
      id: saved.id,
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
