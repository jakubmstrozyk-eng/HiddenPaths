import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import type { Locale } from '@hp/content';
import { createGame, type CharacterInput, type GameConfig, type GameState } from '@hp/engine';
import { api, getSession, serverAvailable, setSession, type Me } from './api';
import { DarkMatter } from './DarkMatter';
import { LocaleContext, useT, type UiKey } from './i18n';
import { SetupScreen } from './screens/Setup';
import { CharacterScreen } from './screens/Character';
import { GameScreen } from './screens/Game';
import { AccountScreen, GamesScreen, MultiplayerScreen, OnlineGame, SignInScreen } from './screens/Online';

type Screen =
  | { name: 'menu' }
  | { name: 'setup'; multi: boolean }
  | { name: 'character'; config: GameConfig; maxPlayers: number; joinCode?: string }
  | { name: 'game'; game: GameState }
  | { name: 'signin'; then: Screen }
  | { name: 'games' }
  | { name: 'multi'; code?: string }
  | { name: 'online'; id: string }
  | { name: 'account' };

const SAVE_KEY = 'hidden-paths.save';
/** Where to go after the emailed sign-in link brings the player back. */
const AFTER_KEY = 'hidden-paths.after';

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const game = raw ? (JSON.parse(raw) as GameState) : null;
    // Saves from before event cards and combat lack the newer fields; start fresh.
    return game && Array.isArray(game.eventDeck) && typeof game.logSeq === 'number' ? game : null;
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

