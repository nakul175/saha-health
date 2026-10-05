'use client';
import {useEffect} from 'react';
export function OfflineRegistration(){useEffect(()=>{if('serviceWorker' in navigator)void navigator.serviceWorker.register('/app-sw.js',{scope:'/app'}).catch(()=>{});},[]);return null;}
