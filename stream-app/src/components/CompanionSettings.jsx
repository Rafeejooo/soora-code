import { useState, useEffect, useRef } from 'react';

const ANIMALS = ['cat', 'fox', 'raccoon', 'bird'];
const ANIMAL_LABELS = { cat: 'Cat', fox: 'Fox', raccoon: 'Raccoon', bird: 'Bird' };
const ANIMAL_EMOJI  = { cat: '🐱', fox: '🦊', raccoon: '🦝', bird: '🐦' };

const LS_ANIMAL  = 'soora_companion_animal';
const LS_VISIBLE = 'soora_companion_visible';

export function useCompanionState() {
  const [animal, setAnimalState] = useState(() => localStorage.getItem(LS_ANIMAL) || 'cat');
  const [visible, setVisibleState] = useState(() => {
    const v = localStorage.getItem(LS_VISIBLE);
    return v === null ? true : v === 'true';
  });

  function setAnimal(a) {
    localStorage.setItem(LS_ANIMAL, a);
    setAnimalState(a);
  }

  function setVisible(v) {
    localStorage.setItem(LS_VISIBLE, String(v));
    setVisibleState(v);
  }

  return { animal, setAnimal, visible, setVisible };
}

export default function CompanionSettings({ animal, setAnimal, visible, setVisible }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="companion-settings" ref={panelRef}>
      {open && (
        <div className="companion-settings-panel">
          <div className="companion-settings-title">🐾 Animal Companion</div>
          <div className="companion-animal-picker">
            {ANIMALS.map(a => (
              <button
                key={a}
                className={`companion-animal-btn${animal === a ? ' active' : ''}`}
                onClick={() => setAnimal(a)}
                title={ANIMAL_LABELS[a]}
              >
                <span>{ANIMAL_EMOJI[a]}</span>
                <span>{ANIMAL_LABELS[a]}</span>
              </button>
            ))}
          </div>
          <div className="companion-settings-row">
            <span>Show companion</span>
            <button
              className={`companion-toggle${visible ? ' on' : ''}`}
              onClick={() => setVisible(!visible)}
            >
              {visible ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}
      <button
        className="companion-settings-btn"
        onClick={() => setOpen(o => !o)}
        title="Companion settings"
      >
        ⚙
      </button>
    </div>
  );
}
