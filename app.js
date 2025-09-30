/* App.js - frontend-only prototype using localStorage
   Notes: This is a client-side demo. Real production app requires backend for files, auth, payments.
*/

const DB = {
  usersKey: 'musicapp_users_v1',
  uploadsKey: 'musicapp_uploads_v1',
  withdrawalsKey: 'musicapp_withdraws_v1',
  sessionsKey: 'musicapp_session_v1'
};

function $(s){return document.querySelector(s)}
function $all(s){return document.querySelectorAll(s)}

/* In-memory object URLs for media (files cannot be stored in localStorage) */
const mediaStore = { audio: [], video: [] };

/* Utilities for localStorage */
function read(key){try{return JSON.parse(localStorage.getItem(key) || '[]')}catch(e){return []}}
function write(key, val){localStorage.setItem(key, JSON.stringify(val))}

/* Auto-create admin if missing */
function ensureAdmin(){
  let users = read(DB.usersKey)
  if(!users.find(u=>u.role==='admin')){
    users.push({id:'admin', email:'admin@musicapp.test', password:'admin', role:'admin', fullName:'Administrator', blocked:false})
    write(DB.usersKey, users)
  }
}
ensureAdmin()

/* Session handling */
function setSession(user){ localStorage.setItem(DB.sessionsKey, JSON.stringify(user)) }
function getSession(){ return JSON.parse(localStorage.getItem(DB.sessionsKey) || 'null') }
function clearSession(){ localStorage.removeItem(DB.sessionsKey) }

/* UI refs */
const authModal = $('#authModal'), modalOverlay = $('#modalOverlay')
const openRegister = $('#openRegister'), openLogin = $('#openLogin'), doRegister = $('#doRegister'), doLogin = $('#doLogin')
const btnMusic = $('#btnMusic'), btnVideos = $('#btnVideos'), btnPlaylist = $('#btnPlaylist'), btnLibrary = $('#btnLibrary')
const mainContent = $('#mainContent'), homeView = $('#homeView'), videosView = $('#videosView'), dashboardView = $('#dashboardView')
const adminView = $('#adminView'), btnLogout = $('#btnLogout'), userAvatar = $('#userAvatar')
const musicList = $('#musicList'), videoList = $('#videoList')
const uploadModal = $('#uploadModal'), doUpload = $('#doUpload'), closeUpload = $('#closeUpload')
const audioPlayer = $('#audioPlayer'), playBtn = $('#playBtn'), prevBtn = $('#prevBtn'), nextBtn = $('#nextBtn'), volume = $('#volume')
const nowPlaying = $('#nowPlaying'), shuffleBtn = $('#shuffleBtn'), repeatBtn = $('#repeatBtn')
const btnSimActive = $('#btnSimActive')

/* Auth flow */
$('#openRegister')?.addEventListener('click', ()=>{
  $('#loginForm').classList.add('hidden'); $('#registerForm').classList.remove('hidden')
})

$('#openLogin')?.addEventListener('click', ()=>{
  $('#registerForm').classList.add('hidden'); $('#loginForm').classList.remove('hidden')
})

$('#authTitle').innerText = 'Login'
function showAuth(){ modalOverlay.classList.remove('hidden'); authModal.classList.remove('hidden') }
function hideAuth(){ modalOverlay.classList.add('hidden'); authModal.classList.add('hidden') }

