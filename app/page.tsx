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
            Accounting Augmented by AI.
            <br />
            <span className="text-primary">Tax Season, Solved.</span>
          </h1>
          <p className="mt-6 text-xl leading-8 text-gray-600 max-w-2xl mx-auto">
            Stop wrestling with complex accounting software. Turbo Invoice uses
            AI to instantly process receipts and generate invoices. It’s
            automagic bookkeeping for the modern pro.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" className="px-8 text-lg h-12 rounded-full">
                  Start for Free
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/app">
                <Button size="lg" className="px-8 text-lg h-12 rounded-full">
                  Go to Dashboard
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>

        <div className="mt-32 grid grid-cols-1 gap-12 sm:grid-cols-3">
          <div className="p-8 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
              <span className="text-2xl">⚡️</span>
            </div>
            <h3 className="text-xl font-bold mb-3">Instant Receipt Capture</h3>
            <p className="text-gray-600 leading-relaxed">
              Snap a photo, and our AI extracts every detail (merchant, date,
              totals) in seconds. No manual entry, ever.
            </p>
          </div>
          <div className="p-8 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
              <span className="text-2xl">🧠</span>
            </div>
            <h3 className="text-xl font-bold mb-3">AI Invoice Creation</h3>
            <p className="text-gray-600 leading-relaxed">
              Describe your work in plain English, and let AI generate a
              professional, itemized invoice ready to send.
            </p>
          </div>
          <div className="p-8 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
              <span className="text-2xl">😌</span>
            </div>
            <h3 className="text-xl font-bold mb-3">Stress-Free Taxes</h3>
            <p className="text-gray-600 leading-relaxed">
              Everything is categorized and exportable. Hand your accountant a
              perfect CSV, or file it yourself with confidence.
            </p>
          </div>
        </div>

        <div className="mt-32 bg-slate-50 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Too simple to be true? That’s the point.
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Traditional software is built for accountants, not you. We stripped
            away the bloat and added intelligence to give you exactly what you
            need: <strong>speed and clarity</strong>.
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <Button variant="outline" size="lg">
                Try the Simplicity
              </Button>
            </SignUpButton>
          </SignedOut>
        </div>
      </main>
    </div>
  );
}
