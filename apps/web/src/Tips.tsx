import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from './i18n';

/** First-game tips: each shows once, the first time its moment comes, until the player taps OK. */
export type TipId = 'move' | 'event' | 'combat' | 'town' | 'endTurn';

const TIPS: Record<TipId, { pl: string; en: string }> = {
  move: {
    pl: 'Dotknij sąsiedni fragment, by tam wyruszyć. Każdy krok kosztuje Szybkość i 1 Wytrzymałość. Ciemne fragmenty odsłaniają się, gdy na nie wejdziesz.',
    en: 'Tap a neighbouring fragment to travel there. Each step costs Speed and 1 Stamina. Dark fragments are revealed when you enter them.',
  },
  event: {
    pl: 'Zdarzenie! Opcje z testem pokazują szansę powodzenia. Niektóre kosztują Wytrzymałość albo złoto.',
    en: 'An event! Options with a test show your chance of success. Some cost Stamina or gold.',
  },
  combat: {
    pl: 'Walka. Po walce runda się kończy. Atak rzuca na Walkę, parowanie blokuje cios, skupienie daje +10 w następnej rundzie, a ucieczka to przeciwstawny test Zręczności. Pasek szansy podpowie, kiedy lepiej uciec.',
    en: 'A fight. When it ends, so does your round. Attack tests Combat, parry blocks a blow, focus gives +10 next round, and fleeing is an opposed Dexterity test. The odds line tells you when running is wiser.',
  },
  town: {
    pl: 'Jesteś w osadzie. Otwórz „Osada”, by kupić, sprzedać albo skorzystać z usług.',
    en: 'You are in a settlement. Open "Town" to buy, sell or use its services.',
  },
  endTurn: {
    pl: 'Nie możesz już iść dalej. Rozbij obóz, jeśli masz Wytrzymałość, albo zakończ turę. Nowa tura przywraca Szybkość i Wytrzymałość. Nie zapomnij zjeść posiłku (ikona bochenka), inaczej grozi głód.',
    en: 'You cannot travel further. Camp if you have Stamina left, or end your turn. A new turn restores Speed and Stamina. Do not forget to eat (the bread icon), or hunger sets in.',
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
