import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} CRM Franchise`,
  description: "CRM de recrutement franchise Zonara"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
