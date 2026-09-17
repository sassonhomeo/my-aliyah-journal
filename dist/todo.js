(() => {
  const KEY="my-aliyah-todos-v1";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}};
  const save=v=>localStorage.setItem(KEY,JSON.stringify(v));
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  let todos=read();
  const postIds=()=>new Set(todos.filter(x=>x.postId).map(x=>x.postId));
  function render(){
    const items=todos.filter(x=>x.postId).map(x=>`<article class="card todo-item" data-todo-id="${esc(x.id)}"><p>${esc(x.postText||x.text)}</p></article>`).join("");
    return items?`<div class="todo-list">${items}</div>`:`<article class="card empty-state"><div class="empty-icon">✓</div><h2>No To-Dos yet</h2><p>Touch “To-Do” beneath any post to keep it here.</p></article>`;
  }
  function showTodo(){
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view==="todo"));
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active-view"));
    const g=document.querySelector("#genericView");g.classList.add("active-view");document.querySelector("#pageTitle").textContent="To-Do";document.querySelector("#pageSubtitle").textContent="Things you want to remember.";g.innerHTML=render();document.querySelector(".sidebar")?.classList.remove("open");
  }
  function togglePost(card,btn){
    const id=card?.dataset.id;if(!id)return;
    const existing=todos.findIndex(x=>x.postId===id);
    if(existing>=0)todos.splice(existing,1);else{const text=card.querySelector(".post-text")?.textContent||"";todos.unshift({id:crypto.randomUUID(),postId:id,text,postText:text,createdAt:new Date().toISOString()})}
    save(todos);paintButtons();
  }
  function paintButtons(){
    const ids=postIds();document.querySelectorAll(".post").forEach(card=>{const b=card.querySelector(".todo-from-post");if(!b)return;const on=ids.has(card.dataset.id);b.classList.toggle("saved",on);b.textContent=on?"✓ To-Do":"○ To-Do"})
  }
  function install(){
    const nav=document.querySelector(".sidebar nav"),generic=document.querySelector("#genericView"),feed=document.querySelector("#feed");if(!nav||!generic||!feed)return false;
    if(!nav.querySelector('[data-view="todo"]')){const b=document.createElement("button");b.className="nav-item";b.dataset.view="todo";b.innerHTML="<span>✓</span>To-Do";const book=nav.querySelector('[data-view="book"]'),settings=nav.querySelector('[data-view="settings"]');nav.insertBefore(b,book||settings);b.onclick=showTodo}
    feed.addEventListener("click",e=>{const btn=e.target.closest(".todo-from-post");if(!btn)return;e.stopPropagation();togglePost(btn.closest(".post"),btn)});
    const addButtons=()=>{document.querySelectorAll(".post .post-actions").forEach(actions=>{if(!actions.querySelector(".todo-from-post")){const b=document.createElement("button");b.className="post-action todo-from-post";actions.insertBefore(b,actions.querySelector(".edit-action"))}});paintButtons()};
    const observer=new MutationObserver(addButtons);observer.observe(feed,{childList:true,subtree:true});addButtons();
    return true;
  }
  const style=document.createElement("style");style.textContent=`.todo-list{display:grid;gap:14px}.todo-item{padding:20px}.todo-item p{margin:0;line-height:1.55}.todo-from-post.saved{font-weight:700}`;document.head.appendChild(style);
  let n=0,t=setInterval(()=>{if(install()||++n>80)clearInterval(t)},150);
})();