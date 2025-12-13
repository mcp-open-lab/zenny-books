import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpToLine,
  Brain,
  Database,
  History,
  ListTodo,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    title: "Instant capture",
    description: "Snap receipts or upload statements. Zenny extracts the details.",
    icon: Database,
  },
  {
    title: "Smart rules",
    description: "Teach it once. Zenny applies your preferences automatically.",
    icon: Brain,
  },
  {
    title: "Review queue",
    description: "Clear edge cases fast with bulk approvals and edits.",
    icon: ListTodo,
  },
  {
    title: "Merchant view",
    description: "Audit spend by merchant and apply consistent changes in bulk.",
    icon: History,
  },
  {
    title: "Tax-ready exports",
    description: "Export clean data to CSV/Excel for your accountant and tools.",
    icon: ArrowUpToLine,
  },
  {
    title: "Confident & secure",
    description: "Stay organized with a workflow designed for accuracy and clarity.",
    icon: ShieldCheck,
  },
];

export function FeatureGrid() {
  return (
    <section className="w-full py-12 md:py-24 bg-muted/40 border-t">
      <div className="container px-4 md:px-6 mx-auto max-w-7xl">
        <FadeIn className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            What Zenny does
          </h2>
          <p className="text-muted-foreground md:text-xl max-w-3xl mx-auto">
            A calm, repeatable system that keeps your books clean and your brain
            quiet.
          </p>
        </FadeIn>

        <FadeIn delayMs={80}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card
                  key={f.title}
                  className="group transition-all duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg/10"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="rounded-full border px-2 py-1">
                          Live
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{f.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {f.description}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FadeIn>

        <FadeIn delayMs={120} className="mt-10">
          <div className="rounded-2xl border border-dashed bg-background/60 backdrop-blur p-6 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-primary">
                  Advisor upgrades rolling out
                </div>
                <div className="text-2xl font-bold tracking-tight">
                  Zenny becomes proactive
                </div>
                <div className="text-sm text-muted-foreground max-w-2xl">
                  Budget coaching, planning, invoicing, and tax optimization
                  suggestions—so the agent doesn&apos;t just organize your past,
                  it helps you steer your future.
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary/80" />
                In progress
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}


