import { useEffect, useRef, useState, useCallback } from 'react';

const MESSAGES = {
  cat:     ["Nyaa~", "Mau nonton apa?", "Udah makan belum?", "...zzz", "Sini peluk!"],
  fox:     ["Kon kon!", "Pilih yang bagus ya~", "Hmm... menarik", "Kuy nonton bareng"],
  raccoon: ["Heboh amat!", "Makanan ada ga?", "Aku mau ikut!", "*nyuri snack*"],
  bird:    ["Tweet!", "Mau terbang ga?", "Cuit cuit!", "Langit cerah nih~"],
};

const SCALE = 3; // pixel art upscale factor

function useSprite(animal) {
  const [sprite, setSprite] = useState(null); // { img, frames, tags }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [jsonRes] = await Promise.all([
          fetch(`/companion/${animal}.json`),
        ]);
        if (!jsonRes.ok) throw new Error('json not found');
        const json = await jsonRes.json();

        const img = new Image();
        img.src = `/companion/${animal}.png`;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });

        if (cancelled) return;

        // Aseprite Array export format
        const frames = Array.isArray(json.frames)
          ? json.frames
          : Object.values(json.frames);

        const tags = json.meta?.frameTags || [];

        setSprite({ img, frames, tags });
      } catch {
        // Sprite files not yet exported — companion stays hidden
        setSprite(null);
      }
    }

    setSprite(null);
    load();
    return () => { cancelled = true; };
  }, [animal]);

  return sprite;
}

export default function Companion({ animal, visible, onHide }) {
  const canvasRef = useRef(null);
  const sprite = useSprite(animal);

  // Animation state (refs to avoid re-render loop)
  const animState = useRef({ anim: 'Idle Down', frameIdx: 0, elapsed: 0 });
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Movement state
  const [posX, setPosX] = useState(120);
  const [facing, setFacing] = useState('right'); // 'left' | 'right'
  const movementRef = useRef(null);

  // Chat bubble
  const [bubble, setBubble] = useState(null);
  const bubbleTimerRef = useRef(null);

  // Canvas dimensions
  const [canvasW, setCanvasW] = useState(32);
  const [canvasH, setCanvasH] = useState(32);

  // Determine canvas size from first frame
  useEffect(() => {
    if (!sprite) return;
    const fr = sprite.frames[0]?.frame;
    if (fr) {
      setCanvasW(fr.w * SCALE);
      setCanvasH(fr.h * SCALE);
    }
  }, [sprite]);

  // Canvas draw loop
  useEffect(() => {
    if (!sprite || !visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function getTagRange(name) {
      const tag = sprite.tags.find(t => t.name === name);
      if (!tag) return null;
      return { from: tag.from, to: tag.to };
    }

    function draw(ts) {
      const dt = lastTimeRef.current ? ts - lastTimeRef.current : 16;
      lastTimeRef.current = ts;

      const st = animState.current;
      const range = getTagRange(st.anim);

      if (range) {
        st.elapsed += dt;
        const fr = sprite.frames[st.frameIdx];
        const dur = fr?.duration ?? 100;
        if (st.elapsed >= dur) {
          st.elapsed -= dur;
          st.frameIdx++;
          if (st.frameIdx > range.to) st.frameIdx = range.from;
        }

        const f = sprite.frames[st.frameIdx];
        if (f) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            sprite.img,
            f.frame.x, f.frame.y, f.frame.w, f.frame.h,
            0, 0, canvas.width, canvas.height,
          );
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [sprite, visible]);

  // Change animation helper
  const setAnim = useCallback((name) => {
    if (animState.current.anim === name) return;
    animState.current.anim = name;
    animState.current.frameIdx = 0;
    animState.current.elapsed = 0;
  }, []);

  // Autonomous wander
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    async function wander() {
      while (!cancelled) {
        const screenW = window.innerWidth;
        const margin = 80;
        const targetX = margin + Math.random() * (screenW - margin * 2);
        const currentX = movementRef.current ?? 120;
        const dist = Math.abs(targetX - currentX);
        const speed = 80; // px/s
        const duration = (dist / speed) * 1000;

        const dir = targetX > currentX ? 'right' : 'left';
        setFacing(dir);
        setAnim(dir === 'right' ? 'Run R' : 'Run L');
        movementRef.current = targetX;
        setPosX(targetX);

        // Wait for movement to complete
        await new Promise(r => setTimeout(r, duration));
        if (cancelled) break;

        // Idle
        setAnim('Idle Down');
        const idleTime = 1000 + Math.random() * 2500;
        await new Promise(r => setTimeout(r, idleTime));
      }
    }

    // Small initial delay
    const initTimer = setTimeout(wander, 500);
    return () => {
      cancelled = true;
      clearTimeout(initTimer);
    };
  }, [visible, setAnim]);

  // Sync movementRef with posX
  useEffect(() => {
    movementRef.current = posX;
  }, [posX]);

  function showBubble() {
    const msgs = MESSAGES[animal] || MESSAGES.cat;
    setBubble(msgs[Math.floor(Math.random() * msgs.length)]);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 3000);
  }

  function handleClick(e) {
    e.stopPropagation();
    showBubble();
  }

  function handleDoubleClick(e) {
    e.stopPropagation();
    setBubble(null);
    onHide();
  }

  if (!visible || !sprite) return null;

  const spriteMirror = facing === 'left' && !animState.current.anim.includes('L');

  return (
    <div className="companion-area" aria-hidden="true">
      <div
        className="companion-sprite"
        style={{
          transform: `translateX(${posX}px)`,
          transition: `transform ${Math.abs(posX - (movementRef.current || posX)) / 80}s linear`,
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {bubble && (
          <div className="companion-bubble">
            {bubble}
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{
            imageRendering: 'pixelated',
            transform: spriteMirror ? 'scaleX(-1)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
