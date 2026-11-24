(() => {
  const SUPABASE_URL = "https://dbtawhhuctckhozwpqqc.supabase.co";
  const SUPABASE_KEY = "sb_publishable_vF8zzvdQVc8QBYC4lVy9vA__vvWTJrN";
  const $ = (id) => document.getElementById(id);
  // Keep the sign-up switch responsive even if the Supabase library fails to load.
  $("switchAuth").addEventListener("click", () => setAuthMode($("signupForm").classList.contains("hidden")));
  if (!window.supabase?.createClient) {
    $("authMessage").textContent = "The sign-in service could not load. Please refresh the page and try again.";
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null, profile = null, activeView = "feed";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = (name) => (String(name || "Z").trim().charAt(0) || "Z").toUpperCase();
  const notice = (id, text, good=false) => { const el=$(id); el.textContent=text || ""; el.classList.toggle("success",!!good); };
  const toast = (text) => { $("toast").textContent=text; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2600); };
  function setAuthMode(signup) {
    $("loginForm").classList.toggle("hidden",signup);
    $("signupForm").classList.toggle("hidden",!signup);
    $("authHeading").textContent=signup?"Join Z'app":"Welcome to Z'app";
    $("authSubheading").textContent=signup?"Create your account and find your people.":"Sign in to continue to your space.";
    $("switchText").textContent=signup?"Already a member?":"New to Z'app?";
    $("switchAuth").textContent=signup?"Sign in":"Create an account";
    notice("authMessage","");
  }
  function showScreen(signedIn) {
    $("authScreen").classList.toggle("hidden",signedIn);
    $("appScreen").classList.toggle("hidden",!signedIn);
    $("logoutBtn").classList.toggle("hidden",!signedIn);
    $("topUser").textContent=signedIn?(profile?.display_name || user?.email || ""):"";
  }
  async function loadProfile() {
    const {data,error}=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();
    if(error) throw error;
    profile=data || {id:user.id,display_name:user.user_metadata?.display_name || "Member",username:"member",bio:"",profile_visibility:"public"};
    const name=profile.display_name || "Member", handle="@"+(profile.username || "member");
    $("myName").textContent=name; $("myHandle").textContent=handle;
    $("myAvatar").textContent=initials(name); $("composerAvatar").textContent=initials(name);
    $("topUser").textContent=name;
    $("profileName").value=name; $("profileUsername").value=profile.username || "";
    $("profileBio").value=profile.bio || ""; $("profileVisibility").value=profile.profile_visibility || "public";
    $("profileAvatar").textContent=initials(name);
  }
  async function loadFeed() {
    $("feedList").innerHTML='<div class="loading glass">Loading posts…</div>';
    const {data:posts,error}=await db.from("posts").select("id,author_id,body,audience,created_at").order("created_at",{ascending:false}).limit(50);
    if(error) { $("feedList").textContent="Could not load posts: "+error.message; return; }
    if(!posts?.length) { $("feedList").innerHTML='<div class="empty-state glass">No posts yet. Be the first to share something.</div>'; return; }
    const ids=[...new Set(posts.map(p=>p.author_id))];
    const {data:people}=await db.from("profiles").select("id,display_name,username").in("id",ids);
    const peopleById=Object.fromEntries((people||[]).map(p=>[p.id,p]));
    const {data:likes}=await db.from("post_likes").select("post_id,user_id").in("post_id",posts.map(p=>p.id));
    const {data:comments}=await db.from("comments").select("id,post_id,author_id,body,created_at").in("post_id",posts.map(p=>p.id)).order("created_at",{ascending:true});
    const commentAuthors=[...new Set((comments||[]).map(c=>c.author_id))];
    let commentPeople={};
    if(commentAuthors.length){const r=await db.from("profiles").select("id,display_name,username").in("id",commentAuthors);commentPeople=Object.fromEntries((r.data||[]).map(p=>[p.id,p]));}
    $("feedList").innerHTML=posts.map(p=>{
      const person=peopleById[p.author_id]||{}, name=person.display_name||"Z'app member";
      const postLikes=(likes||[]).filter(l=>l.post_id===p.id), liked=postLikes.some(l=>l.user_id===user.id);
      const postComments=(comments||[]).filter(c=>c.post_id===p.id);
      const commentHtml=postComments.map(c=>'<div class="comment"><strong>'+esc(commentPeople[c.author_id]?.display_name||"Member")+'</strong>'+esc(c.body)+'</div>').join("");
      return '<article class="post-card glass" data-post="'+p.id+'"><div class="post-author"><div class="avatar">'+esc(initials(name))+'</div><div><strong>'+esc(name)+'</strong><small>@'+esc(person.username||"member")+' · '+esc(new Date(p.created_at).toLocaleString())+'</small></div></div><div class="post-body">'+esc(p.body)+'</div><div class="post-actions"><button class="action-btn '+(liked?"liked":"")+'" data-action="like" data-id="'+p.id+'">'+(liked?"♥":"♡")+' '+postLikes.length+' Likes</button><button class="action-btn" data-action="comments" data-id="'+p.id+'">▤ '+postComments.length+' Comments</button></div><div class="comments hidden" id="comments-'+p.id+'">'+(commentHtml||'<div class="comment">No comments yet.</div>')+'<form class="comment-form" data-comment="'+p.id+'"><input name="body" maxlength="2000" placeholder="Write a comment…" required><button type="submit">Send</button></form></div></article>';
    }).join("");
  }
  async function loadApp() {
    showScreen(true);
    try { await loadProfile(); await loadFeed(); }
    catch(e){ toast(e.message || "Could not load your account."); }
  }
  async function handleSignup(e) {
    e.preventDefault();
    notice("authMessage","Creating your account…");
    const submitButton = $("signupForm").querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const display_name=$("signupName").value.trim();
      const {data,error}=await db.auth.signUp({email:$("signupEmail").value.trim(),password:$("signupPassword").value,options:{data:{display_name}}});
      if(error){notice("authMessage",error.message);return;}
      if(data.session){user=data.user;await loadApp();}
      else notice("authMessage","Account created. Check your email if confirmation is enabled, then sign in.",true);
    } catch (error) {
      notice("authMessage",error?.message || "Something went wrong. Please try again.");
    } finally {
      submitButton.disabled = false;
    }
  }
  async function handleLogin(e) {
    e.preventDefault(); notice("authMessage","Signing in…");
    const {data,error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
    if(error){notice("authMessage",error.message);return;}
    user=data.user; await loadApp();
  }
  async function publishPost() {
    const body=$("postText").value.trim(); if(!body){notice("postMessage","Write something before publishing.");return;}
    $("publishBtn").disabled=true; notice("postMessage","Publishing…");
    const {error}=await db.from("posts").insert({author_id:user.id,body,audience:$("postAudience").value});
    $("publishBtn").disabled=false;
    if(error){notice("postMessage",error.message);return;}
    $("postText").value="";notice("postMessage","Your post is live.",true);await loadFeed();
  }
  async function saveProfile(e) {
    e.preventDefault(); const display_name=$("profileName").value.trim();
    const username=$("profileUsername").value.trim().toLowerCase().replace(/^@/,"");
    if(!/^[a-z0-9_]{3,24}$/.test(username)){notice("profileMessage","Username must be 3–24 characters: letters, numbers, and underscores.");return;}
    notice("profileMessage","Saving…");
    const changes={display_name,username,bio:$("profileBio").value.trim(),profile_visibility:$("profileVisibility").value,updated_at:new Date().toISOString()};
    const {error}=await db.from("profiles").update(changes).eq("id",user.id);
    if(error){notice("profileMessage",error.code==="23505"?"That username is already taken.":error.message);return;}
    profile={...profile,...changes};await loadProfile();notice("profileMessage","Profile saved.",true);toast("Profile updated");
  }
  async function handleFeedClick(e) {
    const btn=e.target.closest("[data-action]"); if(!btn)return;
    const id=btn.dataset.id, action=btn.dataset.action;
    if(action==="comments"){ $("comments-"+id).classList.toggle("hidden");return; }
    if(action==="like"){
      btn.disabled=true;
      const {data:existing}=await db.from("post_likes").select("post_id").eq("post_id",id).eq("user_id",user.id).maybeSingle();
      const result=existing?await db.from("post_likes").delete().eq("post_id",id).eq("user_id",user.id):await db.from("post_likes").insert({post_id:id,user_id:user.id});
      if(result.error)toast(result.error.message);else await loadFeed();
    }
  }
  async function handleComment(e) {
    const form=e.target.closest("form[data-comment]");if(!form)return;e.preventDefault();
    const post_id=form.dataset.comment, body=new FormData(form).get("body").toString().trim();if(!body)return;
    const {error}=await db.from("comments").insert({post_id,author_id:user.id,body});
    if(error){toast(error.message);return;}await loadFeed();$("comments-"+post_id)?.classList.remove("hidden");
  }
  function navigate(view) {
    activeView=view;
    $("feedView").classList.toggle("hidden",view!=="feed");
    $("profileView").classList.toggle("hidden",view!=="profile");
    document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    if(view==="feed")loadFeed();
  }
  async function logout(){await db.auth.signOut();user=null;profile=null;showScreen(false);setAuthMode(false);}
  $("loginForm").addEventListener("submit",handleLogin);
  $("signupForm").addEventListener("submit",handleSignup);
  $("publishBtn").addEventListener("click",publishPost);
  $("profileForm").addEventListener("submit",saveProfile);
  $("refreshBtn").addEventListener("click",loadFeed);
  $("logoutBtn").addEventListener("click",logout);$("sideLogout").addEventListener("click",logout);
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  $("feedList").addEventListener("click",handleFeedClick);$("feedList").addEventListener("submit",handleComment);
  db.auth.getSession().then(({data})=>{user=data.session?.user||null;if(user)loadApp();else{showScreen(false);setAuthMode(false);}});
  db.auth.onAuthStateChange((_event,session)=>{if(session?.user&&!user){user=session.user;loadApp();}else if(!session){user=null;profile=null;showScreen(false);}});
})();