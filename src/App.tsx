import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initHeroCanvas } from './webgl/heroCanvas';
import { initSpecsCanvas } from './webgl/specsCanvas';

gsap.registerPlugin(ScrollTrigger);

const OLIRA_PRODUCT_IMG = '/assets/aistudio/OLIRA_Google_AI_Studio-1_384cb337.jpg';

type VariantId = 'classic' | 'light' | 'signature';
type SizeLabel = '500 ml (455g)' | '1 L' | '2 L';

interface BagItem {
  variant: VariantId;
  size: SizeLabel;
  price: number;
  qty: number;
}

const VARIANT_META: Record<
  VariantId,
  {
    name: string;
    dot: string;
    priceDelta: number;
    extraction: string;
    bestFor: string;
  }
> = {
  classic: {
    name: 'Cold-Pressed Classic',
    dot: '#B57B1E',
    priceDelta: 0,
    extraction: 'First cold-pressed black sesame (< 27°C)',
    bestFor: 'Everyday cooking, tadka, roasting & drizzling',
  },
  light: {
    name: 'Extra Light',
    dot: '#D8B362',
    priceDelta: -50,
    extraction: 'Gentle cold-filtered sesame, mild aroma',
    bestFor: 'High-heat searing, baking & stir-frying',
  },
  signature: {
    name: 'Signature Blend',
    dot: '#3D5740',
    priceDelta: 150,
    extraction: 'Early-harvest Rajasthan black sesame press',
    bestFor: 'Finishing dishes, wellness rituals & dipping',
  },
};

const SIZE_OPTIONS: { size: SizeLabel; basePrice: number; scale: number }[] = [
  { size: '500 ml (455g)', basePrice: 749, scale: 0.92 },
  { size: '1 L', basePrice: 1399, scale: 1.0 },
  { size: '2 L', basePrice: 2599, scale: 1.08 },
];

const SHOWCASE_STAGES = [
  {
    cropClass: 'showcase-img--full',
    alt: 'Olira Natural Oil — Black Sesame Oil bottle from the land of Rajasthan with burlap cap wrap and origin tag',
    title: 'Black Sesame Oil',
    sub: 'Cold-pressed from heirloom Rajasthan seeds for pure everyday flavor',
  },
  {
    cropClass: 'showcase-img--cap',
    alt: 'Close-up of the Olira hand-tied jute burlap cap wrap, twine tie, and origin hang-tag',
    title: 'Hand-Tied Jute Seal',
    sub: 'Artisanal burlap wrap and twine sealing clean glass purity',
  },
  {
    cropClass: 'showcase-img--label',
    alt: 'Close-up of the Olira Black Sesame Oil label reading Sehat Ka Bharosa and From the Land of Rajasthan',
    title: 'Sehat Ka Bharosa',
    sub: '100% pure vegetarian extraction with zero chemical solvents',
  },
  {
    cropClass: 'showcase-img--amber',
    alt: 'Detail of the rich golden-amber Olira Black Sesame Oil glowing through the flared glass bottle',
    title: 'Golden-Amber Clarity',
    sub: 'Naturally rich in antioxidants, steady aroma, and clean pouring',
  },
];