/* Register - simulate verification code */
doRegister.addEventListener('click', ()=>{
  const type = $('#regType').value
  const email = $('#regEmail').value.trim()
  const pwd = $('#regPwd').value.trim()
  const fullName = $('#regFullName').value.trim()
  const phone = $('#regPhone').value.trim()
  const artistName = $('#regArtistName').value.trim()
  if(!email || !pwd || !fullName){ alert('Please fill required fields'); return }
  let users = read(DB.usersKey)
  if(users.find(u=>u.email===email)){ alert('Email already used'); return }
  // create pending user
  const id = 'u_'+Date.now()
  const role = (type==='artist') ? 'artist' : 'streamer'
  const user = {id, email, password:pwd, fullName, phone, role, artistName:artistName||fullName, bio:'', paypal:'', profilePic:'', wallet:0, activeSince: Date.now(), blocked:false}
  users.push(user); write(DB.usersKey, users)
  // simulate sending code: store code in temp and show verify form
  const code = Math.floor(1000 + Math.random()*9000).toString()
  sessionStorage.setItem('pending_verify', JSON.stringify({id, code}))
  alert('Simulated verification code: ' + code + ' (in real app this is emailed/sms)')
  $('#loginForm').classList.add('hidden'); $('#registerForm').classList.add('hidden')
  $('#verifyForm').classList.remove('hidden')
})

/* Verify */
$('#doVerify').addEventListener('click', ()=>{
  const entered = $('#verifyCode').value.trim()
  const pending = JSON.parse(sessionStorage.getItem('pending_verify') || 'null')
  if(!pending || entered!==pending.code){ alert('Invalid code'); return }
  // activate user and login
  let users = read(DB.usersKey)
  const u = users.find(x=>x.id===pending.id)
  if(!u){ alert('User not found'); return }
  write(DB.usersKey, users)
  sessionStorage.removeItem('pending_verify')
  setSession(u)
  hideAuth(); refreshUI(); alert('Registration complete! Logged in.')
})

/* Login */
doLogin.addEventListener('click', ()=>{
  const email = $('#loginEmail').value.trim(), pwd = $('#loginPwd').value.trim()
  const users = read(DB.usersKey)
  const u = users.find(x=>x.email===email && x.password===pwd)
  if(!u){ alert('Invalid credentials') ; return }
  if(u.blocked){ alert('Your account is blocked'); return }
  setSession(u); hideAuth(); refreshUI()
})

/* Logout */
btnLogout.addEventListener('click', ()=>{
  clearSession(); refreshUI(); showAuth()
})

/* Initial show auth if no session */
if(!getSession()) showAuth()

/* Switch views */
btnMusic.addEventListener('click', ()=>{ showView('home') })
btnVideos.addEventListener('click', ()=>{ showView('videos') })
userAvatar.addEventListener('click', ()=>{ showProfile() })

function showView(v){
  homeView.classList.toggle('hidden', v!=='home')
  videosView.classList.toggle('hidden', v!=='videos')
  dashboardView.classList.toggle('hidden', true)
  adminView.classList.add('hidden')
}

/* Show profile/dashboard */
function showProfile(){
  const u = getSession()
  if(!u){ showAuth(); return }
  const dash = $('#dashboardView')
  dash.classList.remove('hidden')
  homeView.classList.add('hidden'); videosView.classList.add('hidden'); adminView.classList.add('hidden')
  $('#dashTitle').innerText = u.role==='artist' ? 'Artist Dashboard' : (u.role==='streamer' ? 'Streamer Dashboard' : 'Admin Dashboard')
  renderDashboard()
}

/* Render dashboard content */
function renderDashboard(){
  const u = getSession()
  const area = $('#dashboardArea'); area.innerHTML = ''
  if(!u) return
  if(u.role==='admin'){
    adminView.classList.remove('hidden'); dashboardView.classList.add('hidden'); renderAdmin()
    return
  }
  const card = document.createElement('div'); card.className='card'
  card.innerHTML = `
    <div><strong>Name:</strong> ${u.fullName} (${u.role})</div>
    <div><strong>Artist:</strong> ${u.artistName || '-'}</div>
    <div><strong>Wallet:</strong> $<span id="walletAmt">${u.wallet||0}</span></div>
    <div style="margin-top:8px">
      <button id="editProfile">Edit Profile</button>
      <button id="openUpload">Upload Track/Video</button>
      <button id="viewUploads">My Uploads</button>
      <button id="viewWithdraws">My Withdrawals</button>
    </div>
  `
  area.appendChild(card)
  $('#openUpload').addEventListener('click', ()=>{ openUploadModal() })
  $('#editProfile').addEventListener('click', ()=>{ editProfile() })
  $('#viewUploads').addEventListener('click', ()=>{ viewMyUploads() })
  $('#viewWithdraws').addEventListener('click', ()=>{ viewMyWithdraws() })
}

