import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";

type Quote = {
  quote: string;
  name: string;
  role: string;
};

const quotes: Quote[] = [
  {
    quote:
      "Zenny turned a weekly bookkeeping chore into a 10‑minute review. The queue makes it feel like the agent is doing the work for me.",
    name: "Freelance designer",
    role: "Solo business",
  },
  {
    quote:
      "The rules are the killer feature. Once I approve a few merchants, it just stays clean—month after month.",
    name: "Agency owner",
    role: "Multi-client books",
  },
  {
    quote:
      "Exporting for my accountant used to be stressful. Now it’s a button and a sigh of relief.",
    name: "Independent consultant",
    role: "Tax-ready workflow",
  },
];

export function Testimonials() {
  return (
    <section className="w-full py-12 md:py-24 border-t">
      <div className="container px-4 md:px-6 mx-auto max-w-7xl">
        <FadeIn className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Feels like an agent
          </h2>
          <p className="text-muted-foreground md:text-xl max-w-3xl mx-auto">
            Less bookkeeping. More confidence. More Zenny.
          </p>
        </FadeIn>

        <div className="grid gap-6 md:grid-cols-3">
          {quotes.map((q, idx) => (
            <FadeIn key={q.name} delayMs={idx * 120}>
              <Card className="h-full">
                <CardContent className="p-6 flex h-full flex-col gap-5">
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    “{q.quote}”
                  </div>
                  <div className="mt-auto">
                    <div className="font-semibold">{q.name}</div>
                    <div className="text-xs text-muted-foreground">{q.role}</div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}


