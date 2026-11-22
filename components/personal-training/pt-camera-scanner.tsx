"use client";
import {useEffect,useRef,useState} from 'react';
import {Camera,CameraOff} from 'lucide-react';
import {decodePTCameraFrame} from '@/lib/pt-camera';
import {Button} from '@/components/ui/button';
type QRDetector={detect:(source:HTMLVideoElement)=>Promise<{rawValue:string}[]>};
type QRDetectorConstructor={new(options:{formats:string[]}):QRDetector;getSupportedFormats?:()=>Promise<string[]>};
export function PTCameraScanner({onScan}:{onScan:(payload:string)=>void}){
 const [open,setOpen]=useState(false);const [error,setError]=useState('');const [ready,setReady]=useState(false);
 const video=useRef<HTMLVideoElement>(null);const callback=useRef(onScan);
 useEffect(()=>{callback.current=onScan;},[onScan]);
 useEffect(()=>{
  if(!open)return;
  const element=video.current;
  let cancelled=false;let stream:MediaStream|null=null;let timer:ReturnType<typeof setTimeout>|undefined;
  const stop=()=>{stream?.getTracks().forEach(track=>track.stop());};
  async function start(){
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('unavailable');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(cancelled){stop();return;}
    if(!element){stop();return;}
    element.srcObject=stream;await element.play();if(cancelled){stop();return;}
    const Detector=(window as Window&{BarcodeDetector?:QRDetectorConstructor}).BarcodeDetector;
    let detector:QRDetector|undefined;
    try{if(Detector&&(!Detector.getSupportedFormats||(await Detector.getSupportedFormats()).includes('qr_code')))detector=new Detector({formats:['qr_code']});}catch{/* Use the local QR decoder when native detection is unavailable. */}
    if(!detector){
     const {BrowserQRCodeReader}=await import('@zxing/browser');
     if(cancelled)return;
     const reader=new BrowserQRCodeReader();const canvas=document.createElement('canvas');
     detector={detect:async source=>[{rawValue:decodePTCameraFrame(reader,canvas,source)}]};
    }
    if(cancelled)return;setReady(true);
    const scan=async()=>{
     if(cancelled)return;
     try{
      const found=element.readyState>=2?await detector!.detect(element):[];
      if(cancelled)return;
      const token=found.find(code=>!!code.rawValue)?.rawValue;
      if(token){cancelled=true;stop();setOpen(false);setReady(false);callback.current(token);return;}
     }catch{/* Autofocus can temporarily make a frame unreadable. */}
     if(!cancelled)timer=setTimeout(scan,250);
    };
    void scan();
   }catch(reason){
    stop();if(cancelled)return;
    const name=reason instanceof DOMException?reason.name:'';
    setError(name==='NotAllowedError'?'Izin kamera ditolak. Izinkan kamera di browser lalu coba lagi.':name==='NotFoundError'?'Kamera tidak ditemukan. Gunakan input token atau scanner USB.':'Kamera gagal dibuka. Gunakan HTTPS/localhost dan pastikan kamera tidak sedang dipakai.');
   }
  }
  void start();
  return()=>{cancelled=true;if(timer)clearTimeout(timer);stop();if(element)element.srcObject=null;};
 },[open]);
 return <section className="space-y-3 rounded-xl border border-line bg-canvas p-4" aria-label="PT camera scanner"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink">Scan QR dengan kamera</h3>{open?<Button type="button" variant="secondary" onClick={()=>{setOpen(false);setReady(false);}}><CameraOff size={16}/>Tutup kamera</Button>:<Button type="button" onClick={()=>{setError('');setReady(false);setOpen(true);}}><Camera size={16}/>Buka kamera</Button>}</div>{open&&<><video ref={video} autoPlay muted playsInline aria-label="PT QR camera preview" className="aspect-video w-full rounded-lg bg-black object-cover"/>{!error&&<p role="status" className="text-xs text-ink-muted">{ready?'Arahkan kamera ke QR absensi PT member.':'Menyiapkan kamera...'}</p>}</>}{error&&<p role="alert" className="text-sm text-danger">{error}</p>}<p className="text-xs text-ink-muted">Gambar kamera diproses di perangkat dan tidak diunggah. Hasil scan tetap memakai validasi absensi mock PT.</p></section>;
}
