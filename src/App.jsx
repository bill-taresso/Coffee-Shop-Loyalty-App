import { useState, useEffect, useCallback, useRef } from "react";

function generateQRDataURL(text, size = 200) {
  const hash = Array.from(text).reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  const rng = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; };
  const rand = rng(Math.abs(hash));
  const modules = 21;
  const grid = Array.from({ length: modules }, (_, r) =>
    Array.from({ length: modules }, (_, c) => {
      const inFinder = (r < 7 && c < 7) || (r < 7 && c >= modules - 7) || (r >= modules - 7 && c < 7);
      if (inFinder) {
        const lr = r < 7 ? r : r - (modules - 7);
        const lc = c < 7 ? c : c >= modules - 7 ? c - (modules - 7) : c;
        const onBorder = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const inInner = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
        return onBorder || inInner ? 1 : 0;
      }
      if (r === 6 || c === 6) return (r + c) % 2 === 0 ? 1 : 0;
      return rand() > 0.5 ? 1 : 0;
    })
  );
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cell = size / modules;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
  grid.forEach((row, r) => row.forEach((val, c) => {
    ctx.fillStyle = val ? "#1a0f00" : "#ffffff";
    ctx.fillRect(c * cell, r * cell, cell, cell);
  }));
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = cell * 2;
  ctx.strokeRect(cell, cell, size - cell * 2, size - cell * 2);
  return canvas.toDataURL();
}

const LOYALTY_GOAL = 5;
const COOLDOWN_MS  = 20 * 60 * 1000;
const ALERT_THRESH = 2;

