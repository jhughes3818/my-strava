// src/components/ConnectStravaButton.tsx
"use client";
import { signIn } from "next-auth/react";

export default function ConnectStravaButton() {
  return (
    <button
      onClick={() => signIn("strava", { callbackUrl: "/dashboard" })}
      className="rounded-md border px-3 py-2 hover:bg-gray-50"
    >
      Connect Strava
    </button>
  );
}
