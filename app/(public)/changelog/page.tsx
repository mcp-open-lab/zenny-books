import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const entries = [
  {
    title: "Review Queue workflow",
    date: "2025-12-13",
    description:
      "Quickly approve and fix low-confidence items with bulk actions and better categorization.",
  },
  {
    title: "Module-based Server Actions",
    date: "2025-12-12",
    description:
      "Server Actions now live under lib/modules/* for clearer ownership and test alignment.",
  },
  {
    title: "App Router error boundaries",
    date: "2025-12-13",
    description:
      "Added app/error.tsx and app/global-error.tsx plus route-level error boundaries for better UX.",
  },
];

export default function ChangelogPage() {
  return (
    <main className="container px-4 md:px-6 mx-auto max-w-7xl py-12 md:py-20">
      <div className="flex items-center justify-between gap-4 mb-10">
        <div>
          <Badge variant="secondary" className="mb-3">
            Updates
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            What&apos;s new
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Product improvements and new modules as Turbo Invoice evolves.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back</Link>
        </Button>
      </div>

      <div className="space-y-4">
        {entries.map((e) => (
          <Card key={`${e.date}-${e.title}`}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{e.title}</CardTitle>
                <div className="mt-1 text-sm text-muted-foreground">{e.date}</div>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {e.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}


