import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlphaDiagnostic | Alphaducation",
  description: "Diagnostic pédagogique français de la Grade 6 à la Terminale pour comprendre les acquis en mathématiques et les méthodes d’apprentissage.",
  other: { "codex-preview": "development" },
  icons: { icon: "/brand/alphaducation-mark.png", shortcut: "/brand/alphaducation-mark.png", apple: "/brand/alphaducation-mark.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
