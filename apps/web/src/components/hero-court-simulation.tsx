"use client";

import { useEffect, useState } from "react";

type BallPosition = { x: number; y: number; duration: number };

export function HeroCourtSimulation() {
  const [ball, setBall] = useState<BallPosition>({ x: 24, y: 32, duration: 1450 });

  useEffect(() => {
    let active = true;
    let movingToFarSide = false;
    let timer = 0;

    function continueRally() {
      if (!active) return;
      movingToFarSide = !movingToFarSide;
      const duration = 1300 + Math.round(Math.random() * 700);
      setBall({
        x: 14 + Math.random() * 72,
        y: movingToFarSide ? 61 + Math.random() * 24 : 15 + Math.random() * 24,
        duration,
      });
      timer = window.setTimeout(continueRally, duration);
    }

    timer = window.setTimeout(continueRally, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="hero-court-stage" role="img" aria-label="Animated overhead view of a padel rally">
      <div className="sim-court">
        <span className="sim-court__center" />
        <span className="sim-court__service sim-court__service--left" />
        <span className="sim-court__service sim-court__service--right" />
        <span className="sim-court__net" />
        <span
          className="sim-court__ball"
          style={{ left: `${ball.x}%`, top: `${ball.y}%`, transitionDuration: `${ball.duration}ms` }}
        />
      </div>
      <span className="court-shadow" aria-hidden="true" />
    </div>
  );
}