const C = {
  bg:"#09080a", surface:"#110f14", card:"#18151e", border:"#2a2533",
  gold:"#c8a96e", goldDim:"#6e5c38", cream:"#f0e8d8", muted:"#7a7080",
  success:"#3d7a35", error:"#7a2828", free:"#2a5c22", accent:"#a06ef0",
};
const font = "'EB Garamond','Palatino Linotype',serif";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};-webkit-font-smoothing:antialiased}
  input,button{font-family:${font}}
  ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-thumb{background:${C.border}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes stampPop{0%{transform:scale(0) rotate(-15deg);opacity:0}65%{transform:scale(1.25) rotate(3deg)}100%{transform:scale(1) rotate(0);opacity:1}}
  @keyframes scanBeam{0%,100%{top:6%}50%{top:88%}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${C.gold}44}50%{box-shadow:0 0 0 12px transparent}}
  @keyframes notif{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  @keyframes confetti{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(200px) rotate(720deg);opacity:0}}
  @keyframes alertPulse{0%,100%{background:${C.error}}50%{background:#a03030}}
  @keyframes badgePop{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
  .fadeUp{animation:fadeUp .35s ease both}
`;

const MENU = [
  { id:1, name:"Espresso",          price:2.50, emoji:"☕", cat:"Ζεστά" },
  { id:2, name:"Cappuccino",        price:3.80, emoji:"☕", cat:"Ζεστά" },
  { id:3, name:"Flat White",        price:3.50, emoji:"☕", cat:"Ζεστά" },
  { id:4, name:"Filter Coffee",     price:2.80, emoji:"☕", cat:"Ζεστά" },
  { id:5, name:"Latte",             price:3.90, emoji:"🥛", cat:"Ζεστά" },
  { id:6, name:"Cold Brew",         price:4.20, emoji:"🧊", cat:"Κρύα"  },
  { id:7, name:"Freddo Espresso",   price:2.00, emoji:"🧊", cat:"Κρύα"  },
  { id:8, name:"Freddo Cappuccino", price:2.20, emoji:"🧊", cat:"Κρύα"  },
];

const NOW = Date.now();
const INIT_CUSTOMERS = [
  { id:"C001", name:"Νίκος Παπαδόπουλος", email:"nikos@email.com",    purchases:4,  totalSpent:14.60, freeAvailable:false, joinDate:"2026-01-10", lastStamp: NOW - 25*60*1000 },
  { id:"C002", name:"Μαρία Γεωργίου",      email:"maria@email.com",    purchases:10, totalSpent:38.50, freeAvailable:true,  joinDate:"2025-11-20", lastStamp: NOW - 60*60*1000 },
  { id:"C003", name:"Δημήτρης Κώστας",    email:"dimitris@email.com", purchases:2,  totalSpent:7.00,  freeAvailable:false, joinDate:"2026-03-05", lastStamp: NOW - 90*60*1000 },
  { id:"C004", name:"Ελένη Σταματίου",    email:"eleni@email.com",    purchases:7,  totalSpent:27.30, freeAvailable:false, joinDate:"2026-02-14", lastStamp: NOW - 45*60*1000 },
];
const INIT_LOGS = [
  { id:"L001", customerId:"C002", customer:"Μαρία Γεωργίου",     ts: NOW-65*60*1000, note:"" },
  { id:"L002", customerId:"C001", customer:"Νίκος Παπαδόπουλος", ts: NOW-26*60*1000, note:"" },
  { id:"L003", customerId:"C004", customer:"Ελένη Σταματίου",    ts: NOW-46*60*1000, note:"" },
];

const genId  = (p) => p + Date.now().toString(36).toUpperCase().slice(-5);
const modulo = (p) => p % LOYALTY_GOAL;
const toFree = (p) => LOYALTY_GOAL - modulo(p);
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("el-GR",{hour:"2-digit",minute:"2-digit"});
const fmtDate = (ts) => new Date(ts).toLocaleDateString("el-GR",{day:"2-digit",month:"2-digit",year:"numeric"});
const cooldownRemaining = (ls) => { const d = COOLDOWN_MS-(Date.now()-ls); return d>0?d:0; };

export default function App() {
  const [customers, setCustomers]   = useState(INIT_CUSTOMERS);
  const [logs, setLogs]             = useState(INIT_LOGS);
  const [orders, setOrders]         = useState([]); // pending orders
  const [alerts, setAlerts]         = useState([]);
  const [screen, setScreen]         = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotif]    = useState(null);
  const [confetti, setConfetti]     = useState(false);
  const [adminTab, setAdminTab]     = useState("orders");
  const [loginEmail, setLoginEmail] = useState("");
  const [regForm, setRegForm]       = useState({name:"",email:"",phone:""});
  const [qrDataURL, setQrDataURL]   = useState(null);
  const [scanPhase, setScanPhase]   = useState("idle");
  const [scannedC, setScannedC]     = useState(null);
  const [cart, setCart]             = useState([]);
  const [now, setNow]               = useState(Date.now());
  const [offers, setOffers]         = useState([
    { id:"O001", text:"🧊 Freddo Espresso μόνο 1.50€ — Σήμερα!", active:true, color:"#1a2a3a", border:"#2a5a7a" },
    { id:"O002", text:"⭐ Double stamps κάθε Τετάρτη!", active:true, color:"#2a1a3a", border:"#5a2a7a" },
  ]);
  const [offerForm, setOfferForm]   = useState({ text:"", color:"#1a2a10", border:"#3a6a20" });
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (currentUser && !currentUser.admin) {
      const payload = JSON.stringify({id:currentUser.id, name:currentUser.name});
      setQrDataURL(generateQRDataURL(payload, 200));
    }
  }, [currentUser?.id]);

  const notify = useCallback((msg, type="ok") => {
    setNotif({msg,type});
    setTimeout(()=>setNotif(null),3500);
  },[]);

  const fireConfetti = () => { setConfetti(true); setTimeout(()=>setConfetti(false),2200); };

  // ── Auth ───────────────────────────────────────────────────────
  const handleLogin = () => {
    if (loginEmail.trim()==="admin") { setCurrentUser({admin:true,name:"Διαχειριστής"}); setScreen("admin"); return; }
    const c = customers.find(c=>c.email.toLowerCase()===loginEmail.trim().toLowerCase());
    if (!c) { notify("Δεν βρέθηκε λογαριασμός.","err"); return; }
    setCurrentUser(c); setScreen("home");
  };

  const handleRegister = () => {
    const {name,email,phone} = regForm;
    if (!name||!email||!phone) { notify("Συμπλήρωσε όλα τα πεδία.","err"); return; }
    if (customers.find(c=>c.email===email)) { notify("Το email υπάρχει ήδη.","err"); return; }
    const newC = {id:genId("C"),name,email,phone,purchases:0,totalSpent:0,freeAvailable:false,joinDate:new Date().toISOString().split("T")[0],lastStamp:0};
    setCustomers(p=>[...p,newC]); setCurrentUser(newC); notify("Καλωσόρισες! ☕"); setScreen("home");
  };

  // ── Cart ────────────────────────────────────────────────────────
  const addItem = (item) => setCart(p => {
    const ex = p.find(i=>i.id===item.id);
    if (ex) return p.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i);
    return [...p,{...item,qty:1}];
  });
  const removeItem = (id) => setCart(p=>p.filter(i=>i.id!==id));
  const changeQty  = (id,d) => setCart(p=>p.map(i=>i.id===id?{...i,qty:Math.max(1,i.qty+d)}:i));
  const cartTotal  = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const cartCount  = cart.reduce((s,i)=>s+i.qty,0);

  // ── Place order (no payment — notify staff) ─────────────────────
  const placeOrder = () => {
    if (cart.length===0) return;
    const newOrder = {
      id: genId("ORD"),
      customerId: currentUser.id,
      customer: currentUser.name,
      items: cart.map(i=>`${i.name}${i.qty>1?` ×${i.qty}`:""}`),
      total: cartTotal,
      ts: Date.now(),
      status: "pending", // pending | confirmed | ready
    };
    setOrders(p=>[newOrder,...p]);
    setCart([]);
    setScreen("ordered");
    notify("Η παραγγελία σου στάλθηκε! ☕");
  };

  // ── Admin: confirm order → grant stamp ─────────────────────────
  const confirmOrder = (orderId) => {
    const order = orders.find(o=>o.id===orderId);
    if (!order) return;
    const nowTs = Date.now();
    const customer = customers.find(c=>c.id===order.customerId);
    if (!customer) return;

    // Cooldown check
    const remaining = cooldownRemaining(customer.lastStamp);
    if (remaining>0) { notify(`Cooldown ενεργό για ${customer.name.split(" ")[0]}! ~${Math.ceil(remaining/60000)} λεπτά ακόμα.`,"err"); return; }

    const newP    = customer.purchases + 1;
    const newFree = newP % LOYALTY_GOAL === 0;

    // Alert check
    const recentStamps = logs.filter(l=>l.customerId===customer.id && nowTs-l.ts<60*60*1000);
    if (recentStamps.length>=ALERT_THRESH) {
      setAlerts(p=>[{id:genId("ALR"),msg:`⚠️ ${customer.name.split(" ")[0]}: ${recentStamps.length+1} σφραγίδες στην τελευταία ώρα!`,ts:nowTs,customerId:customer.id},...p]);
    }

    setCustomers(p=>p.map(c=>c.id===customer.id?{...c,purchases:newP,totalSpent:c.totalSpent+order.total,freeAvailable:newFree,lastStamp:nowTs}:c));
    setLogs(p=>[{id:genId("L"),customerId:customer.id,customer:customer.name,ts:nowTs,note:newFree?"🎁 Δωρεάν καφέ κερδήθηκε!":""},...p]);
    setOrders(p=>p.map(o=>o.id===orderId?{...o,status:"confirmed"}:o));

    if (newFree) { fireConfetti(); notify(`🎉 ${customer.name.split(" ")[0]} κέρδισε δωρεάν καφέ!`); }
    else notify(`✓ Παραγγελία επιβεβαιώθηκε · +1 σφραγίδα για ${customer.name.split(" ")[0]}!`);
  };

  const markReady = (orderId) => setOrders(p=>p.map(o=>o.id===orderId?{...o,status:"ready"}:o));

  // ── QR Scan (staff) ─────────────────────────────────────────────
  const doScan = () => {
    setScanPhase("scanning");
    setTimeout(()=>{
      const target = customers[Math.floor(Math.random()*customers.length)];
      setScannedC(target);
      setScanPhase(cooldownRemaining(target.lastStamp)>0?"blocked":"found");
    },1800);
  };

  const grantStampScan = () => {
    if (!scannedC) return;
    const nowTs = Date.now();
    const remaining = cooldownRemaining(scannedC.lastStamp);
    if (remaining>0) { notify(`Αναμονή ~${Math.ceil(remaining/60000)} λεπτά ακόμα.`,"err"); return; }
    const newP    = scannedC.purchases+1;
    const newFree = newP%LOYALTY_GOAL===0;
    const recentStamps = logs.filter(l=>l.customerId===scannedC.id&&nowTs-l.ts<60*60*1000);
    if (recentStamps.length>=ALERT_THRESH) setAlerts(p=>[{id:genId("ALR"),msg:`⚠️ ${scannedC.name.split(" ")[0]}: ${recentStamps.length+1} σφραγίδες στην τελευταία ώρα!`,ts:nowTs,customerId:scannedC.id},...p]);
    setCustomers(p=>p.map(c=>c.id===scannedC.id?{...c,purchases:newP,freeAvailable:newFree,lastStamp:nowTs}:c));
    setLogs(p=>[{id:genId("L"),customerId:scannedC.id,customer:scannedC.name,ts:nowTs,note:newFree?"🎁 Δωρεάν καφέ κερδήθηκε!":""},...p]);
    if (newFree) { fireConfetti(); notify(`🎉 ${scannedC.name.split(" ")[0]} κέρδισε δωρεάν καφέ!`); }
    else notify(`✓ +1 σφραγίδα για ${scannedC.name.split(" ")[0]}!`);
    setScanPhase("success");
    setTimeout(()=>{setScanPhase("idle");setScannedC(null);},2500);
  };

  const dismissAlert = (id) => setAlerts(p=>p.filter(a=>a.id!==id));

  // ── Derived ─────────────────────────────────────────────────────
  const user         = currentUser;
  const stampsNow    = user&&!user.admin ? modulo(user.purchases) : 0;
  const userCooldown = user&&!user.admin ? cooldownRemaining(user.lastStamp) : 0;
  const userLogs     = user&&!user.admin ? logs.filter(l=>l.customerId===user.id) : [];
  const pendingOrders = orders.filter(o=>o.status==="pending");
  const userOrders   = user&&!user.admin ? orders.filter(o=>o.customerId===user.id) : [];

  const screenTitle = {login:"Είσοδος",register:"Εγγραφή",home:`Γεια, ${user?.name?.split(" ")[0]||""}`,menu:"Μενού",cart:"Καλάθι",ordered:"Παραγγελία",qr:"Το QR μου",history:"Ιστορικό",admin:"Διαχείριση",scan:"Σάρωση QR"};

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:font,color:C.cream,overflowX:"hidden"}}>
      <style>{CSS}</style>

      {/* Confetti */}
      {confetti && Array.from({length:24}).map((_,i)=>(
        <div key={i} style={{position:"fixed",pointerEvents:"none",zIndex:9999,left:`${8+Math.random()*84}%`,top:`${-4+Math.random()*8}%`,width:7,height:7,borderRadius:Math.random()>.5?"50%":"2px",background:[C.gold,"#fff","#e05050","#50c050","#5090e0"][i%5],animation:`confetti ${.7+Math.random()*1.3}s ease-in ${Math.random()*.6}s forwards`}}/>
      ))}

      {/* Notification */}
      {notification && (
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:notification.type==="err"?C.error:"#1a3a14",border:`1px solid ${notification.type==="err"?"#c44":"#4a9a3a"}`,color:C.cream,padding:"11px 22px",borderRadius:8,fontSize:15,zIndex:10000,animation:"notif .3s ease both",boxShadow:"0 4px 28px #00000099",whiteSpace:"nowrap"}}>
          {notification.msg}
        </div>
      )}

      {/* Admin Alert Banner */}
      {alerts.length>0 && user?.admin && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9998,background:C.error,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",animation:"alertPulse 1.5s ease infinite"}}>
          <div style={{fontSize:30,fontWeight:600}}>🚨 {alerts[0].msg}</div>
          <button onClick={()=>dismissAlert(alerts[0].id)} style={{background:"none",border:"1px solid #ffffff55",borderRadius:6,color:C.cream,fontSize:12,padding:"4px 10px",cursor:"pointer"}}>Dismiss</button>
        </div>
      )}

      {/* Pending orders badge for admin */}
      {pendingOrders.length>0 && user?.admin && screen!=="admin" && (
        <div style={{position:"fixed",bottom:20,right:20,zIndex:9000,background:C.error,color:"#fff",borderRadius:50,width:50,height:50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 4px 16px #00000088",cursor:"pointer",animation:"badgePop .3s ease"}} onClick={()=>{setAdminTab("orders");setScreen("admin");}}>
          🔔<span style={{position:"absolute",top:-4,right:-4,background:"#fff",color:C.error,borderRadius:"50%",width:20,height:20,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{pendingOrders.length}</span>
        </div>
      )}

      <div style={{maxWidth:460,margin:"0 auto",padding:`${alerts.length>0&&user?.admin?"56px":"0"} 0 60px`}}>

        {/* HEADER */}
        <div style={{padding:"26px 22px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:11,letterSpacing:5,color:C.gold,textTransform:"uppercase",marginBottom:3}}>barista.gr</div>
            <div style={{fontSize:26,fontWeight:400,letterSpacing:.5}}>{screenTitle[screen]||""}</div>
          </div>
          {user && (
            <button onClick={()=>{setCurrentUser(null);setScreen("login");setLoginEmail("");setCart([]);}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:12,padding:"6px 12px",cursor:"pointer"}}>Έξοδος</button>
          )}
        </div>

        <div style={{height:1,background:`linear-gradient(90deg,transparent,${C.gold}55,transparent)`,margin:"16px 0"}}/>

        {/* NAV Customer */}
        {user&&!user.admin&&!["login","register","ordered"].includes(screen) && (
          <div style={{display:"flex",gap:6,padding:"0 22px",marginBottom:22}}>
            {[["home","🏠"],["menu","☕ Παραγγελία"],["qr","📱 QR"],["history","📋"]].map(([s,label])=>(
              <button key={s} onClick={()=>setScreen(s)} style={{flex:1,padding:"9px 4px",borderRadius:7,background:screen===s?C.gold:"transparent",border:`1px solid ${screen===s?C.gold:C.border}`,color:screen===s?C.bg:C.gold,fontSize:12,cursor:"pointer",transition:"all .18s",position:"relative"}}>
                {label}
                {s==="menu"&&cartCount>0&&<span style={{position:"absolute",top:-6,right:-4,background:C.error,color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{cartCount}</span>}
              </button>
            ))}
          </div>
        )}

        {/* NAV Admin */}
        {user?.admin && (
          <div style={{display:"flex",gap:6,padding:"0 22px",marginBottom:22}}>
            {[["orders","📋 Παραγγ."],["customers","👥 Πελάτες"],["scan","📷 Σάρωση"],["offers","🏷️ Προσφορές"],["alerts","🚨 Alerts"]].map(([t,label])=>(
              <button key={t} onClick={()=>{setAdminTab(t);setScreen(t==="scan"?"scan":"admin");}} style={{flex:1,padding:"9px 4px",borderRadius:7,fontSize:11,background:(screen==="scan"?t==="scan":adminTab===t&&screen==="admin")?C.gold:"transparent",border:`1px solid ${(screen==="scan"?t==="scan":adminTab===t&&screen==="admin")?C.gold:C.border}`,color:(screen==="scan"?t==="scan":adminTab===t&&screen==="admin")?C.bg:C.gold,cursor:"pointer",transition:"all .18s",position:"relative"}}>
                {label}
                {t==="orders"&&pendingOrders.length>0&&<span style={{position:"absolute",top:-6,right:-4,background:C.error,color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{pendingOrders.length}</span>}
                {t==="alerts"&&alerts.length>0&&<span style={{position:"absolute",top:-6,right:-4,background:C.error,color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{alerts.length}</span>}
              </button>
            ))}
          </div>
        )}

        <div style={{padding:"0 22px"}}>

          {/* ══ LOGIN ══════════════════════════════════════════ */}
          {screen==="login" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:20,alignItems:"center",paddingTop:12}}>
              <div style={{width:88,height:88,borderRadius:"50%",background:"radial-gradient(circle at 35% 35%,#d4a96a,#5e3c1a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,boxShadow:`0 0 50px ${C.gold}33`,animation:"pulse 2.5s infinite",marginTop:40}}>☕</div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22}}>Καλωσόρισες</div>
                <div style={{fontSize:14,color:C.muted,marginTop:4}}>Κάθε 5 καφέδες, 1 δωρεάν.</div>
              </div>
              <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}>
                <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="Email ή 'admin'" style={iStyle}/>
                <button onClick={handleLogin} style={primBtn}>Είσοδος →</button>
                <button onClick={()=>setScreen("register")} style={ghostBtn}>Νέος Λογαριασμός</button>
              </div>
              <div style={{fontSize:11,color:"#2e2a38",textAlign:"center",lineHeight:1.9}}>nikos@email.com · maria@email.com<br/>dimitris@email.com · admin</div>
            </div>
          )}

          {/* ══ REGISTER ═══════════════════════════════════════ */}
          {screen==="register" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:11}}>
              {[["name","Ονοματεπώνυμο","text"],["email","Email","email"],["phone","Τηλέφωνο","tel"]].map(([k,ph,t])=>(
                <input key={k} value={regForm[k]} type={t} onChange={e=>setRegForm(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={iStyle}/>
              ))}
              <button onClick={handleRegister} style={{...primBtn,marginTop:6}}>Δημιουργία Λογαριασμού</button>
              <button onClick={()=>setScreen("login")} style={ghostBtn}>← Πίσω</button>
            </div>
          )}

          {/* ══ HOME ═══════════════════════════════════════════ */}
          {screen==="home" && user && !user.admin && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* OFFERS BANNER */}
              {offers.filter(o=>o.active).length>0 && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {offers.filter(o=>o.active).map((offer,i)=>(
                    <div key={offer.id} style={{
                      background:offer.color, border:`1px solid ${offer.border}`,
                      borderRadius:12, padding:"14px 16px",
                      display:"flex", alignItems:"center", gap:12,
                      animation:`fadeUp .4s ease ${i*.1}s both`,
                    }}>
                      <div style={{fontSize:22}}>🏷️</div>
                      <div style={{fontSize:15, lineHeight:1.4}}>{offer.text}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{background:"linear-gradient(135deg,#1a1422 0%,#231a30 100%)",border:`1px solid ${C.border}`,borderRadius:16,padding:22,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",right:-30,top:-30,width:130,height:130,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}18,transparent 70%)`}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
                  <div>
                    <div style={{fontSize:10,letterSpacing:4,color:C.gold,marginBottom:5}}>ΚΑΡΤΑ ΠΙΣΤΟΤΗΤΑΣ</div>
                    <div style={{fontSize:17}}>{user.name}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:3}}>{user.purchases} παραγγελίες · €{user.totalSpent.toFixed(2)}</div>
                  </div>
                  {user.freeAvailable && <div style={{background:C.free,border:"1px solid #5a9e4a",color:"#9ae880",fontSize:11,padding:"5px 11px",borderRadius:20}}>🎁 ΔΩΡΕΑΝ</div>}
                </div>
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {Array.from({length:LOYALTY_GOAL}).map((_,i)=>(
                    <div key={i} style={{width:44,height:44,borderRadius:"50%",background:i<stampsNow?"radial-gradient(circle at 35% 35%,#d4a96a,#7a4e1a)":C.surface,border:`2px solid ${i<stampsNow?C.gold:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,animation:i<stampsNow?`stampPop .4s ease ${i*.07}s both`:"none",boxShadow:i<stampsNow?`0 0 10px ${C.gold}44`:"none"}}>
                      {i<stampsNow?"☕":""}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:13,color:C.muted}}>
                  {user.freeAvailable?"🎉 Έχεις δωρεάν καφέ! Δείξε το QR σου.":`${toFree(user.purchases)} ακόμα για δωρεάν καφέ`}
                </div>
                {userCooldown>0 && <div style={{marginTop:10,background:"#2a1a30",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.muted}}>⏱ Επόμενη σφραγίδα σε ~<span style={{color:C.gold}}>{Math.ceil(userCooldown/60000)} λεπτά</span></div>}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <button onClick={()=>setScreen("menu")} style={{background:C.gold,border:"none",borderRadius:12,padding:"18px 12px",color:C.bg,cursor:"pointer",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
                  <span style={{fontSize:26}}>☕</span>
                  <span style={{fontSize:15,fontWeight:600,fontFamily:font}}>Παραγγελία</span>
                  <span style={{fontSize:11,opacity:.7,fontFamily:font}}>Επίλεξε καφέ</span>
                </button>
                <button onClick={()=>setScreen("qr")} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 12px",color:C.cream,cursor:"pointer",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
                  <span style={{fontSize:26}}>📱</span>
                  <span style={{fontSize:15,fontWeight:600,fontFamily:font}}>QR Μου</span>
                  <span style={{fontSize:11,color:C.muted,fontFamily:font}}>Σάρωση & σφραγίδα</span>
                </button>
              </div>

              {userOrders.filter(o=>o.status==="pending"||o.status==="confirmed").length>0 && (
                <div style={{background:"#1a2010",border:"1px solid #3a5020",borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:11,letterSpacing:3,color:"#8abe6a",marginBottom:8}}>ΕΝΕΡΓΗ ΠΑΡΑΓΓΕΛΙΑ</div>
                  {userOrders.filter(o=>o.status==="pending"||o.status==="confirmed").slice(0,1).map(o=>(
                    <div key={o.id}>
                      <div style={{fontSize:14,marginBottom:4}}>{o.items.join(", ")}</div>
                      <div style={{fontSize:12,color:C.muted}}>€{o.total.toFixed(2)} · {o.status==="pending"?"⏳ Αναμονή επιβεβαίωσης":"✓ Επιβεβαιώθηκε — ετοιμάζεται!"}</div>
                    </div>
                  ))}
                </div>
              )}

              {userLogs.length>0 && (
                <div>
                  <div style={{fontSize:11,letterSpacing:3,color:C.gold,marginBottom:10}}>ΤΕΛΕΥΤΑΙΕΣ ΣΦΡΑΓΙΔΕΣ</div>
                  {userLogs.slice(0,3).map(l=>(
                    <div key={l.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7,display:"flex",justifyContent:"space-between"}}>
                      <div style={{fontSize:13}}>☕ +1 σφραγίδα {l.note&&<span style={{color:"#9ae880"}}>{l.note}</span>}</div>
                      <div style={{fontSize:11,color:C.muted}}>{fmtDate(l.ts)} {fmtTime(l.ts)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ MENU ═══════════════════════════════════════════ */}
          {screen==="menu" && user && !user.admin && (
            <div className="fadeUp">
              {["Ζεστά","Κρύα"].map(cat=>(
                <div key={cat} style={{marginBottom:22}}>
                  <div style={{fontSize:11,letterSpacing:3,color:C.gold,marginBottom:10}}>{cat==="Ζεστά"?"☕ ΖΕΣΤΟΙ ΚΑΦΕΔΕΣ":"🧊 ΚΡΥΟΙ ΚΑΦΕΔΕΣ"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {MENU.filter(m=>m.cat===cat).map(item=>{
                      const inCart = cart.find(i=>i.id===item.id);
                      return (
                        <button key={item.id} onClick={()=>addItem(item)} style={{background:inCart?"#231d12":C.card,border:`1px solid ${inCart?C.gold:C.border}`,borderRadius:11,padding:"14px 12px",cursor:"pointer",textAlign:"left",color:C.cream,transition:"all .18s",display:"flex",flexDirection:"column",gap:4}}>
                          <div style={{fontSize:24}}>{item.emoji}</div>
                          <div style={{fontSize:14,lineHeight:1.3}}>{item.name}</div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
                            <div style={{fontSize:14,color:C.gold}}>€{item.price.toFixed(2)}</div>
                            {inCart&&<div style={{fontSize:12,color:C.gold,background:`${C.gold}22`,padding:"2px 7px",borderRadius:10}}>×{inCart.qty}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {cart.length>0 && (
                <button onClick={()=>setScreen("cart")} style={{...primBtn,display:"flex",justifyContent:"space-between",marginTop:8}}>
                  <span>Καλάθι ({cartCount})</span><span>€{cartTotal.toFixed(2)} →</span>
                </button>
              )}
            </div>
          )}

          {/* ══ CART ═══════════════════════════════════════════ */}
          {screen==="cart" && user && !user.admin && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:12}}>
              {cart.map(item=>(
                <div key={item.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:15}}>{item.name}</div>
                    <div style={{fontSize:13,color:C.gold,marginTop:2}}>€{(item.price*item.qty).toFixed(2)}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <button onClick={()=>changeQty(item.id,-1)} style={qtyBtn}>−</button>
                    <span style={{fontSize:15,minWidth:20,textAlign:"center"}}>{item.qty}</span>
                    <button onClick={()=>changeQty(item.id,1)} style={qtyBtn}>+</button>
                    <button onClick={()=>removeItem(item.id)} style={{...qtyBtn,color:"#e05050",borderColor:"#6a2020"}}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:C.muted}}>Σύνολο</span>
                  <span style={{color:C.gold,fontSize:20}}>€{cartTotal.toFixed(2)}</span>
                </div>
                <div style={{fontSize:12,color:C.muted}}>Πληρωμή στο ταμείο ή κατά την παράδοση</div>
              </div>
              <button onClick={placeOrder} style={primBtn}>📨 Αποστολή Παραγγελίας</button>
              <button onClick={()=>setScreen("menu")} style={ghostBtn}>← Πίσω στο Μενού</button>
            </div>
          )}

          {/* ══ ORDERED CONFIRMATION ════════════════════════════ */}
          {screen==="ordered" && user && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,paddingTop:10}}>
              <div style={{fontSize:70}}>📨</div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:8}}>Η παραγγελία στάλθηκε!</div>
                <div style={{fontSize:14,color:C.muted,lineHeight:1.7}}>Ο barista θα επιβεβαιώσει σύντομα.<br/>Θα λάβεις τη σφραγίδα σου αυτόματα.</div>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",width:"100%"}}>
                <div style={{fontSize:11,letterSpacing:3,color:C.gold,marginBottom:10}}>ΚΑΡΤΑ ΠΙΣΤΟΤΗΤΑΣ</div>
                <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}>
                  {Array.from({length:LOYALTY_GOAL}).map((_,i)=>(
                    <div key={i} style={{width:38,height:38,borderRadius:"50%",background:i<stampsNow?"radial-gradient(circle at 35% 35%,#d4a96a,#7a4e1a)":C.surface,border:`2px solid ${i<stampsNow?C.gold:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>
                      {i<stampsNow?"☕":""}
                    </div>
                  ))}
                </div>
                <div style={{textAlign:"center",fontSize:13,color:C.muted}}>{stampsNow}/{LOYALTY_GOAL} σφραγίδες</div>
              </div>
              <button onClick={()=>setScreen("home")} style={primBtn}>← Αρχική</button>
            </div>
          )}

          {/* ══ QR (customer) ══════════════════════════════════ */}
          {screen==="qr" && user && !user.admin && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
              <div style={{fontSize:14,color:C.muted,textAlign:"center",lineHeight:1.8}}>Δείξε αυτόν τον κωδικό στον barista<br/>μετά από κάθε αγορά για να κερδίσεις σφραγίδα.</div>
              <div style={{background:"#fff",borderRadius:18,padding:22,display:"flex",flexDirection:"column",alignItems:"center",gap:14,boxShadow:`0 0 60px ${C.gold}44`}}>
                {qrDataURL ? <img src={qrDataURL} alt="QR" style={{width:180,height:180,imageRendering:"pixelated"}}/> : <div style={{width:180,height:180,background:"#f0f0f0",borderRadius:8}}/>}
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:14,color:"#1a0f00",fontWeight:600}}>{user.name}</div>
                  <div style={{fontSize:11,color:"#888",marginTop:2}}>{user.id} · barista.gr loyalty</div>
                </div>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",width:"100%",textAlign:"center"}}>
                <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:10}}>
                  {Array.from({length:LOYALTY_GOAL}).map((_,i)=>(
                    <div key={i} style={{width:36,height:36,borderRadius:"50%",background:i<stampsNow?"radial-gradient(circle at 35% 35%,#d4a96a,#7a4e1a)":C.surface,border:`2px solid ${i<stampsNow?C.gold:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                      {i<stampsNow?"☕":""}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:13,color:C.muted}}>{stampsNow}/{LOYALTY_GOAL} σφραγίδες{user.freeAvailable&&" · 🎁 Έχεις δωρεάν καφέ!"}</div>
                {userCooldown>0&&<div style={{fontSize:12,color:C.goldDim,marginTop:8}}>⏱ Επόμενη σφραγίδα σε ~{Math.ceil(userCooldown/60000)} λεπτά</div>}
              </div>
            </div>
          )}

          {/* ══ HISTORY ════════════════════════════════════════ */}
          {screen==="history" && user && !user.admin && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:8}}>
              {userLogs.length===0&&<div style={{textAlign:"center",color:C.muted,paddingTop:30,fontSize:15}}>Δεν υπάρχουν σφραγίδες ακόμα.</div>}
              {userLogs.map(l=>(
                <div key={l.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{fontSize:14}}>☕ +1 σφραγίδα</div>
                    <div style={{fontSize:12,color:C.gold}}>+1</div>
                  </div>
                  {l.note&&<div style={{fontSize:12,color:"#9ae880",marginBottom:4}}>{l.note}</div>}
                  <div style={{fontSize:11,color:C.muted}}>{fmtDate(l.ts)} στις {fmtTime(l.ts)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ══ ADMIN ORDERS ═══════════════════════════════════ */}
          {screen==="admin" && adminTab==="orders" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                {[["📋",pendingOrders.length,"Εκκρεμείς"],["✓",orders.filter(o=>o.status==="confirmed").length,"Επιβεβ."],["💰","€"+orders.reduce((s,o)=>s+o.total,0).toFixed(0),"Έσοδα"]].map(([e,v,l])=>(
                  <div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
                    <div style={{fontSize:20}}>{e}</div>
                    <div style={{fontSize:18,color:C.gold,marginTop:2}}>{v}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
                  </div>
                ))}
              </div>

              {orders.length===0&&<div style={{textAlign:"center",color:C.muted,paddingTop:20,fontSize:15}}>Δεν υπάρχουν παραγγελίες ακόμα.</div>}

              {orders.map(o=>(
                <div key={o.id} style={{background:C.card,border:`1px solid ${o.status==="pending"?C.gold:C.border}`,borderRadius:12,padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div>
                      <div style={{fontSize:15}}>{o.customer}</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{fmtTime(o.ts)} · #{o.id}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <div style={{fontSize:14,color:C.gold}}>€{o.total.toFixed(2)}</div>
                      <div style={{fontSize:10,padding:"3px 8px",borderRadius:12,background:o.status==="pending"?"#3a2a00":o.status==="confirmed"?"#1a3a10":"#1a2a3a",color:o.status==="pending"?C.gold:o.status==="confirmed"?"#8abe6a":"#6ab0e0",border:`1px solid ${o.status==="pending"?C.goldDim:o.status==="confirmed"?"#3a7020":"#2a5060"}`}}>
                        {o.status==="pending"?"⏳ Εκκρεμεί":o.status==="confirmed"?"✓ Επιβεβαιώθηκε":"✓ Έτοιμο"}
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:10}}>{o.items.join(", ")}</div>
                  {o.status==="pending" && (
                    <button onClick={()=>confirmOrder(o.id)} style={primBtn}>✓ Επιβεβαίωση & Σφραγίδα</button>
                  )}
                  {o.status==="confirmed" && (
                    <button onClick={()=>markReady(o.id)} style={{...ghostBtn,borderColor:"#3a7020",color:"#8abe6a"}}>☕ Έτοιμο για παραλαβή</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══ ADMIN CUSTOMERS ════════════════════════════════ */}
          {screen==="admin" && adminTab==="customers" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:10}}>
              {customers.map(c=>{
                const remaining = cooldownRemaining(c.lastStamp);
                return (
                  <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:15}}>{c.name}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{c.email}</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                        {c.freeAvailable&&<div style={{background:C.free,border:"1px solid #5a9e4a",color:"#9ae880",fontSize:10,padding:"3px 8px",borderRadius:14}}>ΔΩΡΕΑΝ</div>}
                        {remaining>0&&<div style={{background:"#2a1a10",border:`1px solid ${C.goldDim}`,color:C.goldDim,fontSize:10,padding:"3px 8px",borderRadius:14}}>⏱ {Math.ceil(remaining/60000)}′</div>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,marginBottom:10}}>
                      {Array.from({length:LOYALTY_GOAL}).map((_,i)=>(
                        <div key={i} style={{width:30,height:30,borderRadius:"50%",background:i<modulo(c.purchases)?"radial-gradient(circle at 35% 35%,#d4a96a,#7a4e1a)":C.surface,border:`2px solid ${i<modulo(c.purchases)?C.gold:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>
                          {i<modulo(c.purchases)?"☕":""}
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
                      <span>{c.purchases} παραγγελίες</span>
                      <span>{c.lastStamp?`Τελ. σφραγίδα: ${fmtTime(c.lastStamp)}`:"Χωρίς σφραγίδες"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ ADMIN SCAN ═════════════════════════════════════ */}
          {screen==="scan" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
              <div style={{fontSize:13,color:C.muted,textAlign:"center",lineHeight:1.8}}>Σαρώστε τον QR κωδικό του πελάτη.<br/><span style={{color:C.goldDim,fontSize:12}}>Μία σφραγίδα ανά 20 λεπτά ανά πελάτη.</span></div>
              <div style={{width:240,height:240,borderRadius:18,background:"#07060a",border:`1px solid ${C.border}`,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {[[0,0],[1,0],[0,1],[1,1]].map(([xi,yi],i)=>(
                  <div key={i} style={{position:"absolute",left:xi?undefined:10,right:xi?10:undefined,top:yi?undefined:10,bottom:yi?10:undefined,width:28,height:28,borderTop:yi===0?`3px solid ${C.gold}`:"none",borderBottom:yi===1?`3px solid ${C.gold}`:"none",borderLeft:xi===0?`3px solid ${C.gold}`:"none",borderRight:xi===1?`3px solid ${C.gold}`:"none"}}/>
                ))}
                {scanPhase==="idle"&&<div style={{fontSize:64,opacity:.1}}>▦</div>}
                {scanPhase==="scanning"&&<><div style={{position:"absolute",width:"100%",height:2,background:`linear-gradient(90deg,transparent,${C.gold},transparent)`,animation:"scanBeam 1.2s ease-in-out infinite"}}/><div style={{width:34,height:34,border:`3px solid ${C.gold}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/></>}
                {scanPhase==="found"&&scannedC&&<div style={{textAlign:"center",padding:16}}><div style={{fontSize:42,marginBottom:8}}>👤</div><div style={{fontSize:14}}>{scannedC.name.split(" ")[0]}</div><div style={{fontSize:12,color:C.gold,marginTop:4}}>{modulo(scannedC.purchases)}/{LOYALTY_GOAL} ☕</div></div>}
                {scanPhase==="blocked"&&scannedC&&<div style={{textAlign:"center",padding:16}}><div style={{fontSize:42,marginBottom:8}}>⏱</div><div style={{fontSize:13,color:"#e05050"}}>Αναμονή</div><div style={{fontSize:12,color:C.muted,marginTop:4}}>~{Math.ceil(cooldownRemaining(scannedC.lastStamp)/60000)} λεπτά</div></div>}
                {scanPhase==="success"&&<div style={{textAlign:"center"}}><div style={{fontSize:60,animation:"stampPop .4s ease"}}>✓</div></div>}
              </div>
              {scanPhase==="found"&&scannedC&&(
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",width:"100%"}}>
                  <div style={{fontSize:11,letterSpacing:3,color:C.gold,marginBottom:8}}>ΠΕΛΑΤΗΣ</div>
                  <div style={{fontSize:17,marginBottom:3}}>{scannedC.name}</div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{scannedC.purchases} παραγγελίες · Τελευταία: {scannedC.lastStamp?fmtTime(scannedC.lastStamp):"—"}</div>
                  <div style={{display:"flex",gap:7,marginBottom:14}}>
                    {Array.from({length:LOYALTY_GOAL}).map((_,i)=>(
                      <div key={i} style={{width:36,height:36,borderRadius:"50%",background:i<modulo(scannedC.purchases)?"radial-gradient(circle at 35% 35%,#d4a96a,#7a4e1a)":C.surface,border:`2px solid ${i<modulo(scannedC.purchases)?C.gold:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                        {i<modulo(scannedC.purchases)?"☕":""}
                      </div>
                    ))}
                  </div>
                  {scannedC.freeAvailable&&<div style={{background:C.free,border:"1px solid #5a9e4a",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#9ae880",marginBottom:12}}>🎁 Αυτός ο πελάτης έχει δωρεάν καφέ!</div>}
                  <button onClick={grantStampScan} style={primBtn}>☕ Χορήγηση Σφραγίδας</button>
                </div>
              )}
              {scanPhase==="blocked"&&scannedC&&(
                <div style={{background:"#2a1010",border:`1px solid ${C.error}`,borderRadius:12,padding:"14px 18px",width:"100%",textAlign:"center"}}>
                  <div style={{fontSize:14,color:"#e05050",marginBottom:4}}>❌ Cooldown ενεργό</div>
                  <div style={{fontSize:13,color:C.muted}}>{scannedC.name.split(" ")[0]} μπορεί να λάβει σφραγίδα σε ~{Math.ceil(cooldownRemaining(scannedC.lastStamp)/60000)} λεπτά.</div>
                  <button onClick={()=>{setScanPhase("idle");setScannedC(null);}} style={{...ghostBtn,marginTop:12}}>Ακύρωση</button>
                </div>
              )}
              {(scanPhase==="idle"||scanPhase==="success")&&(
                <button onClick={doScan} disabled={scanPhase!=="idle"} style={{...primBtn,background:scanPhase!=="idle"?C.border:C.gold,color:scanPhase!=="idle"?C.muted:C.bg,cursor:scanPhase!=="idle"?"default":"pointer"}}>
                  {scanPhase==="idle"?"📷 Σάρωση QR Πελάτη":"✓ Σφραγίδα χορηγήθηκε!"}
                </button>
              )}
              <div style={{fontSize:11,color:"#1e1a28",textAlign:"center"}}>Simulation · Η κάμερα ενεργοποιείται σε production</div>
            </div>
          )}

          {/* ══ ADMIN OFFERS ═══════════════════════════════════ */}
          {screen==="admin" && adminTab==="offers" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{fontSize:11,letterSpacing:3,color:C.gold,marginBottom:4}}>ΕΝΕΡΓΕΣ ΠΡΟΣΦΟΡΕΣ</div>

              {/* Add new offer */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:8}}>
                <div style={{fontSize:13,color:C.muted,marginBottom:10}}>Νέα Προσφορά</div>
                <input
                  value={offerForm.text}
                  onChange={e=>setOfferForm(p=>({...p,text:e.target.value}))}
                  placeholder="π.χ. 🧊 Freddo 1.50€ — Σήμερα μόνο!"
                  style={{...iStyle, marginBottom:10}}
                />
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {[
                    {label:"🔵 Μπλε",  color:"#1a2a3a", border:"#2a5a7a"},
                    {label:"🟣 Μωβ",   color:"#2a1a3a", border:"#5a2a7a"},
                    {label:"🟢 Πράσινο",color:"#1a2a10", border:"#3a6a20"},
                    {label:"🟡 Χρυσό", color:"#2a1e08", border:"#6a5020"},
                  ].map(opt=>(
                    <button key={opt.color} onClick={()=>setOfferForm(p=>({...p,color:opt.color,border:opt.border}))} style={{
                      flex:1, padding:"8px 4px", borderRadius:7, fontSize:11,
                      background: offerForm.color===opt.color ? opt.border : C.surface,
                      border:`1px solid ${offerForm.color===opt.color ? opt.border : C.border}`,
                      color:C.cream, cursor:"pointer",
                      fontFamily:font,
                    }}>{opt.label}</button>
                  ))}
                </div>
                <button onClick={()=>{
                  if (!offerForm.text.trim()) return;
                  setOffers(p=>[...p,{id:genId("O"),text:offerForm.text,active:true,color:offerForm.color,border:offerForm.border}]);
                  setOfferForm(p=>({...p,text:""}));
                  notify("✓ Προσφορά προστέθηκε!");
                }} style={primBtn}>+ Προσθήκη Προσφοράς</button>
              </div>

              {/* Existing offers */}
              {offers.length===0 && <div style={{textAlign:"center",color:C.muted,padding:"20px 0"}}>Δεν υπάρχουν προσφορές ακόμα.</div>}
              {offers.map(offer=>(
                <div key={offer.id} style={{background:offer.color,border:`1px solid ${offer.border}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{fontSize:14,lineHeight:1.5,flex:1}}>{offer.text}</div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{
                        setOffers(p=>p.map(o=>o.id===offer.id?{...o,active:!o.active}:o));
                        notify(offer.active?"Προσφορά απενεργοποιήθηκε":"Προσφορά ενεργοποιήθηκε!");
                      }} style={{background:"none",border:`1px solid ${offer.border}`,borderRadius:6,color:C.cream,fontSize:12,padding:"4px 10px",cursor:"pointer",fontFamily:font}}>
                        {offer.active?"⏸ Off":"▶ On"}
                      </button>
                      <button onClick={()=>{
                        setOffers(p=>p.filter(o=>o.id!==offer.id));
                        notify("Προσφορά διαγράφηκε.");
                      }} style={{background:"none",border:"1px solid #6a2020",borderRadius:6,color:"#e05050",fontSize:12,padding:"4px 10px",cursor:"pointer",fontFamily:font}}>✕</button>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:offer.active?"#9ae880":"#e05050",marginTop:8}}>
                    {offer.active?"● Ενεργή — εμφανίζεται σε όλους τους πελάτες":"○ Ανενεργή"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ ADMIN ALERTS ═══════════════════════════════════ */}
          {screen==="admin" && adminTab==="alerts" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:10}}>
              {alerts.length===0&&<div style={{textAlign:"center",color:C.muted,paddingTop:30,fontSize:15}}>✓ Δεν υπάρχουν ύποπτες δραστηριότητες.</div>}
              {alerts.map(a=>(
                <div key={a.id} style={{background:"#2a1010",border:`1px solid ${C.error}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{fontSize:14,color:"#e07070"}}>{a.msg}</div>
                    <button onClick={()=>dismissAlert(a.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>×</button>
                  </div>
                  <div style={{fontSize:11,color:C.muted}}>{fmtDate(a.ts)} · {fmtTime(a.ts)}</div>
                </div>
              ))}
              {alerts.length>0&&<button onClick={()=>setAlerts([])} style={ghostBtn}>Dismiss All</button>}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const iStyle = {background:"#110f14",border:"1px solid #2a2533",borderRadius:8,padding:"13px 16px",color:"#f0e8d8",fontSize:16,outline:"none",width:"100%"};
const primBtn = {background:"#c8a96e",border:"none",borderRadius:9,padding:"14px 20px",color:"#09080a",fontSize:16,cursor:"pointer",fontWeight:600,letterSpacing:.3,width:"100%",textAlign:"center",fontFamily:"'EB Garamond','Palatino Linotype',serif"};
const ghostBtn = {background:"transparent",border:"1px solid #2a2533",borderRadius:9,padding:"13px 20px",color:"#c8a96e",fontSize:15,cursor:"pointer",width:"100%",textAlign:"center",fontFamily:"'EB Garamond','Palatino Linotype',serif"};
const qtyBtn = {background:"#1c1710",border:"1px solid #2e2618",borderRadius:6,color:"#c8a96e",width:30,height:30,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'EB Garamond','Palatino Linotype',serif"};