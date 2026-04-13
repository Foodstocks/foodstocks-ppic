import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Foodstocks WMS — Purchasing Control",
  description: "Dashboard kontrol pembelian, stok, COGS, dan supplier untuk Foodstocks",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <body style={{ minHeight: '100vh' }} suppressHydrationWarning>
        <ThemeProvider>
          <Navigation />
          <main className="md:ml-[220px]">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
