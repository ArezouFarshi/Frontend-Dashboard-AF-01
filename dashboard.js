(() => {
  const CONFIG = {
    BACKEND_BASE: "https://dpp-update-frontend-af02.onrender.com",
    ACCESS_DEFAULT: "public", // start in public mode
    RPC_URL: "https://sepolia.infura.io/v3/6ad85a144d0445a3b181add73f6a55d9",
    CONTRACT_ADDRESS: "0xF2dCCAddE9dEe3ffF26C98EC63e2c44E08B4C65c",
    EVENT_SIG: "PanelEventAdded(string,bool,string,string,int256,string,uint256)"
  };

  const $ = (id) => document.getElementById(id);
  const panelIdEl = $("panelId");
  const accessEl = $("accessTier");
  const accessCodeEl = $("accessCode");   // NEW: Access code field
  const jsonOut = $("jsonOut");
  const jsonLink = $("jsonLink");
  const projectMeta = $("projectMeta");
  const eventsHelp = $("eventsHelp");
  const eventsTable = $("eventsTable");
  const eventsBody = $("eventsBody");
  const btnLoadAll = $("btnLoadAll");
  const btnLoadDpp = $("btnLoadDpp");

  // 🔑 Sync Access tier based on Access code
function syncAccessTier() {
  const code = accessCodeEl.value.trim();

  // Reset access tier
  accessEl.value = "";

  // Match code to tier (same as before)
  if (code === "00") accessEl.value = "public";
  else if (code === "11") accessEl.value = "tier1";
  else if (code === "22") accessEl.value = "tier2";
  else accessEl.value = "";
}

accessCodeEl.addEventListener("input", syncAccessTier);

function ensureValidAccess(selectedTier) {
  syncAccessTier();
  const access = accessEl.value;

  // ✅ Public tier requires no validation
  if (selectedTier === "public") {
    return true;
  }

  // ❌ Invalid or empty code
  if (!access) {
    alert("Enter a valid access code (11 or 22).");
    return false;
  }

  // ❌ Wrong code for tier
  if (
    (access === "tier1" && selectedTier !== "tier1") ||
    (access === "tier2" && selectedTier !== "tier2")
  ) {
    alert("Access code does not match the selected tier.");
    return false;
  }

  // ✅ Correct tier
  return true;
}

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

      jsonOut.textContent = JSON.stringify(payload, null, 2);

      const data = payload.data || {};
      const factory = data.factory_registration || {};
      const install = data.installation_metadata || {};
      const sustainability = data.sustainability_declaration || {};

      // Project info
      const tower = install.tower_name || "Not specified";
      const location = install.location || "Not specified";
      const contractor = factory.manufacturer_name || "Not specified";
      const installDate = install.installation_date || "Not specified";

      // Build project info section
      let html = [
        metaItem("Tower / Project", tower),
        metaItem("Location", location),
        metaItem("Contractor", contractor),
        metaItem("Installation date", installDate)
      ].join("");

      // Add panel overview
      html += [
        metaItem("Panel ID", factory.panel_id),
        metaItem("Manufacturer", factory.manufacturer_name),
        metaItem("Manufacture date", factory.manufacture_date),
        metaItem("Material composition", factory.material_composition),
        metaItem("Declared performance", factory.declared_performance),
        metaItem("Dimensions (mm)", `${factory.width_mm} × ${factory.height_mm} × ${factory.depth_mm}`),
        metaItem("Weight (kg)", factory.panel_weight_kg),
        metaItem("Carbon footprint (EPD)", factory.epd_carbon_footprint),
        metaItem("NFC tag ID", factory.nfc_tag_id)
      ].join("");

      // Add sustainability declaration
      if (Object.keys(sustainability).length > 0) {
        html += `
          <h4>Sustainability Declaration</h4>
          ${metaItem("Carbon footprint", sustainability.carbon_footprint)}
          ${metaItem("Primary energy demand", sustainability.primary_energy_demand)}
          ${metaItem("Water consumption", sustainability.water_consumption)}
          ${metaItem("Waste generated", sustainability.waste_generated)}
          ${metaItem("Resource depletion", sustainability.resource_depletion)}
          ${metaItem("Recyclability", sustainability.recyclability)}
          ${metaItem("Certifications", (sustainability.certifications || []).join(", "))}
        `;
      }

      projectMeta.innerHTML = html;
    } catch (err) {
      jsonOut.textContent = `Failed to fetch JSON.\n${String(err)}\n\nIf this is a browser CORS error, enable CORS on your Flask backend:\nfrom flask_cors import CORS\nCORS(app)`;
      projectMeta.innerHTML = `<div class="muted">Project metadata unavailable.</div>`;
    }
  }

  async function loadEvents() {
    eventsHelp.classList.add("hidden");
    eventsTable.classList.remove("hidden");
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading events...</td></tr>`;

    const panelId = panelIdEl.value.trim();
    if (!panelId) { alert("Enter a Panel ID."); return; }

    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const iface = new ethers.Interface([`event ${CONFIG.EVENT_SIG}`]);
      const topic0 = iface.getEvent("PanelEventAdded").topicHash;

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
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load events: ${String(err)}</td></tr>`;
    }
  }

  async function loadAll() {
    await loadDpp();
    const access = accessEl.value || CONFIG.ACCESS_DEFAULT;
    if (access === "tier1" || access === "tier2") {
      await loadEvents();
    } else {
      eventsHelp.classList.remove("hidden");
      eventsHelp.textContent = "Blockchain logs are restricted to Tier 1 and Tier 2 access.";
      eventsTable.classList.add("hidden");
    }
  }

  btnLoadAll.addEventListener("click", loadAll);
  btnLoadDpp.addEventListener("click", loadDpp);

  accessEl.value = CONFIG.ACCESS_DEFAULT;
})();
