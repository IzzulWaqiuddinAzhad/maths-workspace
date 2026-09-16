let next=0;
export const field=(text='')=>({type:'Text',id:'f'+(++next),text});
export const sequence=()=>({type:'Sequence',children:[field()]});
export function template(type,name=''){const child=()=>sequence();return type==='Fraction'?{type,numerator:child(),denominator:child()}:type==='Mixed'?{type,whole:child(),numerator:child(),denominator:child()}:type==='Power'?{type,base:child(),exponent:child()}:type==='Root'?{type,index:child(),body:child()}:type==='Sqrt'?{type,body:child()}:type==='Function'?{type,name,body:child()}:{type:'Group',body:child()};}
export function children(node){return node.type==='Sequence'?node.children:node.type==='Mixed'?[node.whole,node.numerator,node.denominator]:node.type==='Fraction'?[node.numerator,node.denominator]:node.type==='Power'?[node.base,node.exponent]:node.type==='Root'?[node.index,node.body]:node.body?[node.body]:[];}
export function fields(node){return node.type==='Text'?[node]:children(node).flatMap(fields);}
export function serialize(node){switch(node.type){case'Text':return node.text;case'Sequence':return node.children.map(serialize).join('');case'Fraction':return`((${serialize(node.numerator)})/(${serialize(node.denominator)}))`;case'Mixed':{const whole=serialize(node.whole);if(!/^[+−-]?\d+(?:\.0+)?$/.test(whole))return 'invalidMixed()';const f=`((${serialize(node.numerator)})/(${serialize(node.denominator)}))`;return /^[-−]/.test(whole)?`(-(${whole.slice(1)})-${f})`:`((${whole})+${f})`;}case'Power':return`((${serialize(node.base)})^(${serialize(node.exponent)}))`;case'Root':return`root(${serialize(node.index)},${serialize(node.body)})`;case'Sqrt':return`sqrt(${serialize(node.body)})`;case'Function':return`${node.name}(${serialize(node.body)})`;case'Group':return`(${serialize(node.body)})`;default:throw Error('syntax');}}
export function pathTo(root,id){const walk=(node,path)=>{if(node.type==='Text')return node.id===id?[...path,node]:null;for(const child of children(node)){const found=walk(child,[...path,node]);if(found)return found;}return null;};return walk(root,[])||[];}
function trailingAtom(text){if(!text)return ['', ''];if(text.endsWith(')')){let depth=0;for(let i=text.length-1;i>=0;i--){if(text[i]===')')depth++;if(text[i]==='('&&! --depth){const prefix=text.slice(0,i),fn=prefix.match(/[a-zA-Z]+$/)?.[0]||'';return [prefix.slice(0,prefix.length-fn.length),fn+text.slice(i)];}}}const m=text.match(/(?:\d*\.?\d+|Ans|ans|π|pi|e)(?:[!%])*$/);return m?[text.slice(0,-m[0].length),m[0]]:[text,''];}
export function insert(root,id,start,end,type,name){const path=pathTo(root,id),target=path.at(-1),parent=path.at(-2);if(!target||parent.type!=='Sequence')return null;const node=template(type,name);let before=target.text.slice(0,start),selected=target.text.slice(start,end),after=target.text.slice(end),focus=fields(node)[0],at=parent.children.indexOf(target),captured=false;
 if(['Power','Fraction'].includes(type)){const part=type==='Power'?node.base:node.numerator;if(selected){part.children[0].text=selected;captured=true;}else{const [prefix,atom]=trailingAtom(before);if(atom){before=prefix;part.children[0].text=atom;captured=true;}else if(!before&&at>0&&parent.children[at-1].type!=='Text'){part.children=[field(),parent.children[at-1],field()];parent.children.splice(at-1,1);at--;captured=true;}}if(captured)focus=fields(type==='Power'?node.exponent:node.denominator)[0];else if(type==='Power')focus=fields(node.base)[0];}
 else if(selected)focus.text=selected;
 target.text=before;parent.children.splice(at+1,0,node,field(after));return focus.id;
}
export function navigate(root,id,direction){const path=pathTo(root,id),all=fields(root),at=all.findIndex(f=>f.id===id);if(direction==='left'||direction==='right')return all[at+(direction==='left'?-1:1)]?.id??id;
 for(let i=path.length-2;i>=0;i--){const node=path[i];let parts;if(node.type==='Fraction')parts=[node.numerator,node.denominator];if(node.type==='Power')parts=[node.exponent,node.base];if(node.type==='Root')parts=[node.index,node.body];if(node.type==='Mixed')parts=[node.numerator,node.denominator];if(!parts)continue;const inPart=parts.findIndex(p=>fields(p).some(f=>f.id===id)),dest=direction==='up'?0:1;if(inPart>=0&&inPart!==dest)return fields(parts[dest])[0].id;}
 return id;
}
export function exitStructure(root,id,direction='right'){const path=pathTo(root,id);for(let i=path.length-2;i>0;i--){const node=path[i],parent=path[i-1];if(node.type!=='Sequence'&&parent.type==='Sequence'){const at=parent.children.indexOf(node),target=parent.children[at+(direction==='left'?-1:1)];return fields(target)[0].id;}}return id;}
// Remove only the innermost empty template; merge its surrounding caret gaps.
export function unwrapEmpty(root,id,returnId=false){const path=pathTo(root,id);for(let i=path.length-2;i>0;i--){const node=path[i],parent=path[i-1];if(node.type!=='Sequence'&&parent.type==='Sequence'&&fields(node).every(f=>!f.text)){const at=parent.children.indexOf(node),before=parent.children[at-1],after=parent.children[at+1];before.text+=after.text;parent.children.splice(at,2);return returnId?before.id:true;}}return false;}
export function boundaryField(parent,node){return parent?.type==='Sequence'&&parent.children.length>1&&node.type==='Text'&&!node.text;}
export class NaturalEditor {
 constructor(){this.clear();}
 clear(){this.root=sequence();this.id=fields(this.root)[0].id;this.selection=[0,0];}
 get current(){return fields(this.root).find(f=>f.id===this.id);}
 focus(id,pos){const f=fields(this.root).find(f=>f.id===id);if(!f)return;this.id=id;this.selection=[pos??f.text.length,pos??f.text.length];}
 type(text){const f=this.current,[a,b]=this.selection;if(!f||serialize(this.root).length+text.length>1500)return;f.text=f.text.slice(0,a)+text+f.text.slice(b);this.focus(f.id,a+text.length);}
 structure(type,name){if(pathTo(this.root,this.id).length>80)return;const id=insert(this.root,this.id,...this.selection,type,name);if(id)this.focus(id);}
 exit(direction='right'){const id=exitStructure(this.root,this.id,direction);this.focus(id,direction==='right'?0:undefined);}
 move(direction){const f=this.current,p=this.selection[0];if(direction==='left'&&p>0){this.focus(f.id,p-1);return;}if(direction==='right'&&p<f.text.length){this.focus(f.id,p+1);return;}const id=navigate(this.root,this.id,direction);this.focus(id,direction==='right'?0:direction==='left'?undefined:Math.min(p,fields(this.root).find(f=>f.id===id).text.length));}
 remove(forward=false){const f=this.current;let [a,b]=this.selection;if(a!==b){f.text=f.text.slice(0,a)+f.text.slice(b);this.focus(f.id,a);return;}if((forward&&a<f.text.length)||(!forward&&a>0)){if(forward)b++;else a--;f.text=f.text.slice(0,a)+f.text.slice(b);this.focus(f.id,a);return;}
 const removed=unwrapEmpty(this.root,this.id,true);if(removed){this.focus(removed);return;}
 const path=pathTo(this.root,this.id),parent=path.at(-2),at=parent.children.indexOf(f),sibling=parent.children[at+(forward?1:-1)];if(sibling&&sibling.type!=='Text'){const slots=fields(sibling);this.focus(forward?slots[0].id:slots.at(-1).id,forward?0:undefined);}else{const id=navigate(this.root,this.id,forward?'right':'left');if(id!==this.id)this.focus(id,forward?0:undefined);}
 }
 key(k){if(k==='C'){this.clear();return;}if(k==='DEL'||k==='Delete'){this.remove(k==='Delete');return;}if(['←','→','↑','↓'].includes(k)){this.move({'←':'left','→':'right','↑':'up','↓':'down'}[k]);return;}if(k==='OUT'){this.exit();return;}
 if(k==='a/b'||k==='mixed'){this.structure(k==='a/b'?'Fraction':'Mixed');return;}
 if(['xʸ','x²','x³','1/x'].includes(k)){this.structure('Power');if(k!=='xʸ'){const path=pathTo(this.root,this.id),power=path.findLast(n=>n.type==='Power');power.exponent.children[0].text=k==='x²'?'2':k==='x³'?'3':'-1';if(serialize(power.base)){this.focus(fields(power.exponent)[0].id);this.exit();}else this.focus(fields(power.base)[0].id);}return;}
 if(k==='√'||k==='ⁿ√'){this.structure(k==='√'?'Sqrt':'Root');return;}
 if(['sin','cos','tan','asin','acos','atan','log','ln','abs'].includes(k)){this.structure('Function',k);return;}
 if(['10ˣ','eˣ','×10ⁿ'].includes(k)){if(k==='×10ⁿ')this.type('×');this.type(k==='eˣ'?'e':'10');this.structure('Power');return;}
 if(k==='('){this.structure('Group');return;}if(k===')'){this.exit();return;}
 if(k==='±'){const f=this.current,[prefix,atom]=trailingAtom(f.text.slice(0,this.selection[0])),after=f.text.slice(this.selection[0]);const toggle=before=>/[-−]$/.test(before)&&(before.length===1||/[+−×÷*/^,(\-]$/.test(before.slice(0,-1)))?before.slice(0,-1):before+'-';if(atom){const before=toggle(prefix);f.text=before+atom+after;this.focus(f.id,before.length+atom.length);}else if(!prefix){const path=pathTo(this.root,this.id),parent=path.at(-2),at=parent.children.indexOf(f),before=parent.children[at-2];if(at>1&&before?.type==='Text'){before.text=toggle(before.text);}else this.type('-');}else this.type('-');return;}

 this.type(k);
 }
}
