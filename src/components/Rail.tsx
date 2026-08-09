"use client";

import { Icon } from "./Sprite";

/**
 * The progress rail is a transit line, not a percentage bar. It establishes the
 * station vocabulary on the first frame, so the Screen 6 map needs no legend.
 */
export function Rail({ current }: { current: number }) {
  const stops = [1, 2, 3, 4, 5, 6];
  const fill = `calc(${((Math.max(1, current) - 1) / 5) * 100}% - 10px)`;

  return (
    <div className="rail">
      <div className="rail-in">
        <div className="lockup">
          <Icon name="mark" />
          <span>Pivot</span>
        </div>

        <div className="track" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={current} aria-label={`Step ${current} of 6`}>
          <div className="fill" style={{ width: fill }} />
          <div className="stops">
            {stops.map((n) => (
              <span
                key={n}
                className={`stop ${n < current ? "done" : n === current ? "now" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
