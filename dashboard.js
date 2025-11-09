(() => {
  // Configuration — single backend for all panels (only Panel ID changes)
  const CONFIG = {
    BACKEND_BASE: "https://dpp-update-frontend-af02.onrender.com", // Flask API base
    ACCESS_DEFAULT: "tier2",
    // RPC must be a valid Sepolia endpoint with a real project key
    RPC_URL: "https://sepolia.infura.io/v3/<YOUR_REAL_PROJECT_ID>",
    CONTRACT_ADDRESS: "0xF2dCCAddE9dEe3ffF26C98EC63e2c44E08B4C65c",
    EVENT_SIG: "PanelEventAdded(string,bool,string,string,int256,string,uint256)",

    // Default project info (visible immediately, replaced when JSON loads)
    PROJECT_DEFAULT: {
      tower: "Milan Smart Façade Tower",
      location: "Milan, Lombardy, Italy",
      contractor: "Your Contractor S.p.A.",
      factory: "Your Facade Factory S.r.l.",
      installation_date: "2025-10-01"
    }
  };

  // DOM
  const $ = (id) => document.getElementById(id);
  const panelIdEl = $("panelId");
  const accessEl = $("accessTier");
  const jsonOut = $("jsonOut");
  const jsonLink = $("jsonLink");
  const projectMeta = $("projectMeta");
  const eventsHelp = $("eventsHelp");
  const eventsTable = $("eventsTable");
  const eventsBody = $("eventsBody");
  const btnLoadAll = $("btnLoadAll");
  const btnLoadDpp = $("btnLoadDpp");

  // Utils
  function badgeFor(prediction) {
    if (prediction === 0) return '<span class="badge b-blue">normal</span>';
    if (prediction === 1) return '<span class="badge b-red">fault</span>';
    if (prediction === 2) return '<span class="badge b-yellow">warning</span>';
    if (prediction === -1) return '<span class="badge b-purple">system error</span>';
    return `<span class="badge">?</span>`;
  }
  function fmtTime(tsSec) {
    if (!tsSec) return "-";
    const d = new Date(Number(tsSec) * 1000);
    return d.toLocaleString(undefined, { hour12: false });
  }
  function metaItem(label, value) {
    if (!value && value !== 0) return "";
    return `
      <div class="meta-item">
        <div class="meta-label">${label}</div>
        <div class="meta-value">${value}</div>
      </div>
    `;
  }

  // Default project info (render immediately)
  function renderDefaultProjectMeta() {
    const m = CONFIG.PROJECT_DEFAULT;
    projectMeta.innerHTML = [
      metaItem("Tower / Project", m.tower),
      metaItem("Location", m.location),
      metaItem("Contractor", m.contractor),
      metaItem("Facade factory", m.factory),
      metaItem("Installation date", m.installation_date),
      metaItem("Access tier", accessEl.value || CONFIG.ACCESS_DEFAULT)
    ].join("");
  }
  renderDefaultProjectMeta();

  // DPP JSON
  async function loadDpp() {
    const base = CONFIG.BACKEND_BASE.replace(/\/+$/, "");
    const panelId = panelIdEl.value.trim();
    const access = accessEl.value || CONFIG.ACCESS_DEFAULT;

    if (!panelId) { alert("Enter a Panel ID (e.g., ID_27_C_42)."); return; }

    const url = `${base}/api/dpp/${encodeURIComponent(panelId)}?access=${access}`;
    jsonLink.href = url;
    jsonLink.textContent = "Open raw JSON";
    jsonOut.textContent = "Loading JSON...";

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json();

      // Print JSON
      jsonOut.textContent = JSON.stringify(payload, null, 2);

      // Extract and render project metadata (override defaults if present)
      const data = payload.data || {};
      const pi = data.project_info || data.Project_Info || {};
      const contractor = pi.contractor || pi.Contractor || data.contractor || CONFIG.PROJECT_DEFAULT.contractor;
      const factory = pi.factory || pi.Facade_Factory || data.factory || CONFIG.PROJECT_DEFAULT.factory;
      const tower = pi.tower_name || pi.Tower_Name || data.tower_name || CONFIG.PROJECT_DEFAULT.tower;
      const location = pi.location || pi.Location || data.location || CONFIG.PROJECT_DEFAULT.location;
      const installDate = pi.installation_date || pi.Installation_Date || data.installation_date || CONFIG.PROJECT_DEFAULT.installation_date;

      projectMeta.innerHTML = [
        metaItem("Tower / Project", tower),
        metaItem("Location", location),
        metaItem("Contractor", contractor),
        metaItem("Facade factory", factory),
        metaItem("Installation date", installDate),
        metaItem("Access tier", payload.access || access)
      ].join("");
    } catch (err) {
      jsonOut.textContent = `Failed to fetch JSON.\n${String(err)}\n\nIf this is a browser CORS error, enable CORS on your Flask backend:\nfrom flask_cors import CORS\nCORS(app)`;
      // Keep showing defaults so the page never looks empty
      renderDefaultProjectMeta();
    }
  }

  // Blockchain events
  async function loadEvents() {
    eventsHelp.classList.add("hidden");
    eventsTable.classList.remove("hidden");
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading events...</td></tr>`;

    const panelId = panelIdEl.value.trim();
    if (!panelId) { alert("Enter a Panel ID (e.g., ID_27_C_42)."); return; }

    // Guard: RPC must be configured
    const invalidRpc =
      !CONFIG.RPC_URL ||
      CONFIG.RPC_URL.includes("<YOUR_REAL_PROJECT_ID>") ||
      !CONFIG.RPC_URL.startsWith("http");
    if (invalidRpc) {
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">RPC URL is not configured. Set a valid Sepolia endpoint (Infura/Alchemy) in dashboard.js.</td></tr>`;
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const iface = new ethers.Interface([`event ${CONFIG.EVENT_SIG}`]);
      const topic0 = iface.getEvent("PanelEventAdded").topicHash;

      // Query all logs from genesis to latest
      const filter = { address: CONFIG.CONTRACT_ADDRESS, topics: [topic0], fromBlock: 0 };
      const logs = await provider.getLogs(filter);

      const rows = [];
      for (const log of logs) {
        let parsed;
        try { parsed = iface.parseLog(log); } catch { continue; }
        const args = parsed.args;
        const ev = {
          panelId: String(args[0]),
          ok: Boolean(args[1]),
          color: String(args[2]),
          status: String(args[3]),
          prediction: Number(args[4]),
          reason: String(args[5]),
          timestamp: Number(args[6])
        };
        if (ev.panelId !== panelId) continue;

        const timeStr = fmtTime(ev.timestamp);
        const txUrl = `https://sepolia.etherscan.io/tx/${log.transactionHash}`;
        rows.push(`
          <tr>
            <td>${timeStr}</td>
            <td>${badgeFor(ev.prediction)}</td>
            <td>${ev.color}</td>
            <td>${ev.status}</td>
            <td>${ev.reason || "-"}</td>
            <td><a href="${txUrl}" target="_blank">tx</a></td>
          </tr>
        `);
      }

      eventsBody.innerHTML = rows.length
        ? rows.join("")
        : `<tr><td colspan="6" class="muted">No events found for panel “${panelId}”.</td></tr>`;
    } catch (err) {
      const msg = String(err).includes("401")
        ? "Unauthorized RPC: check your provider key and Sepolia access."
        : String(err);
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load events: ${msg}</td></tr>`;
    }
  }

  // Composite
  async function loadAll() {
    await loadDpp();
    await loadEvents();
  }

  // Events
  btnLoadAll.addEventListener("click", loadAll);
  btnLoadDpp.addEventListener("click", loadDpp);

  // Defaults
  accessEl.value = CONFIG.ACCESS_DEFAULT;
})();
