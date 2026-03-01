'use client';

import { Share2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';

interface CatShareButtonProps {
  catName: string;
  path: string;
  catId?: string;
  captureSelector?: string;
  className?: string;
  stopLinkNavigation?: boolean;
}

export default function CatShareButton({
  catName,
  path,
  catId,
  captureSelector,
  className = '',
  stopLinkNavigation = false,
}: CatShareButtonProps) {
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setRefCode(d?.guest_id || null);
      })
      .catch(() => {
        if (mounted) setRefCode(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleShare(e: MouseEvent<HTMLButtonElement>) {
    if (stopLinkNavigation) {
      e.preventDefault();
      e.stopPropagation();
    }

    const refParam = refCode ? `?ref=${encodeURIComponent(refCode)}` : '';
    const url = `${window.location.origin}${path}${refParam}`;
    const cardUrl = catId
      ? `${window.location.origin}/api/share/cat-card?cat_id=${encodeURIComponent(catId)}${refCode ? `&ref=${encodeURIComponent(refCode)}` : ''}`
      : null;
    const text = `Check out ${catName} on CatBattle Arena`;

    let shareFile: File | null = null;
    if (captureSelector) {
      const target = document.querySelector(captureSelector) as HTMLElement | null;
      if (target) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(target, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
          });
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            shareFile = new File([blob], `${catName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'cat'}-profile.png`, { type: 'image/png' });
          }
        } catch {
          shareFile = null;
        }
      }
    }

    if (navigator.share) {
      try {
        const payload: ShareData = shareFile && (navigator as Navigator & { canShare?: (data: ShareData) => boolean }).canShare?.({ files: [shareFile] })
          ? { title: catName, text: `${text}\nShare to Instagram Stories, X, or Discord`, url, files: [shareFile] }
          : { title: catName, text: `${text}\nShare to Instagram Stories, X, or Discord`, url };
        await navigator.share(payload);
        localStorage.setItem('shared_once_v1', '1');
        return;
      } catch {
        // fall through to clipboard
      }
    }

    if (shareFile) {
      try {
        const fileUrl = URL.createObjectURL(shareFile);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = shareFile.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(fileUrl);
      } catch {
        // ignore download failure
      }
    }

    try {
      const payload = cardUrl ? `${url}\nShare Card: ${cardUrl}` : url;
      await navigator.clipboard.writeText(payload);
      localStorage.setItem('shared_once_v1', '1');
      window.alert(cardUrl ? 'Invite link + share card copied. Try sharing on Instagram Stories, X, or Discord.' : 'Invite link copied.');
    } catch {
      window.prompt('Copy this link:', cardUrl ? `${url}\nShare Card: ${cardUrl}` : url);
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white ${className}`}
      type="button"
      title="Share"
    >
      <Share2 className="w-3.5 h-3.5" />
      Share
    </button>
  );
}
