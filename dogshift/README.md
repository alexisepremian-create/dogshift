This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## DogShift (MVP)

### Mapbox Token (required for the map)

The homepage map uses Mapbox GL. You must provide a public token:

1. Create a `.env.local` file at the project root
2. Add:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token
```

If the token is missing, the map will show a non-blocking fallback message (no crash).
  - Remplir et envoyer
  - Résultat: message « Merci, nous vous recontactons »

- Admin (optionnel):
  - Ouvrir `/admin/host`
  - Résultat: affichage des profils soumis (stockage mock)

### Run locally

```bash
npm install
npm run dev
```

### MVP URLs to test

- `/` homepage (search + map preview + expand modal)
- `/search` search results (mock sitters, "Contacter" -> profile)
- `/sitter/s-1` sitter profile (mock messaging + mock booking modal)
- `/login` and `/signup` (UI only)

## Prelaunch password lock

To enable the site lock, set `SITE_PASSWORD` in the environment.

To disable it, remove `SITE_PASSWORD`.
