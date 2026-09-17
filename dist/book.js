(() => {
  const KEYS={posts:"my-aliyah-posts-v1",journal:"my-aliyah-journal-v1",settings:"my-aliyah-settings-v1"};
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const date=v=>new Date(v).toLocaleDateString([],{year:"numeric",month:"long",day:"numeric"});
  function renderBook(){
    const posts=read(KEYS.posts,[]), journal=read(KEYS.journal,[]), total=posts.length+journal.length;
    return `<section class="book-maker card"><p class="eyebrow">Your story in print</p><h2>Make My Book</h2><p class="book-intro">Turn your posts, photographs and journal entries into a keepsake PDF. You can save the PDF now and use it for printing later.</p><div class="book-count"><strong>${total}</strong><span>${total===1?"entry":"entries"} ready for your book</span></div><h3>Choose a book theme</h3><div class="book-themes"><label class="book-theme selected"><input type="radio" name="bookTheme" value="classic" checked><span class="theme-preview classic-preview"><b>My Aliyah</b><i>A personal journal</i></span><strong>Classic</strong><small>Warm, traditional and easy to read.</small></label><label class="book-theme"><input type="radio" name="bookTheme" value="modern"><span class="theme-preview modern-preview"><b>MY ALIYAH</b><i>JOURNAL+</i></span><strong>Modern</strong><small>Clean, visual and photo-forward.</small></label></div><button id="makeBookPdf" class="primary-button book-button">Create my PDF</button><p class="book-note">Your browser will open the finished book. Choose <strong>Save as PDF</strong> in the print window.</p></section>`;
  }
  function openBook(theme){
    const posts=read(KEYS.posts,[]), journal=read(KEYS.journal,[]), settings=read(KEYS.settings,{});
    const items=[...posts.map(x=>({...x,kind:"Post",body:x.text||""})),...journal.map(x=>({...x,kind:"Journal",body:x.body||""}))].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    const name=settings.name||"My";
    const pages=items.map(x=>`<article class="entry ${x.image?"with-photo":""}"><p class="entry-date">${esc(date(x.createdAt))}${x.mood?` · ${esc(x.mood)}`:""}</p>${x.title?`<h2>${esc(x.title)}</h2>`:""}<p class="entry-text">${esc(x.body).replace(/\n/g,"<br>")}</p>${x.image?`<img src="${x.image}" alt="">`:""}</article>`).join("");
    const w=window.open("","_blank"); if(!w){alert("Please allow pop-ups so My Aliyah can create your book.");return;}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>My Aliyah Journal+</title><style>@page{size:6in 9in;margin:.65in}*{box-sizing:border-box}body{margin:0;color:#173a5e;font-family:${theme==="classic"?"Georgia,serif":"Arial,sans-serif"};background:white}.cover{height:7.5in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}.cover h1{font-size:${theme==="classic"?"38px":"44px"};margin:0 0 12px}.cover p{font-size:17px;margin:5px}.plus{color:#ef2b21}.entry{page-break-inside:avoid;border-bottom:1px solid #dbe6ef;padding:0 0 28px;margin:0 0 30px}.entry-date{text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-family:Arial,sans-serif;color:#66809a}.entry h2{font-size:24px;margin:8px 0 12px}.entry-text{font-size:15px;line-height:1.65;color:#24394d}.entry img{display:block;max-width:100%;max-height:5.4in;object-fit:contain;margin:18px auto 0;border-radius:${theme==="modern"?"12px":"0"}}.modern .entry{border:0}.modern .entry h2{font-size:27px}@media print{.no-print{display:none}}</style></head><body class="${theme}"><section class="cover"><h1>My Aliyah Journal<span class="plus">+</span></h1><p>${esc(name)}’s story</p><p>${items.length} ${items.length===1?"memory":"memories"}</p></section>${pages||`<article class="entry"><h2>Your story is just beginning.</h2><p class="entry-text">Add posts and journal entries, then return here to create your book.</p></article>`}<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`);w.document.close();
  }
  function install(){
    const nav=document.querySelector(".sidebar nav"), generic=document.querySelector("#genericView"); if(!nav||!generic)return false;
    if(document.querySelector('[data-view="book"]'))return true;
    const btn=document.createElement("button");btn.className="nav-item";btn.dataset.view="book";btn.innerHTML="<span>▧</span>Make My Book";
    const settingsBtn=nav.querySelector('[data-view="settings"]');nav.insertBefore(btn,settingsBtn);
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
      document.querySelectorAll(".view").forEach(x=>x.classList.remove("active-view"));generic.classList.add("active-view");
      document.querySelector(".sidebar")?.classList.remove("open");
      const title=document.querySelector("#pageTitle"),sub=document.querySelector("#pageSubtitle");if(title)title.textContent="Make My Book";if(sub)sub.textContent="Turn your journey into a keepsake.";
      generic.innerHTML=renderBook();
      generic.querySelectorAll('.book-theme input').forEach(r=>r.onchange=()=>{generic.querySelectorAll('.book-theme').forEach(x=>x.classList.remove('selected'));r.closest('.book-theme').classList.add('selected')});
      generic.querySelector("#makeBookPdf").onclick=()=>openBook(generic.querySelector('input[name="bookTheme"]:checked').value);
    });
    return true;
  }
  const style=document.createElement("style");style.textContent=`.book-maker{max-width:820px;padding:34px}.book-maker h2{font-size:30px;margin:4px 0 8px}.book-intro{max-width:650px;line-height:1.6}.book-count{display:flex;align-items:baseline;gap:10px;margin:26px 0}.book-count strong{font-size:34px}.book-themes{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:14px 0 26px}.book-theme{border:2px solid #d9e4ee;border-radius:16px;padding:14px;cursor:pointer}.book-theme.selected{border-color:#1a5fb4}.book-theme input{position:absolute;opacity:0}.book-theme>strong,.book-theme>small{display:block;margin-top:8px}.book-theme>small{color:#6b7d8e}.theme-preview{height:155px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f6f1e8;color:#173a5e}.modern-preview{background:#eaf5ff;font-family:Arial,sans-serif}.theme-preview b{font-size:25px}.theme-preview i{font-size:12px;margin-top:7px;letter-spacing:.08em}.book-button{margin-top:2px}.book-note{font-size:13px;color:#6b7d8e;margin-top:14px}@media(max-width:700px){.book-themes{grid-template-columns:1fr}.book-maker{padding:22px}}`;document.head.appendChild(style);
  let tries=0;const timer=setInterval(()=>{if(install()||++tries>80)clearInterval(timer)},250);
})();