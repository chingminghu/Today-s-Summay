async function getDigestData() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL;

  const res = await fetch(`${baseUrl}/api/digest`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch digest data");
  }

  return res.json();
}

const categoryTitles: Record<string, string> = {
  general: "政治 / 綜合",
  sports: "體育",
  business: "財經",
  technology: "科技",
};

export default async function HomePage() {
  const data = await getDigestData();
  const digest = data.digest;
  const news = digest.rawNewsJson;

  const summaries = {
    general: digest.generalSummary,
    sports: digest.sportsSummary,
    business: digest.businessSummary,
    technology: digest.technologySummary,
  };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: 12 }}>
        今日新聞摘要
      </h1>

      <p style={{ color: "#666", marginBottom: 24 }}>
        摘要日期：{digest.digestDate}
      </p>

      <section
        style={{
          background: "#f5f7fb",
          borderRadius: 16,
          padding: 20,
          marginBottom: 32,
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: "22px", marginBottom: 12 }}>本日總覽</h2>
        <p style={{ lineHeight: 1.8 }}>{digest.dailySummary}</p>
      </section>

      {Object.entries(summaries).map(([category, summary]) => {
        const articles = news[category] || [];

        return (
          <section key={category} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: "24px", marginBottom: 12 }}>
              {categoryTitles[category] ?? category}
            </h2>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <p style={{ lineHeight: 1.8 }}>{String(summary)}</p>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {articles.slice(0, 5).map((article: any, index: number) => (
                <article
                  key={`${article.url}-${index}`}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <h3 style={{ marginBottom: 8 }}>{article.title}</h3>
                  <p style={{ marginBottom: 8 }}>{article.description}</p>
                  <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                    來源：{article.source}
                  </p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563eb" }}
                  >
                    查看原文
                  </a>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}