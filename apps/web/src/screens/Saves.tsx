import { useState } from 'react';
import { PROFESSIONS, RACES } from '@hp/content';
import { currentPlayer, type GameState } from '@hp/engine';
import { useT } from '../i18n';
import { Icon } from '../Icons';
import { PixelHero } from '../PixelHero';
import { listSaves, MAX_NAMED, removeSave, saveAs, type SaveSlot } from '../saves';
import { Sheet } from './Sheets';

function when(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** One saved game: the hero, how far they got, and when it was saved. */
function SaveRow({ slot, children, onOpen }: { slot: SaveSlot; children?: React.ReactNode; onOpen?: () => void }) {
  const { t, tx, locale } = useT();
  const hero = currentPlayer(slot.game).character;
  const title = slot.auto ? tx({ pl: 'Autozapis', en: 'Autosave' }) : slot.name;
  return (
    <div className={`save-row ${onOpen ? 'pickable' : ''}`} onClick={onOpen} role={onOpen ? 'button' : undefined}>
      <PixelHero race={hero.race} profession={hero.profession} look={hero.look} size={44} />
      <div className="save-body">
        <b>{title}{slot.auto && <span className="mode-badge auto">{tx({ pl: 'auto', en: 'auto' })}</span>}</b>
        <small>
          {hero.name} · {tx(RACES[hero.race].name)} · {tx(PROFESSIONS[hero.profession].name)} · {t('level')} {hero.level} · {t('round')} {slot.game.round}
        </small>
        <small>{when(slot.savedAt, locale)}{slot.game.winner ? ` · ${tx({ pl: 'gra skończona', en: 'game over' })}` : ''}</small>
      </div>
      {children}
    </div>
  );
}

/** Continue: every game kept on this device, newest first. */
export function SavesScreen({ onBack, onOpen, onNew }: { onBack: () => void; onOpen: (game: GameState) => void; onNew: () => void }) {
  const { t, tx } = useT();
  const [saves, setSaves] = useState(listSaves);
  const [sure, setSure] = useState<string | null>(null);
  return (
    <div className="panel">
      <h2>{t('continue')}</h2>
      {saves.length === 0 ? <p className="muted">{t('noGames')}</p> : (
        <div className="save-list">
          {saves.map((s) => (
            <SaveRow key={s.id} slot={s} onOpen={() => onOpen(s.game)}>
              <button
                className={`ghost small ${sure === s.id ? 'danger' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sure !== s.id) return setSure(s.id);
                  removeSave(s.id);
                  setSaves(listSaves());
                  setSure(null);
                }}
              >
                {sure === s.id ? t('deleteSure') : t('deleteHero')}
              </button>
            </SaveRow>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
        <button className="primary" onClick={onNew}>{t('newGame')}</button>
      </div>
    </div>
  );
}

/** The floppy button's sheet: save under a new name, or over one of the saves already there. */
export function SaveDialog({ game, onClose }: { game: GameState; onClose: () => void }) {
  const { t, tx } = useT();
  const hero = currentPlayer(game).character;
  const [name, setName] = useState(`${hero.name} · ${t('round')} ${game.round}`);
  const [named, setNamed] = useState(() => listSaves().filter((s) => !s.auto));
  const [over, setOver] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const full = named.length >= MAX_NAMED;

  const save = (overwrite?: string) => {
    const slot = saveAs(game, name || hero.name, overwrite);
    if (!slot) {
      setError(full && !overwrite
        ? tx({ pl: `Masz już ${MAX_NAMED} zapisów. Nadpisz któryś z nich.`, en: `You already have ${MAX_NAMED} saves. Overwrite one of them.` })
        : tx({ pl: 'Przeglądarka nie pozwoliła zapisać gry (brak miejsca?).', en: 'The browser would not store the game (out of space?).' }));
      return;
    }
    setError(null);
    setOver(null);
    setNamed(listSaves().filter((s) => !s.auto));
    setDone(slot.name);
  };

  return (
    <Sheet title={tx({ pl: 'Zapisz grę', en: 'Save game' })} onClose={onClose}>
      <div className="row">
        <input className="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={tx({ pl: 'Nazwa zapisu', en: 'Save name' })} />
        <button className="primary with-icon" disabled={full} onClick={() => save()}><Icon name="save" />{tx({ pl: 'Zapisz jako nowy', en: 'Save as new' })}</button>
      </div>
      {done && <p className="save-done">{tx({ pl: `Zapisano: ${done}`, en: `Saved: ${done}` })}</p>}
      {error && <p className="save-error">{error}</p>}
      <p className="muted">{tx({ pl: 'Gra zapisuje się też sama po każdym ruchu (autozapis).', en: 'The game also saves itself after every move (autosave).' })}</p>
      {named.length > 0 && (
        <>
          <h3>{tx({ pl: 'Nadpisz zapis', en: 'Overwrite a save' })}</h3>
          <div className="save-list">
            {named.map((s) => (
              <SaveRow key={s.id} slot={s}>
                <button className={`ghost small ${over === s.id ? 'danger' : ''}`} onClick={() => (over === s.id ? save(s.id) : setOver(s.id))}>
                  {over === s.id ? tx({ pl: 'Na pewno nadpisać?', en: 'Overwrite for sure?' }) : tx({ pl: 'Nadpisz', en: 'Overwrite' })}
                </button>
              </SaveRow>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
