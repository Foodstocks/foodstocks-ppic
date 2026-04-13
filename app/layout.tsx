import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ThemeProvider from "@/components/ThemeProvider";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "Foodstocks PPIC — Purchasing Control",
  description: "Dashboard kontrol pembelian, stok, COGS, dan supplier untuk Foodstocks",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ minHeight: '100vh' }} suppressHydrationWarning>
        <ThemeProvider>
          <AuthGuard>
            <Navigation />
            <main className="md:ml-[228px] pb-16 md:pb-0">
              {children}
            </main>
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
