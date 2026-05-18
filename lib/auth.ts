import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/tasks",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      try {
        if (!user?.email) {
          console.error("[Auth] Sign-in failed: no email from Google");
          return false;
        }
        const profileImage =
          typeof profile?.picture === "string" ? profile.picture : user.image;
        const profileName =
          typeof profile?.name === "string" ? profile.name : user.name;

        await prisma.user.updateMany({
          where: { email: user.email },
          data: {
            ...(profileName ? { name: profileName } : {}),
            ...(profileImage ? { image: profileImage } : {}),
          },
        });

        console.log("[Auth] Sign-in attempt:", user.email);
        return true;
      } catch (err) {
        console.error("[Auth] Sign-in callback error:", err);
        return false;
      }
    },
    async redirect({ url, baseUrl }) {
      console.log("[Auth] Redirect callback:", { url, baseUrl });
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
    session({ session, user }) {
      try {
        if (user?.id) {
          session.user.id = user.id;
        }
        return session;
      } catch (err) {
        console.error("[Auth] Session callback error:", err);
        return session;
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
});
