import { Suspense } from 'react';
import NoteDetailPage from '@/components/NoteDetailPage';

interface NoteDynamicPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NoteDynamicPage({ params }: NoteDynamicPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <NoteDetailPage slug={slug} />
    </Suspense>
  );
}
