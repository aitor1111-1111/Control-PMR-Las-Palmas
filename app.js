(() => {
  const db = window.supabase.createClient(
    "https://xvyrjxfvetiljpnxmupz.supabase.co",
    "sb_publishable_kJZ7SAwetfUf589-p5BiuA_vNaIFKdB"
  );
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateToday = () => { const d=new Date(); return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
  let user=null, agent=null, auths=[], checks=[], agents=[], tab="inicio";

  function msg(t, bad=true) { $("#login-message").textContent=t||""; $("#login-message").style.color=bad?"#a33333":"#216143"; }
  function showSession() {
    $("#login-panel").classList.add("hidden"); $("#app-panel").classList.remove("hidden");
    $("#welcome").textContent=agent.nombre||user.email||"Agente";
    $("#agent-meta").textContent=[agent.numero_agente?"N.º agente "+agent.numero_agente:"",agent.rol].filter(Boolean).join(" · ");
    $("#admin-tab").classList.toggle("hidden",agent.rol!=="administrador");
  }
  async function profile(u) {
    const {data,error}=await db.from("agentes").select("id,nombre,numero_agente,rol,activo").eq("id",u.id).maybeSingle();
    if(error) throw Error("Error al consultar agentes: "+error.message);
    if(!data||!data.activo) { await db.auth.signOut(); throw Error("Usuario sin perfil activo. Contacta con Administración."); }
    user=u; agent=data; showSession(); await reload(); render("inicio");
  }
  async function reload() {
    $("#connection-status").textContent="Consultando Supabase…";
    const [a,i]=await Promise.all([
      db.from("autorizaciones").select("id,numero_original,emplazamiento,numero_portal,barrio,distrito,matricula,expediente,numero_resolucion,fecha_resolucion").order("distrito").order("emplazamiento").limit(2000),
      db.from("inspecciones").select("id,autorizacion_id,agente_id,fecha_inspeccion,estado_comprobacion,observaciones,matricula_adicional_1,estado_matricula_1,matricula_adicional_2,estado_matricula_2,creado_en").order("fecha_inspeccion",{ascending:false}).limit(2000)
    ]);
    if(a.error) throw Error("Tabla autorizaciones: "+a.error.message);
    if(i.error) throw Error("Tabla inspecciones: "+i.error.message);
    auths=a.data||[]; checks=i.data||[];
    if(agent.rol==="administrador") {
      const r=await db.from("agentes").select("id,nombre,numero_agente,rol,activo").order("numero_agente");
      if(!r.error) agents=r.data||[];
    }
    $("#connection-status").textContent="Conectado · "+auths.length+" autorizaciones · "+checks.length+" inspecciones";
  }
  function tabs() {
    document.querySelectorAll(".tab").forEach(b=>{
      b.classList.toggle("active",b.dataset.tab===tab);
      b.onclick=()=>render(b.dataset.tab);
    });
  }
  function render(t) {
    tab=t; tabs();
    if(t==="inicio") home();
    if(t==="buscar") search();
    if(t==="incidencias") incidents();
    if(t==="historial") history();
    if(t==="mapa") map();
    if(t==="administracion") admin();
  }
  function home() {
    $("#tab-content").innerHTML='<h3>Resumen de actividad</h3><div class="stats-grid"><article class="stat-card"><span>Autorizaciones</span><strong>'+auths.length+'</strong></article><article class="stat-card"><span>Inspecciones</span><strong>'+checks.length+'</strong></article><article class="stat-card"><span>Incidencias</span><strong>'+checks.filter(x=>x.estado_comprobacion!=="OK / vigente").length+'</strong></article></div><p class="muted">Busca una matrícula o dirección para registrar una inspección.</p><button id="refresh" class="secondary">Actualizar datos</button>';
    $("#refresh").onclick=async()=>{try{await reload();home()}catch(e){alert(e.message)}};
  }
  function search() {
    const districts=[...new Set(auths.map(a=>a.distrito).filter(Boolean))].sort();
    $("#tab-content").innerHTML='<h3>Buscar autorización PMR</h3><div class="search-grid"><label>Matrícula<input id="plate" placeholder="Ej. 1234ABC"></label><label>Distrito<select id="district"><option value="">Todos</option>'+districts.map(x=>'<option>'+esc(x)+'</option>').join("")+'</select></label><label>Vía / emplazamiento<select id="street"><option value="">Todas las vías</option></select></label></div><button id="find">Buscar</button><div id="results"></div>';
    const d=$("#district"),s=$("#street");
    function streets(){const vals=[...new Set(auths.filter(a=>!d.value||a.distrito===d.value).map(a=>a.emplazamiento).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));s.innerHTML='<option value="">Todas las vías</option>'+vals.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("")}
    d.onchange=streets; streets(); $("#find").onclick=runSearch; $("#plate").onkeydown=e=>{if(e.key==="Enter")runSearch()};
  }
  function runSearch() {
    const p=$("#plate").value.trim().toUpperCase().replace(/[\s-]/g,""),d=$("#district").value,s=$("#street").value;
    const rows=auths.filter(a=>(!p||String(a.matricula||"").toUpperCase().replace(/[\s-]/g,"").includes(p))&&(!d||a.distrito===d)&&(!s||a.emplazamiento===s));
    $("#results").innerHTML=rows.length?'<p class="muted">'+rows.length+' resultado(s)</p>'+rows.map(a=>{
      const last=checks.find(i=>Number(i.autorizacion_id)===Number(a.id));
      return '<article class="record-card"><div class="record-top"><strong>'+esc(a.matricula||"Sin matrícula")+'</strong><span class="pill">'+esc(a.distrito)+'</span></div><p><b>'+esc(a.emplazamiento)+', '+esc(a.numero_portal)+'</b></p><p class="muted">'+esc(a.barrio)+' · Expte. '+esc(a.expediente||"—")+'</p><p class="muted">Resolución '+esc(a.numero_resolucion||"—")+' · '+esc(a.fecha_resolucion||"—")+'</p><p class="muted">'+(last?"Última comprobación: "+esc(last.estado_comprobacion):"Sin inspecciones")+'</p><button data-id="'+a.id+'">Registrar inspección</button></article>';
    }).join(""):'<p class="muted">No se han encontrado autorizaciones.</p>';
    $("#results").querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>inspection(Number(b.dataset.id)));
  }
  function inspection(id) {
    const a=auths.find(x=>Number(x.id)===id); if(!a)return;
    $("#results").innerHTML='<article class="record-card"><button id="back" class="secondary">← Volver</button><h3>Inspección · '+esc(a.matricula)+'</h3><p>'+esc(a.emplazamiento)+', '+esc(a.numero_portal)+' · '+esc(a.barrio)+' · '+esc(a.distrito)+'</p><form id="check-form"><label>Fecha<input id="check-date" type="date" value="'+dateToday()+'" required></label><label>Resultado<select id="check-status" required><option>OK / vigente</option><option>De baja</option><option>No se ha podido comprobar</option></select></label><label>Observaciones<textarea id="notes" rows="3"></textarea></label><h4>Matrículas adicionales</h4><label>Matrícula adicional 1<input id="extra1" maxlength="12"></label><label>Estado matrícula 1<select id="state1"><option value="">Sin indicar</option><option>OK / vigente</option><option>De baja</option><option>No aparece en archivo inicial</option><option>No se ha podido comprobar</option></select></label><label>Matrícula adicional 2<input id="extra2" maxlength="12"></label><label>Estado matrícula 2<select id="state2"><option value="">Sin indicar</option><option>OK / vigente</option><option>De baja</option><option>No aparece en archivo inicial</option><option>No se ha podido comprobar</option></select></label><p class="muted">Agente: '+esc(agent.numero_agente)+' · '+esc(agent.nombre)+'</p><button type="submit">Guardar inspección</button><p id="check-message" class="message"></p></form></article>';
    $("#back").onclick=runSearch;
    $("#check-form").onsubmit=async e=>{
      e.preventDefault();const b=e.currentTarget.querySelector('button[type="submit"]');b.disabled=true;b.textContent="Guardando…";
      const payload={autorizacion_id:a.id,agente_id:user.id,fecha_inspeccion:new Date($("#check-date").value+"T12:00:00").toISOString(),estado_comprobacion:$("#check-status").value,observaciones:$("#notes").value.trim()||null,matricula_adicional_1:$("#extra1").value.trim().toUpperCase()||null,estado_matricula_1:$("#state1").value||null,matricula_adicional_2:$("#extra2").value.trim().toUpperCase()||null,estado_matricula_2:$("#state2").value||null};
      try{const {error}=await db.from("inspecciones").insert(payload);if(error)throw error;await reload();render("buscar");$("#plate").value=a.matricula||"";runSearch()}
      catch(err){$("#check-message").textContent="No se pudo guardar: "+err.message;b.disabled=false;b.textContent="Guardar inspección"}
    };
  }
  function card(i) {
    const a=auths.find(x=>Number(x.id)===Number(i.autorizacion_id));
    const dt=i.fecha_inspeccion?new Date(i.fecha_inspeccion).toLocaleString("es-ES"):"—";
    const cl=i.estado_comprobacion==="De baja"?"bad":i.estado_comprobacion==="OK / vigente"?"ok":"pending";
    return '<article class="record-card"><div class="record-top"><strong>'+esc(a?.matricula||"Matrícula no disponible")+'</strong><span class="pill '+cl+'">'+esc(i.estado_comprobacion)+'</span></div><p>'+esc(a?.emplazamiento||"")+', '+esc(a?.numero_portal||"")+' · '+esc(a?.barrio||"")+'</p><p class="muted">'+esc(a?.distrito||"")+' · '+dt+'</p>'+(i.observaciones?'<p>'+esc(i.observaciones)+'</p>':"")+(i.matricula_adicional_1?'<p>Matrícula adicional 1: '+esc(i.matricula_adicional_1)+' · '+esc(i.estado_matricula_1)+'</p>':"")+(i.matricula_adicional_2?'<p>Matrícula adicional 2: '+esc(i.matricula_adicional_2)+' · '+esc(i.estado_matricula_2)+'</p>':"")+'</article>';
  }
  function incidents(){const rows=checks.filter(i=>i.estado_comprobacion!=="OK / vigente");$("#tab-content").innerHTML='<h3>Incidencias</h3><p class="muted">'+rows.length+' inspección(es) con resultado distinto de OK / vigente.</p>'+(rows.length?rows.map(card).join(""):'<p class="muted">No hay incidencias registradas.</p>')}
  function history(){$("#tab-content").innerHTML='<h3>Historial de inspecciones</h3><p class="muted">'+checks.length+' registro(s), ordenados por fecha.</p>'+(checks.length?checks.map(card).join(""):'<p class="muted">Todavía no hay inspecciones.</p>')}
  function map(){
    const rows=auths.filter(a=>a.emplazamiento);
    $("#tab-content").innerHTML='<h3>Mapa de emplazamientos</h3><p class="muted">Cada enlace abre la búsqueda de la dirección en OpenStreetMap. Son ubicaciones orientativas, no coordenadas municipales verificadas.</p>'+rows.slice(0,300).map(a=>'<article class="map-row"><div><b>'+esc(a.emplazamiento)+', '+esc(a.numero_portal)+'</b><p class="muted">'+esc(a.barrio)+' · '+esc(a.distrito)+' · '+esc(a.matricula)+'</p></div><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/search?query='+encodeURIComponent([a.emplazamiento,a.numero_portal,a.barrio,a.distrito,"Las Palmas de Gran Canaria"].filter(Boolean).join(", "))+'">Ver ubicación</a></article>').join("")+(rows.length>300?'<p class="muted">Se muestran los primeros 300 registros.</p>':"");
  }
  function admin(){
    if(agent.rol!=="administrador"){render("inicio");return}
    $("#tab-content").innerHTML='<h3>Administración</h3><p class="muted">Perfiles de agentes registrados. Las cuentas y contraseñas se gestionan en Supabase Authentication.</p><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>N.º agente</th><th>Rol</th><th>Estado</th></tr></thead><tbody>'+agents.map(a=>'<tr><td>'+esc(a.nombre)+'</td><td>'+esc(a.numero_agente)+'</td><td>'+esc(a.rol)+'</td><td>'+(a.activo?"Activo":"Inactivo")+'</td></tr>').join("")+'</tbody></table></div><button id="export" class="secondary">Exportar inspecciones CSV</button>';
    $("#export").onclick=exportCSV;
  }
  function exportCSV(){
    const head=["FECHA INSPECCION","MATRICULA","EMPLAZAMIENTO","PORTAL","BARRIO","DISTRITO","EXPEDIENTE","ESTADO COMPROBACION","AGENTE_ID","OBSERVACIONES","MATRICULA_ADICIONAL_1","ESTADO_MATRICULA_1","MATRICULA_ADICIONAL_2","ESTADO_MATRICULA_2"];
    const rows=checks.map(i=>{const a=auths.find(x=>Number(x.id)===Number(i.autorizacion_id))||{};return[i.fecha_inspeccion,a.matricula,a.emplazamiento,a.numero_portal,a.barrio,a.distrito,a.expediente,i.estado_comprobacion,i.agente_id,i.observaciones,i.matricula_adicional_1,i.estado_matricula_1,i.matricula_adicional_2,i.estado_matricula_2]});
    const csv=[head,...rows].map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="historial_inspecciones_pmr.csv";a.click();URL.revokeObjectURL(url);
  }
  $("#login-form").addEventListener("submit",async e=>{
    e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;b.textContent="Comprobando…";msg("",false);
    try{const {error}=await db.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error)throw error;const {data:{user:u}}=await db.auth.getUser();if(!u)throw Error("No se pudo validar la sesión.");await profile(u)}
    catch(err){msg(err.message||"No se pudo iniciar sesión.")}
    finally{b.disabled=false;b.textContent="Entrar"}
  });
  $("#logout").onclick=async()=>{await db.auth.signOut();user=null;agent=null;$("#app-panel").classList.add("hidden");$("#login-panel").classList.remove("hidden");$("#login-form").reset()};
  db.auth.getSession().then(async({data:{session}})=>{if(session?.user)try{await profile(session.user)}catch(e){msg(e.message)}});
  if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();