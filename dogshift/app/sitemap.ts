import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: "https://www.dogshift.ch",
      lastModified,
    },
    {
      url: "https://www.dogshift.ch/devenir-dogsitter",
      lastModified,
    },
    {
      url: "https://www.dogshift.ch/dog-sitter-lausanne",
      lastModified,
    },
    {
      url: "https://www.dogshift.ch/dog-sitter-geneve",
      lastModified,
    },
    {
      url: "https://www.dogshift.ch/reserver",
      lastModified,
    },
    {
      url: "https://www.dogshift.ch/profil",
      lastModified,
    },
  ];
}
