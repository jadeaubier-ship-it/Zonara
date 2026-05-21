import bcrypt from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ROLE_REDIRECTS } from "@/lib/utils/constants";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Email / mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email }
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstname} ${user.lastname}`,
          role: user.role,
          firstname: user.firstname,
          lastname: user.lastname
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as typeof user & {
          role?: string;
          firstname?: string;
          lastname?: string;
        };
        token.role = authUser.role;
        token.firstname = authUser.firstname;
        token.lastname = authUser.lastname;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const role = token.role ?? "CANDIDATE";
        session.user.id = token.sub!;
        session.user.role = role;
        session.user.firstname = token.firstname;
        session.user.lastname = token.lastname;
        session.user.redirectTo = ROLE_REDIRECTS[role as keyof typeof ROLE_REDIRECTS];
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
