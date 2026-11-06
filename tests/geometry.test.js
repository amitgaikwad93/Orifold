const { test } = require('node:test');
const assert = require('node:assert/strict');
const { foldSheet } = require('../demo/geometry.js');
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
test('reference boxes at 0, 90 and 180 degrees', () => {
  for (const [angle, expected] of [[0,[20,10,0]],[90,[10,10,10]],[180,[10,10,0]]]) {
    foldSheet({angle}).dimensions.forEach((v,i)=>close(v,expected[i]));
  }
});
test('all pairwise panel distances remain constant throughout the motion', () => {
  for (const crease of [3,10,17]) {
    const flat = foldSheet({crease});
    for (let angle=0;angle<=180;angle++) {
      const folded = foldSheet({crease,angle});
      for (const face of flat.faces) for (const a of face) for (const b of face) {
        close(distance(flat.vertices[a],flat.vertices[b]),distance(folded.vertices[a],folded.vertices[b]));
      }
      assert.deepEqual(folded.vertices[1], flat.vertices[1]);
      assert.deepEqual(folded.vertices[4], flat.vertices[4]);
      close(folded.area,200);
    }
  }
});
test('unequal panels can extend behind the fixed edge', () => {
  const geometry = foldSheet({crease:3,angle:180});
  close(geometry.min[0],-14);
  close(geometry.dimensions[0],17);
});
test('box encloses every vertex across different sheets and angles', () => {
  for (const length of [1,20,100]) for (const width of [1,10,100]) for (const angle of [0,37,90,146,180]) {
    const g=foldSheet({length,width,crease:length*0.3,angle});
    for (const v of g.vertices) v.forEach((n,i)=>assert.ok(n>=g.min[i] && n<=g.max[i]));
  }
});
test('rejects invalid geometry and angles', () => {
  for (const input of [{length:0},{width:-1},{crease:0},{crease:20},{angle:-1},{angle:181},{length:NaN},{width:Infinity}]) {
    assert.throws(()=>foldSheet(input));
  }
});
