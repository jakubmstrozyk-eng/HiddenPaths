import type { TerrainAction, TerrainId } from '@hp/content';
import { ACTION_COST } from '@hp/engine';

type Txt = { pl: string; en: string };

/** What a terrain action asks for and what it brings, written out for its button. Mirrors runTerrainAction. */
export function actionInfo(action: TerrainAction, terrain: TerrainId): { test: Txt | null; reward: Txt; risk?: Txt; cost: number } {
  const cost = ACTION_COST[action] ?? 0;
  switch (action) {
    case 'hunt': {
      const food = terrain === 'mountains' || terrain === 'river' ? 1 : 2;
      return { cost, test: { pl: 'Zręczność + Łowiectwo', en: 'Dexterity + Hunting' }, reward: { pl: `+${food} jedzenia`, en: `+${food} food` } };
    }
    case 'gather':
      return { cost, test: { pl: 'Inteligencja +10', en: 'Intelligence +10' }, reward: { pl: '+1 jedzenia', en: '+1 food' } };
    case 'herbalism':
      return { cost, test: { pl: 'Inteligencja + Zielarstwo', en: 'Intelligence + Herbalism' }, reward: { pl: 'losowe zioło', en: 'a random herb' } };
    case 'mine':
      if (terrain === 'forest') return { cost, test: { pl: 'Zręczność + Wydobycie', en: 'Dexterity + Mining' }, reward: { pl: '1 drewno', en: '1 wood' } };
      if (terrain === 'cave') return { cost, test: { pl: 'Zręczność + Wydobycie', en: 'Dexterity + Mining' }, reward: { pl: '1 ruda i grzyb (+1 jedzenia)', en: '1 ore and a mushroom (+1 food)' } };
      return { cost, test: { pl: 'Zręczność + Wydobycie', en: 'Dexterity + Mining' }, reward: { pl: '2 rudy, może rzadki kruszec', en: '2 ores, maybe a rare one' } };
    case 'swim':
      return {
        cost, test: { pl: 'Zręczność i Siła', en: 'Dexterity and Strength' },
        reward: { pl: 'przejście przez rzekę', en: 'crossing the river' }, risk: { pl: 'porażka: −6 Żyw.', en: 'failure: −6 Vitality' },
      };
    case 'meditate':
      return { cost, test: null, reward: { pl: '+20 do losowej cechy na 3 rundy', en: '+20 to a random attribute for 3 rounds' } };
    default:
      return { cost, test: null, reward: { pl: '', en: '' } };
  }
}
