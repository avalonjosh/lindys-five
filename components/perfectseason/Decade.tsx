import { shortDecade } from './ui';

/**
 * Renders a decade with a smaller trailing "s" (e.g. 70s) so the number reads
 * clearly. The "s" scales to the inherited font size. Bebas Neue is all-caps,
 * which otherwise makes the S the same height as the digits and hard to scan.
 */
export default function Decade({ value }: { value: string }) {
  const short = shortDecade(value);
  const num = short.replace(/s$/i, '');
  const hasS = short.length !== num.length;
  return (
    <>
      {num}
      {hasS && <span className="text-[0.6em]">s</span>}
    </>
  );
}
