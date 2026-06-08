import Link from 'next/link';

export interface Crumb {
  name: string;
  href?: string;
}

/** Visible breadcrumb trail. Pages that render this already emit a matching
 *  BreadcrumbList JSON-LD, so this is the visual counterpart only. */
export default function BreadcrumbNav({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className ?? 'text-sm text-gray-500'}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-x-2">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-gray-700 transition-colors">
                  {c.name}
                </Link>
              ) : (
                <span
                  className={last ? 'text-gray-600' : undefined}
                  aria-current={last ? 'page' : undefined}
                >
                  {c.name}
                </span>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
