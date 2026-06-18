"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type CategoryKey = "nation" | "sports" | "business" | "technology";

type Article = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: CategoryKey;
};

type NewsTopic = {
  id: string;
  title: string;
  summary: string;
  articles: Article[];
};

type RawNewsJson = Record<CategoryKey, NewsTopic[] | Article[]>;

type Digest = {
  id: string;
  digestDate: string;
  dailySummary: string;
  nationSummary: string;
  sportsSummary: string;
  businessSummary: string;
  technologySummary: string;
  rawNewsJson: RawNewsJson;
  createdAt: string;
  updatedAt: string;
};

const categories: CategoryKey[] = ["nation", "sports", "business", "technology"];

const categoryTitles: Record<CategoryKey, string> = {
  nation: "台灣要聞",
  sports: "體育",
  business: "財經",
  technology: "科技",
};

const categoryDescriptions: Record<CategoryKey, string> = {
  nation: "政治、社會、民生與公共議題",
  sports: "賽事、選手動態與運動產業",
  business: "市場、產業、公司與經濟政策",
  technology: "AI、半導體、產品與科技產業",
};

const categoryAccent: Record<CategoryKey, string> = {
  nation: "from-sky-500/20 to-cyan-500/10",
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

function isTopicList(items: NewsTopic[] | Article[] | undefined): items is NewsTopic[] {
  return Array.isArray(items) && items.some((item) => "articles" in item);
}

function normalizeTopics(category: CategoryKey, rawNewsJson: RawNewsJson): NewsTopic[] {
  const items = rawNewsJson[category] || [];

  if (isTopicList(items)) {
    return items;
  }

  return (items as Article[]).map((article, index) => ({
    id: `${category}-${index + 1}`,
    title: article.title,
    summary: article.description || article.title,
    articles: [article],
  }));
}

function countArticles(topics: NewsTopic[]) {
  return topics.reduce((total, topic) => total + topic.articles.length, 0);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-white/10 px-1.5 py-0.5 text-[0.92em] text-zinc-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function MarkdownText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = text.trim().split(/\n{2,}/).filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));

        if (bulletLines.length === lines.length && lines.length > 0) {
          return (
            <ul key={blockIndex} className="my-2 list-disc space-y-2 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex} className={blockIndex > 0 ? "mt-4" : undefined}>
            {renderInlineMarkdown(lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}

export default function DigestPage() {
  const today = useMemo(() => getTaiwanDateString(), []);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>("nation");
  const [error, setError] = useState("");

  const fetchDigest = useCallback(async () => {
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
        throw new Error("讀取摘要失敗。");
      }

      const data = await res.json();
      setDigest(data.digest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤。");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const summaries = digest
    ? {
        nation: digest.nationSummary,
        sports: digest.sportsSummary,
        business: digest.businessSummary,
        technology: digest.technologySummary,
      }
    : null;

  const topicGroups = useMemo(() => {
    if (!digest) return null;

    return categories.reduce(
      (acc, category) => {
        acc[category] = normalizeTopics(category, digest.rawNewsJson);
        return acc;
      },
      {} as Record<CategoryKey, NewsTopic[]>
    );
  }, [digest]);

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
                以台灣新聞為主，整理每日重點、事件脈絡與相關來源。
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
        ) : !digest || !summaries || !topicGroups ? (
          <section className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-12 text-center backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl">
              +
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-white">
              今天還沒有摘要
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              產生今日摘要後，這裡會顯示各分類重點與整理後的小主題。
            </p>
          </section>
        ) : (
          <>
            <section className="relative mx-auto mb-10 max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white/8 p-6 shadow-2xl backdrop-blur md:p-8 lg:p-10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <div className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wider text-zinc-300">
                    TODAY OVERVIEW
                  </div>
                </div>

                <h2 className="text-2xl font-semibold text-white md:text-3xl">
                  今日總覽
                </h2>

                <MarkdownText
                  text={digest.dailySummary}
                  className="mt-5 max-w-[950px] break-words text-base leading-8 text-zinc-100 [text-wrap:pretty] md:text-[17px] md:leading-9"
                />
              </div>
            </section>

            <section className="mb-10">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-white">分類摘要</h2>
                <p className="text-sm text-zinc-500">點一下卡片可展開小主題</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {categories.map((category) => {
                  const isOpen = openCategory === category;
                  const topics = topicGroups[category];

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setOpenCategory(isOpen ? null : category)}
                      className={`group relative overflow-hidden rounded-[26px] border p-6 text-left transition duration-300 ${
                        isOpen
                          ? "scale-[1.02] border-white bg-white/15 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                          : "border-white/10 bg-white/5 hover:-translate-y-1 hover:border-white/30 hover:bg-white/10"
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
                                isOpen
                                  ? "text-white"
                                  : "text-zinc-200 group-hover:text-white"
                              }`}
                            >
                              {categoryTitles[category]}
                            </h3>
                          </div>
                          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                            {topics.length} 主題 / {countArticles(topics)} 篇
                          </div>
                        </div>

                        <p className="mt-5 text-sm leading-7 text-zinc-200 md:text-base">
                          {stripMarkdown(summaries[category]).length > 80
                            ? `${stripMarkdown(summaries[category]).slice(0, 80)}...`
                            : stripMarkdown(summaries[category])}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                openCategory ? "max-h-[8000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              {openCategory && (
                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur md:p-8">
                  <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">整理後的小主題</p>
                      <h2 className="text-3xl font-bold text-white">
                        {categoryTitles[openCategory]}
                      </h2>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {topicGroups[openCategory].length} 個小主題，{countArticles(topicGroups[openCategory])} 篇新聞
                    </p>
                  </div>

                  <div className="mb-6 rounded-[22px] border border-white/10 bg-white/10 p-5 md:p-6">
                    <p className="mb-2 text-sm text-zinc-400">分類摘要</p>
                    <MarkdownText
                      text={summaries[openCategory]}
                      className="text-sm leading-8 text-zinc-100 md:text-base"
                    />
                  </div>

                  <div className="grid gap-5">
                    {topicGroups[openCategory].map((topic, index) => (
                      <article
                        key={topic.id || `${openCategory}-${index}`}
                        className="rounded-[22px] border border-white/10 bg-black/30 p-5 transition hover:border-white/20 hover:bg-black/40"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                              Topic {index + 1}
                            </p>
                            <h3 className="mt-2 text-xl font-semibold leading-8 text-white md:text-2xl">
                              {topic.title}
                            </h3>
                          </div>
                          <div className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                            {topic.articles.length} 篇來源
                          </div>
                        </div>

                        <MarkdownText
                          text={topic.summary}
                          className="mt-4 text-sm leading-7 text-zinc-200 md:text-base"
                        />

                        <div className="mt-5 grid gap-3">
                          {topic.articles.map((article, articleIndex) => (
                            <div
                              key={`${article.url}-${articleIndex}`}
                              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <h4 className="text-base font-semibold leading-7 text-white">
                                    {article.title}
                                  </h4>
                                </div>
                                <a
                                  href={article.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-sm font-medium text-blue-400 transition hover:text-blue-300"
                                >
                                  閱讀原文
                                </a>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
                                <span>來源：{article.source}</span>
                                {article.publishedAt && (
                                  <span>時間：{article.publishedAt}</span>
                                )}
                              </div>
                            </div>
                          ))}
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