function remember(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A screen to come back to after sign-in, as a short string that survives the emailed link. */
function afterOf(s: Screen): string {
  if (s.name === 'online') return `game:${s.id}`;
  if (s.name === 'multi') return s.code ? `join:${s.code}` : 'multi:';
  if (s.name === 'setup') return s.multi ? 'multi:' : 'new:';
  return `${s.name}:`;
}
function screenOf(after: string): Screen {
  const [kind, value = ''] = after.split(':');
  if (kind === 'game') return { name: 'online', id: value };
  if (kind === 'join') return { name: 'multi', code: value };
  if (kind === 'multi') return { name: 'multi' };
  if (kind === 'new') return { name: 'setup', multi: false };
  if (kind === 'games') return { name: 'games' };
  if (kind === 'account') return { name: 'account' };
  return { name: 'menu' };
}

/** Reads ?login, ?game and ?join from the address and clears them. */
function takeParams() {
  const url = new URL(location.href);
  const p = { login: url.searchParams.get('login'), game: url.searchParams.get('game'), join: url.searchParams.get('join') };
  if (p.login || p.game || p.join) history.replaceState(null, '', url.pathname);
  return p;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(() => (navigator.language.startsWith('pl') ? 'pl' : 'en'));
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [save, setSave] = useState<GameState | null>(loadSave);
  /** null while checking; false in a copy without a server, which plays solo games on this device. */
  const [online, setOnline] = useState<boolean | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Each screen opens at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen.name]);

  useEffect(() => {
    const params = takeParams();
    (async () => {
      if (!(await serverAvailable())) return setOnline(false);
      setOnline(true);
      let user: Me | null = null;
      if (params.login) {
        try {
          const r = await api.verifyLogin(params.login, locale);
          setSession(r.session);
          user = r.user;
        } catch (e) {
          setNotice((e as Error).message);
        }
      } else if (getSession()) {
        user = await api.me().then((r) => r.user, () => (setSession(null), null));
      }
      if (user) {
        setMe(user);
        setLocale(user.locale === 'pl' ? 'pl' : 'en');
      }
      // A link from an email or an invite says where to go; remember it across sign-in.
      const after = params.game ? `game:${params.game}` : params.join ? `join:${params.join}` : recall(AFTER_KEY);
      if (!after) return;
      const target = screenOf(after);
      if (user) {
        remember(AFTER_KEY, null);
        setScreen(target);
      } else {
        remember(AFTER_KEY, after);
        setScreen({ name: 'signin', then: target });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Server screens need a signed-in player; otherwise sign in first and come back. */
  const go = (target: Screen) => {
    if (online && !me) {
      remember(AFTER_KEY, afterOf(target));
      setScreen({ name: 'signin', then: target });
    } else setScreen(target);
  };

  const play = (game: GameState) => {
    writeSave(game);
    setSave(game);
    setScreen({ name: 'game', game });
  };

  const startGame = async (config: GameConfig, maxPlayers: number, joinCode: string | undefined, character: CharacterInput, seed: string) => {
    if (!online) return play(createGame(seed, config, [{ id: 'you', character }]));
    const { id } = joinCode ? await api.join(joinCode, character) : await api.create(config, character, maxPlayers, seed);
    setScreen({ name: 'online', id });
  };

  const join = async (code: string) => {
    try {
      const info = await api.invite(code);
      setScreen({ name: 'character', config: info.config, maxPlayers: info.max_players, joinCode: code });
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const changeLocale = () => {
    const next = locale === 'pl' ? 'en' : 'pl';
    setLocale(next);
    if (me) api.updateMe(me.display_name, next).then((r) => setMe(r.user), () => {});
  };

  return (
    <LocaleContext.Provider value={locale}>
      <MotionConfig reducedMotion="user">
        <DarkMatter />
        <button className="lang" onClick={changeLocale}>
          {locale === 'pl' ? 'EN' : 'PL'}
        </button>
        {notice && <p className="toast error" onClick={() => setNotice(null)}>{notice}</p>}
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {screen.name === 'menu' && (
              <MainMenu
                key="menu"
                online={online}
                me={me}
                hasSave={!!save}
                onNew={() => go({ name: 'setup', multi: false })}
                onContinue={() => (online ? go({ name: 'games' }) : save && setScreen({ name: 'game', game: save }))}
                onMulti={() => go({ name: 'multi' })}
                onAccount={() => go({ name: 'account' })}
              />
            )}
            {screen.name === 'signin' && (
              <Opened key="signin">
                <SignInScreen onBack={() => { remember(AFTER_KEY, null); setScreen({ name: 'menu' }); }} />
              </Opened>
            )}
            {screen.name === 'setup' && (
              <Opened key={`setup-${screen.multi}`} tile={screen.multi ? undefined : 'newGame'}>
                <SetupScreen
                  multiplayer={screen.multi}
                  onBack={() => setScreen(screen.multi ? { name: 'multi' } : { name: 'menu' })}
                  onNext={(config, maxPlayers) => setScreen({ name: 'character', config, maxPlayers })}
                />
              </Opened>
            )}
            {screen.name === 'character' && (
              <Opened key="character">
                <CharacterScreen
                  config={screen.config}
                  onBack={() => setScreen(screen.joinCode ? { name: 'multi', code: screen.joinCode } : { name: 'setup', multi: screen.config.multiplayer })}
                  onStart={(character, seed) => startGame(screen.config, screen.maxPlayers, screen.joinCode, character, seed)}
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
                  onNew={() => setScreen({ name: 'setup', multi: false })}
                />
              </Opened>
            )}
            {screen.name === 'games' && me && (
              <Opened key="games" tile="continue">
                <GamesScreen
                  onBack={() => setScreen({ name: 'menu' })}
                  onOpen={(id) => setScreen({ name: 'online', id })}
                  onNew={() => setScreen({ name: 'setup', multi: false })}
                />
              </Opened>
            )}
            {screen.name === 'multi' && (
              <Opened key="multi" tile="multiplayer">
                <MultiplayerScreen
                  initialCode={screen.code}
                  onBack={() => setScreen({ name: 'menu' })}
                  onCreate={() => setScreen({ name: 'setup', multi: true })}
                  onJoin={join}
                />
              </Opened>
            )}
            {screen.name === 'online' && me && (
              <Opened key={`online-${screen.id}`}>
                <OnlineGame
                  id={screen.id}
                  me={me}
                  onMenu={() => setScreen({ name: 'games' })}
                  onNew={() => setScreen({ name: 'setup', multi: false })}
                />
              </Opened>
            )}
            {screen.name === 'account' && me && (
              <Opened key="account" tile="settings">
                <AccountScreen
                  me={me}
                  onBack={() => setScreen({ name: 'menu' })}
                  onChange={setMe}
                  onSignOut={async () => {
                    await api.logout().catch(() => {});
                    setSession(null);
                    setMe(null);
                    setScreen({ name: 'menu' });
                  }}
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

function MainMenu({ online, me, hasSave, onNew, onContinue, onMulti, onAccount }: {
  online: boolean | null;
  me: Me | null;
  hasSave: boolean;
  onNew: () => void;
  onContinue: () => void;
  onMulti: () => void;
  onAccount: () => void;
}) {
  const { t } = useT();
  const checking = online === null;
  const tiles: { key: UiKey; onClick?: () => void; note?: string }[] = online
    ? [
        { key: 'newGame', onClick: onNew },
        { key: 'continue', onClick: onContinue, note: t('yourGames') },
        { key: 'multiplayer', onClick: onMulti },
        { key: 'settings', onClick: onAccount, note: me ? me.display_name : t('signIn') },
      ]
    : [
        { key: 'newGame', onClick: checking ? undefined : onNew },
        { key: 'continue', onClick: hasSave && !checking ? onContinue : undefined, note: hasSave ? undefined : t('noGames') },
        { key: 'multiplayer', note: checking ? t('loading') : t('needsServer') },
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
