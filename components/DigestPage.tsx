"use client";

import { useEffect, useMemo, useState } from "react";

type Article = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: "general" | "sports" | "business" | "technology";
};

type Digest = {
  id: string;
  digestDate: string;
  dailySummary: string;
  generalSummary: string;
  sportsSummary: string;
  businessSummary: string;
  technologySummary: string;
  rawNewsJson: Record<string, Article[]>;
  createdAt: string;
  updatedAt: string;
};

const categoryTitles: Record<string, string> = {
  general: "政治 / 綜合",
  sports: "體育",
  business: "財經",
  technology: "科技",
};

function getTaiwanDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function DigestPage() {
  const today = useMemo(() => getTaiwanDateString(), []);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  async function fetchTodayDigest() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/digest?date=${today}`, {
        cache: "no-store",
      });

      if (res.status === 404) {
        setDigest(null);
        return;
      }

      if (!res.ok) {
        throw new Error("讀取摘要失敗");
      }

      const data = await res.json();
      setDigest(data.digest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTodayDigest();
  }, [today]);

  async function handleGenerate() {
    setGenerating(true);
    setProgress(10);
    setStatusText("開始生成今日摘要...");
    setError("");

    const fakeProgressSteps = [
      { value: 25, text: "正在抓取今日新聞..." },
      { value: 45, text: "正在整理新聞分類..." },
      { value: 70, text: "正在生成各分類摘要..." },
      { value: 90, text: "正在寫入資料庫..." },
    ];

    let stepIndex = 0;

    const timer = setInterval(() => {
      if (stepIndex < fakeProgressSteps.length) {
        setProgress(fakeProgressSteps[stepIndex].value);
        setStatusText(fakeProgressSteps[stepIndex].text);
        stepIndex += 1;
      }
    }, 1200);

    try {
      const res = await fetch("/api/generate-digest", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("生成失敗");
      }

      setProgress(100);
      setStatusText("生成完成，正在更新畫面...");
      await fetchTodayDigest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失敗");
    } finally {
      clearInterval(timer);
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
        setStatusText("");
      }, 600);
    }
  }

  const summaries = digest
    ? {
        general: digest.generalSummary,
        sports: digest.sportsSummary,
        business: digest.businessSummary,
        technology: digest.technologySummary,
      }
    : null;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">今日新聞摘要</h1>
            <p className="mt-3 text-lg text-zinc-400">摘要日期：{today}</p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {generating ? "生成中..." : digest ? "重新生成今日摘要" : "生成今日摘要"}
          </button>
        </div>

        {generating && (
          <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">生成進度</h2>
              <span className="text-sm text-zinc-400">{progress}%</span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-3 text-sm text-zinc-300">{statusText}</p>
          </section>
        )}

        {error && (
          <section className="mb-8 rounded-2xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            {error}
          </section>
        )}

        {loading ? (
          <section className="space-y-4">
            <div className="h-32 animate-pulse rounded-3xl bg-zinc-900" />
            <div className="h-56 animate-pulse rounded-3xl bg-zinc-900" />
            <div className="h-56 animate-pulse rounded-3xl bg-zinc-900" />
          </section>
        ) : !digest ? (
          <section className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-950 p-10 text-center">
            <h2 className="text-2xl font-semibold">今天的摘要尚未生成</h2>
            <p className="mt-3 text-zinc-400">
              目前資料庫裡還沒有今天的新聞摘要，按右上角按鈕即可立即生成。
            </p>
          </section>
        ) : (
          <>
            <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-zinc-400">
                本日總覽
              </p>
              <p className="text-lg leading-8 text-zinc-100">{digest.dailySummary}</p>
            </section>

            <div className="grid gap-8">
              {Object.entries(summaries!).map(([category, summary]) => {
                const articles = digest.rawNewsJson[category] || [];

                return (
                  <section
                    key={category}
                    className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
                  >
                    <h2 className="mb-4 text-3xl font-bold">
                      {categoryTitles[category] ?? category}
                    </h2>

                    <div className="mb-6 rounded-2xl bg-zinc-900 p-5">
                      <p className="leading-8 text-zinc-100">{String(summary)}</p>
                    </div>

                    <div className="grid gap-4">
                      {articles.slice(0, 5).map((article, index) => (
                        <article
                          key={`${article.url}-${index}`}
                          className="rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-600"
                        >
                          <h3 className="mb-3 text-xl font-semibold leading-8 text-white">
                            {article.title}
                          </h3>

                          <p className="mb-4 leading-7 text-zinc-300">
                            {article.description || "無摘要"}
                          </p>

                          <p className="mb-4 text-sm text-zinc-500">
                            來源：{article.source}
                          </p>

                          <a
                            href={article.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300"
                          >
                            查看原文
                          </a>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}