/* Render admin */
function renderAdmin(){
  const area = $('#adminArea'); area.innerHTML = ''
  const users = read(DB.usersKey)
  const uploads = read(DB.uploadsKey)
  const withdraws = read(DB.withdrawalsKey)
  const ucard = document.createElement('div'); ucard.className='card'
  ucard.innerHTML = `<h3>Users</h3><div id="usersList"></div>`
  const uploadsCard = document.createElement('div'); uploadsCard.className='card'
  uploadsCard.innerHTML = `<h3>Uploads</h3><div id="uploadsList"></div>`
  const withdrawCard = document.createElement('div'); withdrawCard.className='card'
  withdrawCard.innerHTML = `<h3>Withdraw Requests</h3><div id="withdrawList"></div>`
  area.appendChild(ucard); area.appendChild(uploadsCard); area.appendChild(withdrawCard)

  const ul = $('#usersList'); users.forEach(us=>{
    const d = document.createElement('div'); d.style.padding='6px'; d.style.borderBottom='1px solid #222'
    d.innerHTML = `<strong>${us.fullName}</strong> (${us.email}) - ${us.role} ${us.blocked?'<em>BLOCKED</em>':''} 
      <button data-id="${us.id}" class="btnBlock">${us.blocked?'Unblock':'Block'}</button>`
    ul.appendChild(d)
  })
  $all('.btnBlock').forEach(b=>b.addEventListener('click', (e)=>{
    const id = e.target.dataset.id; let users = read(DB.usersKey)
    const uidx = users.findIndex(x=>x.id===id); users[idxu = uidx].blocked = !users[idxu].blocked
    write(DB.usersKey, users); renderAdmin()
  }))

  const uplEl = $('#uploadsList'); uploads.forEach(up=>{
    const d = document.createElement('div'); d.style.padding='6px'; d.style.borderBottom='1px solid #222'
    d.innerHTML = `<strong>${up.title}</strong> by ${up.artist} (${up.type}) <button data-id="${up.id}" class="btnRemove">Remove</button>`
    uplEl.appendChild(d)
  })
  $all('.btnRemove').forEach(b=>b.addEventListener('click', (e)=>{
    const id = e.target.dataset.id; let ups = read(DB.uploadsKey)
    ups = ups.filter(x=>x.id!==id); write(DB.uploadsKey, ups); renderAdmin()
  }))

  const wlist = $('#withdrawList'); withdraws.forEach(w=>{
    const d = document.createElement('div'); d.style.padding='6px'; d.style.borderBottom='1px solid #222'
    d.innerHTML = `<strong>${w.userEmail}</strong> requested $${w.amount} - ${w.status} 
      <button data-id="${w.id}" class="btnApprove">Approve</button>`
    wlist.appendChild(d)
  })
  $all('.btnApprove').forEach(b=>b.addEventListener('click', (e)=>{
    const id = e.target.dataset.id; let ws = read(DB.withdrawalsKey)
    const idx = ws.findIndex(x=>x.id===id); if(idx>-1){ ws[idx].status='approved'; write(DB.withdrawalsKey, ws); alert('Approved'); renderAdmin() }
  }))
}

/* Upload flow */
function openUploadModal(){ modalOverlay.classList.remove('hidden'); uploadModal.classList.remove('hidden') }
function closeUploadModal(){ modalOverlay.classList.add('hidden'); uploadModal.classList.add('hidden') }
$('#closeUpload').addEventListener('click', closeUploadModal)

