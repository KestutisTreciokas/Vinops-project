'use client'
import { useState } from 'react'

export default function Gallery({ images, alt='photo' }: { images: string[]; alt?: string }) {
  const safe = images && images.length ? images : ['/svg/brand/property-1-brand-theme-light-size-56.svg']
  const [idx, setIdx] = useState(0)
  const to = (i:number) => setIdx(Math.min(Math.max(i,0), safe.length-1))
  return (
    <div className="w-full">
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-[color:var(--border-muted)] bg-[var(--bg-canvas)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safe[idx]}
          alt={alt}
          className="h-full w-full object-cover"
          onClick={() => to((idx+1)%safe.length)}
        />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {safe.map((src,i)=>(
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt=""
               className={`h-16 w-24 flex-none cursor-pointer rounded-lg border object-cover ${i===idx?'border-[color:var(--brand)]':'border-[color:var(--border-muted)]'}`}
               onClick={()=>to(i)} />
        ))}
      </div>
    </div>
  )
}
