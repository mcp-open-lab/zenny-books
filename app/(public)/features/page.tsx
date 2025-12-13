import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const currentModules = [
  {
    title: "Review Queue",
    description: "Fix low-confidence items fast with bulk approval and edits.",
  },
  {
    title: "Smart Rules",
    description: "Create repeatable rules so categorization gets better over time.",
  },
  {
    title: "Merchant Insights",
    description: "Audit spend by merchant and apply consistent changes in bulk.",
  },
  {
    title: "Instant Capture",
    description: "Upload receipts and statements; AI extracts structured data.",
  },
  {
    title: "Bank Connections",
    description: "Sync accounts with Plaid for a cleaner, continuous workflow.",
  },
  {
    title: "Budget Tracking",
    description: "Plan monthly budgets and compare against real spending.",
  },
];

const plannedModules = [
  { title: "Invoicing", description: "Send invoices, track payments, and reconcile." },
  { title: "Tax Reports", description: "Export tax-ready summaries and schedules." },
  { title: "Team Collaboration", description: "Share workflows with roles and approvals." },
];

export default function FeaturesPage() {
  return (
    <main className="container px-4 md:px-6 mx-auto max-w-7xl py-12 md:py-20">
      <div className="flex items-center justify-between gap-4 mb-10">
        <div>
          <Badge variant="secondary" className="mb-3">
            Modules
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Current and planned features
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Turbo Invoice is built as a set of focused modules so you get a
            clean workflow today, and more power over time.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back</Link>
        </Button>
      </div>

      <h2 className="text-xl font-semibold mb-4">Available now</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {currentModules.map((m) => (
          <Card key={m.title} variant="kpi">
            <CardHeader>
              <CardTitle>{m.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {m.description}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Coming soon</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plannedModules.map((m) => (
            <Card key={m.title} className="border-dashed">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{m.title}</CardTitle>
                <Badge variant="info">Coming soon</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {m.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}


