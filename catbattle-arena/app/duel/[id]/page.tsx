import { redirect } from 'next/navigation';

export default async function DuelLegacyRedirect({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const id = String(p.id || '').trim();
  if (!id) redirect('/duel');
  redirect(`/d/${encodeURIComponent(id)}`);
}

