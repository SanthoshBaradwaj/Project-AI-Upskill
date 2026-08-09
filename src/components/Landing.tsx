"use client";

import { HeroRoutes } from "./HeroRoutes";
import { Icon } from "./Sprite";

/** Screen 1. No gold appears anywhere on this screen — nothing is earned yet. */
export function Landing({
  onStart,
  onDemo,
  demoBusy,
}: {
  onStart: () => void;
  onDemo: () => void;
  demoBusy: boolean;
}) {
  return (
    <div className="hero">
      <div className="hero-l">
        <div className="eyebrow">
          <Icon name="route" />
          AI career transition
        </div>

        <h1>
          Find the line
          <br />
          you&apos;re <em>already</em> on.
        </h1>

        <p style={{ marginTop: 20, fontSize: 16.5, maxWidth: 460 }}>
          Most advice guesses where you are. We test it — then map the shortest real
          route to a job you can actually hold.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
          <button className="btn go" onClick={onStart}>
            Find my route
            <Icon name="arrow" />
          </button>
          <button className="btn ghost" onClick={onDemo} disabled={demoBusy}>
            {demoBusy ? "Loading…" : "See a demo"}
          </button>
        </div>

        <div className="trust">
          <span>No account</span>
          <span>Nothing stored</span>
          <span>5 minutes</span>
        </div>
      </div>

      <div className="hero-r">
        <HeroRoutes />
      </div>

      <style jsx>{`
        .hero {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          border: 2px solid var(--void);
          margin-top: 34px;
        }
        .hero-l {
          background: var(--white);
          padding: 44px 34px;
        }
        .hero-r {
          background: var(--void);
          min-height: 300px;
          overflow: hidden;
          position: relative;
        }
        .trust {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 32px;
        }
        .trust span {
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--mute);
        }
        em {
          font-style: normal;
          color: var(--volt);
        }
        @media (max-width: 760px) {
          .hero {
            grid-template-columns: 1fr;
          }
          .hero-l {
            padding: 32px 22px;
          }
          .hero-r {
            min-height: 220px;
          }
        }
      `}</style>
    </div>
  );
}
