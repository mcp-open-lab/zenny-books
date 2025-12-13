import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import {
  faqPageJsonLd,
  JsonLdScript,
  softwareApplicationJsonLd,
} from "@/components/seo/json-ld";
import { LandingHero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Testimonials } from "@/components/landing/testimonials";
import { FinalCta } from "@/components/landing/final-cta";

const siteUrl = "https://zennybooks.com";

export const metadata: Metadata = {
  title: "Zenny - AI Bookkeeping on Autopilot",
  description:
    "Zenny is an AI personal bookkeeper for freelancers and small businesses: receipt capture, smart categorization, review queue, and tax-ready exports.",
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "Zenny - Bookkeeping on Autopilot",
    description:
      "Automate receipts, categorization, and review workflows. Stay tax-ready with clean exports.",
    url: siteUrl,
    type: "website",
  },
};

const faq = [
  {
    question: "What is Zenny?",
    answer:
      "Zenny is an AI-powered personal bookkeeper that captures receipts, categorizes transactions, and helps you export tax-ready data in minutes.",
  },
  {
    question: "Do I need to connect my bank account?",
    answer:
      "No. You can upload receipts and statements. If you connect via Plaid, Zenny can sync transactions automatically for an ongoing workflow.",
  },
  {
    question: "How accurate is the AI categorization?",
    answer:
      "Zenny combines AI with smart rules and a review queue. You can approve low-confidence items quickly and teach rules so accuracy improves over time.",
  },
  {
    question: "Can I export for my accountant?",
    answer:
      "Yes. Export clean, categorized data to CSV/Excel for bookkeeping, tax prep, or importing into other tools.",
  },
  {
    question: "Is this replacing an accountant?",
    answer:
      "No. Zenny is designed to automate the day-to-day workflow and make it easy to share clean data with your accountant or tax pro.",
  },
];

export default function MarketingPage() {
  return (
    <main className="flex-1">
      <JsonLdScript
        data={softwareApplicationJsonLd({
          siteUrl,
          name: "Zenny",
          description:
            "AI-powered bookkeeping for freelancers and small businesses: receipt capture, smart categorization, and tax-ready exports.",
        })}
      />
      <JsonLdScript data={faqPageJsonLd({ questions: faq })} />

      <LandingHero />
      <HowItWorks />
      <FeatureGrid />
      <Testimonials />
      <FinalCta />
    </main>
  );
}


