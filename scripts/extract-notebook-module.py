"""Extract printed SVG pages and exact graph geometry from the editable module.

Usage: python extract-notebook-module.py SOURCE_HTML SOURCE_BUILDER OUTPUT_DIR
Requires the same ReportLab/fonts as the source; never modifies the source PDF.
"""
import importlib.util, json, re, sys
from pathlib import Path
from collections import defaultdict

html_path,builder_path,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('module_source',builder_path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
graphs=[]
original_init=m.Graph.__init__;original_point=m.Graph.point;original_shape=m.Graph.shape

def init(self,d,*args,**kwargs):
 original_init(self,d,*args,**kwargs)
 self.record={'page':d.page-1,'section':d.current_label,'x':self.gx,'y':self.gy,'width':self.gw,'height':self.gh,'unit':self.s,'bounds':dict(zip(['xmin','xmax','ymin','ymax'],self.b)),'objects':[]}
 graphs.append(self.record)
def add(self,points,label,labels=None):
 existing=next((o for o in self.record['objects'] if o['points']==points),None)
 if existing:
  if label:existing['name']=label
  if labels:existing['labels']=list(labels)
 else:self.record['objects'].append({'name':label or f"Shape {len(self.record['objects'])+1}",'points':points,'labels':list(labels or [])})
def point(self,p,label,*args,**kwargs):
 original_point(self,p,label,*args,**kwargs)
 if not kwargs.get('center'):add(self,[list(p)],label,[label])
def shape(self,pts,label=None,*args,**kwargs):
 original_shape(self,pts,label,*args,**kwargs);add(self,[list(p) for p in pts],label or kwargs.get('vertices'),kwargs.get('vertices'))
m.Graph.__init__=init;m.Graph.point=point;m.Graph.shape=shape
original_labelled=m.labelled_graph;original_shaded=m.shaded_pair
def labelled(d,x,y,size,polys,labels=None,vertices=None,**kwargs):
 g=original_labelled(d,x,y,size,polys,labels,vertices,**kwargs)
 for i,poly in enumerate(polys):add(g,[list(p) for p in poly],labels[i] if labels else vertices[i] if vertices else None,vertices[i] if vertices else None)
 return g
def shaded(g,outer,inner,outerlab='Q',innerlab='P'):
 original_shaded(g,outer,inner,outerlab,innerlab)
 add(g,[list(p) for p in outer],outerlab);add(g,[list(p) for p in inner],innerlab)
m.labelled_graph=labelled;m.shaded_pair=shaded
# Build the source's in-memory drawing instructions only; no PDF save or export.
d=m.Doc(out/'unused.pdf');m.cover(d);m.build_A(d);m.build_B(d);m.build_C(d);m.build_D(d)
sections=re.findall(r'<section[^>]*aria-label="([^"]+)"[^>]*>(<svg.*?</svg>)</section>',html_path.read_text(),re.S)
assert len(sections)==d.page==23
pages=[]
for i,(label,svg) in enumerate(sections):
 width,height=map(float,re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',svg).groups())
 filename=f'page-{i+1:02d}.svg';(out/filename).write_text(svg)
 pages.append({'id':i+1,'section':label,'width':width,'height':height,'asset':filename})
bysection=defaultdict(list)
for a in m.ANS:bysection[a['section']].append(a)
seen=defaultdict(int)
for g in graphs:
 section=g['section'];idx=seen[section];seen[section]+=1
 answer=bysection[section][min(idx,len(bysection[section])-1)]
 g['questionId']=str(answer['q']);g['id']=str(answer['q'])+(f'-{idx+1}' if section.startswith('D') else '')
 g['defaultType']={'T':'translation','F':'reflection','R':'rotation','E':'enlargement'}.get(answer.get('transform',{}).get('type'),'translation')
 # Section B draws polygon labels separately, in the same P/Q/R order as
 # its geometry records. Match exact coordinates, never infer from draw order.
 if section.startswith('B'):
  for key,name in [('object','P'),('intermediate','Q'),('image','R' if 'intermediate' in answer else 'Q')]:
   for o in g['objects']:
    if key in answer and o['points']==[list(p) for p in answer[key]]:o['name']=name
 source=[list(p) for p in answer.get('object',[]) if isinstance(p,(list,tuple))]
 g['objects'].sort(key=lambda o:(o['points']!=source,o['name']))
 for i,o in enumerate(g['objects']):o['id']=f'{g["id"]}-source-{i}'
 # Only graph geometry is shipped, never answer prose or hidden solution graphics.
assert len(graphs)==63
(out/'module-pages.js').write_text('// Extracted from the editable BIJAK SPM v4.2 student module.\nexport const MODULE_PAGES = '+json.dumps(pages,ensure_ascii=False,separators=(',',':'))+';\nexport const MODULE_GRAPHS = '+json.dumps(graphs,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps({'pages':len(pages),'graphs':len(graphs),'objects':sum(len(g['objects']) for g in graphs)}))
