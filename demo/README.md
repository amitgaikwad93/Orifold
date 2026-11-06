# Experiment 001: one hinge

Open `index.html` directly in a browser. No installation, build step, network connection, or server is required. Alternatively, run `python3 -m http.server 8000` from the repository and visit `http://localhost:8000/demo/`.

Adjust sheet length, width, crease position, and fold angle. Presets show the three reference configurations; Play fold animates a complete fold and return. Green is fixed, amber moves, and the dashed line is the hinge. The side profile looks along the hinge. The camera scale stays fixed while changing the angle.

## Model

Units are centimetres. Let L be sheet length, W width, c crease position, and θ the rotation from flat. The fixed panel occupies x ∈ [0,c], y ∈ [0,W], z = 0. A moving-panel point at distance s ∈ [0,L−c] from the hinge is:

    x = c + s cos θ
    y = y
    z = s sin θ

The bounding box uses the coordinate minima and maxima of all panel vertices. Its axis alignment is fixed to the original sheet; it is not the minimum-volume box over arbitrary orientations. The reported area is material area L × W, including portions hidden by overlap.

For a 20 × 10 sheet with c = 10, the boxes are 20 × 10 × 0 at 0°, 10 × 10 × 10 at 90°, and 10 × 10 × 0 at 180°. Unequal panels may extend behind the original fixed edge.

Assumptions: rigid panels, ideal revolute hinge, zero thickness, and angles from 0° to 180°. Coincident panels are allowed at the flat-folded endpoint. This is forward geometry, not a collision validator, material mechanics simulation, or inverse optimizer. A final bounding box does not describe the swept volume during motion.

## Validation and next steps

Run `npm test` with Node 18 or newer. Tests verify reference boxes, preservation of every pairwise vertex distance within each panel throughout a 1° sweep, stationary hinge endpoints, unequal panels, enclosure of vertices, and rejection of invalid inputs.

Next: compose multiple hinges into an accordion, define target-box constraints, and implement a direct optimizer as the baseline for a small neural model. FOLD export will accompany that design stage. The long-term goal remains generating mechanical folding designs from sheet dimensions and packing requirements.
