'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import './registration-guidance.css';
export function RegistrationGuidance({enabled=true,guided,step,title,hi,busy,back,next,full,children}:{enabled?:boolean;guided:boolean;step:number;title:string;hi:boolean;busy:boolean;back:()=>void;next:()=>void;full:()=>void;children:ReactNode}){
 const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{if(guided)heading.current?.focus({preventScroll:true})},[guided,step]);
 return <div className="registration-guidance">{guided&&<><p>{hi?'प्रश्न':'Question'} {step+1} / 7</p><h3 ref={heading} tabIndex={-1}>{title}</h3><p>{hi?'पीछे और आगे से जानकारी सहेजी नहीं जाती। अंत में पहचान जाँचें और अलग रिकॉर्ड बनाने की पुष्टि करें।':'Back and Next keep your entries. At the end, check identity and explicitly create a separate record.'}</p></>}{children}{enabled&&<div className="registration-navigation">{guided&&<><Button type="button" variant="outline" disabled={busy||step===0} onClick={back}>{hi?'पीछे':'Back'}</Button>{step<6&&<Button type="button" disabled={busy} onClick={next}>{hi?'आगे':'Next'}</Button>}</>}<Button type="button" variant="outline" disabled={busy} onClick={full}>{guided?(hi?'सभी प्रश्न दिखाएँ':'Show all questions'):(hi?'एक बार में एक प्रश्न':'One question at a time')}</Button></div>}</div>;
}
