// Diagnostic upper bounds from finite turning search; separate objective for each denominator.
const P = require('../src/packing');
function toleranceMetrics(design, request) {
  const d = structuredClone(design); delete d.placement; delete d.offset;
  const pts = P.finalSection(d), usable = P.usable(request.targetBox), L = request.length;
  const ratio = (excess, denominator) => denominator > 0 ? excess / denominator : excess > 0 ? Infinity : 0;
  function search(denominators) {
    function objective(angle) {
      const [x,z] = P.turnedExtents(pts, angle);
      return Math.max(ratio(x-usable[0],denominators[0]),ratio(d.width-usable[1],denominators[1]),ratio(z-usable[2],denominators[2]));
    }
    let angle=0, value=Infinity;
    for (let t=0;t<180;t+=.05) { const v=objective(t);if(v<value){value=v;angle=t;} }
    for(let step=.025;step>1e-6;step/=2)for(const t of [angle-step,angle+step]){const v=objective(t);if(v<value){value=v;angle=t;}}
    return {overflow:Math.max(0,value),angle:((angle%180)+180)%180};
  }
  return {sheet:search([L,L,L]),box:search(usable)};
}
module.exports={toleranceMetrics};
