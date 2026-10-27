# Seven Wonders TSP — Cinematic Edition

This version is designed as a presentation/demo experience rather than a basic calculator.

## Main experience

WORLD MAP → landmark nodes → glowing route arcs → animated airplane → live leg distance → destination highlighting → return to source → OPTIMAL TSP TOUR finale.

## Run

```bash
npm install
npm run dev
```

Open the Vite localhost URL.

## Algorithm

For seven nodes, this project computes the exact optimum by brute force:
6! = 720 permutations for a fixed source, or 5040 directed permutations if discussing all starts/routes.

Distance uses the Haversine great-circle formula in kilometres.

## Notes

The map uses OpenStreetMap tiles and therefore needs internet access. The monument visuals are intentionally lightweight cinematic markers so the presentation runs smoothly without downloading large 3D assets.
