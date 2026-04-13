import {CategoryKey} from "./types";

export const categoryLabels: Record<CategoryKey, string> = {
    nation: "台灣",
    world: "國際",
    sports: "體育",
    business: "財經",
    technology: "科技",
    entertainment: "娛樂"
};

export function getHoursDiffFromNow(dateString: string): number {
    const targetDate = new Date(dateString);
    const now = new Date();

    const diffInMs = now.getTime() - targetDate.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    return parseFloat(diffInHours.toFixed(1));
}

export function getDaysAgoISO(days: number = 1): string {
  const now = new Date();
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return past.toISOString(); // e.g. 2026-04-11T10:00:00Z
}