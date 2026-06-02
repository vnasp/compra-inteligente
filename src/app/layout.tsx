import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const interSerif = Inter({
  variable: "--font-inter-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Pantry — Compra Inteligente",
  description:
    "Gestiona tu despensa y optimiza tus compras con inteligencia artificial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interSerif.variable} ${interSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
