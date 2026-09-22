import { useEffect } from 'react';

/**
 * ============================================================================
 * Arriving, and moving with the page
 * ============================================================================
 *
 * Two things, both on the landing page only:
 *
 *   1. A section marked `.rise` becomes visible when it reaches the screen.
 *   2. The hero photograph moves slower than the page, so the page has depth
 *      rather than sliding as one flat sheet.
 *
 * ⚠️ The content is visible by DEFAULT and is hidden only once this runs, by
 * adding `js-reveal` to the document. A page that parks its own content at
 * zero opacity and waits for JavaScript shows a blank screen when the script
 * fails — and this product's audience is exactly the one on an old phone and
 * a poor connection.
 *
 * ⚠️ Anyone whose device asks for less motion gets none of it: no hiding, no
 * parallax, nothing to re-enable. Motion can cause real symptoms, and nobody
 * should have to trade reading the page for that.
 */
/**
 * ⚠️ `signal` exists because the services arrive from the API a moment AFTER
 * this page mounts. The first version queried the page once, found no service
 * rows yet, and never watched them — so they rendered as blank space, hidden
 * and waiting for an observer that was not looking at them. Passing the number
 * of processes re-runs this the moment they land.
 */
export function useReveal(active: boolean, signal?: unknown) {
  useEffect(() => {
    if (!active) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) return;

    const root = document.documentElement;
    root.classList.add('js-reveal');

    const targets = Array.from(document.querySelectorAll<HTMLElement>('.rise, .track, .beat, .svc-art'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.15 },
    );
    targets.forEach((t) => io.observe(t));

    /* The hero is above the fold, so it is never "observed arriving" — it is
       already here. Shown on the next frame so it still fades in rather than
       appearing mid-animation. */
    const first = requestAnimationFrame(() => {
      document.querySelectorAll('.hero .rise').forEach((el) => el.classList.add('in'));
    });

    /**
     * ⚠️ THE SAFETY NET, and not a theoretical one: the first render of this
     * page in a headless browser showed the three services as blank space,
     * because nothing ever reported them "arriving" and they stayed at zero
     * opacity. Anything that has not been revealed within two and a half
     * seconds is revealed anyway. A section that animates is a nicety; a
     * section that never appears is a broken page.
     */
    const safety = window.setTimeout(() => {
      targets.forEach((t) => t.classList.add('in'));
    }, 2500);

    /* ⚠️ Read the scroll position inside requestAnimationFrame, never in the
       scroll handler itself: touching layout on every scroll event is what
       makes a page stutter on the phones this audience actually owns. */
    const photo = document.querySelector<HTMLElement>('.hero-photo');
    let ticking = false;
    const onScroll = () => {
      if (ticking || !photo) return;
      ticking = true;
      requestAnimationFrame(() => {
        photo.style.transform = `translate3d(0, ${(window.pageYOffset || 0) * 0.16}px, 0)`;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      cancelAnimationFrame(first);
      window.clearTimeout(safety);
      window.removeEventListener('scroll', onScroll);
      root.classList.remove('js-reveal');
      if (photo) photo.style.transform = '';
    };
  }, [active, signal]);
}
