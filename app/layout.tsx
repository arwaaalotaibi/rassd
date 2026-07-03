import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "رصد — المصحف الإلكتروني",
  description:
    "مصحف إلكتروني برواية حفص عن عاصم لرصد أخطاء الحفظ ومتابعتها عبر الزمن",
  appleWebApp: {
    capable: true,
    title: "رصد",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d4534",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className={`${cairo.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
