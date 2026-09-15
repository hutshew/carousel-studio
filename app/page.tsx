'use client';

import dynamic from 'next/dynamic';

const CarouselEditor = dynamic(() => import('../components/editor/CarouselEditor'), {
  ssr: false,
});

export default function Home() {
  return <CarouselEditor />;
}
