"use client";

import { useEffect } from "react";

/**
 * The site motion layer — a 1:1 port of the handoff's site-motion.js
 * (design_handoff_motion_haptics/designs/site-motion.js). Scroll-reveal for
 * [data-reveal] (optional [data-reveal-delay] ms stagger; markers keep it
 * ≤180ms by convention — not enforced here) and SVG
 * line draw for [data-draw]. Elements already visible on first paint are left
 * completely static so the page never flashes; under prefers-reduced-motion
 * the whole layer no-ops. Hero load animations are NOT here — they're CSS
 * keyframes (globals.css) applied inline on the hero elements.
 */
const EASE = "cubic-bezier(0.22,1,0.36,1)";

export default function SiteMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Elements prepped (hidden) but not yet revealed. If the effect is torn
    // down before they reveal (dev StrictMode double-mount, unmount), the
    // cleanup un-preps them so a re-run can prep + observe them again instead
    // of leaving them invisible.
    const pending = new Set<HTMLElement | SVGElement>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement | SVGElement;
          io.unobserve(el);
          pending.delete(el);
          const delay = parseFloat(el.dataset.revealDelay ?? "0") || 0;
          window.setTimeout(() => {
            if (el.dataset.motionDraw === "true") {
              el.style.strokeDashoffset = "0";
            } else {
              el.style.opacity = "1";
              el.style.transform = "none";
              // Once the reveal transition ends, drop the inline styles so
              // class-driven hover transitions (e.g. the Home pricing-teaser
              // lift) regain control — inline transform/transition would
              // otherwise override them forever. Natural state is visible, so
              // removal is a visual no-op. The timeout is a fallback for
              // transitionend never firing (element scrolled away or hidden
              // mid-transition).
              let cleared = false;
              const clear = () => {
                if (cleared) return;
                cleared = true;
                el.removeEventListener("transitionend", onEnd);
                el.style.removeProperty("opacity");
                el.style.removeProperty("transform");
                el.style.removeProperty("transition");
              };
              const onEnd = (e: Event) => {
                if (
                  e.target === el &&
                  (e as TransitionEvent).propertyName === "opacity"
                ) {
                  clear();
                }
              };
              el.addEventListener("transitionend", onEnd);
              window.setTimeout(clear, 800);
            }
          }, delay);
        }
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.06 }
    );

    // First-view guard: anything at or above the viewport's bottom edge at
    // prep time stays static (never hidden) — reveal is below-fold only.
    // DELIBERATE deviation from the reference script, which also required
    // `scrollY < 40`: on a scroll-restored load (App Router back-navigation,
    // hard reload mid-page) that clause hid the restored viewport's visible
    // content (flash + re-animate) and left everything ABOVE it at opacity 0
    // until re-intersected. rect.top alone is exactly right: elements above
    // or inside the restored viewport are static; elements below it still
    // animate on scroll, so top-of-page loads behave as before. (The
    // reference is MPA-only and has the same bug there.)
    const inFirstView = (el: Element) =>
      el.getBoundingClientRect().top < window.innerHeight * 0.95;

    const prepReveal = (el: HTMLElement) => {
      if (el.dataset.motionPrepped) return;
      el.dataset.motionPrepped = "true";
      if (inFirstView(el)) return;
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = `opacity 0.75s ${EASE}, transform 0.75s ${EASE}`;
      pending.add(el);
      io.observe(el);
    };

    const prepDraw = (el: SVGElement) => {
      if (el.dataset.motionPrepped) return;
      el.dataset.motionPrepped = "true";
      el.dataset.motionDraw = "true";
      if (inFirstView(el)) return;
      el.setAttribute("pathLength", "100");
      el.style.strokeDasharray = "100";
      el.style.strokeDashoffset = "100";
      el.style.transition = `stroke-dashoffset 1.2s ${EASE}`;
      pending.add(el);
      io.observe(el);
    };

    const scan = (root: Element | Document) => {
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(prepReveal);
      root.querySelectorAll<SVGElement>("[data-draw]").forEach(prepDraw);
      // The reference also checks the root node's own attributes (matters for
      // nodes added directly with the marker on themselves).
      if (root instanceof Element) {
        if (root.hasAttribute("data-reveal")) prepReveal(root as HTMLElement);
        if (root.hasAttribute("data-draw")) prepDraw(root as SVGElement);
      }
    };

    scan(document);

    // Re-scan DOM added after mount (accordions, client-rendered sections) —
    // mirrors the reference's MutationObserver.
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      for (const el of pending) {
        delete el.dataset.motionPrepped;
        delete el.dataset.motionDraw;
        el.style.opacity = "";
        el.style.transform = "";
        el.style.transition = "";
        el.style.strokeDasharray = "";
        el.style.strokeDashoffset = "";
      }
    };
  }, []);

  return null;
}
