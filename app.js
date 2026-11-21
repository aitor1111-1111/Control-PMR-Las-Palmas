(() => {
  const SUPABASE_URL = "https://xvyrjxfvetiljpnxmupz.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kJZ7SAwetfUf589-p5BiuA_vNaIFKdB";
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const loginPanel = document.querySelector("#login-panel");
  const appPanel = document.querySelector("#app-panel");
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#login-message");

  function showMessage(text, error = true) {
    message.textContent = text;
    message.style.color = error ? "#a33333" : "#216143";
  }

  async function loadProfile(user) {
    const { data: agent, error } = await client
      .from("agentes")
      .select("id,nombre,numero_agente,rol,activo")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw new Error("No se pudo consultar el perfil del agente: " + error.message);
    if (!agent || !agent.activo) {
      await client.auth.signOut();
      throw new Error("Tu usuario no tiene un perfil activo en el registro de agentes. Contacta con Administración.");
    }

    loginPanel.classList.add("hidden");
    appPanel.classList.remove("hidden");
    document.querySelector("#welcome").textContent = agent.nombre || user.email || "Agente";
    document.querySelector("#agent-meta").textContent =
      [agent.numero_agente ? "N.º agente " + agent.numero_agente : "", agent.rol].filter(Boolean).join(" · ");
    document.querySelector("#admin-tab").classList.toggle("hidden", agent.rol !== "administrador");
    document.querySelector("#connection-status").textContent = "Sesión autenticada · Perfil verificado";
    return agent;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;
    const submit = form.querySelector("button");
    submit.disabled = true;
    submit.textContent = "Comprobando…";
    showMessage("", false);
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("No se pudo validar la sesión.");
      await loadProfile(user);
    } catch (error) {
      showMessage(error.message || "No se pudo iniciar sesión.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Entrar";
    }
  });

  document.querySelector("#logout").addEventListener("click", async () => {
    await client.auth.signOut();
    appPanel.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    form.reset();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button));
      const labels = {
        inicio: ["Inicio", "La sesión está autenticada. El catálogo de autorizaciones se conectará en el siguiente paso."],
        buscar: ["Buscar autorizaciones", "Pendiente de conectar la tabla de autorizaciones PMR."],
        incidencias: ["Incidencias", "Aquí aparecerán las inspecciones con resultado distinto de OK."],
        historial: ["Historial", "Aquí aparecerá el historial de inspecciones registradas."],
        mapa: ["Mapa", "La geolocalización se incorporará cuando validemos las direcciones."],
        administracion: ["Administración", "Área reservada al perfil administrador."]
      };
      const [title, description] = labels[button.dataset.tab];
      document.querySelector("#tab-content").innerHTML = "<h3>" + title + "</h3><p>" + description + "</p>";
    });
  });

  client.auth.getSession().then(async ({ data: { session } }) => {
    if (session?.user) {
      try { await loadProfile(session.user); }
      catch (error) { showMessage(error.message); }
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();