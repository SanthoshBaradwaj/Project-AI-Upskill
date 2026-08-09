"use client";

/**
 * Screen 1 hero graphic (UI spec §7). Three routes converge on a single gold
 * origin node — the visual thesis: one starting point, three futures.
 *
 * Every path deliberately bleeds past the viewBox so the network reads as a
 * fragment of something larger. This is the only animation in the product.
 */

const ROUTES = [
  {
    d: "M-20,250 L90,250 L170,170 L440,170",
    c: "#FF3D71",
    n: [
      [90, 250],
      [170, 170],
      [330, 170],
    ],
  },
  { d: "M-20,250 L120,250 L210,340", c: "#00C2A8", n: [[120, 250]] },
  {
    d: "M-20,250 L60,250 L150,160 L150,60 L440,60",
    c: "#6034FF",
    n: [
      [150, 160],
      [150, 60],
      [300, 60],
    ],
  },
] as const;

export function HeroRoutes() {
  return (
    <svg
      viewBox="0 0 420 340"
      // Spec says xMidYMid, but on a portrait panel that crops both edges and
      // the gold origin node at x=34 is the first thing lost — which is the
      // whole thesis of the graphic. Anchoring left keeps the origin on screen
      // and still lets the routes bleed off the right.
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {ROUTES.map((r, i) => (
        <path
          key={r.c}
          d={r.d}
          fill="none"
          stroke={r.c}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 900,
            strokeDashoffset: 900,
            animation: `drawLine 2.4s cubic-bezier(.4,0,.2,1) ${i * 0.22}s forwards`,
          }}
        />
      ))}

      {ROUTES.map((r, i) =>
        r.n.map(([x, y], k) => (
          <circle
            key={`${r.c}-${x}-${y}`}
            cx={x}
            cy={y}
            r={8}
            fill="#100C1C"
            stroke={r.c}
            strokeWidth={4}
            style={{
              opacity: 0,
              transformOrigin: `${x}px ${y}px`,
              animation: `popNode .4s ease-out ${1.1 + i * 0.22 + k * 0.16}s forwards`,
            }}
          />
        )),
      )}

      <g
        style={{
          opacity: 0,
          transformOrigin: "34px 250px",
          animation: "popNode .4s ease-out .35s forwards",
        }}
      >
        <circle cx={34} cy={250} r={13} fill="#FFB020" />
        <circle cx={34} cy={250} r={5} fill="#100C1C" />
      </g>
    </svg>
  );
}
