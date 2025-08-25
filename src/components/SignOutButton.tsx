// src/components/SignOutButton.tsx
"use client";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="rounded-md border px-3 py-2 hover:bg-gray-50"
    >
      Sign out
    </button>
  );
}
