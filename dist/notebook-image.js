import {paintNotebookGraph} from './notebook-render.js?v=12';
import {renderGraphScene} from './graph-render.js?v=16';
import {prepareImages} from './render.js?v=16';

// Page coordinates, independent of the screen camera and device pixel ratio.
// Match the lesson renderer's safe area so axis lettering is not cropped.
export function graphImageFrame(graph){
  const box={x:graph.x-20,y:graph.y-20,w:graph.width+40,h:graph.height+44};
  const scale=Math.min(8,2048/Math.max(box.w,box.h));
  return {...box,scale,width:Math.ceil(box.w*scale),height:Math.ceil(box.h*scale)};
}

export async function createNotebookGraphPNG(graph,page,objects,{now=0,guide=null}={}){
  if(!page.image?.complete||!page.image.naturalWidth)throw Error('Wait for the module page to load, then try again.');
  const ink=structuredClone(objects),frame=graphImageFrame(graph),canvas=document.createElement('canvas');
  canvas.width=frame.width;canvas.height=frame.height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.scale(frame.scale,frame.scale);ctx.translate(-frame.x,-frame.y);
  ctx.drawImage(page.image,page.x,page.y,page.width,page.height);
  // Capture the lesson immediately, before any asynchronous image decoding,
  // so a continuing animation or switching questions cannot change the copy.
  paintNotebookGraph(ctx,graph,{now,active:true,guide,annotations:ink});
  await prepareImages(ink);
  renderGraphScene(ctx,ink,false,()=>{},{view:{x:-frame.x,y:-frame.y,zoom:1},width:frame.w,height:frame.h});
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('The graph image could not be created.')),'image/png'));
}

export function writePNGClipboard(png,clipboard=globalThis.navigator?.clipboard,Item=globalThis.ClipboardItem,timeoutMs=10000){
  if(!clipboard?.write||!Item)return Promise.reject(Error('Image copying is unavailable in this browser.'));
  // Safari requires write() inside the original tap. Give it a promised PNG
  // rather than awaiting canvas encoding and losing that user activation.
  try{
    const writing=clipboard.write([new Item({'image/png':png})]);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Copying did not finish. Save the image instead.')),timeoutMs);
      Promise.resolve(writing).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
    });
  }catch(error){return Promise.reject(error);}
}
