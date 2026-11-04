# Phase 1 validation record

Validated 2026-11-04 in the development environment. These checks validate the implementation under the assumptions in [GEOMETRY.md](GEOMETRY.md); they do not establish physical feasibility for every design.

## Automated geometry checks

`npm test` passes both suites: 11 accordion cases and 5 original one-hinge cases (16 cases total). Node's test output in some executor environments summarizes by test file; running `node tests/accordion.test.js` and `node tests/geometry.test.js` prints the individual cases.

Coverage includes analytical 0°/90°/180° configurations, agreement with the independent one-hinge implementation, panel distance preservation across 181 motion states, fixed panel and shared hinges, unequal panel lengths, crossing rejection despite final fit, conservative touch/overlap rules, ideal flat-stack contact, uncompressible width, swept versus endpoint bounds, scaling, and invalid inputs. The GitHub Actions workflow runs `npm test` on pushes and pull requests.

## Browser smoke checks

Checked in local Chromium with Playwright, using a temporary localhost server:

- Default design shows a current 10 × 10 × 10 box at 50% motion and final 5 × 10 × 0 box.
- Flat-stack and 90° presets match the analytical reference dimensions.
- Crossing example reports final fit but blocked motion, identifies panels 1 and 4, and outlines the involved panels in red.
- Reducing target width from 10 to 9 rejects fit while preserving the motion result.
- Play advances the progress control and Pause stops it.
- Clearing a dimension displays an error, clears stale results, and disables playback; valid input restores the view.
- The 390 px mobile layout has no horizontal overflow.
- The original one-hinge 90° reference still displays 10 × 10 × 10.
- No browser script errors were observed. Desktop and crossing screenshots were visually reviewed.

To repeat manually, serve the repository with `python3 -m http.server 8000`, open `/demo/accordion.html`, and follow the checks above. Screenshots are development artifacts and are not part of the source tree.

## Physical footprint comparison — user reported

The user supplied a photograph of an alternating accordion fold and reported: "yes it's closed width and length is 5 x 10 cm". This follows the requested exercise using a 20 × 10 cm sheet with creases at 5, 10, and 15 cm. The closed footprint agrees with the reference model's 5 × 10 cm prediction.

Evidence: user-provided image `image-1793800030183.jpg` in the project conversation, plus the user's measurement report. The photo shows the partially open accordion, not a measured closed stack; dimensions are attributed to the user, not inferred from the image. The photo has not been copied into the repository.

The basic closed-footprint comparison is complete. Material type/thickness, measurement uncertainty, stack height, the 90° intermediate bounding box, and motion smoothness were not reported. No independent physical measurement was performed by the agent. This observation supports this example's footprint; it does not validate arbitrary designs, layer order, or the simulator's prescribed hinge trajectory.

The contact-policy review for the restricted numerical pilot is recorded in [OPTIMIZATION.md](OPTIMIZATION.md). Its sampling and physical limitations remain in effect.

## Phase 2 numerical solver and recorded results

The combined suite now has 28 cases: 16 geometry cases, 10 optimizer cases, and 2 saved-pilot audit cases. Checks include parameter bounds and length preservation, deterministic seeds, equal search budgets, analytical width rejection, explicit budget exhaustion, strict versus 1% fit, a narrow-box solution, and revalidation of all 80 stored strict-fit optimizer designs and their withheld witnesses.

Both 100-request comparisons completed. See [PILOT_RESULTS.md](PILOT_RESULTS.md) for measured outcomes and reproduction commands. No network training has run.
