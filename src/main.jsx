import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const WONDERS = [
  { id:"colosseum", name:"Colosseum", country:"Italy", lat:41.8902, lng:12.4922, icon:"🏛️", accent:"#b78b48" },
  { id:"petra", name:"Petra", country:"Jordan", lat:30.3285, lng:35.4444, icon:"🪨", accent:"#c56f45" },
  { id:"taj", name:"Taj Mahal", country:"India", lat:27.1751, lng:78.0421, icon:"🕌", accent:"#d6a84b" },
  { id:"wall", name:"Great Wall", country:"China", lat:40.4319, lng:116.5704, icon:"🏯", accent:"#a85b48" },
  { id:"chichen", name:"Chichén Itzá", country:"Mexico", lat:20.6843, lng:-88.5678, icon:"🛕", accent:"#b86d3f" },
  { id:"machu", name:"Machu Picchu", country:"Peru", lat:-13.1631, lng:-72.545, icon:"⛰️", accent:"#6b8761" },
  { id:"christ", name:"Christ the Redeemer", country:"Brazil", lat:-22.9519, lng:-43.2105, icon:"✝️", accent:"#7287a1" }
];

const R = 6371;
const rad = d => d * Math.PI / 180;
function haversine(a,b){
  const dLat=rad(b.lat-a.lat), dLng=rad(b.lng-a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
function solveTSP(startIndex){
  const rest=WONDERS.map((_,i)=>i).filter(i=>i!==startIndex);
  let best={distance:Infinity,route:[]};
  function permute(arr,prefix=[]){
    if(!arr.length){
      const route=[startIndex,...prefix,startIndex];
      let d=0;
      for(let i=0;i<route.length-1;i++) d+=haversine(WONDERS[route[i]],WONDERS[route[i+1]]);
      if(d<best.distance) best={distance:d,route};
      return;
    }
    arr.forEach((v,i)=>permute([...arr.slice(0,i),...arr.slice(i+1)],[...prefix,v]));
  }
  permute(rest);
  return best;
}

function iconFor(w, active=false, source=false){
  return L.divIcon({
    className:"",
    html:`<div class="landmark-pin ${active?"active":""} ${source?"source":""}" style="--accent:${w.accent}">
      <div class="pin-beam"></div><div class="pin-orb">${w.icon}</div>
      <div class="pin-name">${w.name}</div>
      ${source?'<div class="source-tag">START / END</div>':''}
    </div>`,
    iconSize:[150,105], iconAnchor:[75,48], popupAnchor:[0,-45]
  });
}
function planeIcon(){
  return L.divIcon({className:"",html:'<div class="cinema-plane">✈</div>',iconSize:[50,50],iconAnchor:[25,25]});
}

function interpolate(a,b,t){
  // Simple spherical-ish visual interpolation with a lifted arc.
  let lngA=a.lng, lngB=b.lng, dlng=lngB-lngA;
  if(Math.abs(dlng)>180) dlng=dlng>0?dlng-360:dlng+360;
  const lng=lngA+dlng*t;
  const lat=a.lat+(b.lat-a.lat)*t;
  const lift=Math.sin(Math.PI*t)*(Math.min(16,Math.abs(dlng)*0.10+Math.abs(b.lat-a.lat)*0.04));
  return {lat:lat+lift,lng};
}
function arc(a,b,n=50){
  return Array.from({length:n+1},(_,i)=>{
    const p=interpolate(a,b,i/n);
    return [p.lat,p.lng];
  });
}
function MapCamera({activeLeg}){
  const map=useMap();
  useEffect(()=>{
    if(!activeLeg) return;
    const pts=arc(activeLeg.from,activeLeg.to,12);
    map.fitBounds(L.latLngBounds(pts),{padding:[70,70],maxZoom:3.5,animate:true,duration:.8});
  },[activeLeg,map]);
  return null;
}

function App(){
  const [startId,setStartId]=useState("colosseum");
  const [running,setRunning]=useState(false);
  const [finished,setFinished]=useState(false);
  const [legIndex,setLegIndex]=useState(0);
  const [t,setT]=useState(0);
  const [speed,setSpeed]=useState(1);
  const [showMatrix,setShowMatrix]=useState(false);
  const raf=useRef(null);
  const last=useRef(0);

  const startIndex=WONDERS.findIndex(w=>w.id===startId);
  const solution=useMemo(()=>solveTSP(startIndex),[startIndex]);
  const route=solution.route.map(i=>WONDERS[i]);
  const legs=route.slice(0,-1).map((from,i)=>({from,to:route[i+1],distance:haversine(from,route[i+1])}));
  const activeLeg=legs[legIndex] || legs[0];

  useEffect(()=>{
    setRunning(false);setFinished(false);setLegIndex(0);setT(0);
  },[startId]);

  useEffect(()=>{
    if(!running) return;
    last.current=performance.now();
    const frame=(now)=>{
      const dt=Math.min(40,now-last.current); last.current=now;
      setT(prev=>{
        let next=prev+dt/(4200/speed);
        if(next>=1){
          if(legIndex>=legs.length-1){
            setRunning(false);setFinished(true);return 1;
          }
          setLegIndex(x=>x+1);return 0;
        }
        return next;
      });
      raf.current=requestAnimationFrame(frame);
    };
    raf.current=requestAnimationFrame(frame);
    return ()=>cancelAnimationFrame(raf.current);
  },[running,speed,legIndex,legs.length]);

  const currentPoint=activeLeg?interpolate(activeLeg.from,activeLeg.to,t):route[0];
  const distanceCovered=legs.slice(0,legIndex).reduce((s,l)=>s+l.distance,0)+(activeLeg?activeLeg.distance*t:0);
  const routePercent=(distanceCovered/solution.distance)*100;
  const displayedRoute=route.slice(0,legIndex+1);

  const start=()=>{
    if(finished){setFinished(false);setLegIndex(0);setT(0);}
    setRunning(true);
  };
  const reset=()=>{setRunning(false);setFinished(false);setLegIndex(0);setT(0);};
  const matrix=WONDERS.map(a=>WONDERS.map(b=>a.id===b.id?0:haversine(a,b)));

  return <div className="cinema-app">
    <div className="ambient ambient-a"></div><div className="ambient ambient-b"></div>

    <header className="hero">
      <div className="brand">
        <div className="brand-mark">07</div>
        <div><div className="micro">ALGORITHM EXPERIENCE</div><div className="brand-name">WONDERS / TSP</div></div>
      </div>
      <div className="hero-title">
        <div className="micro">TRAVELING SALESMAN PROBLEM</div>
        <h1>THE WORLD'S <em>SHORTEST</em> WONDER TOUR</h1>
      </div>
      <div className="status"><span></span>{running?"LIVE SIMULATION":finished?"TOUR COMPLETE":"SYSTEM READY"}</div>
    </header>

    <section className="control-strip">
      <div className="control-group">
        <label>START / END</label>
        <select value={startId} onChange={e=>setStartId(e.target.value)}>
          {WONDERS.map(w=><option value={w.id} key={w.id}>{w.name} — {w.country}</option>)}
        </select>
      </div>
      <div className="route-readout">
        <span className="micro">OPTIMAL CLOSED TOUR</span>
        <strong>{route.map(w=>w.short||w.name).join("  →  ")}</strong>
      </div>
      <div className="control-actions">
        <button className="gold" onClick={start}>{running?"FLYING…":finished?"REPLAY TOUR":"START TSP TOUR"}</button>
        <button onClick={reset}>RESET</button>
        <button onClick={()=>setShowMatrix(x=>!x)}>{showMatrix?"HIDE MATRIX":"DISTANCE MATRIX"}</button>
      </div>
    </section>

    <main className="stage">
      <div className="map-shell">
        <div className="map-corner top-left"><span>GLOBAL ROUTE VISUALIZATION</span><b>7 NODES / 1 CLOSED CYCLE</b></div>
        <div className="map-corner top-right"><span>CALCULATION</span><b>HAVERSINE · KM</b></div>
        <MapContainer center={[15,10]} zoom={2} minZoom={2} maxZoom={5} className="cinema-map" worldCopyJump>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
          <MapCamera activeLeg={running?activeLeg:null}/>

          {legs.map((l,i)=><Polyline key={i} positions={arc(l.from,l.to)} pathOptions={{
            color:i<legIndex||finished?"#c8a35d":"#18212f",weight:i===legIndex&&!finished?3:1.6,
            opacity:i<legIndex||finished?0.92:.5,dashArray:i===legIndex&&!finished?"1 9":"6 10",lineCap:"round"
          }}/>)}

          {WONDERS.map(w=><Marker key={w.id} position={[w.lat,w.lng]} icon={iconFor(w,w.id===activeLeg?.to||w.id===startId,w.id===startId)}>
            <Popup><b>{w.name}</b><br/>{w.country}</Popup>
          </Marker>)}

          {(running||finished)&&<Marker position={[currentPoint.lat,currentPoint.lng]} icon={planeIcon()} zIndexOffset={5000}/>}
        </MapContainer>

        <div className="map-vignette"></div>

        <div className="flight-hud">
          <div className="hud-top"><span>FLIGHT {String(Math.min(legIndex+1,7)).padStart(2,"0")} / 07</span><span>{Math.round(routePercent)}%</span></div>
          <div className="hud-main">
            <div><span>DEPARTING</span><strong>{activeLeg?.from.name}</strong></div>
            <div className="hud-arrow">→</div>
            <div><span>ARRIVING</span><strong>{activeLeg?.to.name}</strong></div>
          </div>
          <div className="hud-distance">
            <div><span>LEG DISTANCE</span><b>{Math.round((activeLeg?.distance||0)*t).toLocaleString()} / {Math.round(activeLeg?.distance||0).toLocaleString()} KM</b></div>
            <div className="hud-bar"><i style={{width:`${t*100}%`}}></i></div>
          </div>
        </div>

        <div className="total-hud">
          <span>TOTAL TOUR DISTANCE</span>
          <strong>{Math.round(solution.distance).toLocaleString()} <small>KM</small></strong>
          <em>{finished?"OPTIMAL TSP TOUR":"EXACT SOLUTION · 7! SEARCH SPACE"}</em>
        </div>

        {finished&&<div className="finish-screen">
          <div className="finish-glow"></div>
          <div className="finish-kicker">ROUTE OPTIMIZATION COMPLETE</div>
          <h2>OPTIMAL <span>TSP TOUR</span></h2>
          <p>{route.map(w=>w.short||w.name).join("  →  ")}</p>
          <div className="finish-distance">{Math.round(solution.distance).toLocaleString()} <small>KM</small></div>
          <button className="gold" onClick={reset}>RUN AGAIN</button>
        </div>}
      </div>

      <aside className="side-panel">
        <div className="panel-block source-block">
          <span className="micro">MISSION ORIGIN</span>
          <div className="source-name">{route[0].icon} {route[0].name}</div>
          <div className="source-country">{route[0].country} · START = END</div>
        </div>

        <div className="panel-block">
          <div className="micro">TOUR STATISTICS</div>
          <div className="stat-grid">
            <div><b>{Math.round(solution.distance).toLocaleString()}</b><span>TOTAL KM</span></div>
            <div><b>07</b><span>WONDERS</span></div>
            <div><b>08</b><span>FLIGHT LEGS</span></div>
            <div><b>5040</b><span>ROUTES TESTED</span></div>
          </div>
        </div>

        <div className="panel-block route-list">
          <div className="micro">OPTIMAL SEQUENCE</div>
          {route.map((w,i)=><div className={`sequence-row ${i===legIndex?"current":""} ${i<=legIndex?"visited":""}`} key={i}>
            <span>{String(i+1).padStart(2,"0")}</span><i>{w.icon}</i><b>{w.name}</b>{i===0&&<small>S/E</small>}
          </div>)}
        </div>

        <div className="panel-block speed-block">
          <div className="micro">FLIGHT SPEED</div>
          <div className="speed-buttons">
            {[.65,1,1.5,2].map(s=><button className={speed===s?"selected":""} onClick={()=>setSpeed(s)} key={s}>{s}×</button>)}
          </div>
        </div>
      </aside>
    </main>

    {showMatrix&&<section className="matrix-panel">
      <div className="matrix-head"><div><div className="micro">ANALYSIS VIEW</div><h2>Distance Matrix · Kilometres</h2></div><button onClick={()=>setShowMatrix(false)}>CLOSE ×</button></div>
      <div className="matrix-scroll"><table><thead><tr><th></th>{WONDERS.map(w=><th key={w.id}>{w.short}</th>)}</tr></thead><tbody>
        {matrix.map((row,i)=><tr key={i}><th>{WONDERS[i].short}</th>{row.map((d,j)=><td className={i===j?"zero":""} key={j}>{Math.round(d).toLocaleString()}</td>)}</tr>)}
      </tbody></table></div>
    </section>}

    <footer><span>SEVEN WONDERS · TRAVELING SALESMAN PROBLEM</span><span>EXACT BRUTE-FORCE OPTIMIZATION · GREAT-CIRCLE DISTANCE</span></footer>
  </div>
}

createRoot(document.getElementById("root")).render(<App />);
