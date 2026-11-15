import { useEffect, useState } from 'react';

/** One timer for the page, including nested scrolling surfaces and portalled sheets. */
export function useAutoHideNavigation({ timeout = 5000, pinned = false }: { timeout?: number; pinned?: boolean } = {}) {
  const [visible, setVisible] = useState(true);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let overlayOpen = false;
    const editable = () => document.activeElement?.matches('input:not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]');
    const keyboardOpen = () => Boolean(window.visualViewport && window.innerHeight - window.visualViewport.height > 150);
    const wake = () => {
      clearTimeout(timer);
      setVisible(true);
      if (!pinned && !interacting && !overlayOpen && !editable() && !keyboardOpen()) {
        timer = setTimeout(() => setVisible(false), timeout);
      }
    };
    const inspectOverlays = () => {
      frame = 0;
      const open = Array.from(document.querySelectorAll('[aria-modal="true"], [role="dialog"], dialog[open], [data-navigation-lock], .fixed.inset-0'))
        .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
      if (open !== overlayOpen) { overlayOpen = open; wake(); }
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(inspectOverlays);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'aria-hidden'] });
    const events = ['touchstart', 'touchmove', 'scroll', 'pointerdown', 'keydown', 'focusin', 'focusout'] as const;
    const options = { passive: true, capture: true };
    events.forEach(event => window.addEventListener(event, wake, options));
    window.visualViewport?.addEventListener('resize', wake, { passive: true });
    inspectOverlays();
    wake();
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      events.forEach(event => window.removeEventListener(event, wake, options));
      window.visualViewport?.removeEventListener('resize', wake);
    };
  }, [timeout, pinned, interacting]);
  return { visible, setInteracting };
}
