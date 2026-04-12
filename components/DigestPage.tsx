"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [digest, setDigest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  async function fetchDigest() {
    setLoading(true);
    const res = await fetch(`/api/digest?date=${today}`, {
      cache: "no-store",
    });

    if (res.status === 404) {
      setDigest(null);
      setLoading(false);
      return;
    }

    const data = await res.json();
    setDigest(data.digest);
    setLoading(false);
  }

  useEffect(() => {
    fetchDigest();
  }, []);

  // 🔹 summary mapping
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
        {/* 🔝 HERO */}
        <section className="mb-10">
          <h1 className="text-5xl font-bold tracking-tight">
            今日新聞摘要
          </h1>
        
          <p className="mt-3 text-zinc-400">
            {today}
          </p>
        
          <p className="mt-4 text-sm text-zinc-500">
            每日自動更新
          </p>
        </section>

        {/* 🧊 空狀態 */}
        {!loading && !digest && (
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center">
            <h2 className="text-2xl font-semibold">
              今日摘要尚未生成
            </h2>
            <p className="mt-3 text-zinc-400">
              系統將於每日固定時間自動更新新聞摘要，請稍後再回來查看。
            </p>
          </div>
        )}

        {/* ⏳ Loading */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl bg-zinc-900"
              />
            ))}
          </div>
        )}

        {/* 🔥 內容 */}
        {digest && (
          <>
            {/* 本日總覽 */}
            <section className="mb-10 rounded-3xl bg-zinc-900 p-8">
              <h2 className="mb-4 text-xl text-zinc-400">
                本日總覽
              </h2>
              <p className="text-lg leading-8">
                {digest.dailySummary}
              </p>
            </section>

            {/* 📦 分類卡 */}
            <div className="grid gap-6 md:grid-cols-2">
              {Object.entries(summaries!).map(([key, summary]) => (
                <div
                  key={key}
                  className="cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-white"
                  onClick={() =>
                    setOpenCategory(
                      openCategory === key ? null : key
                    )
                  }
                >
                  <h3 className="mb-3 text-2xl font-bold">
                    {categoryTitles[key]}
                  </h3>

                  <p className="text-zinc-300 line-clamp-3">
                    {summary as string}
                  </p>

                  {/* 展開 */}
                  {openCategory === key && (
                    <div className="mt-6 space-y-4">
                      {digest.rawNewsJson[key]
                        .slice(0, 5)
                        .map((a: any, i: number) => (
                          <div
                            key={i}
                            className="rounded-xl bg-black p-4"
                          >
                            <h4 className="font-semibold">
                              {a.title}
                            </h4>
                            <p className="mt-2 text-sm text-zinc-400">
                              {a.description}
                            </p>
                            <a
                              href={a.url}
                              target="_blank"
                              className="mt-2 block text-blue-400 text-sm"
                            >
                              查看原文
                            </a>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}