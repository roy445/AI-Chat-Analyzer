"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

export function useGsapMotion(scope: React.RefObject<HTMLElement | null>, pageKey: string) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          desktop: "(min-width: 900px)",
        },
        ({ conditions }) => {
          const reduceMotion = Boolean(conditions?.reduceMotion);
          const desktop = Boolean(conditions?.desktop);
          const duration = reduceMotion ? 0 : 0.72;

          const revealSelector = ".hero > div, .flow-title, .guide-card, .upload-panel, .identify-card, .report-layout, .section-heading, .faq-grid, .faq-note";
          const staggerSelector = ".feature-grid, .steps, .platform-grid, .guide-list, .guide-two-col";
          gsap.set(revealSelector, { autoAlpha: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 18 });
          gsap.set(`${staggerSelector} > *`, { autoAlpha: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 14 });

          if (!reduceMotion) {
            const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
            intro.to(revealSelector, { autoAlpha: 1, y: 0, duration, stagger: 0.08 });
            intro.to(`${staggerSelector} > *`, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.055 }, "-=0.42");
          }

          if (desktop && !reduceMotion) {
            gsap.to(".hero-orb", { y: -12, x: 8, duration: 3.8, ease: "sine.inOut", repeat: -1, yoyo: true });
            gsap.to(".chat-card", { y: -7, rotation: 0.35, duration: 3.2, ease: "sine.inOut", repeat: -1, yoyo: true });
          }

          if (!reduceMotion) {
            root.querySelectorAll<HTMLElement>(".feature-card, .platform-card, .surface-card, .stat-card").forEach((card) => {
              const onEnter = () => gsap.to(card, { y: -5, scale: 1.012, duration: 0.24, ease: "power2.out", overwrite: "auto" });
              const onLeave = () => gsap.to(card, { y: 0, scale: 1, duration: 0.3, ease: "power2.out", overwrite: "auto" });
              card.addEventListener("mouseenter", onEnter);
              card.addEventListener("mouseleave", onLeave);
              (card as HTMLElement & { __motionCleanup?: () => void }).__motionCleanup = () => {
                card.removeEventListener("mouseenter", onEnter);
                card.removeEventListener("mouseleave", onLeave);
              };
            });
          }

          return () => {
            root.querySelectorAll<HTMLElement>(".feature-card, .platform-card, .surface-card, .stat-card").forEach((card) => (card as HTMLElement & { __motionCleanup?: () => void }).__motionCleanup?.());
          };
        },
      );
    }, root);

    return () => ctx.revert();
  }, [pageKey, scope]);
}
