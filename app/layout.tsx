import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "TempoFlow — Dashboard",
  description: "Master your time.",
  other: { "color-scheme": "light" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.className} antialiased`} style={{ background: "var(--bg)", color: "var(--ink)" }}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
