import { Suspense } from 'react';
import Link from 'next/link';
import NoteDetailPage from '@/components/NoteDetailPage';

interface NoteDynamicPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NoteDynamicPage({ params }: NoteDynamicPageProps) {
  const { slug } = await params;

  if (!slug || slug === 'undefined') {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <Link href="/notes" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
            ← Back to Notes
          </Link>
          <div className="bg-white p-8 rounded-lg border border-red-200">
            <p className="text-red-700">Invalid note identifier</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <NoteDetailPage slug={slug} />
    </Suspense>
  );
}
