'use client';
/** Photo & video gallery with an accessible lightbox (focus trapped to the dialog, Esc / arrows). */
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import type { GalleryItem } from '@armyx/shared/content';

export function Gallery({ items }: { items: GalleryItem[] }) {
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = items.filter((i) => filter === 'all' || i.type === filter);
  const current = index === null ? null : shown[index];

  useEffect(() => {
    if (index === null) dialog.current?.close();
    else if (!dialog.current?.open) dialog.current?.showModal();
  }, [index]);

  const move = (d: number) => setIndex((i) => (i === null ? null : (i + d + shown.length) % shown.length));

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Filter media">
        {(['all', 'photo', 'video'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`btn ${filter === f ? 'bg-olive-700 text-white' : 'border border-olive-100 bg-white'}`}>
            {f === 'all' ? 'All' : f === 'photo' ? 'Photos' : 'Videos'}
          </button>
        ))}
      </div>
      <ul className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {shown.map((m, i) => (
          <li key={m.id} className="mb-4 break-inside-avoid">
            <button type="button" onClick={() => setIndex(i)} className="group relative block w-full overflow-hidden rounded-xl text-left">
              <Image src={m.src} alt={m.title} width={800} height={560} className="h-auto w-full object-cover transition group-hover:scale-[1.03]" sizes="(min-width:1024px) 33vw, 100vw" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-olive-950/90 to-transparent p-4 text-sm font-semibold text-white">{m.title}</span>
              {m.type === 'video' && <span className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-olive-950"><Play aria-hidden className="h-5 w-5" /><span className="sr-only">Video</span></span>}
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={dialog} onClose={() => setIndex(null)} onKeyDown={(e) => { if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowLeft') move(-1); }}
        aria-label={current?.title} className="m-auto w-[min(1100px,95vw)] max-w-none rounded-xl bg-olive-950 p-0 text-white backdrop:bg-black/80">
        {current && (
          <div>
            <div className="relative aspect-video bg-black">
              {current.type === 'video' && current.videoUrl && current.videoUrl.length > 35 ? (
                <iframe src={current.videoUrl} title={current.title} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
              ) : (
                <Image src={current.src} alt={current.title} fill sizes="95vw" className="object-contain" />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <p className="font-semibold">{current.title}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => move(-1)} className="btn-ghost-light px-3" aria-label="Previous"><ChevronLeft aria-hidden /></button>
                <button type="button" onClick={() => move(1)} className="btn-ghost-light px-3" aria-label="Next"><ChevronRight aria-hidden /></button>
                <button type="button" onClick={() => setIndex(null)} className="btn-gold px-3" aria-label="Close"><X aria-hidden /></button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
