import { prisma } from "./prisma";
import { CategorizedNews, CategoryKey } from "./types";

type SaveDigestInput = {
  digestDate: string;
  dailySummary: string;
  summaries: Record<CategoryKey, string>;
  news: CategorizedNews;
};

export async function saveDailyDigest(input: SaveDigestInput) {
  const {
    digestDate,
    dailySummary,
    summaries,
    news,
  } = input;

  return prisma.dailyDigest.upsert({
    where: { digestDate },
    update: {
      dailySummary,
      generalSummary: summaries.general,
      sportsSummary: summaries.sports,
      businessSummary: summaries.business,
      technologySummary: summaries.technology,
      rawNewsJson: JSON.stringify(news),
    },
    create: {
      digestDate,
      dailySummary,
      generalSummary: summaries.general,
      sportsSummary: summaries.sports,
      businessSummary: summaries.business,
      technologySummary: summaries.technology,
      rawNewsJson: JSON.stringify(news),
    },
  });
}

export async function getLatestDigest() {
  return prisma.dailyDigest.findFirst({
    orderBy: {
      digestDate: "desc",
    },
  });
}

export async function getDigestByDate(digestDate: string) {
  return prisma.dailyDigest.findUnique({
    where: { digestDate },
  });
}