// Fight balance check: how often a fresh level-1 hero beats each random foe by attacking. Run: npx tsx packages/engine/scripts/balance.ts
import { PROFESSIONS, RANDOM_FOES } from '@hp/content';
import { applyAction, createGame, worldView, type GameState } from '../src/index';
import { startCombat } from '../src/combat';

const N = 400;
const heroes = Object.values(PROFESSIONS).filter((p) => p.mvp);
const rows: string[] = [];
for (const foe of RANDOM_FOES) {
  let won = 0, lost = 0, fled = 0, hpLeft = 0;
  for (let i = 0; i < N; i++) {
    const prof = heroes[i % heroes.length]!;
    let g: GameState = createGame(`sim-${foe}-${i}`, { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
      [{ id: 'p', character: { name: 'S', race: prof.race, profession: prof.id, bonus: { com: 10 }, missions: ['hunter', 'scout'] } }]);
    const me = g.players[0]!;
    me.combat = startCombat(worldView(g), [foe]);
    for (let t = 0; t < 60 && g.players[0]!.combat; t++) {
      const c = g.players[0]!.combat!;
      const target = c.foes.find((f) => f.vitality > 0)!.uid;
      g = applyAction(g, 'p', { type: 'combat', move: { move: 'attack', target } });
    }
    const end = [...g.log].reverse().find((e) => e.type === 'combatEnded') as { result: string } | undefined;
    if (end?.result === 'won') { won++; hpLeft += g.players[0]!.character.vitality / g.players[0]!.character.maxVitality; }
    else if (end?.result === 'fled') fled++; else lost++;
  }
  rows.push(`${foe.padEnd(12)} win ${(100 * won / N).toFixed(0).padStart(3)}%  lose ${(100 * lost / N).toFixed(0).padStart(3)}%  hp left when won ${(100 * hpLeft / Math.max(1, won)).toFixed(0)}%`);
}
console.log(rows.join('\n'));
