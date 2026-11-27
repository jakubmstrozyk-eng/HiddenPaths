import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AXIS_LIMIT, AXIS_NAMES, BESTIARY_NOTES, ENEMIES, EVENT_BY_ID, JOURNAL_AXES, JOURNAL_COVERS, JOURNAL_PEOPLE, JOURNAL_PROMPTS, LESSON_NAMES, LESSONS, MISSIONS,
  PERSON_MARKS, TERRAINS, TRAIT_AT, TRAITS, VOWS, type Locale, type PersonMark, type Text,
} from '@hp/content';
import {
  campfireOffer, inspirationCap, notableCount, journalOf,
  type GameState, type JournalEntry, type JournalFact, type JournalSummary, type JournalWrite, type PlayerState, type Vow,
} from '@hp/engine';
import { useT } from './i18n';
import { attrShort } from './logText';
import { PixelHero } from './PixelHero';

/**
 * The hero journal (Jacob, 2026-11-27): the campfire where an entry is written, and the book with every page.
 */

const CONDITION_NAMES: Record<string, Text> = {
  nightmare: { pl: 'Koszmar', en: 'Nightmare' }, plague: { pl: 'Zaraza', en: 'Plague' }, enthralled: { pl: 'Zauroczenie', en: 'Enthralled' },
};
const conditionName = (id: string, l: Locale) => CONDITION_NAMES[id]?.[l] ?? id;
const enemyName = (id: string, l: Locale) => ENEMIES[id]?.name[l] ?? id;
const personName = (id: string, l: Locale) => JOURNAL_PEOPLE.find((p) => p.id === id)?.name[l] ?? id;
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

/** The chronicle as lines of the journal: written without "I did" so it fits every hero. */
export function chronicleLines(facts: JournalFact[], l: Locale): string[] {
  const pl = l === 'pl';
  const lines: string[] = [];
  const add = (s: string) => {
    const last = lines[lines.length - 1];
    const m = last?.match(/^(.*?)(?: ×(\d+))?$/);
    if (m && m[1] === s) lines[lines.length - 1] = `${s} ×${Number(m[2] ?? 1) + 1}`;
    else lines.push(s);
  };
  for (const f of facts) {
    switch (f.k) {
      case 'explore': add(pl ? `${f.n} ${plural(f.n, 'nowy fragment', 'nowe fragmenty', 'nowych fragmentów')} mapy` : `${f.n} new ${f.n === 1 ? 'fragment' : 'fragments'} of the map`); break;
      case 'fight': {
        const foes = [...new Set(f.foes)].map((x) => enemyName(x, l)).join(', ') || (pl ? 'wróg' : 'a foe');
        const how = { won: pl ? 'zwycięstwo' : 'victory', lost: pl ? 'porażka' : 'defeat', fled: pl ? 'ucieczka' : 'fled', hidden: pl ? 'ukrycie się' : 'hid', enthralled: pl ? 'urok odebrał wolę' : 'spellbound', ongoing: '' }[f.result];
        add(`${pl ? 'Walka' : 'Fight'}: ${foes} · ${how}`);
        break;
      }
      case 'event': add(`${pl ? 'Przygoda' : 'Adventure'}: ${EVENT_BY_ID[f.card]?.title[l] ?? f.card}`); break;
      case 'cond': add(`${pl ? 'Dopadł stan' : 'Caught'}: ${conditionName(f.id, l)}`); break;
      case 'cured': add(`${pl ? 'Stan minął' : 'Shaken off'}: ${conditionName(f.id, l)}`); break;
      case 'room': add(pl ? 'Zejście do komnaty lochu' : 'Down into a dungeon room'); break;
      case 'town': add(`${pl ? 'Postój' : 'Stop'}: ${TERRAINS[f.terrain as 'village']?.name[l] ?? f.terrain}`); break;
      case 'level': add(pl ? `Poziom ${f.level}!` : `Level ${f.level}!`); break;
      case 'hunt': add(pl ? 'Udane polowanie' : 'A good hunt'); break;
      case 'died': add(pl ? 'Upadek i przebudzenie w innym miejscu' : 'Fell, and woke elsewhere'); break;
      case 'mission': add(`${pl ? 'Cel gry' : 'Goal'}: ${MISSIONS.find((m) => m.id === f.id)?.name[l] ?? f.id}`); break;
      case 'vow': add(`${pl ? 'Dotrzymane postanowienie' : 'Vow kept'}: ${VOWS.find((v) => v.kind === f.kind)?.text[l] ?? f.kind}`); break;
      case 'story': break;
    }
  }
  return lines;
}

