type QRFrameReader={decodeFromCanvas:(canvas:HTMLCanvasElement)=>{getText:()=>string}};
export function decodePTCameraFrame(reader:QRFrameReader,canvas:HTMLCanvasElement,video:HTMLVideoElement):string {
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context||!video.videoWidth||!video.videoHeight)throw new Error('Camera frame unavailable');
 canvas.width=Math.min(video.videoWidth,640);canvas.height=Math.round(video.videoHeight*canvas.width/video.videoWidth);
 context.setTransform(1,0,0,1,0,0);context.drawImage(video,0,0,canvas.width,canvas.height);
 try{return reader.decodeFromCanvas(canvas).getText();}
 catch{
  // A different finder-pattern scan order handles ambiguous, repetitive QR payloads.
  context.setTransform(-1,0,0,-1,canvas.width,canvas.height);context.drawImage(video,0,0,canvas.width,canvas.height);
  return reader.decodeFromCanvas(canvas).getText();
 }
}
