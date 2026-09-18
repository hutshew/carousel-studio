'use client';

import dynamic from 'next/dynamic';

const CarouselEditor = dynamic(() => import('../components/editor/StudioV2'), {
  ssr: false,
});

export default function Home() {
  return <CarouselEditor />;
}
