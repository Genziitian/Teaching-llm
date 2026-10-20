'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { angularDelta, HOME_ANGLE, homeTarget, springStep } from './compass';
import styles from './DeskDiorama404.module.css';

export default function DeskDiorama404() {
  const pathname = usePathname();
  const stage = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLDivElement>(null);
  const animation = useRef<number>(0);
  const fade = useRef<Animation | null>(null);
  const reduced = useRef(false);
  const motion = useRef({ angle: 0, velocity: 0 });
  const drag = useRef<{ id: number; pointerAngle: number; time: number } | null>(null);
  const [settled, setSettled] = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  function paint(angle: number) {
    motion.current.angle = angle;
    if (needle.current) needle.current.style.transform = `rotate(${angle}rad)`;
  }

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reduced.current = query.matches;
      if (query.matches && (motion.current.velocity !== 0 || drag.current)) {
        drag.current = null;
        setGrabbing(false);
        motion.current.velocity = 0;
        settle(0);
      }
    };
    update();
    query.addEventListener('change', update);
    return () => {
      query.removeEventListener('change', update);
      cancelAnimationFrame(animation.current);
      fade.current?.cancel();
    };
  }, []);

  function settle(velocity = motion.current.velocity) {
    cancelAnimationFrame(animation.current);
    setSettled(false);
    if (reduced.current) {
      paint(HOME_ANGLE);
      fade.current?.cancel();
      fade.current = needle.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }) || null;
      setSettled(true);
      return;
    }
    const target = homeTarget(motion.current.angle, velocity);
    motion.current.velocity = velocity;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 1 / 60);
      previous = now;
      motion.current = springStep(motion.current.angle, motion.current.velocity, target, dt);
      paint(motion.current.angle);
      if (Math.abs(target - motion.current.angle) < 0.001 && Math.abs(motion.current.velocity) < 0.008) {
        paint(target);
        motion.current.velocity = 0;
        setSettled(true);
      } else animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  }

  function pointerAngle(event: PointerEvent<HTMLButtonElement>) {
    const bounds = stage.current!.getBoundingClientRect();
    return Math.atan2(event.clientX - bounds.left - bounds.width * 0.5, -(event.clientY - bounds.top - bounds.height * 0.70625));
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    cancelAnimationFrame(animation.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, pointerAngle: pointerAngle(event), time: performance.now() };
    motion.current.velocity = 0;
    setSettled(false);
    setGrabbing(true);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.id !== event.pointerId || reduced.current) return;
    const now = performance.now();
    const next = pointerAngle(event);
    const delta = angularDelta(drag.current.pointerAngle, next);
    const dt = Math.max((now - drag.current.time) / 1000, 0.004);
    motion.current.velocity = Math.max(-30, Math.min(30, delta / dt));
    paint(motion.current.angle + delta);
    drag.current = { id: event.pointerId, pointerAngle: next, time: now };
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const velocity = cancelled || performance.now() - drag.current.time > 100 ? 0 : motion.current.velocity;
    drag.current = null;
    setGrabbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    settle(velocity);
  }

  return (
    <main className={styles.page}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>404 / PAGE NOT FOUND</p>
        <h1>This page<br />wandered off.</h1>
        <p className={styles.description}><span className={styles.pathname}>{pathname || '/page'}</span> doesn&apos;t exist. Spin the compass,<br className={styles.desktopBreak} /> it knows the way home.</p>
        <Link href="/" className={`${styles.back} ${settled ? styles.pulse : ''}`}>
          <span aria-hidden="true">↖</span> Back
        </Link>
      </div>
      <div ref={stage} className={styles.stage}>
        {/* All layers share the artist's 1200 × 800 registration and pivot. */}
        <img className={`${styles.layer} ${styles.light} ${styles.desktopScene}`} src="/desk-diorama/404/background.svg" alt="A teal paper compass beside a torn paper map." draggable={false} />
        <img className={`${styles.layer} ${styles.dark} ${styles.desktopScene}`} src="/desk-diorama/404/background-dark.svg" alt="A teal paper compass beside a torn paper map." draggable={false} />
        <img className={`${styles.layer} ${styles.light} ${styles.mobileScene}`} src="/desk-diorama/404/background-mobile.svg" alt="A teal paper compass beside a torn paper map." draggable={false} />
        <img className={`${styles.layer} ${styles.dark} ${styles.mobileScene}`} src="/desk-diorama/404/background-mobile-dark.svg" alt="A teal paper compass beside a torn paper map." draggable={false} />
        <svg className={`${styles.path} ${settled ? styles.pathComplete : ''}`} viewBox="0 0 1200 800" aria-hidden="true">
          <defs><mask id="desk-home-path">
            <path className={`${styles.pathReveal} ${styles.desktopScene}`} pathLength="1" d="M 625 496 C 706 447 721 386 808 390 S 891 365 940 316" fill="none" stroke="white" strokeWidth="8" />
            <path className={`${styles.pathReveal} ${styles.mobileScene}`} pathLength="1" d="M 625 496 C 690 470 730 430 780 432 S 810 420 821 409" fill="none" stroke="white" strokeWidth="8" />
          </mask></defs>
          <g mask="url(#desk-home-path)" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round">
            <path className={styles.desktopScene} d="M 625 496 C 706 447 721 386 808 390 S 891 365 940 316" />
            <path className={styles.mobileScene} d="M 625 496 C 690 470 730 430 780 432 S 810 420 821 409" />
          </g>
        </svg>
        <div ref={needle} className={styles.needle}>
          <img className={`${styles.layer} ${styles.light}`} src="/desk-diorama/404/needle-shadow.svg" alt="" draggable={false} />
          <img className={`${styles.layer} ${styles.dark}`} src="/desk-diorama/404/needle-shadow-dark.svg" alt="" draggable={false} />
          <img className={`${styles.layer} ${styles.light}`} src="/desk-diorama/404/needle.svg" alt="" draggable={false} />
          <img className={`${styles.layer} ${styles.dark}`} src="/desk-diorama/404/needle-dark.svg" alt="" draggable={false} />
        </div>
        <div className={`${styles.crane} ${settled ? styles.craneFound : ''}`}>
          <img className={`${styles.layer} ${styles.light}`} src="/desk-diorama/404/crane-shadow.svg" alt="" draggable={false} />
          <img className={`${styles.layer} ${styles.dark}`} src="/desk-diorama/404/crane-shadow-dark.svg" alt="" draggable={false} />
          <img className={`${styles.layer} ${styles.light}`} src="/desk-diorama/404/crane.svg" alt="A cream origami crane with a vermilion wing tip." draggable={false} />
          <img className={`${styles.layer} ${styles.dark}`} src="/desk-diorama/404/crane-dark.svg" alt="A cream origami crane with a vermilion wing tip." draggable={false} />
        </div>
        <button type="button" className={`${styles.compassControl} ${grabbing ? styles.grabbing : ''}`} aria-label="Spin the compass toward home" aria-describedby="compass-instructions" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event => endDrag(event)} onPointerCancel={event => endDrag(event, true)} onLostPointerCapture={event => endDrag(event, true)} onClick={event => { if (event.detail === 0) settle(12); }} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home'].includes(event.key)) {
            event.preventDefault();
            settle(event.key === 'Home' ? 0 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -12 : 12);
          }
        }} />
      </div>
      <p id="compass-instructions" className={styles.hint}>{settled ? 'Found it. Home is just a click away.' : 'Drag to spin · or tap the compass'}<span className={styles.srOnly}>. With a keyboard, press Enter or use the arrow keys.</span></p>
      <span className={styles.srOnly} role="status">{settled ? 'The compass points home. Use Back to return.' : ''}</span>
    </main>
  );
}
