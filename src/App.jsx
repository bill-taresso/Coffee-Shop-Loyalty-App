import { useState, useEffect, useCallback, useRef } from "react";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────
const SUPABASE_URL = "https://eayzuuqgjnraslkcwoxe.supabase.co";
const SUPABASE_KEY = "sb_publishable_UwPXec5AjP9PkCmVk5BmIw_0qYy1EY_";

const sb = {
  async select(table, query="") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" }
    });
    return r.json();
  },
  async insert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async update(table, data, match) {
    const q = Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&");
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`, {
      method: "PATCH",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async delete(table, match) {
    const q = Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&");
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
  }
};

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
const font = "Arial,sans-serif";

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

// Data loaded from Supabase

const genId  = (p) => p + Date.now().toString(36).toUpperCase().slice(-5);
const modulo = (p) => p % LOYALTY_GOAL;
const toFree = (p) => LOYALTY_GOAL - modulo(p);
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("el-GR",{hour:"2-digit",minute:"2-digit"});
const fmtDate = (ts) => new Date(ts).toLocaleDateString("el-GR",{day:"2-digit",month:"2-digit",year:"numeric"});
const cooldownRemaining = (ls) => { const d = COOLDOWN_MS-(Date.now()-ls); return d>0?d:0; };

export default function App() {
  const [customers, setCustomers]   = useState([]);
  const [logs, setLogs]             = useState([]);
  const [orders, setOrders]         = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [screen, setScreen]         = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotif]    = useState(null);
  const [loading, setLoading]       = useState(false);
  const [dbReady, setDbReady]       = useState(false);
  const [confetti, setConfetti]     = useState(false);
  const [adminTab, setAdminTab]     = useState("orders");
  const [loginEmail, setLoginEmail] = useState("");
  const [regForm, setRegForm]       = useState({name:"",email:"",phone:""});
  const [qrDataURL, setQrDataURL]   = useState(null);
  const [scanPhase, setScanPhase]   = useState("idle");
  const [scannedC, setScannedC]     = useState(null);
  const [cart, setCart]             = useState([]);
  const [sugar, setSugar]           = useState("Μέτριος");
  const [orderNote, setOrderNote]   = useState("");
  const [now, setNow]               = useState(Date.now());
  const [offers, setOffers]         = useState([
    { id:"O001", text:"🧊 Freddo Espresso μόνο 1.50€ — Σήμερα!", active:true, color:"#1a2a3a", border:"#2a5a7a" },
    { id:"O002", text:"⭐ Double stamps κάθε Τετάρτη!", active:true, color:"#2a1a3a", border:"#5a2a7a" },
  ]);
  const [offerForm, setOfferForm]   = useState({ text:"", color:"#1a2a10", border:"#3a6a20" });
  const [orderFilter, setOrderFilter] = useState("all"); // all | today | week | month
  const timerRef = useRef(null);

  // ── Load data from Supabase ──────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [custs, ords, logs_] = await Promise.all([
        sb.select("customers", "?order=created_at.asc"),
        sb.select("orders", "?order=created_at.desc"),
        sb.select("stamp_logs", "?order=stamped_at.desc"),
      ]);
      if (Array.isArray(custs)) {
        setCustomers(custs.map(c => ({
          id: c.id, name: c.name, email: c.email, phone: c.phone||"",
          purchases: c.purchases||0, totalSpent: parseFloat(c.total_spent||0),
          freeAvailable: c.free_available||false,
          joinDate: c.join_date||"", lastStamp: c.last_stamp ? new Date(c.last_stamp).getTime() : 0
        })));
      }
      if (Array.isArray(ords)) {
        setOrders(ords.map(o => ({
          id: o.id, customerId: o.customer_id, customer: o.customer_name,
          items: Array.isArray(o.items) ? o.items : JSON.parse(o.items||"[]"),
          sugar: o.sugar||"", note: o.note||"",
          total: parseFloat(o.total||0),
          ts: new Date(o.created_at).getTime(),
          status: o.status||"pending"
        })));
      }
      if (Array.isArray(logs_)) {
        setLogs(logs_.map(l => ({
          id: l.id, customerId: l.customer_id, customer: l.customer_name,
          ts: new Date(l.stamped_at).getTime(), note: l.note||""
        })));
      }
      setDbReady(true);
    } catch(e) {
      console.error("Supabase load error:", e);
      setDbReady(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Auto-refresh for admin (every 20 seconds) ─────────────────
  useEffect(() => {
    if (!currentUser?.admin) return;
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, [currentUser, loadData]);

  // ── Supabase Realtime for instant order notifications ──────────
  useEffect(() => {
    if (!currentUser?.admin) return;
    let channel;
    const connectRealtime = async () => {
      try {
        const ws = new WebSocket(
          `wss://eayzuuqgjnraslkcwoxe.supabase.co/realtime/v1/websocket?apikey=sb_publishable_UwPXec5AjP9PkCmVk5BmIw_0qYy1EY_&vsn=1.0.0`
        );
        ws.onopen = () => {
          ws.send(JSON.stringify({topic:"realtime:public:orders",event:"phx_join",payload:{},ref:"1"}));
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.event === "INSERT" || msg.event === "UPDATE") {
              loadData();
            }
          } catch {}
        };
        channel = ws;
      } catch(e) {}
    };
    connectRealtime();
    return () => { if (channel) channel.close(); };
  }, [currentUser, loadData]);

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

  // ── Auto-refresh for logged-in customer (every 30 sec) ──────────
  useEffect(() => {
    if (!currentUser || currentUser.admin) return;
    const interval = setInterval(() => {
      loadData().then(() => {
        // Update currentUser from fresh customers list
        setCustomers(prev => {
          const updated = prev.find(c => c.id === currentUser.id);
          if (updated) setCurrentUser(u => ({...u, ...updated}));
          return prev;
        });
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser, loadData]);

  // ── Session persistence ───────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("taresso_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        const age = Date.now() - (u.savedAt||0);
        if (age < 30*24*60*60*1000) {
          setCurrentUser(u);
          setScreen(u.admin ? "admin" : "home");
        } else {
          localStorage.removeItem("taresso_user");
        }
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("taresso_user", JSON.stringify({...currentUser, savedAt: Date.now()}));
    } else {
      localStorage.removeItem("taresso_user");
    }
  }, [currentUser]);

  // ── Auth ───────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (loginEmail.trim()==="admin") { setCurrentUser({admin:true,name:"Διαχειριστής"}); setScreen("admin"); return; }
    setLoading(true);
    try {
      const results = await sb.select("customers", `?email=eq.${encodeURIComponent(loginEmail.trim().toLowerCase())}`);
      if (!Array.isArray(results) || results.length===0) { notify("Δεν βρέθηκε λογαριασμός.","err"); setLoading(false); return; }
      const c = results[0];
      const user = { id:c.id, name:c.name, email:c.email, phone:c.phone||"", purchases:c.purchases||0, totalSpent:parseFloat(c.total_spent||0), freeAvailable:c.free_available||false, joinDate:c.join_date||"", lastStamp:c.last_stamp?new Date(c.last_stamp).getTime():0 };
      setCurrentUser(user);
      await loadData();
      setScreen("home");
    } catch(e) { notify("Σφάλμα σύνδεσης.","err"); }
    setLoading(false);
  };

  const handleRegister = async () => {
    const {name,email,phone} = regForm;
    if (!name||!email||!phone) { notify("Συμπλήρωσε όλα τα πεδία.","err"); return; }
    setLoading(true);
    try {
      const exists = await sb.select("customers", `?email=eq.${encodeURIComponent(email.toLowerCase())}`);
      if (Array.isArray(exists) && exists.length>0) { notify("Το email υπάρχει ήδη.","err"); setLoading(false); return; }
      const result = await sb.insert("customers", { name, email:email.toLowerCase(), phone, purchases:0, total_spent:0, free_available:false, join_date:new Date().toISOString().split("T")[0] });
      if (Array.isArray(result) && result.length>0) {
        const c = result[0];
        const newC = {id:c.id,name:c.name,email:c.email,phone:c.phone||"",purchases:0,totalSpent:0,freeAvailable:false,joinDate:c.join_date||"",lastStamp:0};
        setCustomers(p=>[...p,newC]); setCurrentUser(newC); notify("Καλωσόρισες! ☕"); setScreen("home");
      } else { notify("Σφάλμα εγγραφής.","err"); }
    } catch(e) { notify("Σφάλμα εγγραφής.","err"); }
    setLoading(false);
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
  const placeOrder = async () => {
    if (cart.length===0) return;
    setLoading(true);
    try {
      const result = await sb.insert("orders", {
        customer_id: currentUser.id,
        customer_name: currentUser.name,
        items: JSON.stringify(cart.map(i=>`${i.name}${i.qty>1?` ×${i.qty}`:""}`)),
        sugar: sugar,
        note: orderNote,
        total: cartTotal,
        status: "pending"
      });
      const newOrder = {
        id: Array.isArray(result)&&result[0] ? result[0].id : genId("ORD"),
        customerId: currentUser.id,
        customer: currentUser.name,
        items: cart.map(i=>`${i.name}${i.qty>1?` ×${i.qty}`:""}`),
        sugar, note: orderNote, total: cartTotal,
        ts: Date.now(), status: "pending"
      };
      setOrders(p=>[newOrder,...p]);
      setCart([]); setOrderNote(""); setSugar("Μέτριος");
      setScreen("ordered");
      notify("Η παραγγελία σου στάλθηκε! ☕");
    } catch(e) { notify("Σφάλμα αποστολής.","err"); }
    setLoading(false);
  };

  // ── Admin: confirm order → grant stamp ─────────────────────────
  const confirmOrder = async (orderId) => {
    const order = orders.find(o=>o.id===orderId);
    if (!order) return;
    const nowTs = Date.now();
    const customer = customers.find(c=>c.id===order.customerId);
    if (!customer) return;

    const remaining = cooldownRemaining(customer.lastStamp);
    if (remaining>0) { notify(`Cooldown ενεργό για ${customer.name.split(" ")[0]}! ~${Math.ceil(remaining/60000)} λεπτά ακόμα.`,"err"); return; }

    const newP    = customer.purchases + 1;
    const newFree = newP % LOYALTY_GOAL === 0;
    const recentStamps = logs.filter(l=>l.customerId===customer.id && nowTs-l.ts<60*60*1000);
    if (recentStamps.length>=ALERT_THRESH) {
      setAlerts(p=>[{id:genId("ALR"),msg:`⚠️ ${customer.name.split(" ")[0]}: ${recentStamps.length+1} σφραγίδες στην τελευταία ώρα!`,ts:nowTs,customerId:customer.id},...p]);
    }

    // Update Supabase
    try {
      await Promise.all([
        sb.update("customers", {
          purchases: newP,
          total_spent: customer.totalSpent + order.total,
          free_available: newFree,
          last_stamp: new Date(nowTs).toISOString()
        }, {id: customer.id}),
        sb.update("orders", { status: "confirmed" }, {id: orderId}),
        sb.insert("stamp_logs", {
          customer_id: customer.id,
          customer_name: customer.name,
          note: newFree ? "🎁 Δωρεάν καφέ κερδήθηκε!" : ""
        })
      ]);
    } catch(e) { console.error("Supabase confirm error:", e); }

    setCustomers(p=>p.map(c=>c.id===customer.id?{...c,purchases:newP,totalSpent:c.totalSpent+order.total,freeAvailable:newFree,lastStamp:nowTs}:c));
    setLogs(p=>[{id:genId("L"),customerId:customer.id,customer:customer.name,ts:nowTs,note:newFree?"🎁 Δωρεάν καφέ κερδήθηκε!":""},...p]);
    setOrders(p=>p.map(o=>o.id===orderId?{...o,status:"confirmed"}:o));
    if (newFree) { fireConfetti(); notify(`🎉 ${customer.name.split(" ")[0]} κέρδισε δωρεάν καφέ!`); }
    else notify(`✓ Παραγγελία επιβεβαιώθηκε · +1 σφραγίδα για ${customer.name.split(" ")[0]}!`);
  };

  const markReady = async (orderId) => {
    try { await sb.update("orders", {status:"ready"}, {id:orderId}); } catch(e) {}
    setOrders(p=>p.map(o=>o.id===orderId?{...o,status:"ready"}:o));
  };

  // ── QR Scan (staff) ─────────────────────────────────────────────
  const doScan = () => {
    setScanPhase("scanning");
    setTimeout(()=>{
      const target = customers[Math.floor(Math.random()*customers.length)];
      setScannedC(target);
      setScanPhase(cooldownRemaining(target.lastStamp)>0?"blocked":"found");
    },1800);
  };

  const grantStampScan = async () => {
    if (!scannedC) return;
    const nowTs = Date.now();
    const remaining = cooldownRemaining(scannedC.lastStamp);
    if (remaining>0) { notify(`Αναμονή ~${Math.ceil(remaining/60000)} λεπτά ακόμα.`,"err"); return; }
    const newP    = scannedC.purchases+1;
    const newFree = newP%LOYALTY_GOAL===0;
    const recentStamps = logs.filter(l=>l.customerId===scannedC.id&&nowTs-l.ts<60*60*1000);
    if (recentStamps.length>=ALERT_THRESH) setAlerts(p=>[{id:genId("ALR"),msg:`⚠️ ${scannedC.name.split(" ")[0]}: ${recentStamps.length+1} σφραγίδες στην τελευταία ώρα!`,ts:nowTs,customerId:scannedC.id},...p]);
    try {
      await Promise.all([
        sb.update("customers", {purchases:newP, free_available:newFree, last_stamp:new Date(nowTs).toISOString()}, {id:scannedC.id}),
        sb.insert("stamp_logs", {customer_id:scannedC.id, customer_name:scannedC.name, note:newFree?"🎁 Δωρεάν καφέ κερδήθηκε!":""})
      ]);
    } catch(e) { console.error("Scan stamp error:", e); }
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
          <div style={{fontSize:14,fontWeight:600}}>🚨 {alerts[0].msg}</div>
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
            <div style={{fontSize:11,letterSpacing:5,color:C.gold,textTransform:"uppercase",marginBottom:3}}>Taresso Artisan Coffee Roasters</div>
            <div style={{fontSize:26,fontWeight:400,letterSpacing:.5}}>{screenTitle[screen]||""}</div>
          </div>
          {user && (
            <button onClick={()=>{setCurrentUser(null);setScreen("login");setLoginEmail("");setCart([]);localStorage.removeItem("taresso_user");}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:12,padding:"6px 12px",cursor:"pointer"}}>Έξοδος</button>
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
              <img src="data:image/jpeg;base64,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a9aGM5SFXPyRKTyRGgVQTycZNAHmVFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAa+jf8fTf7h/mK6Wua0b/AI+m/wBw/wAxXS0Af//R/Ae6/wCPqb/fb+dV6sXX/H1N/vt/Oq9ABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAGpo2uaz4d1CLVtAvp9OvYCGjnt5GikQjuGUgiveE/a+/apSBrZfi74q8p12lf7YuyMHjH+sr5zooA6zxV478beOblLzxpr19rs8edr3txJcMu45ODIxxk8muToooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA19G/wCPpv8AcP8AMV0tc1o3/H03+4f5iuloA//S/Ae6/wCPqb/fb+dV6sXX/H1N/vt/Oq9ABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUU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" alt="Taresso" style={{width:260,height:"auto",marginTop:60,objectFit:"contain",mixBlendMode:"screen"}}/>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22}}>Καλωσόρισες</div>
                <div style={{fontSize:30,color:C.muted,marginTop:4}}>Κάθε 5 καφέδες, 1 δωρεάν.</div>
              </div>
              <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}>
                <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="Email ή 'admin'" style={iStyle}/>
                <button onClick={handleLogin} disabled={loading} style={{...primBtn,opacity:loading?0.6:1}}>{loading?"Φόρτωση...":"Είσοδος →"}</button>
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
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {["Σκέτος","Μέτριος","Γλυκός"].map(s=>(
                  <button key={s} onClick={()=>setSugar(s)} style={{flex:1,padding:"10px 4px",borderRadius:8,background:sugar===s?C.gold:"transparent",border:`1px solid ${sugar===s?C.gold:C.border}`,color:sugar===s?C.bg:C.gold,fontSize:13,cursor:"pointer",fontFamily:font}}>{s}</button>
                ))}
              </div>
              <textarea value={orderNote} onChange={e=>setOrderNote(e.target.value)} placeholder="Σχόλια παραγγελίας... (π.χ. χωρίς γάλα, extra shot)" style={{...iStyle,resize:"none",height:80,marginBottom:10}}/>
              <button onClick={placeOrder} disabled={loading} style={{...primBtn,opacity:loading?0.6:1}}>{loading?"Αποστολή...":"📨 Αποστολή Παραγγελίας"}</button>
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
              <div style={{fontSize:11,letterSpacing:3,color:C.gold,marginBottom:4}}>ΤΕΛΕΥΤΑΙΕΣ 10 ΠΑΡΑΓΓΕΛΙΕΣ</div>
              {userOrders.length===0&&<div style={{textAlign:"center",color:C.muted,paddingTop:20,fontSize:15}}>Δεν υπάρχουν παραγγελίες ακόμα.</div>}
              {userOrders.slice(0,10).map(o=>(
                <div key={o.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{fontSize:14}}>{o.items.join(", ")}</div>
                    <div style={{fontSize:13,color:C.gold}}>€{o.total.toFixed(2)}</div>
                  </div>
                  {o.sugar&&<div style={{fontSize:12,color:C.gold,marginBottom:3}}>🍬 {o.sugar}</div>}
                  {o.note&&<div style={{fontSize:12,color:"#a0c8e0",marginBottom:3}}>💬 {o.note}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}>
                    <span>{fmtDate(o.ts)} · {fmtTime(o.ts)}</span>
                    <span style={{color:o.status==="ready"?"#8abe6a":o.status==="confirmed"?C.gold:C.muted}}>
                      {o.status==="pending"?"⏳ Εκκρεμεί":o.status==="confirmed"?"✓ Επιβεβαιώθηκε":"☕ Έτοιμο"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ ADMIN ORDERS ═══════════════════════════════════ */}
          {screen==="admin" && adminTab==="orders" && (
            <div className="fadeUp" style={{display:"flex",flexDirection:"column",gap:10}}>

              {/* Stats */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:6}}>
                {[["📋",pendingOrders.length,"Εκκρεμείς"],["✓",orders.filter(o=>o.status==="ready").length,"Ολοκλ."],["💰","€"+orders.reduce((s,o)=>s+o.total,0).toFixed(0),"Έσοδα"]].map(([e,v,l])=>(
                  <div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
                    <div style={{fontSize:20}}>{e}</div>
                    <div style={{fontSize:18,color:C.gold,marginTop:2}}>{v}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Filter */}
              <div style={{display:"flex",gap:6,marginBottom:6}}>
                {[["all","Όλες"],["today","Σήμερα"],["week","Εβδομάδα"],["month","Μήνας"]].map(([f,label])=>(
                  <button key={f} onClick={()=>setOrderFilter(f)} style={{flex:1,padding:"8px 4px",borderRadius:7,fontSize:11,background:orderFilter===f?C.gold:"transparent",border:`1px solid ${orderFilter===f?C.gold:C.border}`,color:orderFilter===f?C.bg:C.gold,cursor:"pointer"}}>
                    {label}
                  </button>
                ))}
              </div>

              {(() => {
                const now2 = Date.now();
                const filtered = orders.filter(o => {
                  if (orderFilter==="today") return now2 - o.ts < 24*60*60*1000;
                  if (orderFilter==="week")  return now2 - o.ts < 7*24*60*60*1000;
                  if (orderFilter==="month") return now2 - o.ts < 30*24*60*60*1000;
                  return true;
                });
                const filteredRevenue = filtered.reduce((s,o)=>s+o.total,0);
                return (
                  <>
                    {orderFilter!=="all"&&<div style={{fontSize:12,color:C.muted,marginBottom:4,textAlign:"right"}}>
                      {filtered.length} παραγγελίες · €{filteredRevenue.toFixed(2)} έσοδα
                    </div>}
                    {filtered.length===0&&<div style={{textAlign:"center",color:C.muted,paddingTop:20,fontSize:15}}>Δεν υπάρχουν παραγγελίες.</div>}
                    {filtered.map(o=>(
                      <div key={o.id} style={{background:C.card,border:`1px solid ${o.status==="pending"?C.gold:C.border}`,borderRadius:12,padding:16}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                          <div>
                            <div style={{fontSize:15}}>{o.customer}</div>
                            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{fmtDate(o.ts)} · {fmtTime(o.ts)}</div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                            <div style={{fontSize:14,color:C.gold}}>€{o.total.toFixed(2)}</div>
                            <div style={{fontSize:10,padding:"3px 8px",borderRadius:12,background:o.status==="pending"?"#3a2a00":o.status==="confirmed"?"#1a3a10":"#1a2a3a",color:o.status==="pending"?C.gold:o.status==="confirmed"?"#8abe6a":"#6ab0e0",border:`1px solid ${o.status==="pending"?C.goldDim:o.status==="confirmed"?"#3a7020":"#2a5060"}`}}>
                              {o.status==="pending"?"⏳ Εκκρεμεί":o.status==="confirmed"?"✓ Επιβεβαιώθηκε":"☕ Έτοιμο"}
                            </div>
                          </div>
                        </div>
                        <div style={{fontSize:13,color:C.muted,marginBottom:4}}>{o.items.join(", ")}</div>
                        {o.sugar&&<div style={{fontSize:12,color:C.gold,marginBottom:4}}>🍬 {o.sugar}</div>}
                        {o.note&&<div style={{fontSize:12,color:"#a0c8e0",marginBottom:10}}>💬 {o.note}</div>}
                        {o.status==="pending"&&<button onClick={()=>confirmOrder(o.id)} style={primBtn}>✓ Επιβεβαίωση & Σφραγίδα</button>}
                        {o.status==="confirmed"&&<button onClick={()=>markReady(o.id)} style={{...ghostBtn,borderColor:"#3a7020",color:"#8abe6a"}}>☕ Έτοιμο για παραλαβή</button>}
                      </div>
                    ))}
                  </>
                );
              })()}
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
