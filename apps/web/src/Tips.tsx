import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from './i18n';

/** First-game tips: each shows once, the first time its moment comes, until the player taps OK. */
export type TipId = 'move' | 'event' | 'combat' | 'town' | 'endTurn';

const TIPS: Record<TipId, { pl: string; en: string }> = {
  move: {
    pl: 'Dotknij sąsiedni fragment, by tam wyruszyć. Każdy krok kosztuje Szybkość. Ciemne fragmenty odsłaniają się, gdy na nie wejdziesz.',
    en: 'Tap a neighbouring fragment to travel there. Each step costs Speed. Dark fragments are revealed when you enter them.',
  },
  event: {
    pl: 'Zdarzenie! Opcje z testem pokazują szansę powodzenia. Niektóre kosztują Wytrzymałość albo złoto.',
    en: 'An event! Options with a test show your chance of success. Some cost Stamina or gold.',
  },
  combat: {
    pl: 'Walka. Atak rzuca na Walkę, parowanie blokuje cios, skupienie daje +10 w następnej rundzie, a ucieczka to przeciwstawny test Zręczności. Pasek szansy podpowie, kiedy lepiej uciec.',
    en: 'A fight. Attack tests Combat, parry blocks a blow, focus gives +10 next round, and fleeing is an opposed Dexterity test. The odds line tells you when running is wiser.',
  },
  town: {
    pl: 'Jesteś w osadzie. Otwórz „Osada”, by kupić, sprzedać albo skorzystać z usług.',
    en: 'You are in a settlement. Open "Town" to buy, sell or use its services.',
  },
  endTurn: {
    pl: 'Nie masz już Szybkości. Rozbij obóz, by odpocząć, albo zakończ turę. Nowa tura przywraca Szybkość i Wytrzymałość.',
    en: 'You are out of Speed. Camp to rest, or end your turn. A new turn restores Speed and Stamina.',
  },
};

const KEY = 'hidden-paths.tips';

function seenTips(): TipId[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function Tip({ candidates }: { candidates: TipId[] }) {
  const { tx } = useT();
  const [seen, setSeen] = useState<TipId[]>(seenTips);
  const tip = candidates.find((c) => !seen.includes(c));
  const dismiss = () => {
    if (!tip) return;
    const next = [...seen, tip];
    setSeen(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage can be unavailable */
    }
  };
  return (
    <AnimatePresence>
      {tip && (
        <motion.aside key={tip} className="tip" role="status" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
          <p>{tx(TIPS[tip])}</p>
          <button className="primary small" onClick={dismiss}>OK</button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