doUpload.addEventListener('click', ()=>{
  const type = $('#uploadType').value, title = $('#trackName').value.trim(), artist = $('#artistNameInput').value.trim(), file = $('#fileInput').files[0]
  if(!title || !artist || !file){ alert('Fill title, artist and choose a file'); return }
  const id = 'up_' + Date.now()
  const up = { id, title, artist, type, filename: file.name, uploader:getSession().email, created:Date.now()}
  // store metadata
  let ups = read(DB.uploadsKey); ups.push(up); write(DB.uploadsKey, ups)
  // create object URL for immediate playback
  const url = URL.createObjectURL(file)
  if(type==='audio'){ mediaStore.audio.push({id, url, meta:up}) } else { mediaStore.video.push({id, url, meta:up}) }
  closeUploadModal(); renderLibrary(); alert('Uploaded (client-side demo).')
})

/* Render lists */
function renderLibrary(){
  musicList.innerHTML=''; videoList.innerHTML=''
  const ups = read(DB.uploadsKey)
  ups.filter(u=>u.type==='audio').forEach(u=>{
    const card = document.createElement('div'); card.className='card'
    card.innerHTML = `<div><img src="https://picsum.photos/seed/${u.id}/300/160" /></div>
      <div class="meta"><div><strong>${u.title}</strong><div style="font-size:0.9em;color:#aaa">${u.artist}</div></div>
      <div><button data-id="${u.id}" class="playTrack">Play</button><button data-id="${u.id}" class="btnLike">Like</button></div></div>`
    musicList.appendChild(card)
  })
  ups.filter(u=>u.type==='video').forEach(u=>{
    const card = document.createElement('div'); card.className='card'
    card.innerHTML = `<div><img src="https://picsum.photos/seed/${u.id}/300/160" /></div>
      <div class="meta"><div><strong>${u.title}</strong><div style="font-size:0.9em;color:#aaa">${u.artist}</div></div>
      <div><button data-id="${u.id}" class="playVideo">Play</button><button data-id="${u.id}" class="btnLike">Like</button></div></div>`
    videoList.appendChild(card)
  })
  // bind play buttons - use mediaStore urls where available, otherwise alert (files not persisted across refresh)
  $all('.playTrack').forEach(b=>b.addEventListener('click', (e)=>{
    const id = e.target.dataset.id
    const m = mediaStore.audio.find(x=>x.id===id)
    if(!m){ alert('File playback not available after refresh in this demo. Upload again to play.'); return }
    audioPlayer.src = m.url; audioPlayer.play(); nowPlaying.innerText = m.meta.title + ' — ' + m.meta.artist; playBtn.innerText='⏸'
  }))
  $all('.playVideo').forEach(b=>b.addEventListener('click', (e)=>{
    const id = e.target.dataset.id
    const m = mediaStore.video.find(x=>x.id===id)
    if(!m){ alert('Video playback not available after refresh in this demo.'); return }
    // for simplicity, play video as audio if it's audio-compatible
    audioPlayer.src = m.url; audioPlayer.play(); nowPlaying.innerText = '(Video) ' + m.meta.title; playBtn.innerText='⏸'
  }))
}

/* Withdraw flow (user) */
function viewMyWithdraws(){
  const u = getSession(); if(!u) return
  const withdraws = read(DB.withdrawalsKey)
  const mine = withdraws.filter(w=>w.userId===u.id)
  let s = 'Your withdrawals:\\n' + (mine.length? mine.map(m=>`${m.amount} — ${m.status}`).join('\\n') : 'No withdrawals')
  const amt = prompt('Enter amount to withdraw (min ' + (u.role==='artist'?200:100) + '). Current wallet: $' + (u.wallet||0))
  if(!amt) return
  const num = Number(amt)
  const min = u.role==='artist'?200:100
  if(num<min){ alert('Minimum withdrawal is $' + min); return }
  if(num> (u.wallet||0)){ alert('Insufficient balance'); return }
  // record request
  const wr = read(DB.withdrawalsKey); const id='w_'+Date.now()
  wr.push({id, userId:u.id, userEmail:u.email, amount:num, status:'pending', created:Date.now()}); write(DB.withdrawalsKey, wr)
  // deduct wallet locally
  let users = read(DB.usersKey); const idx = users.findIndex(x=>x.id===u.id); users[idx].wallet = (users[idx].wallet||0) - num; write(DB.usersKey, users); setSession(users[idx])
  alert('Withdrawal requested — admin approval required.')
}

