import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import CardShareActions from '../../../components/CardShareActions';
import type { FighterCardView } from '../../../components/FighterCard';
import { getOrCreateShareCardByCatId, getShareCard } from '../../_lib/cards';
import { preferCardImage } from '../../../api/_lib/images';

function toView(slug: string, card: Awaited<ReturnType<typeof getShareCard>>): FighterCardView {
  const s = (card?.stats || {}) as Record<string, number>;
  const originalImageUrl = String(card?.image_original_url || '').trim();
  const preferredCardUrl = preferCardImage(originalImageUrl);
  const finalImageUrl = preferredCardUrl || originalImageUrl || '/cat-placeholder.svg';
  if (process.env.NODE_ENV !== 'production' && /\/original\.(?:jpg|jpeg|png|webp|avif|gif)(?:$|[?#])/i.test(finalImageUrl)) {
    // eslint-disable-next-line no-console
    console.warn(`[DEV WARNING] ShareCard using ORIGINAL fallback: ${finalImageUrl}`);
  }
  return {
    slug,
    catId: card?.cat_id ? String(card.cat_id) : null,
    ownerUserId: card?.owner_user_id ? String(card.owner_user_id) : null,
    name: String(card?.name || 'Unnamed Cat'),
    rarity: String(card?.rarity || 'Common'),
    level: Math.max(1, Number(card?.level || 1)),
    powerRating: Math.max(0, Number(card?.power_rating || 0)),
    stats: {
      atk: Math.max(0, Number(s.atk || 0)),
      def: Math.max(0, Number(s.def || 0)),
      spd: Math.max(0, Number(s.spd || 0)),
      cha: Math.max(0, Number(s.cha || 0)),
      chs: Math.max(0, Number(s.chs || 0)),
    },
    ownerName: String(card?.owner_display_name || 'Arena Challenger'),
    imageUrl: finalImageUrl,
    fallbackImageUrl: originalImageUrl || null,
    description: String(card?.description || '').trim() || null,
  };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new_cat?: string }>;
}) {
  const p = await params;
  const qs = await searchParams;
  const slug = String(p.id || '').trim();
  let card = await getShareCard(slug);
  if (!card) {
    const minted = await getOrCreateShareCardByCatId(slug);
    if (minted) {
      const suffix = String(qs?.new_cat || '').trim() === '1' ? '?new_cat=1' : '';
      redirect(`/c/${minted.public_slug}/share${suffix}`);
    }
    card = null;
  }
  if (!card) notFound();

  const publicUrl = `/c/${encodeURIComponent(slug)}`;
  const view = toView(slug, card);

  const isNewCat = String(qs?.new_cat || '').trim() === '1';

  return (
    <main className={`min-h-screen bg-black text-white px-4 ${isNewCat ? 'py-4' : 'py-6'} pb-28 sm:pb-6`}>
      <div className="max-w-lg mx-auto">
        {!isNewCat && (
          <div className="mb-4 flex items-center justify-between">
            <Link href={`/c/${slug}`} className="text-sm text-white/65 hover:text-white">Back</Link>
            <p className="text-sm font-bold">Share</p>
            <span className="text-[11px] text-white/35">RESULT → SHARE</span>
          </div>
        )}
        {isNewCat && (
          <div className="mb-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/85">New Recruit</p>
          </div>
        )}

        <CardShareActions card={view} publicUrl={publicUrl} isNewCat={isNewCat} />
      </div>
    </main>
  );
}
