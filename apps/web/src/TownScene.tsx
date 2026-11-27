import type { ReactNode } from 'react';

/** The places in a settlement a hero can walk into. */
export type Spot = 'bar' | 'rooms' | 'table' | 'tavern' | 'smith' | 'yard' | 'market' | 'shop' | 'portal' | 'mystic' | 'castle';

export const SPOTS: Record<'inn' | 'village' | 'city', Spot[]> = {
  inn: ['bar', 'table', 'rooms'],
  village: ['tavern', 'smith', 'yard', 'market', 'shop'],
  city: ['tavern', 'smith', 'yard', 'market', 'shop', 'mystic', 'portal', 'castle'],
};

export const SPOT_NAME: Record<Spot, { pl: string; en: string }> = {
  bar: { pl: 'Szynk', en: 'The bar' },
  table: { pl: 'Stół podróżnych', en: "Travellers' table" },
  rooms: { pl: 'Pokoje na piętrze', en: 'Rooms upstairs' },
  tavern: { pl: 'Karczma', en: 'Tavern' },
  smith: { pl: 'Kuźnia', en: 'Smithy' },
  yard: { pl: 'Plac ćwiczeń', en: 'Training yard' },
  market: { pl: 'Targ', en: 'Market' },
  shop: { pl: 'Kupiec i zielarz', en: 'Merchant and herbalist' },
  portal: { pl: 'Portal', en: 'Portal' },
  mystic: { pl: 'Wieża Mistyka', en: "The Mystic's tower" },
  castle: { pl: 'Zamek', en: 'Castle' },
};

