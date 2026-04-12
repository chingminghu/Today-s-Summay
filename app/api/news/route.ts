import { NextResponse } from "next/server";
import { fetchDailyNews } from "@/lib/news";

export async function GET() {
  try {
    const news = await fetchDailyNews();

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      news,
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