/**
 * "How training works" in a few words: when it happens in the week (a 3-step strip) and three short lines.
 * Collapsible; the open/closed choice is remembered per viewer.
 */
import { useState } from 'react';
import { useT } from '../../i18n/index.ts';

const KEY = 'fm.trainingGuide';

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'closed';
  } catch {
    return true;
  }
}
function writeOpen(open: boolean) {
  try {
    localStorage.setItem(KEY, open ? 'open' : 'closed');
  } catch {
    /* storage unavailable */
  }
}

/** « <b>Title</b> — text » → a bold title and the rest. */
function bold(text: string) {
  const m = /^<b>(.*?)<\/b>(.*)$/.exec(text);
  return m ? (
    <>
      <b>{m[1]}</b>
      {m[2]}
    </>
  ) : (
    text
  );
}

export function TrainingGuide() {
  const { t } = useT();
  const [open, setOpen] = useState(readOpen);
  return (
    <details
      className="training-guide"
      open={open}
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(o);
        writeOpen(o);
      }}
    >
      <summary>
        <b>{t('guide.title')}</b>
      </summary>
      <ol className="guide-steps">
        <li>{bold(t('guide.step1'))}</li>
        <li>{bold(t('guide.step2'))}</li>
        <li>{bold(t('guide.step3'))}</li>
      </ol>
      <ul className="guide-lines">
        <li>{t('guide.xp')}</li>
        <li>{t('guide.program')}</li>
        <li>{t('guide.potential')}</li>
      </ul>
    </details>
  );
}
