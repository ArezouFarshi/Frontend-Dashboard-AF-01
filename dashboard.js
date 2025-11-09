(() => {
  // Configuration — single backend/frontend for all panels (only Panel ID changes)
  const CONFIG = {
    BACKEND_BASE: "https://dpp-update-frontend-af02.onrender.com", // Flask API base
    ACCESS_DEFAULT: "tier2",
    RPC_URL: "https://sepolia.infura.io/v3/<your-project-id>",
    CONTRACT_ADDRESS: "0xF2dCCAddE9dEe3ffF26C98EC63e2c44E08B4C65c",
    EVENT_SIG: "PanelEventAdded(string,bool,string,string,int256,string,uint256)"
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

      // Extract and render project metadata (if present)
      projectMeta.innerHTML = "";
      const data = payload.data || {};
      const pi = data.project_info || data.Project_Info || {};
      const contractor = pi.contractor || pi.Contractor || data.contractor || "";
      const factory = pi.factory || pi.Facade_Factory || data.factory || "";
      const tower = pi.tower_name || pi.Tower_Name || data.tower_name || "";
      const location = pi.location || pi.Location || data.location || "";
      const installDate = pi.installation_date || pi.Installation_Date || data.installation_date || "";

      const metaHtml = [
        metaItem("Tower / Project", tower || ""),
        metaItem("Location", location || ""),
        metaItem("Contractor", contractor || ""),
        metaItem("Facade factory", factory || ""),
        metaItem("Installation date", installDate || ""),
        metaItem("Access tier", payload.access || "")
      ].join("");
      projectMeta.innerHTML = metaHtml || `<div class="muted">No project metadata found in JSON.</div>`;
    } catch (err) {
      jsonOut.textContent = `Failed to fetch JSON.\n${String(err)}\n\nIf this is a browser CORS error, enable CORS on your Flask backend:\nfrom flask_cors import CORS\nCORS(app)`;
      projectMeta.innerHTML = `<div class="muted">Project metadata unavailable.</div>`;
    }
  }

  // Blockchain events
  async function loadEvents() {
    eventsHelp.classList.add("hidden");
    eventsTable.classList.remove("hidden");
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading events...</td></tr>`;

    const panelId = panelIdEl.value.trim();
    if (!panelId) { alert("Enter a Panel ID (e.g., ID_27_C_42)."); return; }

    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const iface = new ethers.Interface([`event ${CONFIG.EVENT_SIG}`]);
      const topic0 = iface.getEvent("PanelEventAdded").topicHash;

      // Query all logs for the contract; provider handles latest block
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

      if (rows.length === 0) {
        eventsBody.innerHTML = `<tr><td colspan="6" class="muted">No events found for panel “${panelId}”.</td></tr>`;
      } else {
        eventsBody.innerHTML = rows.join("");
      }
    } catch (err) {
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load events: ${String(err)}</td></tr>`;
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
