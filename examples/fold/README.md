# Example FOLD files

Three designs from the r6 request map (`results/request-map-2026-11-05-r6.json.gz`), exported with `scripts/export-fold.js`. Each file has two frames: the flat crease pattern (mountain/valley creases with signed fold angles), and the folded 3D shape, turned by its placement angle.

| File | Map cell / budget | What it shows |
| --- | --- | --- |
| `symmetric-five-panel.fold` | 146 / 5 | A symmetric zigzag with alternating ~147° folds |
| `direction-switch.fold` | 96 / 3 | A design that uses a near-flat "direction switch" crease (DECISIONS.md D32) |
| `upright-panel.fold` | 728 / 0 | No folds: a flat sheet stood upright in its box (sanity check) |

To view one, open https://origamisimulator.org and use File → Import. The simulator folds the paper with its own physics, not Orifold's prescribed motion, so treat it as an independent visual check. Zero thickness; nothing here certifies collisions, layer order or manufacturability.

To regenerate: `node scripts/export-fold.js --input results/request-map-2026-11-05-r6.json.gz --cell 146 --budget 5 --output <file>.fold`
