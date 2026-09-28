import { Tv } from 'lucide-react';
import AffiliateLink from '@/components/affiliate/AffiliateLink';
import {
  WATCH_SERVICES,
  isWatchAffiliate,
  usStreamingServices,
  watchServiceUrl,
  type NHLWatchInfo,
  type WatchNetwork,
  type WatchServiceId,
} from '@/lib/watch/nhlWatch';

function ServiceChip({ id, trackLabel, area }: { id: WatchServiceId; trackLabel: string; area?: string }) {
  const className =
    'inline-flex items-center rounded-lg border-2 border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-800 transition-colors hover:border-gray-400 sm:text-sm';
  const name = area ? (
    <>
      {WATCH_SERVICES[id].name}
      <span className="ml-1 font-normal text-gray-500">({area} area)</span>
    </>
  ) : (
    WATCH_SERVICES[id].name
  );
  if (isWatchAffiliate(id)) {
    return (
      <AffiliateLink href={watchServiceUrl(id)} track="watch" trackLabel={`${id}-${trackLabel}`} className={className}>
        {name}
      </AffiliateLink>
    );
  }
  return (
    <a href={watchServiceUrl(id)} target="_blank" rel="noopener noreferrer" className={className}>
      {name}
    </a>
  );
}

const names = (list: WatchNetwork[]) => list.map((n) => n.name).join(', ');

/**
 * Per-game "where to watch": the TV network(s) and the streaming services that
 * carry them. `info` comes from nhlWatchInfo(game.tvBroadcasts).
 */
export default function WhereToWatch({
  info,
  homeName,
  awayName,
  trackLabel,
  note,
  className = '',
}: {
  info: NHLWatchInfo;
  homeName: string;
  awayName: string;
  trackLabel: string;
  /** Extra context line, e.g. NFL regional coverage. */
  note?: string;
  className?: string;
}) {
  const services = usStreamingServices(info);
  const hasUs = info.national.length > 0 || info.home.length > 0 || info.away.length > 0;
  if (!hasUs && info.canada.length === 0) return null;
  const anyAffiliate = services.some((o) => isWatchAffiliate(o.id));
  const canadaServices = info.canada.flatMap((n) => n.services).filter((s, i, a) => a.indexOf(s) === i);

  return (
    <div className={`rounded-xl border-2 border-gray-200 bg-white p-3 sm:p-4 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <Tv className="h-4 w-4 text-gray-500" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Where to watch</h3>
      </div>

      {info.national.length > 0 && (
        <p className="text-sm text-gray-700">
          <span className="font-bold text-gray-900">National TV:</span> {names(info.national)}
        </p>
      )}
      {!info.nationalExclusive && (
        (info.home.length > 0 || info.away.length > 0) && (
          <p className="text-sm text-gray-700">
            <span className="font-bold text-gray-900">Local TV:</span>{' '}
            {[
              info.away.length ? `${names(info.away)} (${awayName})` : '',
              info.home.length ? `${names(info.home)} (${homeName})` : '',
            ].filter(Boolean).join(' · ')}
          </p>
        )
      )}

      {services.length > 0 && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs text-gray-500">
            {info.outOfMarketStream ? 'Stream it (out of market in the US: ESPN+)' : 'Stream it on'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((o) => (
              <ServiceChip
                key={`${o.id}-${o.area ?? 'all'}`}
                id={o.id}
                trackLabel={trackLabel}
                area={o.area === 'home' ? homeName : o.area === 'away' ? awayName : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}

      {info.canada.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">In Canada:</span> {names(info.canada)}
          {canadaServices.length > 0 && ` (stream on ${canadaServices.map((s) => WATCH_SERVICES[s].name).join(' or ')})`}
        </p>
      )}

      {anyAffiliate && (
        <p className="mt-2 text-[11px] text-gray-400">Lindy&apos;s Five may earn a commission when you sign up through these links.</p>
      )}
    </div>
  );
}
