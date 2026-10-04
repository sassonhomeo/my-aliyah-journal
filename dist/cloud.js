(() => {
  const SUPABASE_URL = "https://fwmcujjzdcwqrddgejid.supabase.co";
  const SUPABASE_KEY = "sb_publishable_IA-iZFBxl_V24x8Z9Vtziw_Lm6ZWxCF";
  const KEYS = { posts:"my-aliyah-posts-v1", settings:"my-aliyah-settings-v1", journal:"my-aliyah-journal-v1" };
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null, ready = false, syncChain = Promise.resolve(), timers = {}, profilePhotoUrl = "";

  const esc = (v="") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const originalSet = Storage.prototype.setItem;
  const acknowledged = { post:new Map(), journal:new Map() };
  const CACHE_OWNER = "my-aliyah-cache-owner-v1";

  function entryRow(type, x){
    return {id:x.id,user_id:user.id,entry_type:type,title:type==="journal"?(x.title||null):null,body:type==="post"?(x.text||""):(x.body||""),mood:type==="post"?(x.mood||null):null,is_saved:type==="post"?!!x.saved:false,occurred_at:x.createdAt||new Date().toISOString()};
  }
  function remember(type, items){
    acknowledged[type]=new Map(items.map(x=>[x.id,JSON.stringify(entryRow(type,x))]));
  }
  function preserveCache(){
    const posts=read(KEYS.posts,[]), journal=read(KEYS.journal,[]);
    if(!posts.length && !journal.length) return;
    const owner=localStorage.getItem(CACHE_OWNER)||"unassigned";
    const key=`my-aliyah-recovery-v1:${owner}`;
    const snapshots=read(key,[]);
    const snapshot={posts,journalEntries:journal,savedAt:new Date().toISOString()};
    // Keep the largest copy as well as recent copies, before replacing any cache.
    const signature=x=>JSON.stringify([x.posts,x.journalEntries]);
    if(snapshots.some(x=>signature(x)===signature(snapshot)))return;
    snapshots.push(snapshot);
    const largest=[...snapshots].sort((a,b)=>(b.posts.length+b.journalEntries.length)-(a.posts.length+a.journalEntries.length))[0];
    const kept=[largest,...snapshots.filter(x=>x!==largest).slice(-4)];
    originalSet.call(localStorage,key,JSON.stringify(kept));
  }
  async function readAll(table){
    const rows=[];
    for(let offset=0;;offset+=500){
      const {data,error}=await client.from(table).select("*").eq("user_id",user.id).order("id",{ascending:true}).range(offset,offset+499);
      if(error)throw error;
      if(!Array.isArray(data))throw new Error(`Could not load ${table}.`);
      rows.push(...data);
      if(data.length<500)return rows;
    }
  }

  function authScreen(message=""){
    document.body.innerHTML = `<main class="auth-page">
      <section class="auth-card">
        <p class="auth-brand">My Aliyah Journal+</p>
        <h1>Welcome</h1>
        <p class="auth-intro">Sign in to keep your posts, photographs, journal and shipment information private and available on all your devices.</p>
        <button id="googleSignIn" class="secondary-button auth-secondary" type="button">Continue with Google</button>
        <p class="auth-message" style="margin:14px 0 8px">or sign in with email</p>
        <form id="authForm">
          <label>Email address<input id="authEmail" type="email" required autocomplete="email"></label>
          <label>Password<input id="authPassword" type="password" required minlength="8" autocomplete="current-password"></label>
          <button class="primary-button" type="submit">Sign in</button>
        </form>
        <button id="createAccount" class="secondary-button auth-secondary">Create an account</button>
        <p id="authMessage" class="auth-message" aria-live="polite">${esc(message)}</p>
      </section>
    </main>`;
    document.querySelector("#googleSignIn").addEventListener("click", async () => {
      setMessage("Opening Google sign in…");
      const { error } = await client.auth.signInWithOAuth({
        provider:"google",
        options:{ redirectTo:location.origin + location.pathname }
      });
      if(error) setMessage(error.message, true);
    });
    document.querySelector("#authForm").addEventListener("submit", async e => {
      e.preventDefault();
      setMessage("Signing in…");
      const email=document.querySelector("#authEmail").value.trim(), password=document.querySelector("#authPassword").value;
      const { error } = await client.auth.signInWithPassword({email,password});
      if(error) return setMessage(error.message, true);
      location.reload();
    });
    document.querySelector("#createAccount").addEventListener("click", async () => {
      const email=document.querySelector("#authEmail").value.trim(), password=document.querySelector("#authPassword").value;
      if(!email || password.length<8) return setMessage("Enter your email and a password of at least 8 characters.", true);
      setMessage("Creating your account…");
      const { data, error } = await client.auth.signUp({email,password,options:{emailRedirectTo:location.href}});
      if(error) return setMessage(error.message, true);
      if(data.session) location.reload();
      else setMessage("Check your email and click the confirmation link. Then return here and sign in.");
    });
  }
  function setMessage(text, bad=false){ const el=document.querySelector("#authMessage"); if(el){el.textContent=text;el.classList.toggle("error",bad);} }

  async function signedPhoto(path){
    if(!path) return "";
    const {data}=await client.storage.from("journal-photos").createSignedUrl(path,3600);
    return data?.signedUrl || "";
  }

  async function loadCloud(){
    const [profileResult,entries,photos,shipmentResult] = await Promise.all([
      client.from("profiles").select("*").eq("id",user.id).maybeSingle(),
      readAll("entries"),
      readAll("photos"),
      client.from("shipments").select("*").eq("user_id",user.id).maybeSingle()
    ]);
    if(profileResult.error)throw profileResult.error;
    if(shipmentResult.error)throw shipmentResult.error;
    const profile=profileResult.data, shipment=shipmentResult.data;
    const photoMap={};
    for(const p of photos||[]) (photoMap[p.entry_id] ||= []).push(p);
    const posts=[], journal=[];
    entries.sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at) || String(b.id).localeCompare(String(a.id)));
    for(const e of entries){
      if(e.entry_type==="post"){
        const photo=(photoMap[e.id]||[]).sort((a,b)=>a.sort_order-b.sort_order)[0];
        posts.push({id:e.id,text:e.body,image:photo?await signedPhoto(photo.storage_path):"",_storagePath:photo?.storage_path||"",mood:e.mood||"",createdAt:e.occurred_at,timestamp:"",saved:e.is_saved});
      } else {
        journal.push({id:e.id,title:e.title||"",body:e.body,createdAt:e.occurred_at,date:""});
      }
    }
    const settings={name:profile?.display_name||user.user_metadata?.full_name||user.email.split("@")[0],theme:profile?.theme||"navy",setupComplete:true,pin:"",aliyahDate:profile?.aliyah_date||""};
    preserveCache();
    remember("post",posts);
    remember("journal",journal);
    originalSet.call(localStorage,CACHE_OWNER,user.id);
    originalSet.call(localStorage,KEYS.posts,JSON.stringify(posts));
    originalSet.call(localStorage,KEYS.journal,JSON.stringify(journal));
    originalSet.call(localStorage,KEYS.settings,JSON.stringify(settings));
    window.myAliyahShipment=shipment||null;
    const {data:profileFiles}=await client.storage.from("journal-photos").list(user.id,{search:"profile.jpg",limit:10});
    if((profileFiles||[]).some(file=>file.name==="profile.jpg")) profilePhotoUrl=await signedPhoto(`${user.id}/profile.jpg`);
    applyProfilePhoto(profilePhotoUrl);
  }

  async function dataUrlBlob(url){ return await (await fetch(url)).blob(); }
  async function syncEntries(type, items){
    if(!Array.isArray(items))throw new Error("Invalid journal data.");
    const previous=acknowledged[type];
    const current=new Map();
    for(const item of items){
      if(!item.id || current.has(item.id))throw new Error("Invalid or duplicate entry ID.");
      current.set(item.id,item);
    }
    // Save new/changed entries first. Never delete and rebuild the account's list.
    for(const item of items){
      const row=entryRow(type,item), signature=JSON.stringify(row);
      if(previous.get(item.id)===signature)continue;
      const {error}=await client.from("entries").upsert(row,{onConflict:"id"});
      if(error)throw error;
      if(type==="post" && item.image){
        let path=item._storagePath||"";
        if(item.image.startsWith("data:")){
          path=`${user.id}/${item.id}.jpg`;
          const {error:uploadError}=await client.storage.from("journal-photos").upload(path,await dataUrlBlob(item.image),{contentType:"image/jpeg",upsert:true});
          if(uploadError)throw uploadError;
        }
        if(path){
          const {data:existing,error:photoError}=await client.from("photos").select("id").eq("user_id",user.id).eq("entry_id",item.id).eq("storage_path",path);
          if(photoError)throw photoError;
          if(!existing?.length){
            const {error:insertError}=await client.from("photos").insert({user_id:user.id,entry_id:item.id,storage_path:path});
            if(insertError)throw insertError;
          }
        }
      }
      previous.set(item.id,signature);
    }
    // Only remove entries this browser actually loaded and the user removed.
    const removed=[...previous.keys()].filter(id=>!current.has(id));
    for(const id of removed){
      const {error}=await client.from("entries").delete().eq("user_id",user.id).eq("entry_type",type).eq("id",id);
      if(error)throw error;
      previous.delete(id);
    }
  }
  async function syncSettings(){
    const s=read(KEYS.settings,{});
    const {error}=await client.from("profiles").upsert({id:user.id,display_name:s.name||"",aliyah_date:s.aliyahDate||null,theme:s.theme||"navy",updated_at:new Date().toISOString()});
    if(error) throw error;
  }
  function schedule(key){
    if(!ready || !user) return;
    clearTimeout(timers[key]);
    timers[key]=setTimeout(()=>{
      syncChain=syncChain.then(async()=>{
        if(key===KEYS.posts) await syncEntries("post",read(key,[]));
        if(key===KEYS.journal) await syncEntries("journal",read(key,[]));
        if(key===KEYS.settings) await syncSettings();
      }).catch(err=>{ console.error(err); alert("My Aliyah could not save to the cloud. Please check your connection and try again."); });
    },500);
  }
  Storage.prototype.setItem=function(key,value){
    if(this===localStorage && ready && (key===KEYS.posts || key===KEYS.journal))preserveCache();
    originalSet.call(this,key,value);
    if(this===localStorage)schedule(key);
  };

  function applyProfilePhoto(url=""){
    profilePhotoUrl=url;
    if(url){
      document.documentElement.style.setProperty("--profile-photo",`url("${url}")`);
      document.body.classList.add("has-profile-photo");
    }else{
      document.documentElement.style.removeProperty("--profile-photo");
      document.body.classList.remove("has-profile-photo");
    }
  }

  function prepareProfilePhoto(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=reject;
      reader.onload=()=>{
        const image=new Image();
        image.onerror=reject;
        image.onload=()=>{
          const size=Math.min(image.naturalWidth,image.naturalHeight);
          const sx=(image.naturalWidth-size)/2, sy=(image.naturalHeight-size)/2;
          const canvas=document.createElement("canvas");
          canvas.width=512;canvas.height=512;
          canvas.getContext("2d").drawImage(image,sx,sy,size,size,0,0,512,512);
          canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Photo could not be prepared.")),"image/jpeg",.84);
        };
        image.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function addAccountControls(){
    const observer=new MutationObserver(()=>{
      const card=document.querySelector(".settings-card");
      if(!card || card.querySelector("#cloudAccount")) return;
      const block=document.createElement("div");
      block.className="setting-block";
      block.id="cloudAccount";
      block.innerHTML=`<label>Profile picture</label>
        <p>Add a photo to appear beside your posts and at the top of the app.</p>
        <div class="profile-photo-row">
          <span class="avatar avatar-sarah profile-photo-preview"></span>
          <label class="secondary-button profile-photo-button" for="profilePhotoInput">Choose photo</label>
          <input id="profilePhotoInput" type="file" accept="image/*" hidden>
          <button id="removeProfilePhoto" class="text-button" type="button" ${profilePhotoUrl?"":"hidden"}>Remove</button>
        </div>
        <p id="profilePhotoStatus" class="auth-message" aria-live="polite"></p>
        <div class="account-divider"></div>
        <label>Signed-in account</label><p>${esc(user.email)}</p>
        <button id="signOutCloud" class="secondary-button">Sign out</button>`;
      card.prepend(block);
      block.querySelector("#signOutCloud").onclick=async()=>{await client.auth.signOut();location.reload();};
      block.querySelector("#profilePhotoInput").onchange=async event=>{
        const file=event.target.files?.[0];
        if(!file)return;
        const status=block.querySelector("#profilePhotoStatus");
        status.textContent="Saving your profile picture…";
        try{
          const blob=await prepareProfilePhoto(file);
          const path=`${user.id}/profile.jpg`;
          const {error}=await client.storage.from("journal-photos").upload(path,blob,{contentType:"image/jpeg",upsert:true,cacheControl:"3600"});
          if(error)throw error;
          profilePhotoUrl=await signedPhoto(path);
          applyProfilePhoto(profilePhotoUrl);
          block.querySelector("#removeProfilePhoto").hidden=false;
          status.textContent="Profile picture saved.";
        }catch(error){
          console.error(error);
          status.textContent="The profile picture could not be saved. Please try another photo.";
        }
        event.target.value="";
      };
      block.querySelector("#removeProfilePhoto").onclick=async()=>{
        const status=block.querySelector("#profilePhotoStatus");
        status.textContent="Removing your profile picture…";
        const {error}=await client.storage.from("journal-photos").remove([`${user.id}/profile.jpg`]);
        if(error){status.textContent="The profile picture could not be removed.";return;}
        applyProfilePhoto("");
        block.querySelector("#removeProfilePhoto").hidden=true;
        status.textContent="Profile picture removed.";
      };
      document.querySelectorAll(".signin-options,.preview-label").forEach(el=>el.remove());
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function loadApp(){
    const script=document.createElement("script");
    script.src="app.js";
    script.onload=()=>{ ready=true; addAccountControls(); };
    document.body.appendChild(script);
  }

  async function start(){
    if(!window.supabase) return authScreen("The secure connection could not load. Please refresh.");
    const {data:{session}}=await client.auth.getSession();
    if(!session) return authScreen();
    user=session.user;
    try { await loadCloud(); loadApp(); }
    catch(err){ console.error(err); authScreen("We could not load your journal. Please refresh and try again."); }
  }
  start();
})();