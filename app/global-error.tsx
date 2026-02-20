'use client'

/**
 * Catches errors in the root layout (including ChunkLoadError when layout chunk fails to load).
 * Must define its own <html> and <body> per Next.js docs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isChunkLoad = error?.message?.includes('Loading chunk') ?? false

  return (
    <html lang="en">
      <body className="m-0 min-h-screen bg-gray-50 p-8 font-sans flex items-center justify-center">
        <div className="text-center max-w-[400px]">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {isChunkLoad ? 'Failed to load app' : 'Something went wrong'}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {isChunkLoad
              ? 'The app bundle did not load in time. This can happen on slow connections.'
              : 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => (isChunkLoad ? window.location.reload() : reset())}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md border-0 cursor-pointer"
          >
            {isChunkLoad ? 'Reload page' : 'Try again'}
          </button>
        </div>
      </body>
    </html>
  )
}