function computePrice(variant: VariantId, size: SizeLabel): number {
  const base = SIZE_OPTIONS.find((s) => s.size === size)?.basePrice ?? 749;
  const delta = VARIANT_META[variant].priceDelta;
  return base + delta;
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function App() {
  // Always open in light mode regardless of browser dark-mode preference
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [variant, setVariant] = useState<VariantId>('classic');
  const [size, setSize] = useState<SizeLabel>('500 ml (455g)');
  const [activeStage, setActiveStage] = useState<number>(0);
  const [captionBlur, setCaptionBlur] = useState<boolean>(false);
  const [splitPct, setSplitPct] = useState<number>(50);
  const [splitAnimate, setSplitAnimate] = useState<boolean>(false);
  const [bag, setBag] = useState<BagItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [checkedOut, setCheckedOut] = useState<boolean>(false);

  const heroCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroStageRef = useRef<HTMLDivElement | null>(null);
  const tiltWrapRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const showcaseRef = useRef<HTMLElement | null>(null);
  const frameRefs = useRef<(HTMLElement | null)[]>([]);
  const bentoGridRef = useRef<HTMLDivElement | null>(null);
  const compWrapRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const stageIdxRef = useRef<number>(0);
  const stageTimerRef = useRef<number | null>(null);
  const checkoutTimerRef = useRef<number | null>(null);
  const selectedConfigRef = useRef<{
    variant: VariantId;
    size: SizeLabel;
  }>({ variant: 'classic', size: '500 ml (455g)' });

  const activePrice = computePrice(variant, size);
  const activeScale = SIZE_OPTIONS.find((s) => s.size === size)?.scale ?? 0.92;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const cleanupHeroGl = initHeroCanvas(heroCanvasRef.current);
    const cleanupSpecsGl = initSpecsCanvas(specsCanvasRef.current);

    let lenis: InstanceType<typeof Lenis> | null = null;
    let lenisTicker: ((time: number) => void) | null = null;
    if (!prefersReduced) {
      lenis = new Lenis({
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
      lenisTicker = (time: number) => {
        lenis?.raf(time * 1000);
      };
      gsap.ticker.add(lenisTicker);
      gsap.ticker.lagSmoothing(0);
    }

    let targetRotX = 0;
    let targetRotY = 0;
    let curRotX = 0;
    let curRotY = 0;
    let velX = 0;
    let velY = 0;
    let tiltTicker: (() => void) | null = null;

    const heroStage = heroStageRef.current;
    const onHeroMove = (e: PointerEvent) => {
      if (!heroStage) return;
      const rect = heroStage.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetRotY = nx * 10;
      targetRotX = -ny * 8;
    };
    const onHeroLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    if (heroStage && tiltWrapRef.current && !prefersReduced) {
      heroStage.addEventListener('pointermove', onHeroMove);
      heroStage.addEventListener('pointerleave', onHeroLeave);
      tiltTicker = () => {
        const ax = (targetRotX - curRotX) * 0.08;
        const ay = (targetRotY - curRotY) * 0.08;
        velX = (velX + ax) * 0.82;
        velY = (velY + ay) * 0.82;
        curRotX += velX;
        curRotY += velY;
        if (tiltWrapRef.current) {
          tiltWrapRef.current.style.transform = `rotateX(${curRotX.toFixed(2)}deg) rotateY(${curRotY.toFixed(2)}deg)`;
        }
        if (shadowRef.current) {
          shadowRef.current.style.transform = `translateX(${(-curRotY * 1.4).toFixed(1)}px) scale(${1 - Math.abs(curRotX) * 0.01})`;
        }
      };
      gsap.ticker.add(tiltTicker);
    }

    const gsapCtx = gsap.context(() => {
      if (prefersReduced) return;

      const frames = frameRefs.current.filter(
        (el): el is HTMLElement => el !== null
      );
      if (showcaseRef.current && frames.length === 4) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: showcaseRef.current,
            start: 'top top',
            end: '+=280%',
            pin: true,
            scrub: 0.65,
            onUpdate: (self: { progress: number }) => {
              const t = self.progress * 3.5;
              let nextIdx = 0;
              if (t >= 3.07) nextIdx = 3;
              else if (t >= 2.02) nextIdx = 2;
              else if (t >= 0.97) nextIdx = 1;

              if (nextIdx !== stageIdxRef.current) {
                stageIdxRef.current = nextIdx;
                setCaptionBlur(true);
                if (stageTimerRef.current !== null) {
                  window.clearTimeout(stageTimerRef.current);
                }
                stageTimerRef.current = window.setTimeout(() => {
                  stageTimerRef.current = null;
                  setActiveStage(nextIdx);
                  setCaptionBlur(false);
                }, 100);
              }
            },
          },
        });

        const wipeStarts = [0.25, 1.3, 2.35];
        frames.forEach((frame, i) => {
          if (i === 0) return;
          tl.fromTo(
            frame,
            { clipPath: 'inset(0 0 0 100%)' },
            { clipPath: 'inset(0 0 0 0%)', ease: 'none', duration: 0.8 },
            wipeStarts[i - 1]
          );
        });
        tl.set({}, {}, 3.5);
      }

      if (bentoGridRef.current) {
        gsap.from('.reveal-tile', {
          y: 28,
          scale: 0.96,
          opacity: 0,
          duration: 0.65,
          stagger: 0.08,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: bentoGridRef.current,
            start: 'top 82%',
            once: true,
          },
        });
      }
    });

    return () => {
      if (stageTimerRef.current !== null) {
        window.clearTimeout(stageTimerRef.current);
        stageTimerRef.current = null;
      }
      if (checkoutTimerRef.current !== null) {
        window.clearTimeout(checkoutTimerRef.current);
        checkoutTimerRef.current = null;
      }
      cleanupHeroGl();
      cleanupSpecsGl();
      gsapCtx.revert();
      if (tiltTicker) gsap.ticker.remove(tiltTicker);
      if (lenisTicker) gsap.ticker.remove(lenisTicker);
      lenis?.destroy();
      heroStage?.removeEventListener('pointermove', onHeroMove);
      heroStage?.removeEventListener('pointerleave', onHeroLeave);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const selectStage = (idx: number) => {
    stageIdxRef.current = idx;
    setCaptionBlur(true);
    if (stageTimerRef.current !== null) {
      window.clearTimeout(stageTimerRef.current);
    }
    stageTimerRef.current = window.setTimeout(() => {
      stageTimerRef.current = null;
      setActiveStage(idx);
      setCaptionBlur(false);
    }, 110);
    frameRefs.current.forEach((frame, i) => {
      if (!frame) return;
      frame.style.clipPath =
        i <= idx ? 'inset(0 0 0 0%)' : 'inset(0 0 0 100%)';
    });
  };

  const updateSplit = (pct: number, animate: boolean) => {
    const clamped = Math.max(0, Math.min(100, pct));
    setSplitAnimate(animate);
    setSplitPct(clamped);
  };

  const handleCompPointerDown = (e: {
    currentTarget: HTMLDivElement;
    pointerId: number;
    clientX: number;
  }) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    updateSplit(((e.clientX - rect.left) / rect.width) * 100, false);
  };

  const handleCompPointerMove = (e: {
    currentTarget: HTMLDivElement;
    clientX: number;
  }) => {
    if (!isDraggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    updateSplit(((e.clientX - rect.left) / rect.width) * 100, false);
  };

  const handleCompPointerUp = () => {
    isDraggingRef.current = false;
  };

  const selectVariant = (nextVariant: VariantId) => {
    selectedConfigRef.current.variant = nextVariant;
    setVariant(nextVariant);
  };

  const selectSize = (nextSize: SizeLabel) => {
    selectedConfigRef.current.size = nextSize;
    setSize(nextSize);
  };

  const cancelPendingCheckout = () => {
    if (checkoutTimerRef.current !== null) {
      window.clearTimeout(checkoutTimerRef.current);
      checkoutTimerRef.current = null;
      setCheckedOut(false);
    }
  };

  const addToBag = () => {
    cancelPendingCheckout();
    const activeCfg = selectedConfigRef.current;
    const itemPrice = computePrice(activeCfg.variant, activeCfg.size);
    setBag((prev) => {
      const idx = prev.findIndex(
        (item) =>
          item.variant === activeCfg.variant && item.size === activeCfg.size
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          variant: activeCfg.variant,
          size: activeCfg.size,
          price: itemPrice,
          qty: 1,
        },
      ];
    });
    setDrawerOpen(true);
  };

  const updateBagQty = (idx: number, delta: number) => {
    cancelPendingCheckout();
    setBag((prev) => {
      const next = [...prev];
      const updatedQty = next[idx].qty + delta;
      if (updatedQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], qty: updatedQty };
      }
      return next;
    });
  };

  const handleCheckout = () => {
    if (checkedOut) return;
    if (checkoutTimerRef.current !== null) {
      window.clearTimeout(checkoutTimerRef.current);
    }
    setCheckedOut(true);
    checkoutTimerRef.current = window.setTimeout(() => {
      checkoutTimerRef.current = null;
      setBag([]);
      setCheckedOut(false);
      setDrawerOpen(false);
    }, 1100);
  };

  const totalQty = bag.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = bag.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <>
      <div className="grain-overlay" aria-hidden="true" />

      <header className="site-header" id="site-header">
        <div className="container header-inner">
          <a href="#hero" className="brand-lockup" aria-label="Olira Home">
            <svg
              className="brand-mark"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 12.5C12 12.5 8.5 8.8 8.5 6.2C8.5 4.4 10 3.2 12 3.2C14 3.2 15.5 4.4 15.5 6.2C15.5 8.8 12 12.5 12 12.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M12 13C12 13 6.5 11.8 4.8 9.2C3.8 7.6 4.8 6 6.7 6.6C9 7.3 12 13 12 13Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M12 13C12 13 17.5 11.8 19.2 9.2C20.2 7.6 19.2 6 17.3 6.6C15 7.3 12 13 12 13Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M12 15.2C12 15.2 9.5 18 9.5 19.9C9.5 21.3 10.6 22.4 12 22.4C13.4 22.4 14.5 21.3 14.5 19.9C14.5 18 12 15.2 12 15.2Z"
                fill="#C8962E"
              />
            </svg>
            <span className="brand-wordmark">Olira</span>
          </a>

          <nav className="header-nav" aria-label="Primary">
            <a href="#showcase" className="nav-link">
              Showcase
            </a>
            <a href="#craft" className="nav-link">
              Craft
            </a>
            <a href="#order" className="nav-link">
              Configure
            </a>
            <button
              type="button"
              className="icon-btn theme-toggle"
              id="theme-toggle"
              aria-label="Toggle color theme"
              title="Switch light or dark theme"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              <svg
                id="theme-icon-sun"
                width="19"
                height="19"
                viewBox="0 0 256 256"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="128" cy="128" r="56" stroke="currentColor" strokeWidth="18" />
                <line x1="128" y1="24" x2="128" y2="44" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
                <line x1="128" y1="212" x2="128" y2="232" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
                <line x1="24" y1="128" x2="44" y2="128" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
                <line x1="212" y1="128" x2="232" y2="128" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
                <line x1="54" y1="54" x2="68" y2="68" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
                <line x1="188" y1="188" x2="202" y2="202" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
                <line x1="54" y1="202" x2="68" y2="188" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
                <line x1="188" y1="68" x2="202" y2="54" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
              </svg>
              <svg
                id="theme-icon-moon"
                width="19"
                height="19"
                viewBox="0 0 256 256"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M210.69 158.18A96.78 96.78 0 0 1 192 160 96.11 96.11 0 0 1 96 64a96.78 96.78 0 0 1 1.82-18.69A96.04 96.04 0 1 0 210.69 158.18Z"
                  stroke="currentColor"
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="icon-btn bag-trigger"
              id="bag-trigger"
              aria-label="Open order bag"
              onClick={() => setDrawerOpen(true)}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 256 256"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="32"
                  y="72"
                  width="192"
                  height="144"
                  rx="16"
                  stroke="currentColor"
                  strokeWidth="18"
                />
                <path
                  d="M88 72V64a40 40 0 0 1 80 0v8"
                  stroke="currentColor"
                  strokeWidth="18"
                  strokeLinecap="round"
                />
              </svg>
              <span className="bag-count" id="bag-count">
                {totalQty}
              </span>
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* SECTION 1: Asymmetric Split Hero */}
        <section id="hero" className="hero">
          <canvas
            ref={heroCanvasRef}
            id="hero-gl-canvas"
            className="hero-canvas"
            aria-hidden="true"
          />

          <div className="container hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title">Pure cold-pressed goodness.</h1>
              <p className="hero-sub">
                Pure, thoughtfully sourced oil made for everyday cooking, flavor,
                and wellness—clean pouring with zero mess.
              </p>

              <div className="hero-actions">
                <a href="#order" className="btn btn-primary magnetic-btn">
                  Shop Olira
                </a>
                <a href="#showcase" className="btn btn-ghost">
                  Explore
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 256 256"
                    fill="none"
                    aria-hidden="true"
                  >
                    <line
                      x1="64"
                      y1="64"
                      x2="192"
                      y2="192"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    <polyline
                      points="88 192 192 192 192 88"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            </div>

            <div className="hero-stage" ref={heroStageRef} id="hero-stage">
              <div
                className="flask-tilt-wrap"
                ref={tiltWrapRef}
                id="flask-tilt-wrap"
              >
                <img
                  src={OLIRA_PRODUCT_IMG}
                  alt="Olira Black Sesame Oil 500 ml bottle from the land of Rajasthan with hand-tied burlap cap and origin hang-tag"
                  className="flask-hero-img"
                  id="hero-bottle-img"
                  data-variant={variant}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flask-shadow" ref={shadowRef} aria-hidden="true" />

              <div
                className="hero-swatches"
                role="radiogroup"
                aria-label="Select Olira oil variant"
              >
                {(Object.keys(VARIANT_META) as VariantId[]).map((key) => {
                  const meta = VARIANT_META[key];
                  const isActive = variant === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      className={`swatch-btn${isActive ? ' is-active' : ''}`}
                      data-variant={key}
                      aria-checked={isActive}
                      aria-label={meta.name}
                      onClick={() => selectVariant(key)}
                    >
                      <span
                        className="swatch-dot"
                        style={{ background: meta.dot }}
                      />
                      <span className="swatch-label">{meta.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Pinned 4-Angle Product Showcase */}
        <section id="showcase" ref={showcaseRef} className="showcase-pin">
          <div className="showcase-viewport" id="showcase-viewport">
            <div className="showcase-frames" id="showcase-frames">
              {SHOWCASE_STAGES.map((stage, i) => (
                <figure
                  key={stage.title}
                  ref={(el: HTMLElement | null) => {
                    frameRefs.current[i] = el;
                  }}
                  className={`showcase-frame${i === 0 ? ' is-active' : ''}`}
                  data-index={i}
                >
                  <img
                    src={OLIRA_PRODUCT_IMG}
                    alt={stage.alt}
                    className={`showcase-img ${stage.cropClass}`}
                    referrerPolicy="no-referrer"
                  />
                </figure>
              ))}
            </div>

            <div className="showcase-hud">
              <div
                className={`showcase-caption${captionBlur ? ' is-blurring' : ''}`}
                id="showcase-caption"
              >
                <h2 className="caption-title" id="caption-title">
                  {SHOWCASE_STAGES[activeStage].title}
                </h2>
                <p className="caption-sub" id="caption-sub">
                  {SHOWCASE_STAGES[activeStage].sub}
                </p>
              </div>

              <div
                className="showcase-dots"
                role="tablist"
                aria-label="Product showcase views"
              >
                {SHOWCASE_STAGES.map((stage, i) => (
                  <button
                    key={stage.title}
                    type="button"
                    role="tab"
                    aria-selected={activeStage === i}
                    className={`stage-dot${activeStage === i ? ' is-active' : ''}`}
                    aria-label={`View ${i + 1}: ${stage.title}`}
                    onClick={() => selectStage(i)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Interactive Culinary Performance Comparison Slider */}
        <section id="extraction" className="thermal-section">
          <div className="container thermal-grid">
            <div
              className="comparison-wrap"
              ref={compWrapRef}
              id="comparison-wrap"
              onPointerDown={handleCompPointerDown}
              onPointerMove={handleCompPointerMove}
              onPointerUp={handleCompPointerUp}
              onPointerCancel={handleCompPointerUp}
            >
              <div className="comparison-layer comparison-hot">
                <img
                  src={OLIRA_PRODUCT_IMG}
                  alt="Olira Black Sesame Oil illuminated in warm golden kitchen heat"
                  className="comparison-img"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div
                className="comparison-layer comparison-cold"
                id="comparison-cold"
                style={{
                  clipPath: `inset(0 ${100 - splitPct}% 0 0)`,
                  transition: splitAnimate
                    ? 'clip-path 380ms var(--ease-out)'
                    : 'none',
                }}
              >
                <img
                  src={OLIRA_PRODUCT_IMG}
                  alt="Olira Black Sesame Oil in crisp daylight studio clarity"
                  className="comparison-img"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div
                className={`comparison-handle${
                  splitPct <= 2 || splitPct >= 98 ? ' is-edge' : ''
                }`}
                id="comparison-handle"
                role="slider"
                tabIndex={0}
                aria-label="Compare cold-pressed finishing and everyday high-heat cooking"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(splitPct)}
                style={{
                  left: `clamp(22px, ${splitPct}%, calc(100% - 22px))`,
                  transition: splitAnimate
                    ? 'left 380ms var(--ease-out)'
                    : 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') updateSplit(splitPct - 8, true);
                  if (e.key === 'ArrowRight') updateSplit(splitPct + 8, true);
                }}
              >
                <div className="handle-line" />
                <div className="handle-knob">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 256 256"
                    fill="none"
                    aria-hidden="true"
                  >
                    <polyline
                      points="176 144 208 176 176 208"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1="48"
                      y1="176"
                      x2="208"
                      y2="176"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    <polyline
                      points="80 112 48 80 80 48"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1="208"
                      y1="80"
                      x2="48"
                      y2="80"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="thermal-copy">
              <h2 className="section-title">From raw drizzle to daily sear.</h2>
              <p className="section-sub">
                Cold-pressed from Rajasthan black sesame below 27°C to lock in
                natural nutrients and nutty aroma, while holding steady for clean
                everyday cooking.
              </p>

              <div
                className="segmented-control"
                role="tablist"
                aria-label="Culinary mode"
              >
                <button
                  type="button"
                  role="tab"
                  className={`seg-btn${splitPct >= 98 ? ' is-active' : ''}`}
                  aria-selected={splitPct >= 98}
                  onClick={() => updateSplit(100, true)}
                >
                  Cold-Pressed
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`seg-btn${splitPct <= 2 ? ' is-active' : ''}`}
                  aria-selected={splitPct <= 2}
                  onClick={() => updateSplit(0, true)}
                >
                  Everyday Heat
                </button>
              </div>

              <div className="thermal-metrics">
                <div className="metric-item">
                  <span className="metric-value">410°F</span>
                  <span className="metric-label">Smoke point</span>
                </div>
                <div className="metric-item">
                  <span className="metric-value">24 mo</span>
                  <span className="metric-label">Sealed shelf life</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Asymmetric 3-Tile Editorial Bento */}
        <section id="craft" className="bento-section">
          <div className="container">
            <div className="section-header-stack">
              <h2 className="section-title">Crafted for everyday kitchens.</h2>
            </div>

            <div className="bento-grid" ref={bentoGridRef}>
              <article className="bento-tile bento-tall reveal-tile">
                <img
                  src={OLIRA_PRODUCT_IMG}
                  alt="Detail of Olira hand-tied burlap neck seal, twine, and origin hang-tag"
                  className="bento-img bento-img--cap"
                  referrerPolicy="no-referrer"
                />
                <div className="bento-footer">
                  <h3 className="bento-title">Clean Pour &amp; Jute Seal</h3>
                  <p className="bento-sub">
                    Hand-tied burlap wrap and precision glass lip for zero mess
                  </p>
                </div>
              </article>

              <article className="bento-tile bento-top reveal-tile">
                <img
                  src={OLIRA_PRODUCT_IMG}
                  alt="Close-up of Olira Black Sesame Oil label reading From the Land of Rajasthan"
                  className="bento-img bento-img--label"
                  referrerPolicy="no-referrer"
                />
                <div className="bento-footer">
                  <h3 className="bento-title">Rajasthan Harvest</h3>
                  <p className="bento-sub">
                    Single-origin black sesame seeds · Sehat Ka Bharosa
                  </p>
                </div>
              </article>

              <article className="bento-tile bento-bottom reveal-tile">
                <canvas
                  ref={specsCanvasRef}
                  id="specs-gl-canvas"
                  className="specs-canvas"
                  aria-hidden="true"
                />
                <div className="bento-footer bento-footer-specs">
                  <div>
                    <h3 className="bento-title">100% Pure</h3>
                    <p className="bento-sub">Cold-pressed · Zero additives</p>
                  </div>
                  <span className="spec-mono">500 ml (455g)</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* SECTION 5: Interactive Variant & Capacity Configurator + Order */}
        <section id="order" className="order-section">
          <div className="container order-grid">
            <div className="order-preview" id="order-preview">
              <img
                src={OLIRA_PRODUCT_IMG}
                alt={`Olira Black Sesame Oil — ${VARIANT_META[variant].name} in ${size}`}
                className="order-flask-img"
                id="order-bottle-img"
                data-variant={variant}
                referrerPolicy="no-referrer"
                style={{ transform: `scale(${activeScale})` }}
              />
            </div>

            <div className="order-panel">
              <h2 className="section-title">Olira Black Sesame Oil</h2>
              <p className="order-price" id="order-price">
                {formatINR(activePrice)}
              </p>

              <div className="config-group">
                <span className="config-label">Variant</span>
                <div className="option-row" id="order-variant-row">
                  {(Object.keys(VARIANT_META) as VariantId[]).map((key) => {
                    const meta = VARIANT_META[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`pill-option${
                          variant === key ? ' is-active' : ''
                        }`}
                        onClick={() => selectVariant(key)}
                      >
                        <span
                          className="dot"
                          style={{ background: meta.dot }}
                        />
                        {meta.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="config-group">
                <span className="config-label">Capacity</span>
                <div className="option-row" id="order-size-row">
                  {SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.size}
                      type="button"
                      className={`pill-option${
                        size === opt.size ? ' is-active' : ''
                      }`}
                      onClick={() => selectSize(opt.size)}
                    >
                      {opt.size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="spec-list">
                <div className="spec-row">
                  <span className="spec-key">Origin</span>
                  <span className="spec-val">From the land of Rajasthan</span>
                </div>
                <div className="spec-row">
                  <span className="spec-key">Extraction</span>
                  <span className="spec-val">
                    {VARIANT_META[variant].extraction}
                  </span>
                </div>
                <div className="spec-row">
                  <span className="spec-key">Best For</span>
                  <span className="spec-val">
                    {VARIANT_META[variant].bestFor}
                  </span>
                </div>
                <div className="spec-row">
                  <span className="spec-key">Guarantee</span>
                  <span className="spec-val">
                    Sehat Ka Bharosa · 100% Pure &amp; Vegetarian
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-full magnetic-btn"
                id="add-to-bag-btn"
                onClick={addToBag}
              >
                <span className="btn-label" id="add-to-bag-label">
                  Add to Bag - {formatINR(activePrice)}
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span className="footer-brand">Olira</span>
          <span className="footer-tag">
            Pure cold-pressed goodness · Sehat Ka Bharosa
          </span>
          <span className="footer-copy">© 2026 Olira</span>
        </div>
      </footer>

      {/* Slide-Over Order Bag Drawer */}
      <div
        className="drawer-backdrop"
        id="drawer-backdrop"
        hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className="bag-drawer"
        id="bag-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        hidden={!drawerOpen}
      >
        <div className="drawer-header">
          <h2 id="drawer-title" className="drawer-title">
            Bag
          </h2>
          <button
            type="button"
            className="icon-btn"
            id="drawer-close"
            aria-label="Close bag"
            onClick={() => setDrawerOpen(false)}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 256 256"
              fill="none"
              aria-hidden="true"
            >
              <line
                x1="200"
                y1="56"
                x2="56"
                y2="200"
                stroke="currentColor"
                strokeWidth="20"
                strokeLinecap="round"
              />
              <line
                x1="200"
                y1="200"
                x2="56"
                y2="56"
                stroke="currentColor"
                strokeWidth="20"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="drawer-body" id="drawer-body">
          <div className="drawer-empty" id="drawer-empty" hidden={bag.length > 0}>
            <p>Your bag is empty.</p>
            <a
              href="#order"
              className="btn btn-primary btn-sm"
              id="drawer-empty-cta"
              onClick={() => setDrawerOpen(false)}
            >
              Select Oil
            </a>
          </div>

          <div className="drawer-items" id="drawer-items" hidden={bag.length === 0}>
            {bag.map((item, idx) => (
              <div key={`${item.variant}-${item.size}`} className="bag-item">
                <img
                  src={OLIRA_PRODUCT_IMG}
                  alt={`Olira Black Sesame Oil — ${VARIANT_META[item.variant].name}`}
                  className="bag-item-thumb"
                  data-variant={item.variant}
                  referrerPolicy="no-referrer"
                />
                <div className="bag-item-info">
                  <div className="bag-item-name">Olira Black Sesame Oil</div>
                  <div className="bag-item-meta">
                    {VARIANT_META[item.variant].name} · {item.size} ({formatINR(item.price)})
                  </div>
                  <div className="bag-qty-row">
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label="Decrease quantity"
                      onClick={() => updateBagQty(idx, -1)}
                    >
                      -
                    </button>
                    <span className="bag-qty">{item.qty}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label="Increase quantity"
                      onClick={() => updateBagQty(idx, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="drawer-footer" id="drawer-footer" hidden={bag.length === 0}>
          <div className="drawer-total-row">
            <span>Total</span>
            <span className="drawer-total" id="drawer-total">
              {formatINR(totalPrice)}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-full"
            id="checkout-btn"
            disabled={checkedOut}
            onClick={handleCheckout}
          >
            {checkedOut ? 'Order Confirmed' : 'Checkout'}
          </button>
        </div>
      </aside>
    </>
  );
}
