import { useState, useEffect, useRef, useCallback } from 'react';
import { useBuddy } from '../context/BuddyContext';

const MOOD_DIALOGS = {
  normal:  ['Hai! Mau nonton apa hari ini?', 'Pilih anime yang seru yuk!', 'Soora siap menemanimu!'],
  excited: ['KEREN BANGET NIH!!! 🔥', 'Action time! Gasss!!!', 'Ini seru banget, lanjut terus!'],
  shy:     ['I-iya... bagian yang ini... 😳', '*nutupin muka*', 'W-wah... romantis juga...'],
  scared:  ['I-ini serem banget...', '*sembunyi di balik layar*', 'Jangan matiin lampunya!!'],
  happy:   ['Yeay! Bagus pilihanmu!', '✨ Kamu punya selera bagus!', 'Hore! Selamat nonton!'],
  sleepy:  ['*nguap* zzz...', 'Kamu juga ngantuk gak?', 'Nonton sambil tidur ya...'],
  curious: ['Hmm... ini seru nih...', 'Penasaran apa yang terjadi selanjutnya?', 'Aku juga belum tau endingnya!'],
};

const IDLE_TIMEOUT = 3 * 60 * 1000; // 3 minutes

export default function SooraBuddy() {
  const { mood, setBuddyMood, visible } = useBuddy();
  const [minimized, setMinimized] = useState(false);
  const [dialogText, setDialogText] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [isFloating, setIsFloating] = useState(true);
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('soora_buddy_pos') || 'null');
      return saved || { right: 24, bottom: 24 };
    } catch {
      return { right: 24, bottom: 24 };
    }
  });

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dialogTimer = useRef(null);
  const idleTimer = useRef(null);
  const buddyRef = useRef(null);

  // Check time of day for sleepy mood on mount
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) {
      setBuddyMood('sleepy');
    }
  }, [setBuddyMood]);

  // Idle detection
  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (mood === 'sleepy') return;
    idleTimer.current = setTimeout(() => {
      setBuddyMood('sleepy');
    }, IDLE_TIMEOUT);
  }, [mood, setBuddyMood]);

  useEffect(() => {
    window.addEventListener('mousemove', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle, { passive: true });
    window.addEventListener('click', resetIdle, { passive: true });
    resetIdle();
    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
      clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // Random floating animation toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFloating((v) => !v);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Show dialog on click
  const handleClick = () => {
    const lines = MOOD_DIALOGS[mood] || MOOD_DIALOGS.normal;
    const text = lines[Math.floor(Math.random() * lines.length)];
    setDialogText(text);
    setShowDialog(true);
    clearTimeout(dialogTimer.current);
    dialogTimer.current = setTimeout(() => setShowDialog(false), 3500);
  };

  // Double click = minimize
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setMinimized((v) => !v);
  };

  // Drag logic (mouse)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    const rect = buddyRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      const newRight = window.innerWidth - e.clientX - (buddyRef.current?.offsetWidth || 72) + dragOffset.current.x;
      const newBottom = window.innerHeight - e.clientY - (buddyRef.current?.offsetHeight || 72) + dragOffset.current.y;
      const clampedRight = Math.max(8, Math.min(window.innerWidth - 80, newRight));
      const clampedBottom = Math.max(8, Math.min(window.innerHeight - 80, newBottom));
      setPos({ right: clampedRight, bottom: clampedBottom });
    };

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        setPos((p) => {
          localStorage.setItem('soora_buddy_pos', JSON.stringify(p));
          return p;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`soora-buddy ${mood} ${minimized ? 'buddy-minimized' : ''} ${isFloating ? 'buddy-float' : ''}`}
      ref={buddyRef}
      style={{ right: pos.right, bottom: pos.bottom }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      title="Klik untuk ngobrol, double klik untuk minimize"
    >
      {minimized ? (
        <div className="buddy-mini-icon">🌟</div>
      ) : (
        <div className="buddy-chibi">
          {/* Head */}
          <div className="buddy-head">
            <div className="buddy-face">
              <div className={`buddy-eyes eyes-${mood}`}>
                <div className="buddy-eye left" />
                <div className="buddy-eye right" />
              </div>
              {mood === 'sleepy' && <div className="buddy-zzz">zzz</div>}
              {mood === 'excited' && <div className="buddy-sparkle">✨</div>}
              {mood === 'scared' && <div className="buddy-sweat">💦</div>}
              <div className={`buddy-mouth mouth-${mood}`} />
            </div>
          </div>
          {/* Body */}
          <div className="buddy-body">
            <div className="buddy-arm buddy-arm-left" />
            <div className="buddy-arm buddy-arm-right" />
          </div>
        </div>
      )}

      {/* Dialog bubble */}
      {showDialog && !minimized && (
        <div className="buddy-dialog">
          {dialogText}
          <div className="buddy-dialog-tail" />
        </div>
      )}
    </div>
  );
}
