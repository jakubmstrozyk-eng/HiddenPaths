import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import type { Locale } from '@hp/content';
import type { GameConfig, GameState } from '@hp/engine';
import { DarkMatter } from './DarkMatter';
import { LocaleContext, useT, type UiKey } from './i18n';
import { SetupScreen } from './screens/Setup';
import { CharacterScreen } from './screens/Character';
import { GameScreen } from './screens/Game';

type Screen =
  | { name: 'menu' }
  | { name: 'setup' }
  | { name: 'character'; config: GameConfig }
  | { name: 'game'; game: GameState };

const SAVE_KEY = 'hidden-paths.save';

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

function writeSave(game: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch {
    /* storage can be unavailable; the game still runs */
  }
}

export function App() {
  const [locale, setLocale] = useState<Locale>(() => (navigator.language.startsWith('pl') ? 'pl' : 'en'));
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [save, setSave] = useState<GameState | null>(loadSave);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const play = (game: GameState) => {
    writeSave(game);
    setSave(game);
    setScreen({ name: 'game', game });
  };

  return (
    <LocaleContext.Provider value={locale}>
      <MotionConfig reducedMotion="user">
        <DarkMatter />
        <button className="lang" onClick={() => setLocale(locale === 'pl' ? 'en' : 'pl')}>
          {locale === 'pl' ? 'EN' : 'PL'}
        </button>
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {screen.name === 'menu' && (
              <MainMenu
                key="menu"
                hasSave={!!save}
                onNew={() => setScreen({ name: 'setup' })}
                onContinue={() => save && setScreen({ name: 'game', game: save })}
              />
            )}
            {screen.name === 'setup' && (
              <Opened key="setup" tile="newGame">
                <SetupScreen
                  onBack={() => setScreen({ name: 'menu' })}
                  onNext={(config) => setScreen({ name: 'character', config })}
                />
              </Opened>
            )}
            {screen.name === 'character' && (
              <Opened key="character">
                <CharacterScreen
                  config={screen.config}
                  onBack={() => setScreen({ name: 'setup' })}
                  onStart={play}
                />
              </Opened>
            )}
            {screen.name === 'game' && (
              <Opened key="game" tile="continue">
                <GameScreen
                  game={screen.game}
                  onChange={(g) => {
                    writeSave(g);
                    setSave(g);
                    setScreen({ name: 'game', game: g });
                  }}
                  onMenu={() => setScreen({ name: 'menu' })}
                />
              </Opened>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </MotionConfig>
    </LocaleContext.Provider>
  );
}

/** A screen that grows out of the white menu tile it was opened from. */
function Opened({ tile, children }: { tile?: UiKey; children: React.ReactNode }) {
  return (
    <motion.section
      className="opened"
      layoutId={tile ? `tile-${tile}` : undefined}
      initial={tile ? { backgroundColor: 'rgba(255,255,255,1)' } : { opacity: 0 }}
      animate={{ backgroundColor: 'rgba(255,255,255,0)', opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <motion.div
        className="opened-inner"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}

function MainMenu({ hasSave, onNew, onContinue }: { hasSave: boolean; onNew: () => void; onContinue: () => void }) {
  const { t } = useT();
  const tiles: { key: UiKey; onClick?: () => void; note?: string }[] = [
    { key: 'newGame', onClick: onNew },
    { key: 'continue', onClick: hasSave ? onContinue : undefined, note: hasSave ? undefined : t('noGames') },
    { key: 'multiplayer', note: t('soon') },
    { key: 'settings', note: t('soon') },
  ];
  return (
    <motion.main className="menu" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.h1
        className="title"
        initial={{ opacity: 0, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, letterSpacing: '0.18em' }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      >
        Hidden Paths
      </motion.h1>
      <p className="tagline">{t('tagline')}</p>
      <div className="tiles">
        {tiles.map((tile, i) => (
          <motion.button
            key={tile.key}
            layoutId={`tile-${tile.key}`}
            className="tile"
            disabled={!tile.onClick}
            onClick={tile.onClick}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            whileHover={tile.onClick ? { scale: 1.04 } : undefined}
            whileTap={tile.onClick ? { scale: 0.97 } : undefined}
          >
            <span>{t(tile.key)}</span>
            {tile.note && <small>{tile.note}</small>}
          </motion.button>
        ))}
      </div>
    </motion.main>
  );
}
