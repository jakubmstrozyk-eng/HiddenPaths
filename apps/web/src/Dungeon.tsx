import { motion } from 'motion/react';
import { DUNGEON_THEMES, EVENT_BY_ID, type RoomKind, type Text } from '@hp/content';
import { roomSpeed, type Action, type Dungeon, type GameState, type PlayerState } from '@hp/engine';
import { HeroArt } from './HeroArt';
import { useT } from './i18n';

const KIND: Record<RoomKind, { icon: string; name: Text }> = {
  trap: { icon: '⚠', name: { pl: 'Pułapka', en: 'Trap' } },
  puzzle: { icon: '᛭', name: { pl: 'Zagadka', en: 'Puzzle' } },
  guard: { icon: '⚔', name: { pl: 'Strażnica', en: 'Guard room' } },
  special: { icon: '✦', name: { pl: 'Komnata', en: 'Chamber' } },
  shrine: { icon: '♨', name: { pl: 'Kapliczka', en: 'Shrine' } },
  side: { icon: '🗝', name: { pl: 'Skarbczyk', en: 'Treasury' } },
  boss: { icon: '☠', name: { pl: 'Pan lochu', en: 'Lord' } },
  vault: { icon: '◈', name: { pl: 'Skarbiec', en: 'Vault' } },
};

/**
 * Where each room sits on the dungeon board: columns by steps from the entrance, the two sides of
 * the fork one above the other, and the side treasury under the room it opens from.
 */
function placeRooms(d: Dungeon): { col: number; row: number }[] {
  const out = d.rooms.map(() => ({ col: -1, row: 1 }));
  const visit = (room: number, col: number, row: number) => {
    if (out[room]!.col >= col) return;
    out[room] = { col, row };
    const next = d.rooms[room]!.next;
    const main = next.filter((n) => d.rooms[n]!.kind !== 'side');
    main.forEach((n, i) => visit(n, col + 1, main.length > 1 ? i * 2 : 1));
    for (const n of next) if (d.rooms[n]!.kind === 'side') out[n] = { col, row: 3 };
  };
  d.entry.forEach((room, i) => visit(room, 1, d.entry.length > 1 ? i * 2 : 1));
  return out;
}

/**
 * The dungeon: a dark board of rooms. A room the player has stood in shows what it is; the others are
 * dark doorways, so at the fork the first choice is made blind (Jacob, 2026-11-26).
 */
export function DungeonBoard({ game, me, actions, act, onClose }: {
  game: GameState; me: PlayerState; actions: Action[]; act: (a: Action) => void; onClose: () => void;
}) {
  const { tx, locale } = useT();
  const pl = locale === 'pl';
  const d = game.dungeon!;
  const theme = DUNGEON_THEMES[d.theme];
  const spots = placeRooms(d);
  const cols = Math.max(...spots.map((s) => s.col)) + 1;
  const walk = new Map(actions.flatMap((a) => (a.type === 'dungeon' && a.to !== 'exit' ? [[a.to, a] as const] : [])));
  const exit = actions.find((a) => a.type === 'dungeon' && a.to === 'exit');
  const here = me.delve?.room;
  const others = game.players.filter((p) => p.id !== me.id && p.delve);
  const cell = (col: number, row: number) => ({ gridColumn: col + 1, gridRow: row + 1 });

  return (
    <section className={`dungeon theme-${d.theme}`} aria-label={tx(theme.name)}>
      <header className="dungeon-head">
        <b>{tx(theme.name)}</b>
        <small>{tx(theme.blurb)}</small>
      </header>
      <div className="dungeon-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        <svg className="dungeon-links" aria-hidden="true" viewBox={`0 0 ${cols * 10} 40`} preserveAspectRatio="none">
          {d.entry.map((r) => <line key={`e${r}`} x1={5} y1={15} x2={spots[r]!.col * 10 + 5} y2={spots[r]!.row * 10 + 5} />)}
          {d.rooms.flatMap((room, i) => room.next.map((n) => (
            <line key={`${i}-${n}`} x1={spots[i]!.col * 10 + 5} y1={spots[i]!.row * 10 + 5} x2={spots[n]!.col * 10 + 5} y2={spots[n]!.row * 10 + 5} className={room.cleared ? 'lit' : ''} />
          )))}
        </svg>
        <button className={`room entrance ${here === undefined ? 'here' : ''} ${exit ? 'reachable' : ''}`} style={cell(0, 1)} disabled={!exit} onClick={() => exit && act(exit)}>
          <span className="room-icon">⇡</span>
          <small>{me.delve ? (pl ? 'Wyjście' : 'Way out') : (pl ? 'Wejście' : 'Entrance')}</small>
          {here === undefined && <Figure me={me} />}
        </button>
        {d.rooms.map((room, i) => {
          const seen = room.seenBy.includes(me.id);
          const move = walk.get(i);
          const kind = KIND[room.kind];
          const title = seen ? tx(EVENT_BY_ID[room.card]!.title) : pl ? 'Ciemny korytarz' : 'Dark corridor';
          return (
            <button
              key={i}
              className={`room ${seen ? 'seen' : 'dark'} ${room.cleared ? 'cleared' : ''} ${move ? 'reachable' : ''} ${here === i ? 'here' : ''} kind-${seen ? room.kind : 'unknown'}`}
              style={cell(spots[i]!.col, spots[i]!.row)}
              disabled={!move}
              onClick={() => move && act(move)}
              aria-label={title}
              title={title}
            >
              <span className="room-icon">{seen ? kind.icon : '?'}</span>
              <small>{seen ? tx(kind.name) : '???'}</small>
              {room.cleared && <span className="room-done" aria-hidden="true">✓</span>}
              {others.filter((p) => p.delve!.room === i).map((p) => (
                <span key={p.id} className="room-other"><HeroArt race={p.character.race} profession={p.character.profession} look={p.character.look} size={20} /></span>
              ))}
              {here === i && <Figure me={me} />}
            </button>
          );
        })}
      </div>
      <footer className="dungeon-foot">
        <small>
          {d.plundered
            ? (pl ? 'Skarbiec jest pusty. Ten loch został oczyszczony.' : 'The vault is empty. This dungeon has been cleared.')
            : (pl ? `Każda komnata: ${roomSpeed(game)} Sz. i 1 Wt. Wyjście: 1 Sz. Odpoczynek tylko w kapliczce.` : `Each room: ${roomSpeed(game)} Speed and 1 Stamina. Way out: 1 Speed. Rest only at the shrine.`)}
        </small>
        {!me.delve && <button className="ghost small" onClick={onClose}>{pl ? 'Wróć na mapę' : 'Back to the map'}</button>}
      </footer>
    </section>
  );
}

function Figure({ me }: { me: PlayerState }) {
  const c = me.character;
  return (
    <motion.span className="room-hero" layoutId="dungeon-hero" transition={{ duration: 0.5, ease: 'easeInOut' }}>
      <HeroArt race={c.race} profession={c.profession} look={c.look} size={34} walking={false} />
    </motion.span>
  );
}
