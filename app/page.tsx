import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-bold">Turbo Invoice</div>
            <div className="flex items-center gap-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="ghost">Sign In</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button>Get Started</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/app">
                  <Button>Go to App</Button>
                </Link>
                <UserButton />
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            AI-Powered Receipt Scanner
          </h1>
          <p className="mt-6 text-xl leading-8 text-gray-600 max-w-2xl mx-auto">
            Upload receipts, extract data automatically with AI, and manage your
            expenses effortlessly. No more manual data entry.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg">Get Started Free</Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/app">
                <Button size="lg">Go to Dashboard</Button>
              </Link>
            </SignedIn>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">🤖 AI Extraction</h3>
            <p className="text-gray-600">
              Powered by Google Gemini to automatically extract merchant, date,
              amount, and category from receipts.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">📸 Easy Upload</h3>
            <p className="text-gray-600">
              Drag and drop or use your camera. Works on desktop and mobile
              seamlessly.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">📊 Export & Manage</h3>
            <p className="text-gray-600">
              Review extracted data, make corrections, and export to CSV for
              your records.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
