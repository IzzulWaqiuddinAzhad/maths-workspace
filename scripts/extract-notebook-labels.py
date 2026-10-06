"""Record existing printed label anchors; never alter the original page SVGs."""
from pathlib import Path
import json, xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]/'dist/notebook-assets'
source=(root/'module-pages.js').read_text()
graphs=json.loads(source.split('export const MODULE_GRAPHS = ')[1].rstrip(';\n'))
anchors={}
object_anchors={}
for g in graphs:
 texts=[e for e in ET.parse(root/f"page-{g['page']+1:02}.svg").getroot().iter() if e.tag.endswith('text')]
 for o in g['objects']:
  labels=[]
  for p,name in zip(o['points'],o.get('labels',[])):
   px=g['x']+(p[0]-g['bounds']['xmin'])*g['unit'];py=g['y']+(g['bounds']['ymax']-p[1])*g['unit']
   matches=[e for e in texts if name in ''.join(e.itertext()).split('/') and abs(float(e.get('x'))-px)<25 and abs(float(e.get('y'))-py)<25]
   if not matches:labels.append(None);continue
   e=min(matches,key=lambda e:(float(e.get('x'))-px)**2+(float(e.get('y'))-py)**2)
   labels.append({'x':float(e.get('x'))-g['x'],'y':float(e.get('y'))-g['y'],'size':float(e.get('font-size')),'text':''.join(e.itertext())})
  if labels:anchors[o['id']]=labels
  elif len(o['points'])>1:
   centre=[sum(p[i] for p in o['points'])/len(o['points']) for i in [0,1]]
   px=g['x']+(centre[0]-g['bounds']['xmin'])*g['unit'];py=g['y']+(g['bounds']['ymax']-centre[1])*g['unit']
   matches=[e for e in texts if ''.join(e.itertext())==o['name'] and g['x']<=float(e.get('x'))<=g['x']+g['width'] and g['y']<=float(e.get('y'))<=g['y']+g['height']]
   if matches:
    e=min(matches,key=lambda e:(float(e.get('x'))-px)**2+(float(e.get('y'))-py)**2)
    object_anchors[o['id']]={'x':float(e.get('x'))-g['x'],'y':float(e.get('y'))-g['y'],'size':float(e.get('font-size')),'text':''.join(e.itertext()),'point':centre}

(root/'label-anchors.js').write_text('// Positions of the labels already printed in the original SVG pages.\nexport const PRINTED_LABELS = '+json.dumps(anchors,separators=(',',':'),ensure_ascii=False)+';\nexport const PRINTED_OBJECT_LABELS = '+json.dumps(object_anchors,separators=(',',':'),ensure_ascii=False)+';\n')
print('Recorded',sum(len(v) for v in anchors.values()),'printed labels')
