"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-[calc(100vh-56px)] px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md">
        <SignIn />
      </div>
    </main>
  );
}


