import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layouts/page-container";
import Link from "next/link";
import { AlertCircle, ArrowDownToLine, ArrowUpToLine, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const dataOptions = [
  {
    href: "/app/review",
    icon: AlertCircle,
    title: "Review",
    description: "Categorize and organize transactions that need attention",
  },
  {
    href: "/app/settings/rules",
    icon: SlidersHorizontal,
    title: "Rules",
    description: "Manage auto-categorization rules for future imports",
  },
  {
    href: "/app/import",
    icon: ArrowDownToLine,
    title: "Import",
    description: "Upload bank statements, receipts, and other documents",
  },
  {
    href: "/app/export",
    icon: ArrowUpToLine,
    title: "Export",
    description: "Download reports and transaction data",
  },
];

export default async function DataPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <PageContainer size="narrow">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Data Management</h1>
          <p className="text-muted-foreground">
            Import, review, and export your financial data
          </p>
        </div>

        <div className="grid gap-4">
          {dataOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Link key={option.href} href={option.href}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      {option.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{option.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}

