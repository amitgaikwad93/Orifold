#!/usr/bin/env node
'use strict';

// Standalone FOLD 1.1 export. Kinematics follow docs/GEOMETRY.md; no solver
// or project geometry code is imported. FOLD signs: + valley, - mountain.
// Format reference: https://github.com/edemaine/fold/blob/main/doc/spec.md
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const HELP = `Usage:
  node scripts/export-fold.js '<design JSON>' [--output model.fold]
  node scripts/export-fold.js --input map.json.gz --cell INDEX [--budget N | --answer INDEX] [-o model.fold]
  node scripts/export-fold.js --input dataset.jsonl.gz --request-id ID [--budget N | --answer INDEX] [-o model.fold]

Cell and answer indices are zero-based; the first answer is the default.
--design '<JSON>' is also accepted. Without --output, FOLD JSON goes to stdout.
Output files must not already exist. Placement rotates only the folded frame.
This exports zero-thickness geometry, without collision or layer-order certification.
`;

function validateDesign(design) {
  if (!design || !Array.isArray(design.panelLengths) || design.panelLengths.length === 0 ||
      !design.panelLengths.every(x => Number.isFinite(x) && x > 0) ||
      !Number.isFinite(design.panelLengths.reduce((a, b) => a + b, 0))) {
    throw new Error('panelLengths must be a nonempty array of positive finite lengths with a finite total');
  }
  if (!Number.isFinite(design.width) || design.width <= 0) throw new Error('width must be positive and finite');
  if (!Array.isArray(design.angles) || design.angles.length !== design.panelLengths.length - 1 ||
      !design.angles.every(a => Number.isFinite(a) && a >= 0 && a <= 180)) {
    throw new Error('angles must contain one magnitude in [0, 180] per crease');
  }
  if (design.placement !== undefined && !Number.isFinite(design.placement)) {
    throw new Error('placement must be a finite angle in degrees');
  }
}

function toFold(design) {
  validateDesign(design);
  const { panelLengths: lengths, width, angles } = design;
  const placement = design.placement === undefined ? 0 : design.placement;
  const psi = placement * Math.PI / 180, c = Math.cos(psi), s = Math.sin(psi);
  const vertices = [], folded = [], edges = [], assignments = [], foldAngles = [], faces = [];
  let flatX = 0, x = 0, z = 0, heading = 0;
  for (let i = 0; i <= lengths.length; i++) {
    vertices.push([flatX, 0], [flatX, width]);
    const placedX = x * c - z * s, placedZ = x * s + z * c;
    folded.push([placedX, 0, placedZ], [placedX, width, placedZ]);
    if (i < lengths.length) {
      if (i > 0) heading += (i % 2 === 1 ? 1 : -1) * angles[i - 1] * Math.PI / 180;
      x += lengths[i] * Math.cos(heading);
      z += lengths[i] * Math.sin(heading);
      flatX += lengths[i];
    }
  }
  function edge(a, b, assignment, angle = 0) {
    edges.push([a, b]);
    assignments.push(assignment);
    foldAngles.push(angle === 0 ? 0 : angle);
  }
  for (let i = 0; i < lengths.length; i++) {
    edge(2 * i, 2 * i + 2, 'B');
    edge(2 * i + 3, 2 * i + 1, 'B');
    // Counterclockwise in the flat xy plane: normals initially point +z.
    faces.push([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1]);
  }
  for (let i = 0; i <= lengths.length; i++) {
    if (i === 0 || i === lengths.length) edge(2 * i, 2 * i + 1, 'B');
    else edge(2 * i, 2 * i + 1, i % 2 === 1 ? 'V' : 'M', (i % 2 === 1 ? 1 : -1) * angles[i - 1]);
  }
  return {
    file_spec: 1.1,
    file_creator: 'Orifold',
    file_classes: ['singleModel'],
    file_description: 'Zero-thickness parallel-hinge geometry. No collision, layer-order, or manufacturing certification.',
    frame_title: 'Flat crease pattern',
    frame_classes: ['creasePattern'],
    frame_unit: 'unit',
    vertices_coords: vertices,
    edges_vertices: edges,
    edges_assignment: assignments,
    edges_foldAngle: foldAngles,
    faces_vertices: faces,
    'orifold:placement': placement,
    file_frames: [{
      frame_parent: 0,
      frame_inherit: true,
      frame_title: 'Final folded form',
      frame_classes: ['foldedForm'],
      vertices_coords: folded
    }]
  };
}

