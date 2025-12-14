import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://zennybooks.com"),
  title: {
    default: "Zenny - AI Bookkeeper for Freelancers",
    template: "%s | Zenny",
  },
  description:
    "Bookkeeping on autopilot: AI receipt capture, smart categorization, review queue, and tax-ready exports for freelancers and small businesses.",
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://zennybooks.com",
  },
  openGraph: {
    title: "Zenny - Bookkeeping on Autopilot",
    description:
      "AI receipt capture, smart categorization, review queue, and tax-ready exports — built for freelancers and small businesses.",
    url: "https://zennybooks.com",
    siteName: "Zenny",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zenny - Bookkeeping on Autopilot",
    description:
      "AI receipt capture, smart categorization, review queue, and tax-ready exports — built for freelancers and small businesses.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zenny",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <Analytics />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
