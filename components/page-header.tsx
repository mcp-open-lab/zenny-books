import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  backHref?: string;
};

export function PageHeader({ title, backHref }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-4">
        {backHref && (
          <Button variant="ghost" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <UserButton />
    </div>
  );
}
