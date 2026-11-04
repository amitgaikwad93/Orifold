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

## Pending physical comparison

Use a 20 × 10 cm rectangle, mark parallel creases at 5, 10, and 15 cm, and alternate mountain/valley folds. Compare the flat sheet (20 × 10), a held 90° configuration (approximately 10 × 10 × 10), and the fully folded footprint (approximately 5 × 10). Real thickness makes the stack height nonzero. Photograph or record the measurements and material before marking this check complete.

This comparison is pending; no physical fold or material measurement has been performed by the agent. Before using this evaluator to label a training dataset, review the conservative contact rules and the implications of finite motion sampling.
