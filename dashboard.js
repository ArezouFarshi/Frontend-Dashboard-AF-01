(() => {
  const CONFIG = {
    BACKEND_BASE: "https://dpp-update-frontend-af02.onrender.com",
    ACCESS_DEFAULT: "public",
    RPC_URL: "https://sepolia.infura.io/v3/51bc36040f314e85bf103ff18c570993",
    CONTRACT_ADDRESS: "0xF2dCCAddE9dEe3ffF26C98EC63e2c44E08B4C65c",
    EVENT_SIG: "PanelEventAdded(string,bool,string,string,int256,string,uint256)"
  };

  const $ = (id) => document.getElementById(id);
  const panelIdEl = $("panelId");
  const accessEl = $("accessTier");
  const accessCodeEl = $("accessCode");
  const jsonOut = $("jsonOut");
  const jsonLink = $("jsonLink");
  const projectMeta = $("projectMeta");
  const eventsHelp = $("eventsHelp");
  const eventsTable = $("eventsTable");
  const eventsBody = $("eventsBody");
  const btnLoadAll = $("btnLoadAll");
  const btnLoadDpp = $("btnLoadDpp");
  const loadMessageEl = $("loadMessage");

  const facadePerfCanvas = $("facadePerformanceGraph");
  const systemAnalysisCanvas = $("systemAnalysisGraph");

  const perfBody = $("performanceBody");

  let facadeChart = null;
  let systemChart = null;

  // -------------------------------------------------------
  // Access Code → Access Tier
  // -------------------------------------------------------
  function syncAccessTier() {
    if (!accessCodeEl || !accessEl) return;
    const code = accessCodeEl.value.trim();
    accessEl.value = "";
    if (code === "00") accessEl.value = "public";
    else if (code === "11") accessEl.value = "tier1";
    else if (code === "22") accessEl.value = "tier2";
  }

  if (accessCodeEl) {
    accessCodeEl.addEventListener("input", syncAccessTier);
  }

  function badgeFor(pred) {
    if (pred === 0) return '<span class="badge b-blue">normal</span>';
    if (pred === 1) return '<span class="badge b-red">fault</span>';
    if (pred === 2) return '<span class="badge b-yellow">warning</span>';
    if (pred === -1) return '<span class="badge b-purple">system error</span>';
    return `<span class="badge">?</span>`;
  }

  // Short label for graph X-axis: Month + Year
  function fmtGraphLabel(tsSec) {
    if (!tsSec) return "-";
    const d = new Date(Number(tsSec) * 1000);
    return d.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric"
    });
  }

  // Full timestamp for blockchain logs
  function fmtFullTimestamp(tsSec) {
    if (!tsSec) return "-";
    return new Date(Number(tsSec) * 1000).toISOString();
  }

  function metaItem(label, value) {
    if (!value && value !== 0) return "";
    return `
      <div class="meta-item">
        <div class="meta-label">${label}</div>
        <div class="meta-value">${value}</div>
      </div>`;
  }

  // -------------------------------------------------------
  // Load DPP JSON
  // -------------------------------------------------------
  async function loadDpp() {
    if (!panelIdEl || !jsonOut || !jsonLink || !projectMeta) return;

    const base = CONFIG.BACKEND_BASE.replace(/\/+$/, "");
    const panelId = panelIdEl.value.trim();
    const access = (accessEl && accessEl.value) || CONFIG.ACCESS_DEFAULT;

    if (!panelId) { alert("Enter a Panel ID."); return; }

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

      let html = [
        metaItem("Tower / Project", install.tower_name),
        metaItem("Location", install.location),
        metaItem("Contractor", factory.manufacturer_name),
        metaItem("Installation date", install.installation_date)
      ].join("");

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
      jsonOut.textContent = `Failed to fetch JSON.\n${String(err)}`;
      projectMeta.innerHTML = `<div class="muted">Project metadata unavailable.</div>`;
    }
  }

  // -------------------------------------------------------
  // Blockchain Logs
  // -------------------------------------------------------
  async function loadEvents() {
    if (!panelIdEl || !eventsHelp || !eventsTable || !eventsBody) return;

    eventsHelp.classList.add("hidden");
    eventsTable.classList.remove("hidden");
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading events...</td></tr>`;

    const panelId = panelIdEl.value.trim();
    if (!panelId) { alert("Enter a Panel ID."); return; }

    try {
      if (typeof ethers === "undefined") {
        throw new Error("ethers not available");
      }

      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const iface = new ethers.Interface([`event ${CONFIG.EVENT_SIG}`]);
      const topic0 = iface.getEvent("PanelEventAdded").topicHash;

      const filter = { address: CONFIG.CONTRACT_ADDRESS, topics: [topic0], fromBlock: 0 };
      const logs = await provider.getLogs(filter);

      const evs = [];
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
          timestamp: Number(args[6]),
          txHash: log.transactionHash
        };
        if (ev.panelId !== panelId) continue;
        evs.push(ev);
      }

      evs.sort((a, b) => b.timestamp - a.timestamp);

      const rows = evs.map(ev => {
        const timeStr = fmtFullTimestamp(ev.timestamp);
        const txUrl = `https://sepolia.etherscan.io/tx/${ev.txHash}`;
        return `
          <tr>
            <td>${timeStr}</td>
            <td>${badgeFor(ev.prediction)}</td>
            <td>${ev.color}</td>
            <td>${ev.status}</td>
            <td>${ev.reason || "-"}</td>
            <td><a href="${txUrl}" target="_blank">tx</a></td>
          </tr>`;
      });

      eventsBody.innerHTML = rows.length
        ? rows.join("")
        : `<tr><td colspan="6" class="muted">No events found.</td></tr>`;
    } catch (err) {
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load events: ${String(err)}</td></tr>`;
    }
  }

  // -------------------------------------------------------
  // LOAD PERFORMANCE
  // -------------------------------------------------------
  async function loadPerformance() {
    if (!panelIdEl || !facadePerfCanvas || !systemAnalysisCanvas) return;
    if (!window.Chart) return;

    const base = CONFIG.BACKEND_BASE.replace(/\/+$/, "");
    const panelId = panelIdEl.value.trim();
    if (!panelId) return;

    const url = `${base}/api/performance/${encodeURIComponent(panelId)}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      const data = payload.data || {};

      renderPerformanceGraph(data);
      renderSystemGraph(data);

      if (perfBody) {
        perfBody.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Perf error:", err);
    }
  }

  // -------------------------------------------------------
  // LOAD ALL (main)
  // -------------------------------------------------------
  async function loadAll() {
    const access = (accessEl && accessEl.value) || CONFIG.ACCESS_DEFAULT;

    const tasks = [loadDpp()];

    if (access === "tier1" || access === "tier2") {
      tasks.push(loadEvents());
      tasks.push(loadPerformance());
      if (eventsHelp) eventsHelp.classList.add("hidden");
    } else {
      if (eventsHelp) {
        eventsHelp.classList.remove("hidden");
        eventsHelp.textContent = "Blockchain logs are restricted to Tier 1 and Tier 2.";
      }
      if (eventsTable) eventsTable.classList.add("hidden");
      if (perfBody) perfBody.classList.add("hidden");
    }

    await Promise.all(tasks);
  }

  // -------------------------------------------------------
  // PERFORMANCE GRAPH (PS, SSI, TBI)
  // -------------------------------------------------------
  function renderPerformanceGraph(data) {
    const points = data.points || [];
    const labels = points.map(p => fmtGraphLabel(p.timestamp_unix));
    const perf = points.map(p => p.performance_numeric);
    const ssi = points.map(p => p.ssi);
    const tbi = points.map(p => p.tbi);

    if (facadeChart) facadeChart.destroy();

    facadeChart = new Chart(facadePerfCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Façade Performance Score (PS)",
            data: perf,
            borderColor: "#0057ff",
            tension: 0.25
          },
          {
            label: "Structural Stability Index (SSI)",
            data: ssi,
            borderColor: "#00a86b",
            tension: 0.25
          },
          {
            label: "Thermal–Behavior Index (TBI)",
            data: tbi,
            borderColor: "#ff7f0e",
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const y = ctx.parsed.y.toFixed(2);
                if (ctx.dataset.label.includes("PS")) {
                  return [
                    "Façade Performance Score",
                    "Definition: Overall envelope condition",
                    "Formula: PS = (SSI × 0.5 + TBI × 0.5) / 25",
                    `Value: ${y}`
                  ];
                }
                if (ctx.dataset.label.includes("SSI")) {
                  return [
                    "Structural Stability Index",
                    "Definition: Tilt/sensor stability",
                    "Formula: SSI = 100 − (0.35·Fₛ + 0.35·Sₛ + 0.20·T_last + 0.10·Nₛ)",
                    `Value: ${y}`
                  ];
                }
                if (ctx.dataset.label.includes("TBI")) {
                  return [
                    "Thermal–Behavior Index",
                    "Definition: Thermal deviation behavior",
                    "Formula: TBI = 100 − (0.40·Gₜ + 0.25·Rₜ + 0.20·Aₜ + 0.15·Mₜ)`,
                    `Value: ${y}`
                  ];
                }
                return `${ctx.dataset.label}: ${y}`;
              }
            }
          }
        }
      }
    });
  }

  // -------------------------------------------------------
  // SYSTEM ERROR GRAPH  (2 purple series with visible dots)
  // -------------------------------------------------------
  function renderSystemGraph(data) {
    const events = data.system_events || [];

    if (systemChart) systemChart.destroy();

    if (!events.length) {
      systemChart = new Chart(systemAnalysisCanvas, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: { responsive: true, maintainAspectRatio: false }
      });
      return;
    }

    const labels = events.map(e => fmtGraphLabel(e.timestamp_unix));
    const sensorSeries = [];
    const mlSeries = [];

    events.forEach((e) => {
      const reason = (e.reason || "").toLowerCase();
      const isML = reason.includes("ml"); // e.g. "MLFailure"

      if (isML) {
        mlSeries.push(1);
        sensorSeries.push(null);
      } else {
        sensorSeries.push(1);
        mlSeries.push(null);
      }
    });

    systemChart = new Chart(systemAnalysisCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sensor / Equipment System Faults",
            data: sensorSeries,
            borderColor: "#c084fc",
            backgroundColor: "#c084fc",
            pointRadius: 5,
            showLine: false,
            spanGaps: false
          },
          {
            label: "ML System Faults",
            data: mlSeries,
            borderColor: "#5b21b6",
            backgroundColor: "#5b21b6",
            pointRadius: 5,
            showLine: false,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: "category" },
          y: { display: false, suggestedMin: 0, suggestedMax: 1.5 }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const ev = events[idx];
                return `${ctx.dataset.label} — ${ev.reason}`;
              }
            }
          }
        }
      }
    });
  }

  // -------------------------------------------------------
  // Show temporary "please wait" message
  // -------------------------------------------------------
  function showLoadMessage() {
    if (!loadMessageEl) return;
    loadMessageEl.classList.remove("hidden");
    if (loadMessageEl._hideTimer) clearTimeout(loadMessageEl._hideTimer);
    loadMessageEl._hideTimer = setTimeout(() => {
      loadMessageEl.classList.add("hidden");
    }, 4000);
  }

  // -------------------------------------------------------
  // Bind buttons (defensively)
  // -------------------------------------------------------
  if (btnLoadAll) {
    btnLoadAll.addEventListener("click", () => {
      showLoadMessage();
      loadAll();
    });
  }

  if (btnLoadDpp) {
    btnLoadDpp.addEventListener("click", loadDpp);
  }

  if (accessEl) {
    accessEl.value = CONFIG.ACCESS_DEFAULT;
  }
})();
