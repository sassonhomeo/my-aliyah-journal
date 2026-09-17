(() => {
  const KEY="my-aliyah-todos-v1";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}};
  const save=v=>localStorage.setItem(KEY,JSON.stringify(v));
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  let todos=read(),installed=false;
  const postIds=()=>new Set(todos.map(x=>x.postId).filter(Boolean));

  function render(){
    const items=todos.filter(x=>x.postId).map(x=>`<article class="post card"><p class="post-text">${esc(x.postText||x.text||"")}</p></article>`).join("");
    return items?`<div class="feed todo-list">${items}</div>`:`<article class="card empty-state"><div class="empty-icon">✓</div><h2>No To-Dos yet</h2><p>Touch “To-Do” beneath any post to keep it here.</p></article>`;
  }

  function closeMenu(){document.querySelector(".sidebar")?.classList.remove("open")}
  function showTodo(){
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view==="todo"));
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active-view"));
    const g=document.querySelector("#genericView");
    if(!g)return;
    g.classList.add("active-view");
    document.querySelector("#pageTitle").textContent="To-Do";
    document.querySelector("#pageSubtitle").textContent="Things you want to remember.";
    g.innerHTML=render();
    closeMenu();
  }

  function paintButtons(){
    const ids=postIds();
    document.querySelectorAll("#feed .post").forEach(card=>{
      const b=card.querySelector(".todo-from-post");
      if(!b)return;
      const on=ids.has(card.dataset.id),label=on?"✓ To-Do":"○ To-Do";
      b.classList.toggle("saved",on);
      if(b.textContent!==label)b.textContent=label;
    });
  }

  function addButtons(){
    let added=false;
    document.querySelectorAll("#feed .post .post-actions").forEach(actions=>{
      if(actions.querySelector(".todo-from-post"))return;
      const b=document.createElement("button");
      b.type="button";
      b.className="post-action todo-from-post";
      actions.insertBefore(b,actions.querySelector(".edit-action"));
      added=true;
    });
    if(added||document.querySelector("#feed .todo-from-post"))paintButtons();
  }

  function togglePost(card){
    const id=card?.dataset.id;
    if(!id)return;
    const i=todos.findIndex(x=>x.postId===id);
    if(i>=0)todos.splice(i,1);
    else{
      const text=card.querySelector(".post-text")?.textContent||"";
      todos.unshift({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),postId:id,postText:text});
    }
    save(todos);
    paintButtons();
  }

  function install(){
    if(installed)return true;
    const nav=document.querySelector(".sidebar nav"),feed=document.querySelector("#feed"),chip=document.querySelector(".profile-chip span:last-child");
    if(!nav||!feed||!chip||!chip.textContent.trim())return false;
    installed=true;
    let b=nav.querySelector('[data-view="todo"]');
    if(!b){
      b=document.createElement("button");
      b.type="button";
      b.className="nav-item";
      b.dataset.view="todo";
      b.innerHTML="<span>✓</span>To-Do";
      const book=nav.querySelector('[data-view="book"]'),settings=nav.querySelector('[data-view="settings"]');
      nav.insertBefore(b,book||settings);
    }
    b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();showTodo()});
    feed.addEventListener("click",e=>{
      const btn=e.target.closest(".todo-from-post");
      if(!btn)return;
      e.preventDefault();
      e.stopPropagation();
      togglePost(btn.closest(".post"));
    },true);
    const observer=new MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1)))addButtons();
    });
    observer.observe(feed,{childList:true,subtree:true});
    addButtons();
    return true;
  }

  const style=document.createElement("style");
  style.textContent=`.todo-from-post.saved{font-weight:700}.todo-list .post{padding:20px}`;
  document.head.appendChild(style);
  let tries=0;
  const timer=setInterval(()=>{if(install()||++tries>200)clearInterval(timer)},100);
})();