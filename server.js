require("dotenv").config();
const express=require("express"), helmet=require("helmet"), rateLimit=require("express-rate-limit");
const cookieParser=require("cookie-parser"), bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken");
const Database=require("better-sqlite3"), path=require("path");
const fs=require("fs");
const app=express();
const dbFile=process.env.DB_FILE||path.join(__dirname,"data.sqlite");
fs.mkdirSync(path.dirname(path.resolve(dbFile)),{recursive:true});
const db=new Database(dbFile);
app.set("trust proxy",1);
const PORT=process.env.PORT||3000, OWNER=(process.env.OWNER_USERNAME||"FernzzX").trim();
const SECRET=process.env.JWT_SECRET;
if(!SECRET || SECRET.length<32){console.error("JWT_SECRET wajib diisi dengan random secret minimal 32 karakter.");process.exit(1);}
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, is_premium INTEGER NOT NULL DEFAULT 0, is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS usage(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,tool TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,title TEXT NOT NULL,body TEXT NOT NULL,read_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,plan TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',provider_ref TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,paid_at TEXT);
CREATE TABLE IF NOT EXISTS credit_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,delta INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:"32kb"})); app.use(cookieParser());
app.use(express.static(path.join(__dirname,"public")));
const authLimit=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false});
function tokenFor(u){return jwt.sign({id:u.id,username:u.username},SECRET,{expiresIn:"7d"});}
function safeUser(u){return {id:u.id,username:u.username,isPremium:!!u.is_premium,isAdmin:!!u.is_admin,createdAt:u.created_at};}
function auth(req,res,next){try{const t=req.cookies.fernzz_session;if(!t)return res.status(401).json({error:"Silakan login."});const p=jwt.verify(t,SECRET);const u=db.prepare("SELECT * FROM users WHERE id=?").get(p.id);if(!u)return res.status(401).json({error:"Akun tidak ditemukan."});req.user=u;next();}catch{return res.status(401).json({error:"Sesi berakhir. Silakan login kembali."});}}
function admin(req,res,next){if(!req.user.is_admin)return res.status(403).json({error:"Khusus admin."});next();}
function logUse(user,tool){db.prepare("INSERT INTO usage(user_id,tool) VALUES(?,?)").run(user.id,tool);}
function monthlyUsage(userId){return db.prepare("SELECT COUNT(*) n FROM usage WHERE user_id=? AND created_at >= datetime('now','start of month')").get(userId).n;}
function quotaCheck(req,res,next){const premium=!!req.user.is_premium;const limit=premium?1000:30;const used=monthlyUsage(req.user.id);res.set("X-Usage-Limit",String(limit));res.set("X-Usage-Remaining",String(Math.max(0,limit-used)));if(used>=limit)return res.status(429).json({error:"Kuota bulanan habis.",used,limit,upgrade:"Premium mendapatkan kuota lebih besar."});next();}
function balance(userId){return db.prepare("SELECT COALESCE(SUM(delta),0) n FROM credit_ledger WHERE user_id=?").get(userId).n;}
function bootstrapOwner(){
 const pass=process.env.OWNER_PASSWORD;
 if(!pass){console.warn("OWNER_PASSWORD belum diisi. Buat akun owner secara manual lalu set admin melalui konfigurasi awal.");return;}
 if(pass.length<12){console.error("OWNER_PASSWORD minimal 12 karakter.");process.exit(1);}
 const hash=bcrypt.hashSync(pass,12);
 const old=db.prepare("SELECT * FROM users WHERE username=?").get(OWNER);
 if(!old) db.prepare("INSERT INTO users(username,password_hash,is_premium,is_admin) VALUES(?,?,1,1)").run(OWNER,hash);
 else db.prepare("UPDATE users SET is_admin=1,is_premium=1 WHERE id=?").run(old.id);
}
bootstrapOwner();
app.get("/api/health",(req,res)=>res.json({ok:true,service:"All Tools Mas Fernzz",version:"4.1"}));
app.post("/api/register",authLimit,async(req,res)=>{
 const username=String(req.body.username||"").trim(),password=String(req.body.password||"");
 if(!/^[a-zA-Z0-9_]{3,24}$/.test(username))return res.status(400).json({error:"Username 3-24 karakter: huruf, angka, underscore."});
 if(password.length<10)return res.status(400).json({error:"Password minimal 10 karakter."});
 if(username.toLowerCase()===OWNER.toLowerCase())return res.status(409).json({error:"Username owner tidak dapat didaftarkan."});
 try{const hash=await bcrypt.hash(password,12);const info=db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(username,hash);const u=db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);res.cookie("fernzz_session",tokenFor(u),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:7*864e5});res.json({user:safeUser(u)});}catch{res.status(409).json({error:"Username sudah digunakan."});}
});
app.post("/api/login",authLimit,async(req,res)=>{
 const username=String(req.body.username||"").trim(),password=String(req.body.password||"");
 const u=db.prepare("SELECT * FROM users WHERE username=?").get(username);
 if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:"Username atau password salah."});
 res.cookie("fernzz_session",tokenFor(u),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:7*864e5});res.json({user:safeUser(u)});
});
app.post("/api/logout",(req,res)=>{res.clearCookie("fernzz_session",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"});res.json({ok:true});});
app.get("/api/me",auth,(req,res)=>res.json({user:safeUser(req.user),usage:{used:monthlyUsage(req.user.id),limit:req.user.is_premium?1000:30},credits:balance(req.user.id)}));
app.get("/api/account",auth,(req,res)=>{
 const orders=db.prepare("SELECT id,plan,amount,status,created_at,paid_at FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 30").all(req.user.id);
 const history=db.prepare("SELECT tool,created_at FROM usage WHERE user_id=? ORDER BY id DESC LIMIT 30").all(req.user.id);
 const notices=db.prepare("SELECT id,title,body,read_at,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30").all(req.user.id);
 res.json({orders,history,notifications:notices,credits:balance(req.user.id),usage:{used:monthlyUsage(req.user.id),limit:req.user.is_premium?1000:30}});
});
app.post("/api/account/notification/read",auth,(req,res)=>{
 const id=Number(req.body.id);db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(id,req.user.id);res.json({ok:true});
});
app.post("/api/orders",auth,(req,res)=>{
 const plan=String(req.body.plan||"").toLowerCase();const plans={premium_monthly:29000,premium_yearly:249000};
 if(!plans[plan])return res.status(400).json({error:"Paket tidak dikenal."});
 if(req.user.is_premium)return res.status(400).json({error:"Akun sudah Premium."});
 const info=db.prepare("INSERT INTO orders(user_id,plan,amount) VALUES(?,?,?)").run(req.user.id,plan,plans[plan]);
 db.prepare("INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)").run(req.user.id,"Permintaan paket dibuat","Pesanan #"+info.lastInsertRowid+" menunggu pembayaran dan verifikasi admin.");
 res.json({orderId:info.lastInsertRowid,amount:plans[plan],status:"pending",message:"Pesanan dibuat. Premium baru aktif setelah pembayaran diverifikasi."});
});
app.get("/api/account/usage",auth,(req,res)=>res.json({used:monthlyUsage(req.user.id),limit:req.user.is_premium?1000:30,credits:balance(req.user.id)}));
app.get("/api/admin/users",auth,admin,(req,res)=>{const users=db.prepare("SELECT id,username,is_premium,is_admin,created_at FROM users ORDER BY id DESC LIMIT 500").all();res.json({users:users.map(safeUser)});});
app.post("/api/admin/premium",auth,admin,(req,res)=>{const id=Number(req.body.userId),active=!!req.body.active;if(!Number.isInteger(id))return res.status(400).json({error:"ID tidak valid."});const target=db.prepare("SELECT * FROM users WHERE id=?").get(id);if(!target)return res.status(404).json({error:"Pengguna tidak ditemukan."});if(target.username.toLowerCase()===OWNER.toLowerCase()&&!active)return res.status(400).json({error:"Premium owner tidak dapat dinonaktifkan."});db.prepare("UPDATE users SET is_premium=? WHERE id=?").run(active?1:0,id);res.json({ok:true});});
app.get("/api/admin/orders",auth,admin,(req,res)=>{const rows=db.prepare("SELECT orders.*,users.username FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.id DESC LIMIT 100").all();res.json({orders:rows});});
app.post("/api/admin/orders/verify",auth,admin,(req,res)=>{
 const id=Number(req.body.orderId);const order=db.prepare("SELECT * FROM orders WHERE id=?").get(id);
 if(!order)return res.status(404).json({error:"Pesanan tidak ditemukan."});
 if(order.status!=="pending")return res.status(400).json({error:"Pesanan bukan pending."});
 // Manual verification only: admin must verify the real payment in the payment provider dashboard first.
 const tx=db.transaction(()=>{
  db.prepare("UPDATE orders SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  db.prepare("UPDATE users SET is_premium=1 WHERE id=?").run(order.user_id);
  db.prepare("INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)").run(order.user_id,"Premium aktif","Pembayaran pesanan #"+id+" telah diverifikasi admin. Premium aktif.");
 });
 tx();res.json({ok:true,message:"Status diperbarui setelah verifikasi pembayaran manual."});
});
app.post("/api/admin/credits",auth,admin,(req,res)=>{
 const userId=Number(req.body.userId),delta=Number(req.body.delta),reason=String(req.body.reason||"Penyesuaian admin").slice(0,120);
 if(!Number.isInteger(userId)||!Number.isInteger(delta)||delta===0||Math.abs(delta)>100000)return res.status(400).json({error:"Data kredit tidak valid."});
 db.prepare("INSERT INTO credit_ledger(user_id,delta,reason) VALUES(?,?,?)").run(userId,delta,reason);res.json({ok:true});
});
app.get("/api/admin/stats",auth,admin,(req,res)=>{const total=db.prepare("SELECT COUNT(*) n FROM users").get().n,premium=db.prepare("SELECT COUNT(*) n FROM users WHERE is_premium=1").get().n,uses=db.prepare("SELECT COUNT(*) n FROM usage").get().n;res.json({total,premium,uses});});
app.get("/api/prayer",auth,quotaCheck,async(req,res)=>{try{const city=String(req.query.city||"Surabaya").slice(0,80);const url="https://api.aladhan.com/v1/timingsByCity?city="+encodeURIComponent(city)+"&country=Indonesia&method=20";const r=await fetch(url);if(!r.ok)throw Error("provider");const d=await r.json();logUse(req.user,"prayer");res.json({city,timings:d.data.timings,date:d.data.date.readable});}catch{res.status(502).json({error:"Jadwal sholat tidak tersedia saat ini."});}});
app.get("/api/weather",auth,quotaCheck,async(req,res)=>{try{const lat=Number(req.query.lat),lon=Number(req.query.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return res.status(400).json({error:"Koordinat tidak valid."});const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m`;const r=await fetch(url);if(!r.ok)throw Error("provider");const d=await r.json();logUse(req.user,"weather");res.json(d.current);}catch{res.status(502).json({error:"Data cuaca tidak tersedia."});}});
app.get("/api/ip",(req,res)=>{res.json({note:"IP publik hanya perkiraan lokasi jaringan. Gunakan layanan lookup secara etis."});});
function isHttpsUrl(value){
 try{const u=new URL(String(value));return u.protocol==="https:" && !u.username && !u.password;}catch{return false;}
}
function allowedSource(provider, raw){
 try{
  const u=new URL(raw);if(u.protocol!=="https:")return false;
  const h=u.hostname.toLowerCase();
  const allowed={
   tiktok:["tiktok.com","www.tiktok.com","vm.tiktok.com","vt.tiktok.com"],
   instagram:["instagram.com","www.instagram.com"],
   capcut:["capcut.com","www.capcut.com","capcut.net","www.capcut.net"]
  }[provider]||[];
  return allowed.some(d=>h===d||h.endsWith("."+d));
 }catch{return false;}
}
function normalizeCobalt(data){
 const status=String(data.status||"");
 if(status==="error")return {error:"Cobalt menolak permintaan: "+String(data.error||"unknown").slice(0,100)};
 if(status==="picker"){
  const items=(Array.isArray(data.picker)?data.picker:[]).filter(x=>x&&isHttpsUrl(x.url)).slice(0,20).map(x=>({url:x.url,type:x.type||"media",thumb:isHttpsUrl(x.thumb)?x.thumb:null}));
  return {status,filename:data.filename||null,items};
 }
 if(["tunnel","redirect"].includes(status)&&isHttpsUrl(data.url)){
  return {status,download_url:data.url,filename:data.filename||"media"};
 }
 return {error:"Format jawaban provider tidak dikenali. Periksa versi API."};
}
app.post("/api/downloader/:provider",auth,quotaCheck,async(req,res)=>{
 const provider=String(req.params.provider).toLowerCase();
 if(!["tiktok","instagram","capcut"].includes(provider))return res.status(404).json({error:"Provider tidak dikenal."});
 const url=String(req.body.url||"").trim();
 if(url.length>2000||!allowedSource(provider,url))return res.status(400).json({error:"URL tidak valid atau bukan tautan "+provider+"."});
 // TikTok/Instagram use a self-hosted or explicitly authorized Cobalt-compatible API.
 // CapCut needs a separate provider because Cobalt does not list CapCut as supported.
 const isCobalt=provider!=="capcut" && !!process.env.COBALT_API_URL;
 const endpoint=isCobalt?process.env.COBALT_API_URL:process.env[provider.toUpperCase()+"_API_URL"];
 const key=isCobalt?(process.env.COBALT_API_KEY||""):process.env[provider.toUpperCase()+"_API_KEY"];
 if(!endpoint)return res.status(503).json({error:provider==="capcut"?"API CapCut belum dikonfigurasi admin.":"API downloader belum dikonfigurasi. Admin perlu memasang instance Cobalt sendiri atau API provider yang diizinkan."});
 if(!isHttpsUrl(endpoint))return res.status(500).json({error:"URL endpoint API harus HTTPS."});
 try{
  const headers={"Content-Type":"application/json","Accept":"application/json"};
  if(key)headers.Authorization="Bearer "+key;
  const payload=isCobalt?{url,videoQuality:"1080",downloadMode:"auto",filenameStyle:"pretty"}:{url};
  const r=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(30000),redirect:"error"});
  const raw=await r.text();
  if(!r.ok)return res.status(502).json({error:"Provider API gagal merespons.",providerStatus:r.status});
  let data;try{data=JSON.parse(raw);}catch{return res.status(502).json({error:"Provider tidak mengembalikan JSON yang valid."});}
  let result;
  if(isCobalt)result=normalizeCobalt(data);
  else {
   // Common API response shapes are normalized for the website UI.
   const candidates=[data.download_url,data.video_url,data.url,data.play,data.nowm,data.no_watermark,data.result?.download_url,data.result?.url,data.data?.download_url,data.data?.url,data.data?.play,data.data?.nowm];
   const link=candidates.find(isHttpsUrl);
   result=link?{status:"ready",download_url:link,filename:data.filename||data.title||data.data?.title||"media"}:{error:String(data.message||data.error||"Provider belum mengembalikan link unduhan yang dikenali.").slice(0,180)};
  }
  if(result.error)return res.status(502).json(result);
  logUse(req.user,"downloader_"+provider);
  res.json({...result,provider});
 }catch(err){
  const timeout=err&&err.name==="TimeoutError";
  res.status(502).json({error:timeout?"Provider terlalu lama merespons. Coba lagi nanti.":"Tidak dapat menghubungi API downloader. Periksa endpoint dan akses provider."});
 }
});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Terjadi kesalahan server."});});
app.listen(PORT,()=>console.log(`ALL TOOLS MAS FERNZZ V4 berjalan di port ${PORT}`));
