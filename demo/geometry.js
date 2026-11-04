/* Centimetres; positive angle lifts the moving panel toward +z. */
function foldSheet({ length = 20, width = 10, crease = 10, angle = 0 } = {}) {
  if (![length, width, crease, angle].every(Number.isFinite)) throw new Error('All inputs must be finite numbers.');
  if (length <= 0 || width <= 0 || crease <= 0 || crease >= length) throw new Error('Use positive dimensions and place the crease inside the sheet.');
  if (angle < 0 || angle > 180) throw new Error('Angle must be between 0 and 180 degrees.');
  const radians = angle * Math.PI / 180;
  const movingLength = length - crease;
  const x = crease + movingLength * Math.cos(radians);
  const z = angle === 0 || angle === 180 ? 0 : movingLength * Math.sin(radians);
  const vertices = [[0,0,0], [crease,0,0], [x,0,z], [0,width,0], [crease,width,0], [x,width,z]];
  const min = [0,1,2].map(axis => Math.min(...vertices.map(v => v[axis])));
  const max = [0,1,2].map(axis => Math.max(...vertices.map(v => v[axis])));
  return { vertices, faces: [[0,1,4,3], [1,2,5,4]], min, max,
    dimensions: max.map((value, axis) => value - min[axis]),
    area: length * width, movingLength };
}
if (typeof module !== 'undefined') module.exports = { foldSheet };
