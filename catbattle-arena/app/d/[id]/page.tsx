import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DuelShareView from '../../components/DuelShareView';
import { getPublicDuel } from '../_lib/duels';
import { canonicalSiteOrigin } from '../../lib/site-origin';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await params;
  const duelId = String(p.id || '').trim();
  const duel = await getPublicDuel(duelId);
  if (!duel) return { title: 'Duel Not Found | CatClash Arena' };

  const origin = canonicalSiteOrigin();
  const imageUrl = `${origin}/api/duel/image/${encodeURIComponent(duelId)}`;
  const title = `${duel.challenger_username} vs ${duel.challenged_username} • CatClash Duel`;
  const description = `Live duel: ${duel.votes.cat_a} vs ${duel.votes.cat_b} votes on catclash.org`;
  const url = `${origin}/d/${encodeURIComponent(duelId)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{ url: imageUrl }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function DuelSharePage({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const duelId = String(p.id || '').trim();
  const duel = await getPublicDuel(duelId);
  if (!duel) notFound();

  return <DuelShareView duel={duel} duelId={duelId} />;
}
