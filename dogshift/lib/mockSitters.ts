export type ServiceType = "Promenade" | "Garde" | "Pension";

export type DogSize = "Petit" | "Moyen" | "Grand";

export type MockSitter = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  rating: number | null;
  reviewCount: number;
  pricePerDay: number;
  services: ServiceType[];
  dogSizes: DogSize[];
  availableDates: string[];
  pricing: Partial<Record<ServiceType, number>>;
  bio: string;
  responseTime: string;
  verified: boolean;
  lat: number;
  lng: number;
  avatarUrl: string;
};

export const MOCK_SITTERS: MockSitter[] = [
  {
    id: "s-1",
    name: "Camille R.",
    city: "Genève",
    postalCode: "1201",
    services: ["Promenade", "Garde"],
    dogSizes: ["Petit", "Moyen"],
    availableDates: ["2025-12-20", "2025-12-21", "2025-12-22", "2025-12-27", "2025-12-28"],
    pricing: { Promenade: 25, Garde: 35 },
    pricePerDay: 65,
    rating: 4.9,
    reviewCount: 32,
    responseTime: "~1h",
    verified: true,
    bio: "Passionnée par les chiens depuis toujours, je propose des promenades et des gardes attentives, avec des nouvelles régulières.",
    lat: 46.2046,
    lng: 6.1432,
    avatarUrl: "https://i.pravatar.cc/160?img=32",
  },
  {
    id: "s-2",
    name: "Nicolas M.",
    city: "Lausanne",
    postalCode: "1003",
    services: ["Pension", "Garde"],
    dogSizes: ["Moyen", "Grand"],
    availableDates: ["2025-12-19", "2025-12-20", "2025-12-23", "2025-12-24", "2025-12-25"],
    pricing: { Garde: 38, Pension: 75 },
    pricePerDay: 75,
    rating: 4.8,
    reviewCount: 18,
    responseTime: "~2h",
    verified: true,
    bio: "Appartement calme, sorties fréquentes et environnement sécurisé. Idéal pour séjours courte et moyenne durée.",
    lat: 46.5191,
    lng: 6.6323,
    avatarUrl: "https://i.pravatar.cc/160?img=12",
  },
  {
    id: "s-3",
    name: "Sarah D.",
    city: "Nyon",
    postalCode: "1260",
    services: ["Promenade"],
    dogSizes: ["Petit", "Moyen", "Grand"],
    availableDates: ["2025-12-18", "2025-12-19", "2025-12-20", "2025-12-21"],
    pricing: { Promenade: 22 },
    pricePerDay: 45,
    rating: 4.7,
    reviewCount: 11,
    responseTime: "~45 min",
    verified: false,
    bio: "Je privilégie des promenades structurées, adaptées au rythme de chaque chien. Disponible en semaine et le weekend.",
    lat: 46.3833,
    lng: 6.2396,
    avatarUrl: "https://i.pravatar.cc/160?img=47",
  },
  {
    id: "s-4",
    name: "Luca S.",
    city: "Genève",
    postalCode: "1207",
    services: ["Pension"],
    dogSizes: ["Petit", "Moyen", "Grand"],
    availableDates: ["2025-12-20", "2025-12-21", "2025-12-22", "2025-12-23", "2025-12-24"],
    pricing: { Pension: 90 },
    pricePerDay: 90,
    rating: 5.0,
    reviewCount: 44,
    responseTime: "~30 min",
    verified: true,
    bio: "Expérience premium: routine personnalisée, espace confortable, et attention maximale. Parfait pour chiens sensibles.",
    lat: 46.2102,
    lng: 6.1589,
    avatarUrl: "https://i.pravatar.cc/160?img=7",
  },
  {
    id: "s-5",
    name: "Inès B.",
    city: "Lausanne",
    postalCode: "1006",
    services: ["Promenade", "Pension"],
    dogSizes: ["Petit", "Moyen"],
    availableDates: ["2025-12-21", "2025-12-22", "2025-12-28", "2025-12-29", "2025-12-30"],
    pricing: { Promenade: 28, Pension: 70 },
    pricePerDay: 70,
    rating: 4.9,
    reviewCount: 27,
    responseTime: "~1h",
    verified: true,
    bio: "J'accueille un nombre limité de chiens pour garantir calme, attention et qualité. Parc à proximité.",
    lat: 46.5334,
    lng: 6.6645,
    avatarUrl: "https://i.pravatar.cc/160?img=22",
  },
];

export function getSitterById(id: string) {
  return MOCK_SITTERS.find((s) => s.id === id);
}
