import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ns-ars.ru"),
  title: {
    default: "Дом детской фотографии — NS-ARS",
    template: "%s",
  },
  description:
    "Авторские детские фотопроекты, собранные вокруг характера и собственной истории ребёнка.",
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
