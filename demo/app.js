const $ = id => document.getElementById(id);
const ns = 'http://www.w3.org/2000/svg';
function element(tag, attrs, text) {
  const el = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([key,value]) => el.setAttribute(key,value));
  if (text) el.textContent = text;
  return el;
}
function draw(svg, geometry, project, profile = false) {
  svg.replaceChildren();
  const points = geometry.vertices.map(project);
  if (!profile) {
    geometry.faces.forEach((face,i) => svg.append(element('polygon', {
      points: face.map(v => points[v].join(',')).join(' '),
      fill: i ? '#e8b360' : '#419b84', 'fill-opacity': '.8', stroke: i ? '#a36b24' : '#256c5a', 'stroke-width': 2
    })));
  } else {
    [[0,1,'#256c5a'],[1,2,'#b57b2c']].forEach(([a,b,color]) => svg.append(element('line', {
      x1:points[a][0], y1:points[a][1], x2:points[b][0], y2:points[b][1],stroke:color,'stroke-width':5,'stroke-linecap':'round'
    })));
    [0,1,2].forEach(i => svg.append(element('circle',{cx:points[i][0],cy:points[i][1],r:4,fill:'#183c3b'})));
  }
  if (!profile) svg.append(element('line',{x1:points[1][0],y1:points[1][1],x2:points[4][0],y2:points[4][1],stroke:'#183c3b','stroke-width':3,'stroke-dasharray':'6 5'}));
  svg.append(element('text',{x:24,y:profile?185:395,fill:'#61786b','font-size':12},profile?'Fixed edge → hinge → moving edge':'Oblique projection · fixed camera'));
}
function render() {
  try {
    const length = Number($('length').value), width = Number($('width').value);
    if (!$('length').validity.valid || !$('width').validity.valid) throw Error('Enter sheet dimensions between 1 and 100 cm.');
    const crease = length * Number($('crease').value) / 100, angle = Number($('angle').value);
    const geometry = foldSheet({length,width,crease,angle});
    $('error').textContent = '';
    $('crease-value').textContent = `${crease.toFixed(1)} cm`;
    $('angle-value').textContent = `${angle}°`;
    $('bounds').textContent = geometry.dimensions.map(n => n.toFixed(2)).join(' × ') + ' cm';
    $('area').textContent = `${geometry.area.toFixed(1)} cm²`;
    // Fit the whole motion's conservative envelope, so scale stays fixed during a fold.
    const reach = length - crease, lowX = Math.min(0,crease-reach);
    const scale = Math.min(630/(length-lowX+0.65*width),290/(reach+0.35*width));
    const xMid = (lowX+length)/2;
    const project = ([x,y,z]) => [380+scale*(x-xMid-0.65*(y-width/2)),220+scale*(0.35*(y-width/2)-z+reach/2)];
    draw($('view'),geometry,project);
    const sideScale = Math.min(650/(length-lowX),130/reach);
    draw($('profile'),geometry,([x,y,z]) => [380+sideScale*(x-xMid),155-sideScale*z],true);
  } catch(error) { $('error').textContent = error.message; }
}
let playing = false, lastTime = null, progress = 0;
function stop() { playing = false; $('play').textContent = 'Play fold'; $('play').setAttribute('aria-pressed','false'); }
function frame(time) {
  if (!playing) return;
  if (lastTime !== null) progress = (progress + (time-lastTime)*0.045) % 360;
  lastTime = time;
  $('angle').value = Math.round(progress <= 180 ? progress : 360-progress);
  render(); requestAnimationFrame(frame);
}
['length','width','crease','angle'].forEach(id => $(id).addEventListener('input',() => { stop(); render(); }));
document.querySelectorAll('[data-angle]').forEach(button => button.addEventListener('click',() => {stop();$('angle').value=button.dataset.angle;render();}));
$('play').addEventListener('click',() => {
  if (playing) {stop();return;}
  playing=true;lastTime=null;progress=Number($('angle').value);
  $('play').textContent='Pause fold';$('play').setAttribute('aria-pressed','true');requestAnimationFrame(frame);
});
render();
