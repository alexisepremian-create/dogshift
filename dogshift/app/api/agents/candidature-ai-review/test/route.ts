import { NextResponse } from 'next/server';

export async function GET() {
  // Candidat fictif pour tester rapidement
  const candidatTest = {
    nom: 'Marie Dupont',
    email: 'marie.dupont@example.com',
    telephone: '+41 79 123 45 67',
    ville: 'Lausanne',
    npa: '1003',
    profession: 'Vétérinaire',
    experience: '15 ans en clinique vétérinaire, propriétaire de 2 labradors',
    disponibilite: 'Soirs et weekends',
    services: ['promenade', 'garde à domicile'],
    message: 'Passionnée par le bien-être animal depuis toujours, je souhaite offrir un service de qualité aux propriétaires de la région.',
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${baseUrl}/api/agents/candidature-ai-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(candidatTest),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
