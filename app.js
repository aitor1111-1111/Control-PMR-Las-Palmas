(() => {
  const db = window.supabase.createClient(
    "https://xvyrjxfvetiljpnxmupz.supabase.co",
    "sb_publishable_kJZ7SAwetfUf589-p5BiuA_vNaIFKdB"
  );
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateToday = () => { const d=new Date(); return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
  let user=null, agent=null, auths=[], checks=[], agents=[], tab="inicio", leafletMap=null, markerLayer=null;

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
      db.from("autorizaciones").select("id,numero_original,emplazamiento,numero_portal,barrio,distrito,matricula,expediente,numero_resolucion,fecha_resolucion,latitud,longitud,geocodificacion_estado").order("distrito").order("emplazamiento").limit(2000),
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
    tab=t; tabs(); leafletMap=null; markerLayer=null;
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
  function hasInspection(a){return checks.some(i=>Number(i.autorizacion_id)===Number(a.id))}
  function addressText(a){return [a.emplazamiento,a.numero_portal,a.barrio,a.distrito,"Las Palmas de Gran Canaria","Canarias","España"].filter(Boolean).join(", ")}
  function map(){
    const reviewed=auths.filter(hasInspection).length;
    const q=(window.mapQuery||"").trim().toUpperCase();
    const filtered=auths.filter(a=>!q||[a.matricula,a.emplazamiento,a.numero_portal,a.barrio,a.distrito,a.expediente].some(v=>String(v||"").toUpperCase().includes(q)));
    const visible=filtered;
    $("#tab-content").innerHTML=
      '<h3>Mapa y navegación de emplazamientos</h3>'+
      '<p class="muted">La cartografía integrada anterior se ha retirado porque el servidor de mapas devolvía errores HTTP 400. Se muestran todas las direcciones del registro. Google Maps recibe la calle y el número completos; cuando hay coordenadas verificadas, se utiliza ese punto exacto.</p>'+
      '<div class="map-legend"><span><i class="legend-dot green"></i> Revisado</span><span><i class="legend-dot red"></i> Sin revisar</span></div>'+
      '<div class="stats-grid"><article class="stat-card"><span>Autorizaciones</span><strong>'+auths.length+'</strong></article><article class="stat-card"><span>Revisadas</span><strong>'+reviewed+'</strong></article><article class="stat-card"><span>Sin revisar</span><strong>'+(auths.length-reviewed)+'</strong></article></div>'+
      '<label>Buscar matrícula, calle, portal o barrio<input id="map-filter" value="'+esc(window.mapQuery||"")+'" placeholder="Ej. ACONCAGUA o 1118GZV"></label>'+
      '<p class="muted">Mostrando '+visible.length+' de '+filtered.length+' resultados.</p>'+
      '<div id="map-results">'+visible.map(a=>{
        const done=hasInspection(a),coords=a.geocodificacion_estado==="verificada"&&Number.isFinite(Number(a.latitud))&&a.latitud!==null&&Number.isFinite(Number(a.longitud))&&a.longitud!==null;
        const destination=coords?Number(a.latitud)+","+Number(a.longitud):addressText(a);
        const maps="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(destination);
        return '<article class="map-row '+(done?"map-reviewed":"map-unreviewed")+'"><div class="map-row-info"><b>'+esc(a.emplazamiento)+', '+esc(a.numero_portal)+'</b><p class="muted">'+esc(a.barrio)+' · '+esc(a.distrito)+' · '+esc(a.matricula||"Sin matrícula")+'</p><span class="pill '+(done?"ok":"bad")+'">'+(done?"Revisado":"Sin revisar")+'</span>'+(coords?'<small class="verified-label">Punto exacto verificado</small>':'<small class="muted">Ubicación calculada por Google Maps a partir de la dirección; comprueba el portal.</small>')+'</div><div class="map-actions"><a class="map-open" href="'+maps+'" target="_blank" rel="noopener">Abrir en Google Maps ↗</a>'+(agent.rol==="administrador"&&!coords?'<button class="secondary geocode-btn" data-id="'+a.id+'">Verificar ubicación</button>':'')+'</div></article>';
      }).join("")+'</div>'+
      "";
    $("#map-filter").oninput=e=>{window.mapQuery=e.target.value;map();const input=$("#map-filter");input.focus();input.setSelectionRange(input.value.length,input.value.length)};
    $("#map-results").querySelectorAll(".geocode-btn").forEach(b=>b.onclick=()=>geocodeAuthorization(Number(b.dataset.id),b));
  }
  async function geocodeAuthorization(id,button){
    const a=auths.find(x=>Number(x.id)===id);if(!a||agent.rol!=="administrador")return;
    const address=[a.emplazamiento,a.numero_portal,a.barrio,a.distrito,"Las Palmas de Gran Canaria","España"].filter(Boolean).join(", ");
    button.disabled=true;button.textContent="Abriendo Google Maps…";
    try{
      const mapsUrl="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address);
      window.open(mapsUrl,"_blank","noopener");
      const raw=prompt("Google Maps se ha abierto con esta dirección:\\n\\n"+address+"\\n\\nComprueba el portal exacto. Después pega aquí el enlace del punto de Google Maps o escribe sus coordenadas como LATITUD,LONGITUD.\\n\\nSi no puedes confirmar el punto exacto, pulsa Cancelar.");
      if(raw===null){button.disabled=false;button.textContent="Verificar ubicación";return}
      const text=raw.trim();let lat=null,lon=null;
      const patterns=[
        /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
        /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
        /[?&](?:q|query|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/
      ];
      for(const pattern of patterns){const m=text.match(pattern);if(m){lat=Number(m[1]);lon=Number(m[2]);break}}
      if(lat===null||lon===null){const m=text.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);if(m){lat=Number(m[1]);lon=Number(m[2])}}
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error("No he podido extraer coordenadas. Introduce LATITUD,LONGITUD, por ejemplo 28.12345,-15.43210.");
      if(lat<27||lat>30||lon< -19||lon> -13)throw Error("Las coordenadas no parecen corresponder a Gran Canaria. No se ha guardado nada.");
      if(!confirm("Confirma que el pin corresponde exactamente a "+address+".\\n\\nLatitud: "+lat+"\\nLongitud: "+lon+"\\n\\n¿Guardar esta ubicación verificada?")){button.disabled=false;button.textContent="Verificar ubicación";return}
      const {error}=await db.from("autorizaciones").update({latitud:lat,longitud:lon,geocodificacion_estado:"verificada"}).eq("id",a.id);
      if(error)throw Error("No se pudieron guardar las coordenadas: "+error.message);
      await reload();map();
    }catch(err){alert(err.message);button.disabled=false;button.textContent="Verificar ubicación"}
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