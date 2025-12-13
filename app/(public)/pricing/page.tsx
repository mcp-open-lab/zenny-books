import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PricingPage() {
  return (
    <main className="container px-4 md:px-6 mx-auto max-w-7xl py-12 md:py-20">
      <div className="flex items-center justify-between gap-4 mb-10">
        <div>
          <Badge variant="secondary" className="mb-3">
            Simple pricing
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Pricing that scales with your workflow
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Start free, upgrade when you need more automation. Transparent,
            finance-friendly pricing.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Starter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">$0</div>
            <p className="text-sm text-muted-foreground">
              For trying Turbo Invoice and light usage.
            </p>
            <Button className="w-full">Get Started</Button>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>
              Pro{" "}
              <Badge variant="secondary" className="ml-2">
                Popular
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">$19</div>
            <p className="text-sm text-muted-foreground">
              For freelancers and small businesses who need speed.
            </p>
            <Button className="w-full">Start Pro</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">Custom</div>
            <p className="text-sm text-muted-foreground">
              For teams that want shared workflows and controls.
            </p>
            <Button className="w-full" variant="outline">
              Contact
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


