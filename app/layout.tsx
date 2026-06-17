import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "\u4eca\u65e5\u65b0\u805e\u6458\u8981",
  description: "\u53f0\u7063\u6bcf\u65e5\u65b0\u805e\u6458\u8981\u8207\u5c0f\u4e3b\u984c\u6574\u7406",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
