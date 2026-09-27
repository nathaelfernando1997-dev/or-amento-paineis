import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orçamento de Painéis",
  description: "Orçamento de painéis (paredes + lajes) e parte cinza.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
