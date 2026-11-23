import { useCallback, useEffect, useRef, useState } from 'react';
import { currentPlayer, type Action, type GameState } from '@hp/engine';
import { api, ApiError, type GameSummary, type GameView, type Me } from '../api';
import { useT, type UiKey } from '../i18n';
import { PixelHero } from '../PixelHero';
import { GameScreen } from './Game';

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

/** Email sign-in. In local development the server returns the link, which is shown here to click. */
export function SignInScreen({ onBack }: { onBack: () => void }) {
  const { t, locale } = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.startLogin(email.trim(), locale);
      setSent(true);
      setDevLink(r.link ?? null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>{t('signIn')}</h2>
      <p className="muted">{t('signInInfo')}</p>
      {sent ? (
        <>
          <p>{t('linkSent')}</p>
          {devLink && <p><a href={devLink}>{devLink}</a></p>}
        </>
      ) : (
        <form onSubmit={send} className="row">
          <input className="name" type="email" required autoComplete="email" placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="primary" disabled={busy || !email.includes('@')}>{t('sendLink')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
      </div>
    </div>
  );
}

function statusLabel(g: GameSummary): UiKey {
  if (g.status === 'lobby') return 'lobby';
  if (g.status === 'finished') return 'finished';
  return g.your_turn ? 'yourTurn' : 'theirTurn';
}

/** The signed-in player's games: up to three open at once. */
export function GamesScreen({ onBack, onOpen, onNew }: { onBack: () => void; onOpen: (id: string) => void; onNew: () => void }) {
  const { t, locale } = useT();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.games().then((r) => setGames(r.games), (e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const giveUp = async (id: string) => {
    try {
      await api.abandon(id);
      setConfirm(null);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const open = games?.filter((g) => g.status !== 'finished').length ?? 0;
  return (
    <div className="panel">
      <h2>{t('yourGames')}</h2>
      <p className="muted">{t('slotsInfo')} {games && `(${open}/3)`}</p>
      {!games && !error && <p className="muted">{t('loading')}</p>}
      {games?.length === 0 && <p>{t('noServerGames')}</p>}
      <div className="game-list">
        {games?.map((g) => (
          <div key={g.id} className={`game-row ${g.your_turn ? 'hot' : ''}`}>
            <button className="game-open" onClick={() => onOpen(g.id)}>
              <strong>{t(g.mode === 'solo' ? 'solo' : 'multiplayer')} · {t(g.config.size)} · {t(g.config.difficulty)}</strong>
              <small>
                {t(statusLabel(g))}
                {g.status === 'active' && ` · ${locale === 'pl' ? 'dzień' : 'day'} ${g.round}`}
                {g.mode === 'multi' && ` · ${g.players} ${locale === 'pl' ? 'graczy' : 'players'}`}
                {g.turn_deadline_at && g.mode === 'multi' && g.status === 'active' &&
                  ` · ${locale === 'pl' ? 'do' : 'until'} ${new Date(g.turn_deadline_at).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
              </small>
            </button>
            {g.status !== 'finished' && (confirm === g.id ? (
              <span className="confirm">
                <small>{t('giveUpSure')}</small>
                <button className="ghost small" onClick={() => setConfirm(null)}>{t('back')}</button>
                <button className="primary small" onClick={() => giveUp(g.id)}>{t('giveUp')}</button>
              </span>
            ) : (
              <button className="ghost small" onClick={() => setConfirm(g.id)}>{t('giveUp')}</button>
            ))}
          </div>
        ))}
      </div>
      {error && <p className="error">{error} <button className="ghost small" onClick={load}>{t('retry')}</button></p>}
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
        <button className="primary" disabled={open >= 3} onClick={onNew}>{t('newGame')}</button>
      </div>
    </div>
  );
}

/** Create or join a multiplayer game. */
export function MultiplayerScreen({ onBack, onCreate, onJoin, initialCode = '' }: {
  onBack: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
  initialCode?: string;
}) {
  const { t } = useT();
  const [code, setCode] = useState(initialCode);
  return (
    <div className="panel">
      <h2>{t('multiplayer')}</h2>
      <p className="muted">{t('turnsInfo')}</p>
      <h3>{t('createGame')}</h3>
      <button className="primary" onClick={onCreate}>{t('createGame')}</button>
      <h3>{t('joinGame')}</h3>
      <form className="row" onSubmit={(e) => { e.preventDefault(); onJoin(code.trim().toUpperCase()); }}>
        <input className="name code" maxLength={6} placeholder={t('enterCode')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button className="primary" disabled={code.trim().length !== 6}>{t('join')}</button>
      </form>
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
      </div>
    </div>
  );
}

export function AccountScreen({ me, onBack, onChange, onSignOut }: { me: Me; onBack: () => void; onChange: (me: Me) => void; onSignOut: () => void }) {
  const { t, locale } = useT();
  const [name, setName] = useState(me.display_name);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.updateMe(name, locale);
      onChange(r.user);
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <div className="panel">
      <h2>{t('account')}</h2>
      <p className="muted">{me.email}</p>
      <h3>{t('displayName')}</h3>
      <form className="row" onSubmit={save}>
        <input className="name" maxLength={24} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        <button className="primary" disabled={!name.trim()}>{saved ? t('saved') : t('save')}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
        <button className="ghost" onClick={onSignOut}>{t('signOut')}</button>
      </div>
    </div>
  );
}

const POLL_MS = 8000;

/** A game stored on the server: the lobby while it fills, then the board. */
export function OnlineGame({ id, me, onMenu, onNew }: { id: string; me: Me; onMenu: () => void; onNew: () => void }) {
  const { t } = useT();
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Actions are sent one at a time, in order; the board shows each one at once.
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);

  const load = useCallback(async () => {
    try {
      const v = await api.game(id);
      if (pending.current === 0) setView(v);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const myTurn = !!view?.state && view.status === 'active' && currentPlayer(view.state).id === me.id;
  useEffect(() => {
    if (!view || myTurn || view.status === 'finished' || view.status === 'abandoned') return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [view, myTurn, load]);

  const submit = useCallback((prev: GameState, action: Action) => {
    pending.current++;
    queue.current = queue.current.then(async () => {
      try {
        await api.act(id, prev.version, action);
      } catch (e) {
        setError(errorText(e));
        pending.current = 0;
        await load();
        return;
      }
      if (--pending.current === 0) await load();
    });
    return queue.current;
  }, [id, load]);

  if (!view) {
    return (
      <div className="panel">
        <p className="muted">{error ?? t('loading')}</p>
        {error && <button className="ghost" onClick={() => void load()}>{t('retry')}</button>}
        <div className="actions"><button className="ghost" onClick={onMenu}>{t('back')}</button></div>
      </div>
    );
  }
  if (view.status === 'lobby' || !view.state) return <Lobby view={view} me={me} onMenu={onMenu} onStarted={load} />;

  const names = Object.fromEntries(view.players.map((p) => [p.userId, p.name]));
  return (
    <>
      {error && <p className="toast error" onClick={() => setError(null)}>{error}</p>}
      <GameScreen
        game={view.state}
        meId={me.id}
        names={names}
        deadline={view.mode === 'multi' ? view.deadline : null}
        onChange={(g) => setView((v) => (v ? { ...v, state: g } : v))}
        submit={submit}
        onMenu={onMenu}
        onNew={onNew}
      />
    </>
  );
}

function Lobby({ view, me, onMenu, onStarted }: { view: GameView; me: Me; onMenu: () => void; onStarted: () => Promise<void> }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = view.invite ? `${location.origin}/?join=${view.invite}` : '';
  const isHost = view.host === me.id;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* clipboard can be blocked; the link is shown to copy by hand */
    }
  };
  const start = async () => {
    try {
      await api.start(view.id);
      await onStarted();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="panel">
      <h2>{t('lobby')}</h2>
      <p className="muted">{t('inviteInfo')}</p>
      {view.invite && (
        <>
          <h3>{t('inviteCode')}</h3>
          <p className="invite-code">{view.invite}</p>
          <p className="row">
            <input className="name" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="ghost" onClick={copy}>{copied ? t('copied') : t('copyLink')}</button>
          </p>
        </>
      )}
      <h3>{t('players')} · {view.players.length}/{view.maxPlayers}</h3>
      <ul className="lobby-players">
        {view.players.map((p) => (
          <li key={p.userId}>
            <PixelHero race={p.race as never} size={32} />
            <span><b>{p.hero}</b> <small className="muted">{p.name}{p.userId === view.host ? ` · ${t('host')}` : ''}</small></span>
          </li>
        ))}
      </ul>
      <p className="muted">{t('turnsInfo')}</p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={onMenu}>{t('back')}</button>
        {isHost ? (
          <button className="primary" disabled={view.players.length < 2} onClick={start} title={view.players.length < 2 ? t('needTwo') : undefined}>
            {t('startGame')}
          </button>
        ) : (
          <span className="muted">{t('waitHost')}</span>
        )}
      </div>
    </div>
  );
}
