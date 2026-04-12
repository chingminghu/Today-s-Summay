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

const categoryDescriptions: Record<string, string> = {
  general: "國際局勢、政策與公共議題",
  sports: "重要賽事、戰績與球員動態",
  business: "市場、企業與經濟焦點",
  technology: "AI、產品與科技發展",
};

const categoryAccent: Record<string, string> = {
  general: "from-blue-500/20 to-cyan-500/10",
  sports: "from-emerald-500/20 to-lime-500/10",
  business: "from-amber-500/20 to-orange-500/10",
  technology: "from-fuchsia-500/20 to-violet-500/10",
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
  const [openCategory, setOpenCategory] = useState<string | null>("general");
  const [error, setError] = useState("");

  async function fetchDigest() {
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
    fetchDigest();
  }, [today]);

  const summaries = digest
    ? {
        general: digest.generalSummary,
        sports: digest.sportsSummary,
        business: digest.businessSummary,
        technology: digest.technologySummary,
      }
    : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#18181b_0%,_#09090b_45%,_#000000_100%)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-8 lg:px-10">
        <section className="mb-10">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 backdrop-blur">
            Daily News Digest
          </div>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
                今日新聞摘要
              </h1>
              <p className="mt-3 text-base text-zinc-400 md:text-lg">
                每日自動整理政治、體育、財經與科技重點
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
              <p className="text-sm text-zinc-400">摘要日期</p>
              <p className="mt-1 text-xl font-semibold text-white">{today}</p>
            </div>
          </div>
        </section>

        {error && (
          <section className="mb-8 rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-red-100">
            {error}
          </section>
        )}

        {loading ? (
          <section className="space-y-8">
            <div className="h-48 animate-pulse rounded-[28px] border border-white/10 bg-white/5" />
            <div className="grid gap-6 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-[24px] border border-white/10 bg-white/5"
                />
              ))}
            </div>
          </section>
        ) : !digest ? (
          <section className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-12 text-center backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl">
              📰
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-white">
              今日摘要尚未生成
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              系統目前尚未建立今天的摘要資料，等排程跑完後，這裡就會自動顯示最新內容。
            </p>
          </section>
        ) : (
          <>
            <section className="relative mb-10 overflow-hidden rounded-[32px] border border-white/10 bg-white/8 p-8 shadow-2xl backdrop-blur md:p-10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <div className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wider text-zinc-300">
                    TODAY OVERVIEW
                  </div>
                </div>

                <h2 className="text-2xl font-semibold text-white md:text-3xl">
                  本日總覽
                </h2>

                <p className="mt-5 max-w-4xl text-base leading-8 text-zinc-100 md:text-lg">
                  {digest.dailySummary}
                </p>
              </div>
            </section>

            <section className="mb-10">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">分類摘要</h2>
                <p className="text-sm text-zinc-500">點一下卡片可展開新聞列表</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {Object.entries(summaries!).map(([category, summary]) => {
                  const isOpen = openCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setOpenCategory(isOpen ? null : category)}
                      className={`group relative overflow-hidden rounded-[26px] border p-6 text-left transition duration-300 ${
                        isOpen
                          ? "border-white bg-white/15 shadow-[0_0_30px_rgba(255,255,255,0.15)] scale-[1.02]"
                          : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 hover:-translate-y-1"
                      }`}
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${categoryAccent[category]} ${
                          isOpen ? "opacity-100" : "opacity-60"
                        } transition`}
                      />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-400">
                              {categoryDescriptions[category]}
                            </p>
                            <h3
                              className={`mt-2 text-2xl font-bold ${
                                isOpen ? "text-white" : "text-zinc-200 group-hover:text-white"
                              }`}
                            >
                              {categoryTitles[category]}
                            </h3>
                          </div>
                        </div>

                        <p className="mt-5 text-sm leading-7 text-zinc-200 md:text-base">
                          {String(summary).length > 80
                            ? `${String(summary).slice(0, 80)}...`
                            : String(summary)}
                        </p>

                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition group-hover:text-white">
                          <span>{isOpen ? "點擊收合內容" : "點擊查看完整摘要"}</span>
                          <span
                            className={`transition-transform duration-300 ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          >
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                openCategory ? "max-h-[4000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              {openCategory && (
                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur md:p-8">
                  <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">詳細內容</p>
                      <h2 className="text-3xl font-bold text-white">
                        {categoryTitles[openCategory]}
                      </h2>
                    </div>
                    <p className="text-sm text-zinc-500">完整摘要與前 5 則重點新聞</p>
                  </div>
            
                  <div className="mb-6 rounded-[22px] border border-white/10 bg-white/10 p-5 md:p-6">
                    <p className="mb-2 text-sm text-zinc-400">完整摘要</p>
                    <p className="text-sm leading-8 text-zinc-100 md:text-base">
                      {summaries?.[openCategory as keyof typeof summaries]}
                    </p>
                  </div>
            
                  <div className="grid gap-5">
                    {(digest.rawNewsJson[openCategory] || [])
                      .slice(0, 5)
                      .map((article: Article, index: number) => (
                        <article
                          key={`${article.url}-${index}`}
                          className="group rounded-[22px] border border-white/10 bg-black/30 p-5 transition hover:border-white/20 hover:bg-black/40"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-lg font-semibold leading-8 text-white md:text-xl">
                              {article.title}
                            </h3>
                            <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 md:block">
                              #{index + 1}
                            </div>
                          </div>
            
                          <p className="mt-3 text-sm leading-7 text-zinc-300 md:text-base">
                            {article.description || "無摘要"}
                          </p>
            
                          <div className="mt-5 flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
                            <span className="text-zinc-500">來源：{article.source}</span>
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 font-medium text-blue-400 transition hover:text-blue-300"
                            >
                              查看原文
                              <span aria-hidden="true">↗</span>
                            </a>
                          </div>
                        </article>
                      ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}