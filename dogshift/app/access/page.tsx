import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Redirection",
  description: "Cette page n’est plus utilisée.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  alternates: {
    canonical: "https://www.dogshift.ch",
  },
};

export default function AccessPage() {
  redirect("/");
}