function aboutName(about: string | undefined, l: Locale): string {
  if (!about) return '';
  const [kind, id] = about.split(':');
  if (kind === 'enemy') return enemyName(id!, l);
  if (kind === 'person') return personName(id!, l);
  if (kind === 'card') return EVENT_BY_ID[Number(id)]?.title[l] ?? '';
  return conditionName(about, l);
}

/** The campfire: what happened, a question, a vow, a foe to note, a dream, people to mark and maybe a chapter to close. */
export function Campfire({ game, me, leaving, onWrite, onSkip }: {
  game: GameState; me: PlayerState; leaving?: boolean;
  onWrite: (entry: JournalWrite) => void; onSkip: () => void;
}) {
  const { tx, locale } = useT();
  const pl = locale === 'pl';
  const j = journalOf(me);
  const offer = campfireOffer(game, me);
  const prompt = offer.prompt ? JOURNAL_PROMPTS.find((p) => p.id === offer.prompt!.id) : undefined;
  const [answer, setAnswer] = useState<number | undefined>();
  const [text, setText] = useState('');
  const [vow, setVow] = useState<string | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const [dream, setDream] = useState(false);
  const [dreamText, setDreamText] = useState('');
  const [marks, setMarks] = useState<Record<string, PersonMark>>({});
  const [title, setTitle] = useState('');
  const [lesson, setLesson] = useState(offer.chapter?.lessons[0]);
  const lines = chronicleLines(j.facts, locale);
  const xp = Math.max(0, Math.round(me.character.xp - j.xpAt));
  const gold = Math.round((me.character.gold - j.goldAt) * 100) / 100;
  const axisPreview = (axis: (typeof JOURNAL_AXES)[number], delta: number) => (pl ? `${delta < 0 ? AXIS_NAMES[axis].low.pl : AXIS_NAMES[axis].high.pl}` : `${delta < 0 ? AXIS_NAMES[axis].low.en : AXIS_NAMES[axis].high.en}`);
  const write = () => onWrite({
    ...(answer !== undefined ? { answer } : {}),
    ...(text.trim() ? { text } : {}),
    ...(vow ? { vow: vow as JournalWrite['vow'] } : {}),
    ...(note ? { note } : {}),
    ...(dream ? { dream: true, ...(dreamText.trim() ? { dreamText } : {}) } : {}),
    ...(Object.keys(marks).length ? { marks } : {}),
    ...(offer.chapter ? { title, lesson } : {}),
  });

  return (
    <div className="overlay jr-overlay">
      <motion.div className="jr-camp" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} role="dialog" aria-label={pl ? 'Dziennik przy ognisku' : 'Journal by the fire'}>
        <div className="jr-fire" aria-hidden="true"><span /><span /><span /></div>
        <header className="jr-head">
          <small>{leaving ? (pl ? 'Zanim odejdziesz' : 'Before you go') : (pl ? 'Przy ognisku' : 'By the fire')}</small>
          <h2>{pl ? 'Dziennik Wędrowca' : "Wanderer's Journal"}</h2>
          <span className="jr-date">{pl ? `Dzień ${game.round}` : `Day ${game.round}`}{me.position >= 0 && game.map.cells[me.position] ? ` · ${tx(TERRAINS[game.map.cells[me.position]!.terrain as 'forest']?.name ?? { pl: '', en: '' })}` : ''}</span>
        </header>

        <section className="jr-page">
          <h3>I. {pl ? 'Kronika' : 'Chronicle'}</h3>
          {lines.length ? <ul className="jr-chron">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="jr-muted">{pl ? 'Spokojny dzień. Nic nowego.' : 'A quiet day. Nothing new.'}</p>}
          {(xp > 0 || gold !== 0) && <p className="jr-sum">{xp > 0 ? `+${xp} ${pl ? 'Punktów Doświadczenia' : 'Experience Points'}` : ''}{xp > 0 && gold ? ' · ' : ''}{gold ? `${gold > 0 ? '+' : ''}${gold} ${pl ? 'złota' : 'gold'}` : ''}</p>}
          <p className={`jr-reward ${offer.rewarded ? 'ok' : ''}`}>
            {offer.rewarded
              ? (j.inspiration >= inspirationCap(me.character.level)
                ? (pl ? 'Ten wpis jest pełny, ale Natchnienie masz już w zapasie.' : 'A full entry, but you already hold all the Inspiration you can.')
                : (pl ? '✒ Ten wpis da Natchnienie: jedno przerzucenie nieudanego testu.' : '✒ This entry gives Inspiration: one failed test thrown again.'))
              : (pl ? `Krótki wpis bez nagrody. Do Natchnienia brakuje ${offer.need - offer.notable} ${plural(offer.need - offer.notable, 'nowego zdarzenia', 'nowych zdarzeń', 'nowych zdarzeń')}.` : `A short entry with no reward. ${offer.need - offer.notable} more new things for Inspiration.`)}
          </p>
        </section>

        {prompt && (
          <section className="jr-page">
            <h3>II. {pl ? 'Pytanie ogniska' : 'The campfire question'}</h3>
            <p className="jr-q">{tx(prompt.question).replace('{name}', aboutName(offer.prompt?.about, locale))}</p>
            <div className="jr-opts">
              {prompt.answers.map((a, i) => (
                <button key={i} className={`jr-opt ${answer === i ? 'on' : ''}`} aria-pressed={answer === i} onClick={() => setAnswer(answer === i ? undefined : i)}>
                  <span>{tx(a.text)}</span><small>{axisPreview(a.axis, a.delta)}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="jr-page">
          <h3>{prompt ? 'III.' : 'II.'} {pl ? 'Własne słowa' : 'In your own words'}</h3>
          <textarea id="jr-text" className="jr-text" maxLength={400} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={pl ? 'Nieobowiązkowe. Tylko dla ciebie, nikt tego nie ocenia.' : 'Optional. Only for you; nobody judges it.'} />
        </section>

        {offer.note && (
          <section className="jr-page">
            <h3>{pl ? 'Bestiariusz' : 'Bestiary'}: {enemyName(offer.note.enemy, locale)}</h3>
            <p className="jr-muted">{pl ? 'Co zauważasz? Test Inteligencji sprawdzi, czy notatka jest trafna (łatwy, gdy trafisz w sedno).' : 'What did you notice? An Intelligence test checks the note (easy when you are right).'}</p>
            <div className="jr-opts">
              {offer.note.options.map((s) => (
                <button key={s} className={`jr-opt ${note === s ? 'on' : ''}`} aria-pressed={note === s} onClick={() => setNote(note === s ? undefined : s)}>
                  <span>„{tx(BESTIARY_NOTES[s as 'dex'])}”</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {offer.people.length > 0 && (
          <section className="jr-page">
            <h3>{pl ? 'Znajomi i wrogowie' : 'Friends and foes'}</h3>
            {offer.people.map((id) => (
              <div key={id} className="jr-person">
                <span>{personName(id, locale)}</span>
                <span className="jr-marks">
                  {(Object.keys(PERSON_MARKS) as PersonMark[]).map((m) => (
                    <button key={m} className={`jr-mark ${marks[id] === m ? 'on' : ''} m-${m}`} aria-pressed={marks[id] === m}
                      onClick={() => setMarks((x) => { const n = { ...x }; if (n[id] === m) delete n[id]; else n[id] = m; return n; })}>
                      {tx(PERSON_MARKS[m])}
                    </button>
                  ))}
                </span>
              </div>
            ))}
            <p className="jr-muted">{pl ? 'Kogo zapiszesz, tego rozpoznasz przy kolejnym spotkaniu: +10 do testów na jego karcie.' : 'Whoever you write down you will know next time: +10 to the tests on their card.'}</p>
          </section>
        )}

        {offer.dream && (
          <section className="jr-page">
            <h3>{pl ? 'Sen' : 'A dream'}</h3>
            <label className="jr-check"><input id="jr-dream" type="checkbox" checked={dream} onChange={(e) => setDream(e.target.checked)} /> {pl ? 'Zapisuję sen. Może coś znaczy…' : 'I write the dream down. It may mean something…'}</label>
            {dream && <input id="jr-dream-text" className="jr-line" maxLength={400} value={dreamText} onChange={(e) => setDreamText(e.target.value)} placeholder={pl ? '„Śniła mi się wieża bez drzwi…”' : '"I dreamt of a tower with no door…"'} />}
            <p className="jr-muted">{pl ? 'Zapisany sen zaznacza na mapie ukryty loch (w tej albo w następnej grze).' : 'A dream written down marks the hidden dungeon on the map (in this game or the next).'}</p>
          </section>
        )}

        {offer.vows.length > 0 && (
          <section className="jr-page">
            <h3>{pl ? 'Postanowienie' : 'A vow'}</h3>
            {j.vow && j.vow.have < j.vow.need && <p className="jr-muted">{pl ? 'Nowe postanowienie zastąpi obecne' : 'A new vow replaces the current one'}: {tx(VOWS.find((v) => v.kind === j.vow!.kind)!.text)} ({j.vow.have}/{j.vow.need})</p>}
            <div className="jr-opts">
              {offer.vows.map((k) => (
                <button key={k} className={`jr-opt ${vow === k ? 'on' : ''}`} aria-pressed={vow === k} onClick={() => setVow(vow === k ? undefined : k)}>
                  <span>„{tx(VOWS.find((v) => v.kind === k)!.text)}”</span>
                </button>
              ))}
            </div>
            <p className="jr-muted">{pl ? 'Spełnione: +2 Punkty Doświadczenia i Natchnienie.' : 'Kept: +2 Experience Points and Inspiration.'}</p>
          </section>
        )}

        {offer.chapter && (
          <section className="jr-page jr-chapter">
            <h3>{pl ? `Koniec rozdziału ${offer.chapter.number}` : `End of chapter ${offer.chapter.number}`}</h3>
            <input id="jr-title" className="jr-line" maxLength={48} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pl ? 'Tytuł rozdziału, np. „Ta, która kierowała moimi krokami”' : 'Chapter title, e.g. "The one who steered my steps"'} />
            <div className="jr-opts">
              {offer.chapter.lessons.map((ls) => (
                <button key={ls} className={`jr-opt ${lesson === ls ? 'on' : ''}`} aria-pressed={lesson === ls} onClick={() => setLesson(ls)}>
                  <span>{ls === 'attribute' ? `${tx(LESSON_NAMES[offer.chapter!.attribute] ?? LESSONS.attribute.name)}: +2 ${attrShort(offer.chapter!.attribute, locale)}` : tx(LESSONS[ls].name)}</span>
                  <small>{ls === 'attribute' ? (pl ? 'cecha używana najczęściej w tym rozdziale' : 'the attribute you used most this chapter') : tx(LESSONS[ls].text)}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="jr-foot">
          <button className="ghost" onClick={onSkip}>{pl ? 'Nie teraz' : 'Not now'}</button>
          <button className="primary" onClick={write}>{pl ? 'Zapisz wpis' : 'Write the entry'}</button>
        </footer>
      </motion.div>
    </div>
  );
}

type Tab = 'chronicle' | 'character' | 'people' | 'bestiary' | 'vow' | 'chapters';

/** The book: every page the hero has written, the character, people, foes, the vow and the chapters. */
export function JournalBook({ hero, summary, entries, inspiration, vow, level, onClose, note, onWrite }: {
  hero: { name: string; race: PlayerState['character']['race']; profession: PlayerState['character']['profession']; look?: PlayerState['character']['look'] };
  summary: JournalSummary; entries: JournalEntry[]; inspiration: number; vow: Vow | null; level: number;
  onClose: () => void; note?: string;
  /** Opens a new entry now, during play (Jacob, 2026-11-27: not only at a camp). */
  onWrite?: () => void;
}) {
  const { t, tx, locale } = useT();
  const pl = locale === 'pl';
  const [tab, setTab] = useState<Tab>('chronicle');
  const cover = [...JOURNAL_COVERS].reverse().find((c) => summary.entries >= c.from)!;
  const tabs: { id: Tab; name: string }[] = [
    { id: 'chronicle', name: pl ? 'Kronika' : 'Chronicle' },
    { id: 'character', name: pl ? 'Charakter' : 'Character' },
    { id: 'people', name: pl ? 'Znajomi i wrogowie' : 'Friends and foes' },
    { id: 'bestiary', name: pl ? 'Bestiariusz' : 'Bestiary' },
    { id: 'vow', name: pl ? 'Postanowienie' : 'Vow' },
    { id: 'chapters', name: pl ? 'Rozdziały' : 'Chapters' },
  ];
  const vowDef = vow ? VOWS.find((v) => v.kind === vow.kind) : null;
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <motion.aside className={`sheet jr-book cover-${JOURNAL_COVERS.indexOf(cover)}`} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{pl ? 'Dziennik' : 'Journal'}: {hero.name}</h2>
          <button className="ghost small" onClick={onClose}>{t('close')}</button>
        </header>
        <div className="jr-front">
          <PixelHero race={hero.race} profession={hero.profession} look={hero.look} size={56} />
          <div>
            <b>{tx(cover.name)}</b> · {summary.entries} {pl ? plural(summary.entries, 'wpis', 'wpisy', 'wpisów') : summary.entries === 1 ? 'entry' : 'entries'}
            {summary.chapters.length > 0 && <div className="jr-muted">{pl ? 'Ostatni rozdział' : 'Last chapter'}: „{summary.chapters[summary.chapters.length - 1]!.title}”</div>}
            <div className="jr-insp" title={pl ? 'Natchnienie: jedno przerzucenie nieudanego testu' : 'Inspiration: one failed test thrown again'}>
              ✒ {pl ? 'Natchnienie' : 'Inspiration'}: <b>{inspiration}/{inspirationCap(level)}</b>
            </div>
          </div>
        </div>
        <nav className="jr-tabs" role="tablist">
          {tabs.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{x.name}</button>)}
        </nav>
        {onWrite && <button className="primary jr-write-now" onClick={onWrite}>✒ {pl ? 'Napisz nowy wpis' : 'Write a new entry'}</button>}
        {note && <p className="jr-muted">{note}</p>}

        {tab === 'chronicle' && (
          entries.length ? (
            <ol className="jr-entries">
              {[...entries].reverse().map((e) => (
                <li key={e.id} className="jr-entry">
                  <span className="jr-date">{pl ? `Dzień ${e.round}` : `Day ${e.round}`}{e.terrain && TERRAINS[e.terrain as 'forest'] ? ` · ${tx(TERRAINS[e.terrain as 'forest'].name)}` : ''}{e.rewarded ? ' · ✒' : ''}</span>
                  <ul className="jr-chron">{chronicleLines(e.facts, locale).map((l, i) => <li key={i}>{l}</li>)}</ul>
                  {e.prompt && (() => {
                    const p = JOURNAL_PROMPTS.find((x) => x.id === e.prompt!.id);
                    return p ? <p className="jr-answer">{tx(p.answers[e.prompt.answer]!.text)}</p> : null;
                  })()}
                  {e.text && <p className="jr-own">{e.text}</p>}
                  {e.dream && <p className="jr-own">☾ {e.dream.text || (pl ? 'Zapisany sen' : 'A dream written down')}</p>}
                  {e.chapter && <p className="jr-chapter-mark">{pl ? 'Koniec rozdziału' : 'End of chapter'}: „{e.chapter.title}”</p>}
                </li>
              ))}
            </ol>
          ) : <p className="jr-muted">{pl ? 'Puste strony. Pierwszy wpis zrobisz przy ognisku, na obozowisku.' : 'Empty pages. Write the first entry by the fire, at a camp.'}</p>
        )}

        {tab === 'character' && (
          <div className="jr-axes">
            {JOURNAL_AXES.map((axis) => {
              const v = summary.axes[axis];
              const pos = 50 + (v / AXIS_LIMIT) * 44;
              return (
                <div key={axis} className="jr-axis">
                  <span>{tx(AXIS_NAMES[axis].low)}</span>
                  <div className="jr-track"><i style={{ left: `${pos}%` }} /><em style={{ left: `${50 - (TRAIT_AT / AXIS_LIMIT) * 44}%` }} /><em style={{ left: `${50 + (TRAIT_AT / AXIS_LIMIT) * 44}%` }} /></div>
                  <span>{tx(AXIS_NAMES[axis].high)}</span>
                </div>
              );
            })}
            {summary.traits.length ? summary.traits.map((id) => (
              <div key={id} className="jr-trait">
                <b>{tx(TRAITS[id].name)}</b>
                <small className="plus">+ {tx(TRAITS[id].plus)}</small>
                <small className="minus">− {tx(TRAITS[id].minus)}</small>
              </div>
            )) : <p className="jr-muted">{pl ? `Cecha charakteru pojawia się, gdy wskazówka przejdzie za kreskę (${TRAIT_AT} odpowiedzi w jedną stronę).` : `A trait appears when the marker passes the line (${TRAIT_AT} answers one way).`}</p>}
          </div>
        )}

        {tab === 'people' && (
          Object.keys(summary.people).length ? (
            <ul className="jr-list">
              {Object.entries(summary.people).map(([id, mark]) => (
                <li key={id}><span>{personName(id, locale)}</span><small className={`jr-mark on m-${mark}`}>{mark === 'met' ? (pl ? 'Spotkany' : 'Met') : tx(PERSON_MARKS[mark])}</small></li>
              ))}
            </ul>
          ) : <p className="jr-muted">{pl ? 'Nikogo jeszcze nie zapisano. Postacie z kart wydarzeń trafią tutaj.' : 'Nobody yet. People from event cards will appear here.'}</p>
        )}

        {tab === 'bestiary' && (
          Object.keys(summary.bestiary).length ? (
            <ul className="jr-list">
              {Object.entries(summary.bestiary).map(([id, stat]) => {
                const e = ENEMIES[id];
                return (
                  <li key={id} className="jr-beast">
                    <span><b>{enemyName(id, locale)}</b> · „{tx(BESTIARY_NOTES[stat as 'dex'])}”</span>
                    {e && <small>{pl ? 'Żyw.' : 'Vit'} {e.vitality} · {attrShort('com', locale)} {e.com} · {attrShort('dex', locale)} {e.dex} · {attrShort('str', locale)} {e.str}</small>}
                  </li>
                );
              })}
              <li className="jr-muted">{pl ? 'W walce z tymi wrogami: +5 do pierwszego testu (nie łączy się ze Skalpem).' : 'Fighting these foes: +5 to the first test (not together with Scalp).'}</li>
            </ul>
          ) : <p className="jr-muted">{pl ? 'Po walce z nowym wrogiem zapisz przy ognisku, co zauważyłeś.' : 'After a fight with a new foe, note at the campfire what you saw.'}</p>
        )}

        {tab === 'vow' && (
          vow && vowDef ? (
            <div className="jr-vow">
              <p className="jr-q">„{tx(vowDef.text)}”</p>
              <div className="jr-bar"><i style={{ width: `${(vow.have / vow.need) * 100}%` }} /></div>
              <small>{vow.have}/{vow.need} · {vow.have >= vow.need ? (pl ? 'spełnione' : 'kept') : (pl ? 'spełnione da +2 Punkty Doświadczenia i Natchnienie' : 'keeping it gives +2 Experience Points and Inspiration')}</small>
            </div>
          ) : <p className="jr-muted">{pl ? 'Brak postanowienia. Złożysz je przy ognisku.' : 'No vow. Make one by the fire.'}</p>
        )}

        {tab === 'chapters' && (
          summary.chapters.length ? (
            <ol className="jr-list">
              {summary.chapters.map((c, i) => (
                <li key={i}><span><b>{pl ? 'Rozdział' : 'Chapter'} {i + 1}</b>: „{c.title}”</span><small>{c.lesson === 'attribute' && c.attribute ? `${tx(LESSON_NAMES[c.attribute] ?? LESSONS.attribute.name)} +2 ${attrShort(c.attribute, locale)}` : tx(LESSONS[c.lesson].name)}</small></li>
              ))}
              <li className="jr-muted">{pl ? `W gospodzie przy stole podróżnych: „Opowiedz historię” z +${Math.min(15, 5 * summary.chapters.length)} Ch.` : `In the inn at the travellers' table: "Tell a story" with +${Math.min(15, 5 * summary.chapters.length)} Cha.`}</li>
            </ol>
          ) : <p className="jr-muted">{pl ? 'Co piąty wpis zamyka rozdział: nadasz mu tytuł i wybierzesz lekcję.' : 'Every fifth entry closes a chapter: you name it and pick a lesson.'}</p>
        )}
      </motion.aside>
    </div>
  );
}

/** Inspiration and the vow, for the bar at the top of the game. */
export function JournalChip({ me, onOpen }: { me: PlayerState; onOpen: () => void }) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const j = me.journal;
  if (!j) return null;
  const vow = j.vow && j.vow.have < j.vow.need ? VOWS.find((v) => v.kind === j.vow!.kind) : null;
  const pending = notableCount(j);
  return (
    <button className="jr-chip ghost small" onClick={onOpen} title={pl ? 'Dziennik' : 'Journal'}>
      <span aria-hidden="true">📖</span>
      <span className={j.inspiration ? 'lit' : ''} title={pl ? 'Natchnienie: jedno przerzucenie nieudanego testu' : 'Inspiration: one failed test thrown again'}>✒{j.inspiration}</span>
      {vow && <span className="jr-chip-vow">{vow.text[locale]} {j.vow!.have}/{j.vow!.need}</span>}
      {!vow && pending > 0 && <small>{pl ? `${pending} nowe` : `${pending} new`}</small>}
    </button>
  );
}
