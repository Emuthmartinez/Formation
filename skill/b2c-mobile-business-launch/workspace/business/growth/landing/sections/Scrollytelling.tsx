"use client";

/**
 * How it works — sticky-pinned scrollytelling: the visual stays pinned while
 * scroll progress activates each step and cross-fades the matching screen.
 * All steps are real text in document order; pinning is layout decoration,
 * and reduced motion swaps cross-fades for instant switches.
 */
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";

export interface ScrollyStep {
  title: string;
  body: string;
  /** The pinned visual for this step (screenshot, illustration, mockup). */
  visual: ReactNode;
}

export interface ScrollytellingProps {
  heading: string;
  steps: ScrollyStep[];
}

function PinnedVisual({
  progress,
  index,
  count,
  reduced,
  children,
}: {
  progress: MotionValue<number>;
  index: number;
  count: number;
  reduced: boolean;
  children: ReactNode;
}) {
  const opacity = useTransform(progress, (value) => {
    const active = Math.min(count - 1, Math.floor(value * count));
    return active === index ? 1 : 0;
  });
  return (
    <motion.div className="lm-scrolly-visual" style={{ opacity: reduced && index === 0 ? 1 : opacity }} aria-hidden={index !== 0}>
      {children}
    </motion.div>
  );
}

export function Scrollytelling({ heading, steps }: ScrollytellingProps) {
  const reduced = useReducedMotion() ?? false;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start center", "end center"] });

  return (
    <section className="lm-scrolly">
      <h2 className="lm-section-heading">{heading}</h2>
      <div ref={trackRef} className="lm-scrolly-track">
        <div className="lm-scrolly-pin">
          {steps.map((step, index) => (
            <PinnedVisual key={step.title} progress={scrollYProgress} index={index} count={steps.length} reduced={reduced}>
              {step.visual}
            </PinnedVisual>
          ))}
        </div>
        <ol className="lm-scrolly-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
