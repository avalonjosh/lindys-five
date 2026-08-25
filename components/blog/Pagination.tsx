import Link from 'next/link';

export const POSTS_PER_PAGE = 24;

/** Server-rendered prev/next trail for the filtered blog lists. */
export default function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const linkClass = 'rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#003087] shadow hover:shadow-md transition-shadow';
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm text-gray-500">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">← Newer</Link>
      ) : (
        <span className="px-4 py-2 text-gray-300">← Newer</span>
      )}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass} rel="next">Older →</Link>
      ) : (
        <span className="px-4 py-2 text-gray-300">Older →</span>
      )}
    </nav>
  );
}