/* My uploads */
function viewMyUploads(){
  const u = getSession(); if(!u) return
  const ups = read(DB.uploadsKey).filter(x=>x.uploader===u.email)
  const list = ups.map(x=>`${x.title} (${x.type})`).join('\\n') || 'No uploads'
  alert('Your uploads:\\n' + list)
}

/* Edit profile */
function editProfile(){
  const u = getSession(); if(!u) return
  const bio = prompt('Enter short bio (max 500 chars)', u.bio||'')
  if(bio!==null){
    let users = read(DB.usersKey); const idx = users.findIndex(x=>x.id===u.id)
    users[idx].bio = bio.substring(0,500); write(DB.usersKey, users); setSession(users[idx]); renderDashboard()
  }
}

/* Simulate +5hrs active (gives $1 to wallet for user roles) */
btnSimActive.addEventListener('click', ()=>{
  const u = getSession(); if(!u){ showAuth(); return }
  let users = read(DB.usersKey); const idx = users.findIndex(x=>x.id===u.id)
  if(idx===-1) return
  const amt = 1
  users[idx].wallet = (users[idx].wallet||0) + amt
  write(DB.usersKey, users); setSession(users[idx]); alert('Added $1 for 5hrs active. New wallet: $' + users[idx].wallet); renderDashboard()
})

/* Player controls */
playBtn.addEventListener('click', ()=>{
  if(audioPlayer.paused){ audioPlayer.play(); playBtn.innerText='⏸' } else { audioPlayer.pause(); playBtn.innerText='▶' }
})
audioPlayer.addEventListener('ended', ()=>{ playBtn.innerText='▶'; nowPlaying.innerText='Not playing' })
volume.addEventListener('input', ()=>{ audioPlayer.volume = volume.value / 100 })

/* Initial render */
renderLibrary()
refreshUI()

/* Refresh UI depending on session */
function refreshUI(){
  const u = getSession()
  if(u){
    userAvatar.innerText = (u.profilePic? '' : (u.fullName||'U')[0].toUpperCase())
    if(u.role==='admin'){ adminView.classList.remove('hidden'); dashboardView.classList.add('hidden') }
  } else {
    userAvatar.innerText = 'G'
  }
  renderLibrary()
}

/* Simple search */
$('#searchInput').addEventListener('input', (e)=>{
  const q = e.target.value.toLowerCase()
  const ups = read(DB.uploadsKey)
  const results = ups.filter(u=> (u.title+u.artist+u.uploader).toLowerCase().includes(q))
  musicList.innerHTML=''; videoList.innerHTML=''
  results.forEach(u=>{
    const card = document.createElement('div'); card.className='card'
    card.innerHTML = `<div><img src="https://picsum.photos/seed/${u.id}/300/160" /></div>
      <div class="meta"><div><strong>${u.title}</strong><div style="font-size:0.9em;color:#aaa">${u.artist}</div></div>
      <div><button data-id="${u.id}" class="playTrack">Play</button></div></div>`
    if(u.type==='audio') musicList.appendChild(card); else videoList.appendChild(card)
  })
  $all('.playTrack').forEach(b=>b.addEventListener('click',(e)=>{
    const id = e.target.dataset.id
    const m = mediaStore.audio.find(x=>x.id===id)
    if(!m){ alert('Playback not available after refresh.'); return }
    audioPlayer.src = m.url; audioPlayer.play(); nowPlaying.innerText = m.meta.title; playBtn.innerText='⏸'
  }))
})

/* Small helpers: show/hide modal overlay */
modalOverlay.addEventListener('click', ()=>{ modalOverlay.classList.add('hidden'); authModal.classList.add('hidden'); uploadModal.classList.add('hidden') })