function readInput(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  const bytes = fs.readFileSync(input);
  const text = (bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes) : bytes).toString('utf8').trim();
  if (!text) throw new Error('input is empty');
  try { return JSON.parse(text); } catch {
    return text.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
      try { return JSON.parse(line); } catch { throw new Error(`invalid JSON/JSONL at line ${i + 1}`); }
    });
  }
}

function selectDesign(document, options = {}) {
  const { cell, requestId, budget, answer } = options;
  if (cell !== undefined && requestId !== undefined) throw new Error('choose either --cell or --request-id');
  if (budget !== undefined && answer !== undefined) throw new Error('choose either --budget or --answer');
  if (cell !== undefined && (!Number.isInteger(cell) || cell < 0)) throw new Error('cell index must be a nonnegative integer');
  if (answer !== undefined && (!Number.isInteger(answer) || answer < 0)) throw new Error('answer index must be a nonnegative integer');
  if (budget !== undefined && (!Number.isInteger(budget) || budget < 0 || budget > 11)) throw new Error('budget must be an integer from 0 to 11');
  const records = Array.isArray(document) ? document : document?.cells ?? document?.rows ?? document?.records ?? document?.requests;
  let record = document;
  if (cell !== undefined) {
    if (!Array.isArray(document?.cells)) throw new Error('--cell requires a map with a cells array');
    record = document.cells[cell];
    if (!record) throw new Error(`cell index ${cell} not found`);
  } else if (requestId !== undefined) {
    const candidates = Array.isArray(records) ? records : [document];
    const matches = candidates.filter(r => String(r?.id ?? r?.requestId ?? r?.request?.id) === requestId);
    if (matches.length !== 1) throw new Error(`request id ${requestId}: expected one record, found ${matches.length}`);
    record = matches[0];
  } else if (Array.isArray(records)) {
    throw new Error('select a map cell with --cell or a dataset record with --request-id');
  }
  if (Array.isArray(record?.answers)) {
    const matches = budget === undefined ? [record.answers[answer ?? 0]] : record.answers.filter(a => a?.budget === budget);
    if (matches.length !== 1 || !matches[0]?.design) throw new Error('requested answer/budget not found or has no design');
    return matches[0].design;
  }
  if (budget !== undefined || answer !== undefined) throw new Error('answer/budget selection requires an answers array');
  if (record?.design) return record.design;
  if (Array.isArray(record?.panelLengths)) return record;
  throw new Error('selected record has no design');
}

function parseArguments(args) {
  const options = {};
  const flags = { '--input': 'input', '--design': 'input', '--cell': 'cell', '--request-id': 'requestId',
    '--budget': 'budget', '--answer': 'answer', '--output': 'output', '-o': 'output' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    const key = flags[arg];
    if (key) {
      if (options[key] !== undefined) throw new Error(`duplicate option ${arg}`);
      if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(`missing value for ${arg}`);
      const value = args[++i];
      if (['cell', 'budget', 'answer'].includes(key) && !/^\d+$/.test(value)) throw new Error(`${arg} requires a nonnegative integer`);
      options[key] = ['cell', 'budget', 'answer'].includes(key) ? Number(value) : value;
    } else if (arg.startsWith('-')) throw new Error(`unknown option ${arg}`);
    else if (options.input === undefined) options.input = arg;
    else throw new Error(`unexpected argument ${arg}`);
  }
  if (!options.help && options.input === undefined) throw new Error('input design JSON or filename required; use --help');
  return options;
}

function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) { process.stdout.write(HELP); return; }
  const output = JSON.stringify(toFold(selectDesign(readInput(options.input), options)), null, 2) + '\n';
  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(options.output, output, { flag: 'wx' });
  } else process.stdout.write(output);
}

module.exports = { toFold, readInput, selectDesign, parseArguments, main };
if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`FOLD export failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
