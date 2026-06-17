import { CategoryKey } from "./types";

export const categoryLabels: Record<CategoryKey, string> = {
  nation: "\u53f0\u7063\u8981\u805e",
  world: "\u570b\u969b",
  sports: "\u9ad4\u80b2",
  business: "\u8ca1\u7d93",
  technology: "\u79d1\u6280",
  entertainment: "\u5a1b\u6a02",
};

export function getHoursDiffFromNow(dateString: string): number {
  const targetDate = new Date(dateString);
  const now = new Date();

  const diffInMs = now.getTime() - targetDate.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  return Number.parseFloat(diffInHours.toFixed(1));
}

export function getDaysAgoISO(days: number = 1): string {
  const now = new Date();
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return past.toISOString(); // e.g. 2026-04-11T10:00:00Z
}