/** A clickable building or corner of the picture, lit when hovered or chosen. */
function Hot({ spot, chosen, onPick, label, children, x, y }: { spot: Spot; chosen: Spot | null; onPick: (s: Spot) => void; label: string; children: ReactNode; x: number; y: number }) {
  return (
    <g
      className={`hot ${chosen === spot ? 'chosen' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={chosen === spot}
      onClick={() => onPick(spot)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(spot)}
    >
      {children}
      <g className="hot-tag" transform={`translate(${x} ${y})`}>
        <rect x={-label.length * 3.6 - 8} y={-11} width={label.length * 7.2 + 16} height={20} rx={2} />
        <text textAnchor="middle" y={4}>{label}</text>
      </g>
    </g>
  );
}

const House = ({ x, y, w, h, wall, roof, door = '#3a2414' }: { x: number; y: number; w: number; h: number; wall: string; roof: string; door?: string }) => (
  <>
    <rect x={x} y={y} width={w} height={h} fill={wall} stroke="#1a120c" strokeWidth={2} />
    <polygon points={`${x - 10},${y} ${x + w / 2},${y - h * 0.55} ${x + w + 10},${y}`} fill={roof} stroke="#1a120c" strokeWidth={2} />
    <rect x={x + w / 2 - 10} y={y + h - 30} width={20} height={30} fill={door} />
    <rect x={x + 10} y={y + 14} width={16} height={14} fill="#ffd070" stroke="#1a120c" />
    <rect x={x + w - 26} y={y + 14} width={16} height={14} fill="#ffd070" stroke="#1a120c" />
  </>
);

/** An inn from inside: the bar with barrels, tables of travellers, stairs up to the rooms. */
function InnScene({ chosen, onPick, name }: { chosen: Spot | null; onPick: (s: Spot) => void; name: (s: Spot) => string }) {
  return (
    <>
      <rect width={800} height={360} fill="#2a1a10" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 100} y={0} width={4} height={250} fill="#1e120a" />)}
      <rect y={250} width={800} height={110} fill="#4a3020" />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={0} y={262 + i * 16} width={800} height={2} fill="#3a2416" />)}
      <circle cx={400} cy={60} r={18} fill="#ffd070" opacity={0.25} /><rect x={398} y={0} width={4} height={50} fill="#1a120c" /><circle cx={400} cy={58} r={8} fill="#ffe08a" />
      <Hot spot="bar" chosen={chosen} onPick={onPick} label={name('bar')} x={150} y={120}>
        <rect x={40} y={160} width={230} height={100} fill="#6a4226" stroke="#1a120c" strokeWidth={3} />
        <rect x={30} y={150} width={250} height={14} fill="#8a5a32" stroke="#1a120c" strokeWidth={2} />
        {[60, 110, 160].map((x) => <g key={x}><ellipse cx={x} cy={110} rx={20} ry={26} fill="#7a4a22" stroke="#1a120c" strokeWidth={2} /><rect x={x - 20} y={100} width={40} height={4} fill="#3a2414" /></g>)}
        <rect x={200} y={128} width={8} height={22} fill="#c8e0f0" opacity={0.8} /><rect x={220} y={132} width={8} height={18} fill="#a0d070" opacity={0.8} />
        <circle cx={240} cy={130} r={12} fill="#e0b080" /><rect x={228} y={142} width={24} height={10} fill="#5a7a3a" />
      </Hot>
      <Hot spot="table" chosen={chosen} onPick={onPick} label={name('table')} x={440} y={180}>
        <ellipse cx={440} cy={275} rx={80} ry={18} fill="#7a4a22" stroke="#1a120c" strokeWidth={3} />
        <rect x={430} y={275} width={20} height={45} fill="#5a3418" />
        {[[370, 232, '#8a3a2a'], [440, 222, '#3a5a8a'], [510, 232, '#5a7a3a']].map(([x, y, c]) => (
          <g key={String(x)}><circle cx={Number(x)} cy={Number(y)} r={13} fill="#e0b080" /><rect x={Number(x) - 14} y={Number(y) + 12} width={28} height={30} fill={String(c)} /></g>
        ))}
        <rect x={415} y={262} width={8} height={10} fill="#c8a060" /><rect x={460} y={262} width={8} height={10} fill="#c8a060" />
      </Hot>
      <Hot spot="rooms" chosen={chosen} onPick={onPick} label={name('rooms')} x={680} y={60}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={600 + i * 22} y={250 - i * 26} width={60} height={10} fill="#8a5a32" stroke="#1a120c" strokeWidth={2} />)}
        <rect x={700} y={60} width={60} height={34} fill="#3a2414" stroke="#1a120c" strokeWidth={2} />
        <rect x={712} y={70} width={14} height={24} fill="#6a4226" /><rect x={734} y={70} width={14} height={24} fill="#6a4226" />
      </Hot>
    </>
  );
}

/** A village or city street: tavern, smithy, training yard, market, merchant, and a portal in a city. */
function TownStreet({ chosen, onPick, name, city }: { chosen: Spot | null; onPick: (s: Spot) => void; name: (s: Spot) => string; city: boolean }) {
  return (
    <>
      <rect width={800} height={360} fill={city ? '#3a4a6a' : '#5a7aa0'} />
      <circle cx={680} cy={60} r={26} fill="#ffe8a0" opacity={0.9} />
      {city && <><rect x={0} y={120} width={800} height={30} fill="#6a6a78" /><rect x={0} y={112} width={800} height={10} fill="#8a8a98" />{[...Array(20)].map((_, i) => <rect key={i} x={i * 40} y={104} width={20} height={10} fill="#8a8a98" />)}</>}
      {city && (
        <Hot spot="castle" chosen={chosen} onPick={onPick} label={name('castle')} x={250} y={18}>
          <rect x={212} y={52} width={76} height={60} fill="#7a7a88" stroke="#1a120c" strokeWidth={2} />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={214 + i * 20} y={44} width={12} height={10} fill="#7a7a88" stroke="#1a120c" strokeWidth={1.5} />)}
          {[184, 288].map((x) => (
            <g key={x}>
              <rect x={x} y={36} width={28} height={76} fill="#8a8a98" stroke="#1a120c" strokeWidth={2} />
              <polygon points={`${x - 4},36 ${x + 14},8 ${x + 32},36`} fill="#5a3a6a" stroke="#1a120c" strokeWidth={2} />
              <rect x={x + 10} y={54} width={8} height={12} fill="#ffd070" stroke="#1a120c" />
            </g>
          ))}
          <path d="M238 112 L238 86 Q250 72 262 86 L262 112 Z" fill="#3a2414" stroke="#1a120c" strokeWidth={2} />
          <rect x={249} y={20} width={2} height={26} fill="#1a120c" /><path d="M251 20 L268 25 L251 30 Z" fill="#d8b040" />
        </Hot>
      )}
      <rect y={260} width={800} height={100} fill={city ? '#7a7464' : '#6a8a42'} />
      <path d="M0 300 Q400 270 800 300 L800 330 Q400 300 0 330 Z" fill={city ? '#9a927c' : '#a08a5a'} />
      <Hot spot="tavern" chosen={chosen} onPick={onPick} label={name('tavern')} x={95} y={110}>
        <House x={30} y={170} w={130} h={90} wall="#c8a878" roof="#7a2a1a" />
        <rect x={160} y={175} width={4} height={40} fill="#1a120c" /><rect x={164} y={180} width={28} height={18} fill="#c89a5a" stroke="#1a120c" />
      </Hot>
      <Hot spot="smith" chosen={chosen} onPick={onPick} label={name('smith')} x={275} y={130}>
        <House x={215} y={185} w={120} h={75} wall="#8a7a6a" roof="#3a3a44" />
        <rect x={300} y={130} width={18} height={40} fill="#5a5a60" stroke="#1a120c" /><circle cx={309} cy={120} r={8} fill="#aaa" opacity={0.5} />
        <rect x={340} y={235} width={34} height={14} fill="#3a3a44" /><rect x={348} y={249} width={18} height={12} fill="#2a2a30" />
        <circle cx={226} cy={238} r={7} fill="#ff8a3a" />
      </Hot>
      <Hot spot="yard" chosen={chosen} onPick={onPick} label={name('yard')} x={440} y={180}>
        <rect x={395} y={230} width={100} height={6} fill="#6a4226" /><rect x={395} y={250} width={100} height={6} fill="#6a4226" />
        {[400, 440, 480].map((x) => <rect key={x} x={x} y={222} width={6} height={44} fill="#5a3418" />)}
        <circle cx={445} cy={205} r={10} fill="#c8a060" stroke="#1a120c" /><rect x={440} y={214} width={10} height={20} fill="#c8a060" />
        <rect x={420} y={200} width={50} height={4} fill="#8a5a32" />
      </Hot>
      <Hot spot="market" chosen={chosen} onPick={onPick} label={name('market')} x={580} y={170}>
        {[[520, '#c84a3a'], [590, '#3a7ac8']].map(([x, c]) => (
          <g key={String(x)}>
            <rect x={Number(x)} y={235} width={60} height={30} fill="#8a5a32" stroke="#1a120c" strokeWidth={2} />
            <path d={`M${Number(x) - 6} 205 L${Number(x) + 66} 205 L${Number(x) + 60} 222 L${Number(x)} 222 Z`} fill={String(c)} stroke="#1a120c" strokeWidth={2} />
            <rect x={Number(x) + 2} y={222} width={4} height={14} fill="#5a3418" /><rect x={Number(x) + 54} y={222} width={4} height={14} fill="#5a3418" />
            <circle cx={Number(x) + 15} cy={232} r={6} fill="#e0503a" /><circle cx={Number(x) + 30} cy={232} r={6} fill="#e0c03a" /><circle cx={Number(x) + 45} cy={232} r={6} fill="#7ac03a" />
          </g>
        ))}
      </Hot>
      <Hot spot="shop" chosen={chosen} onPick={onPick} label={name('shop')} x={720} y={city ? 150 : 120}>
        <House x={665} y={180} w={110} h={80} wall="#b8c0a0" roof="#3a6a3a" />
        <rect x={680} y={160} width={24} height={14} fill="#c8a0e0" stroke="#1a120c" />
      </Hot>
      {city && (
        <Hot spot="mystic" chosen={chosen} onPick={onPick} label={name('mystic')} x={600} y={22}>
          <rect x={580} y={58} width={40} height={92} fill="#3a2a5a" stroke="#1a120c" strokeWidth={2} />
          <polygon points="572,58 600,12 628,58" fill="#5a3a8a" stroke="#1a120c" strokeWidth={2} />
          <rect x={592} y={78} width={16} height={20} fill="#c9b8ff" stroke="#1a120c" />
          <circle cx={600} cy={10} r={4} fill="#ffe08a" />
          <rect x={593} y={112} width={14} height={22} fill="#8f7bff" opacity={0.6} />
        </Hot>
      )}
      {city && (
        <Hot spot="portal" chosen={chosen} onPick={onPick} label={name('portal')} x={400} y={40}>
          <ellipse cx={400} cy={88} rx={26} ry={34} fill="#120c22" stroke="#8f7bff" strokeWidth={5} />
          <ellipse cx={400} cy={88} rx={14} ry={20} fill="#8f7bff" opacity={0.4} />
        </Hot>
      )}
    </>
  );
}

/** The settlement as a picture; each building or corner is a button. */
export function TownScene({ place, chosen, onPick, name }: { place: 'inn' | 'village' | 'city'; chosen: Spot | null; onPick: (s: Spot) => void; name: (s: Spot) => string }) {
  return (
    <svg className="town-scene" viewBox="0 0 800 360" role="group" aria-label={name(place === 'inn' ? 'bar' : 'tavern')}>
      {place === 'inn' ? <InnScene chosen={chosen} onPick={onPick} name={name} /> : <TownStreet chosen={chosen} onPick={onPick} name={name} city={place === 'city'} />}
    </svg>
  );
}
