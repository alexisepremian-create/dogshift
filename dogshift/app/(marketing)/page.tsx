import type { Metadata } from "next";

import HomePageClient from "./HomePageClient";

const homepageTitle = "DogShift – Dog-sitting premium en Suisse";
const homepageDescription = "DogShift est une plateforme de dog-sitting premium en Suisse. Trouvez un dog-sitter de confiance pour promenade, garde ou pension.";
const homepageUrl = "https://www.dogshift.ch";

export const metadata: Metadata = {
  title: homepageTitle,
  description: homepageDescription,
  alternates: {
    canonical: homepageUrl,
  },
  openGraph: {
    type: "website",
    url: homepageUrl,
    title: homepageTitle,
    description: homepageDescription,
    siteName: "DogShift",
    locale: "fr_CH",
  },
  twitter: {
    card: "summary_large_image",
    title: homepageTitle,
    description: homepageDescription,
  },
};

export default function Home() {
  return <HomePageClient />;
}