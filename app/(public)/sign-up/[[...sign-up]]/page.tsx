"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-[calc(100vh-56px)] px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md">
        <SignUp />
      </div>
    </main>
  );
}


