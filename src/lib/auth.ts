import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

import GitHubProvider from "next-auth/providers/github";
import StravaProvider from "next-auth/providers/strava";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },

  // Add user id onto session.user for convenience in server components
  callbacks: {
    async session({ session, token }) {
      if (session.user && token?.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },

  providers: [
    // GitHub (optional but nice for quick sign-in)
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
          }),
        ]
      : []),

    // Strava (for linking accounts to fetch activities)
    StravaProvider({
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
      authorization: {
        url: "https://www.strava.com/oauth/authorize",
        params: {
          scope: "read,read_all,activity:read_all",
          response_type: "code",
          approval_prompt: "auto",
        },
      },
    }),
  ],

  // After a provider is linked, copy Strava athlete id over to Account.athlete_id
  events: {
    async linkAccount({ account }) {
      if (account?.provider === "strava" && account.providerAccountId) {
        await db.account.update({
          where: {
            provider_providerAccountId: {
              provider: "strava",
              providerAccountId: account.providerAccountId,
            },
          },
          data: { athlete_id: account.providerAccountId },
        });

        // Kick off initial backfill when Strava is first linked
        if (account.userId) {
          const { backfillAllActivities } = await import("@/lib/strava-sync");
          backfillAllActivities(account.userId).catch((e) =>
            console.error("backfill error", e)
          );
        }
      }
    },
  },
};
