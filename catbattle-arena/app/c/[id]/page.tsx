import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CardShareActions from '../../components/CardShareActions';
import type { FighterCardView } from '../../components/FighterCard';
import { getOrCreateShareCardByCatId, getShareCard } from '../_lib/cards';
import { preferCardImage } from '../../api/_lib/images';
import { canonicalSiteOrigin } from '../../lib/site-origin';

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await params;
  const slug = String(p.id || '').trim();
  const card = (await getShareCard(slug)) || (await getOrCreateShareCardByCatId(slug));
  if (!card) {
    return { title: 'Card Not Found | CatClash Arena' };
  }
  const canonicalSlug = String(card.public_slug || slug);
  const origin = canonicalSiteOrigin();
  const ogImage = card.image_card_png_url || `${origin}/api/cards/image/${canonicalSlug}`;
  return {
    title: `${card.name} — ${card.rarity} Cat Fighter`,
    description: `Power ${card.power_rating} • Level ${card.level} • Ready for war`,
    openGraph: {
      title: `${card.name} — ${card.rarity} Cat Fighter`,
      description: `Power ${card.power_rating} • Level ${card.level} • Ready for war`,
      url: `${origin}/c/${canonicalSlug}`,
      images: [{ url: ogImage }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${card.name} — ${card.rarity} Cat Fighter`,
      description: `Power ${card.power_rating} • Level ${card.level} • Ready for war`,
      images: [ogImage],
    },
  };
}

export default async function PublicCardPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const slug = String(p.id || '').trim();
  let card = await getShareCard(slug);
  if (!card) {
    const minted = await getOrCreateShareCardByCatId(slug);
    if (minted) {
      redirect(`/c/${minted.public_slug}`);
    }
    card = null;
  }
  if (!card) notFound();

  const publicUrl = `/c/${encodeURIComponent(slug)}`;
  const view = toView(slug, card);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6 pb-28 sm:pb-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold">{view.name}</h1>
        <p className="text-white/60 text-sm mb-3">Public Cat Fighter Card</p>

        <CardShareActions card={view} publicUrl={publicUrl} />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/submit" className="h-11 rounded-xl bg-emerald-400 text-black text-sm font-bold inline-flex items-center justify-center">
            Generate your cat
          </Link>
          <Link href={`/c/${slug}/share`} className="h-11 rounded-xl bg-white/10 border border-white/15 text-sm font-bold inline-flex items-center justify-center">
            Open Share Screen
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-bold text-white/85 mb-1">What happens next?</p>
          <p className="text-xs text-white/60">This cat can be challenged asynchronously and can gain fans as players vote and battle.</p>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-white/45">
          <a href={`mailto:hello@catclash.org?subject=Report%20Card%20${encodeURIComponent(slug)}`} className="underline">Report card</a>
          <Link href="/submit" className="underline">How it works</Link>
        </div>
      </div>
    </main>
  );
}
