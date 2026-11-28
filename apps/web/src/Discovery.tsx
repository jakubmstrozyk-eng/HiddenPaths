import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TERRAINS, type TerrainAction, type TerrainId } from '@hp/content';
import { ACTION_COST } from '@hp/engine';
import { TerrainMotif } from './TerrainArt';
import { Icon, type IconName } from './Icons';
import { useT } from './i18n';
import { xpWords } from './outcomeText';

type Txt = { pl: string; en: string };
type Chip = { icon: IconName; name: Txt; value: Txt };

/** How long the reveal stays before it fades by itself (a few seconds, Jacob 2026-11-28). */
export const DISCOVERY_MS = 3800;

/** The short label under each action: what one success brings. Mirrors actionInfo, kept tiny for the reveal. */
function chipOf(action: TerrainAction, terrain: TerrainId): Chip | null {
  switch (action) {
    case 'hunt': {
      const food = terrain === 'mountains' || terrain === 'river' ? 1 : 2;
      return { icon: 'hunt', name: { pl: 'Polowanie', en: 'Hunt' }, value: { pl: `+${food} jedzenia`, en: `+${food} food` } };
    }
    case 'gather': return { icon: 'gather', name: { pl: 'Zbieractwo', en: 'Gather' }, value: { pl: '+1 jedzenia', en: '+1 food' } };
    case 'herbalism': return { icon: 'herbalism', name: { pl: 'Zielarstwo', en: 'Herbalism' }, value: { pl: '+1 zioło', en: '+1 herb' } };
    case 'mine':
      if (terrain === 'forest') return { icon: 'mine', name: { pl: 'Wycinka', en: 'Logging' }, value: { pl: '+1 drewno', en: '+1 wood' } };
      if (terrain === 'cave') return { icon: 'mine', name: { pl: 'Wydobycie', en: 'Mining' }, value: { pl: '+1 ruda, +1 grzyb', en: '+1 ore, +1 mushroom' } };
      return { icon: 'mine', name: { pl: 'Wydobycie', en: 'Mining' }, value: { pl: '+2 rudy', en: '+2 ore' } };
    case 'swim': return { icon: 'swim', name: { pl: 'Przepłynięcie', en: 'Swim' }, value: { pl: 'na drugi brzeg', en: 'to the far bank' } };
    case 'meditate': return { icon: 'meditate', name: { pl: 'Medytacja', en: 'Meditate' }, value: { pl: '+20 do cechy', en: '+20 to a stat' } };
    case 'camp': return { icon: 'camp', name: { pl: 'Obóz', en: 'Camp' }, value: { pl: '+2 Żywotności', en: '+2 Vitality' } };
    default: return null;
  }
}

const TOWN_CHIPS: Record<string, Chip> = {
  meal: { icon: 'food', name: { pl: 'Posiłek', en: 'Meal' }, value: { pl: 'ciepła strawa', en: 'a hot meal' } },
  stay: { icon: 'vitality', name: { pl: 'Nocleg', en: 'Rooms' }, value: { pl: 'pełne siły', en: 'full rest' } },
  gossip: { icon: 'town', name: { pl: 'Plotki', en: 'Gossip' }, value: { pl: 'wieści z krainy', en: 'news of the land' } },
  market: { icon: 'gold', name: { pl: 'Targ', en: 'Market' }, value: { pl: 'kupno i sprzedaż', en: 'buy and sell' } },
  smith: { icon: 'sword', name: { pl: 'Kuźnia', en: 'Smithy' }, value: { pl: 'broń i pancerz', en: 'arms and armour' } },
  portal: { icon: 'map', name: { pl: 'Portal', en: 'Portal' }, value: { pl: 'do innych miast', en: 'to other cities' } },
};

/** The chips shown along the bottom: the fragment's own actions, at most five. */
export function discoveryChips(terrain: TerrainId): Chip[] {
  const t = TERRAINS[terrain];
  if (t.settlement || terrain === 'inn') {
    return t.actions.flatMap((a) => (TOWN_CHIPS[a] ? [TOWN_CHIPS[a]!] : [])).slice(0, 5);
  }
  return t.actions
    .filter((a) => a === 'camp' || ACTION_COST[a] !== undefined)
    .flatMap((a) => { const c = chipOf(a, terrain); return c ? [c] : []; })
    .slice(0, 5);
}

/**
 * A new fragment is found: its name grows out of the dark with its motif (a tree for the forest),
 * the actions it offers line up below, with the Speed it took and the XP for finding it.
 * A short one-off, CSS only (transform and opacity); a tap anywhere skips it.
 */
export function Discovery({ terrain, xp, speed, onDone }: { terrain: TerrainId; xp: number; speed: number; onDone: () => void }) {
  const { tx, locale } = useT();
  const chips = discoveryChips(terrain);
  useEffect(() => {
    const id = window.setTimeout(onDone, DISCOVERY_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);
  // On the page itself, above the hand of cards and every panel of the game screen.
  return createPortal(
    <div className="discovery" role="dialog" aria-label={tx(TERRAINS[terrain].name)} onClick={onDone}>
      <div className="disc-inner">
        <div className="disc-kicker">{tx({ pl: 'Odkryto nowy fragment', en: 'New fragment found' })}</div>
        <div className="disc-motif"><TerrainMotif terrain={terrain} /></div>
        <h2 className="disc-name">{tx(TERRAINS[terrain].name)}</h2>
        {xp > 0 && (
          <div className="disc-xp">
            <Icon name="xp" size={18} />
            <span><b>+{xp}</b> {xpWords(xp, locale)} {tx({ pl: 'za odkrycie terenu', en: 'for finding new land' })}</span>
          </div>
        )}
        <div className="disc-chips">
          {speed > 0 && (
            <div className="disc-chip speed" style={{ animationDelay: '1.05s' }}>
              <Icon name="speed" size={20} />
              <b>{tx({ pl: 'Szybkość', en: 'Speed' })}</b>
              <small>−{speed}</small>
            </div>
          )}
          {chips.map((c, i) => (
            <div key={c.icon + i} className="disc-chip" style={{ animationDelay: `${1.15 + i * 0.12}s` }}>
              <Icon name={c.icon} size={20} />
              <b>{tx(c.name)}</b>
              <small>{tx(c.value)}</small>
            </div>
          ))}
          {chips.length === 0 && (
            <div className="disc-chip" style={{ animationDelay: '1.15s' }}>
              <b>{tx({ pl: 'Tu nic nie zdobędziesz', en: 'Nothing to gain here' })}</b>
            </div>
          )}
        </div>
        <div className="disc-skip">{tx({ pl: 'dotknij, by pominąć', en: 'tap to skip' })}</div>
      </div>
      <div className="disc-bar" style={{ animationDuration: `${DISCOVERY_MS}ms` }} />
    </div>,
    document.body,
  );
}
