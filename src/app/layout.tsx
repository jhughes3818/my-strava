import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Strava",
  description: "Training analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-slate-900 antialiased">
        <div className="min-h-screen">
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
