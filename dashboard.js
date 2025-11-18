(() => {
  const CONFIG = {
    BACKEND_BASE: "https://dpp-update-frontend-af02.onrender.com",
    ACCESS_DEFAULT: "public", // start in public mode
    RPC_URL: "https://sepolia.infura.io/v3/51bc36040f314e85bf103ff18c570993",
    CONTRACT_ADDRESS: "0xF2dCCAddE9dEe3ffF26C98EC63e2c44E08B4C65c",
    EVENT_SIG: "PanelEventAdded(string,bool,string,string,int256,string,uint256)"
  };

  const $ = (id) => document.getElementById(id);
  const panelIdEl = $("panelId");
  const accessEl = $("accessTier");
  const accessCodeEl = $("accessCode");   // Access code field
  const jsonOut = $("jsonOut");
  const jsonLink = $("jsonLink");
  const projectMeta = $("projectMeta");
  const eventsHelp = $("eventsHelp");
  const eventsTable = $("eventsTable");
  const eventsBody = $("eventsBody");
  const btnLoadAll = $("btnLoadAll");
  const btnLoadDpp = $("btnLoadDpp");

  // NEW: extra UI elements
  const facadePerfCanvas = $("facadePerformanceGraph");
  const systemAnalysisCanvas = $("systemAnalysisGraph");
  const perfHelp = $("performanceHelp");
  const loadingHint = $("loadingHint");

  // Keep Chart instances so we can update them cleanly
  let facadeChart = null;
  let systemChart = null;

  // 🔑 Sync Access tier based on Access code
  function syncAccessTier() {
    const code = accessCodeEl.value.trim();
    accessEl.value = "";

    if (code === "00") accessEl.value = "public";
    else if (code === "11") accessEl.value = "tier1";
    else if (code === "22") accessEl.value = "tier2";
    else accessEl.value = "";
  }

  accessCodeEl.addEventListener("input", syncAccessTier);

  function ensureValidAccess(selectedTier) {
    syncAccessTier();
    const access = accessEl.value;

    // Public tier requires no validation
    if (selectedTier === "public") {
      return true;
    }

    // Invalid or empty code
    if (!access) {
      alert("Enter a valid access code (11 or 22).");
      return false;
    }

    // Wrong code for tier
    if (
      (access === "tier1" && selectedTier !== "tier1") ||
      (access === "tier2" && selectedTier !== "tier2")
    ) {
      alert("Access code does not match the selected tier.");
      return false;
    }

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

  // NEW: compact date label for graphs (YYYY-MM-DD only)
  function shortDateLabel(isoStr) {
    if (!isoStr) return "";
    // If already YYYY-MM-DD
    if (isoStr.length <= 10 && isoStr.includes("-")) return isoStr;
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) {
      const head = isoStr.split("T")[0];
      return head || isoStr;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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

      let html = [
        metaItem("Tower / Project", tower),
        metaItem("Location", location),
        metaItem("Contractor", contractor),
        metaItem("Installation date", installDate)
      ].join("");

      // Panel overview
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

      // Sustainability
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

      // newest → oldest
      evs.sort((a, b) => b.timestamp - a.timestamp);

      const rows = evs.map(ev => {
        const timeStr = fmtTime(ev.timestamp);
        const txUrl = `https://sepolia.etherscan.io/tx/${ev.txHash}`;
        return `
          <tr>
            <td>${timeStr}</td>
            <td>${badgeFor(ev.prediction)}</td>
            <td>${ev.color}</td>
            <td>${ev.status}</td>
            <td>${ev.reason || "-"}</td>
            <td><a href="${txUrl}" target="_blank">tx</a></td>
          </tr>
        `;
      });

      eventsBody.innerHTML = rows.length
        ? rows.join("")
        : `<tr><td colspan="6" class="muted">No events found for panel “${panelId}”.</td></tr>`;
    } catch (err) {
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load events: ${String(err)}</td></tr>`;
    }
  }

  // Load performance data from backend and draw graphs
  async function loadPerformance() {
    const base = CONFIG.BACKEND_BASE.replace(/\/+$/, "");
    const panelId = panelIdEl.value.trim();
    if (!panelId) return;
    if (!window.Chart) {
      console.warn("Chart.js is not available; skipping performance graphs.");
      return;
    }

    const url = `${base}/api/performance/${encodeURIComponent(panelId)}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.error("Performance endpoint error:", res.status, res.statusText);
        return;
      }
      const payload = await res.json();
      const data = payload.data || {};
      renderPerformanceGraph(data);
      renderSystemGraph(data);

      if (perfHelp) {
        perfHelp.classList.add("hidden");
      }
    } catch (err) {
      console.error("Performance load error:", err);
    }
  }

  // MAIN: load everything together
  async function loadAll() {
    const panelId = panelIdEl.value.trim();
    if (!panelId) {
      alert("Enter a Panel ID (e.g., ID_27_C_42).");
      return;
    }

    const selectedTier = accessEl.value || CONFIG.ACCESS_DEFAULT;
    if (!ensureValidAccess(selectedTier)) return;

    if (loadingHint) {
      loadingHint.textContent = "Loading panel data... This may take a few seconds. Please wait.";
      loadingHint.classList.remove("hidden");
    }

    await loadDpp();

    if (selectedTier === "tier1" || selectedTier === "tier2") {
      // Load logs + graphs in parallel to avoid extra delay
      await Promise.all([loadEvents(), loadPerformance()]);
    } else {
      // Public: only JSON + project info
      eventsHelp.classList.remove("hidden");
      eventsHelp.textContent = "Blockchain logs are restricted to Tier 1 and Tier 2 access.";
      eventsTable.classList.add("hidden");
      // We simply do not load performance graphs for public.
    }

    if (loadingHint) {
      loadingHint.classList.add("hidden");
    }
  }

  // PERFORMANCE GRAPH: PS, SSI, TBI
  function renderPerformanceGraph(data) {
    if (!facadePerfCanvas || !window.Chart) return;

    const points = data.points || [];
    const labels = points.map(p => shortDateLabel(p.timestamp));

    const ssi = points.map(p => p.ssi);
    const tbi = points.map(p => p.tbi);
    const perf = points.map(p => p.performance_numeric);

    if (facadeChart) {
      facadeChart.destroy();
    }

    facadeChart = new Chart(facadePerfCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Façade Performance Score (PS)",
            data: perf,
            borderColor: "#0057ff",
            tension: 0.25,
            yAxisID: "yPS"
          },
          {
            label: "Structural Stability Index (SSI)",
            data: ssi,
            borderColor: "#00a86b",
            tension: 0.25,
            yAxisID: "yIndex"
          },
          {
            label: "Thermal Behavior Index (TBI)",
            data: tbi,
            borderColor: "#ff7f0e",
            tension: 0.25,
            yAxisID: "yIndex"
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
                const value = ctx.parsed.y;
                if (ctx.dataset.label.startsWith("Façade Performance Score")) {
                  return `PS (overall façade performance).\nFormula: PS = (SSI × 0.5 + TBI × 0.5) / 25 | Value: ${value.toFixed(2)}`;
                }
                if (ctx.dataset.label.startsWith("Structural Stability")) {
                  return `SSI (structural stability index).\nFormula: SSI = 100 − (0.35·Fₛ + 0.35·Sₛ + 0.20·T_last + 0.10·Nₛ) | Value: ${value.toFixed(2)}`;
                }
                if (ctx.dataset.label.startsWith("Thermal Behavior")) {
                  return `TBI (thermal behavior index).\nFormula: TBI = 100 − (0.40·Gₜ + 0.25·Rₜ + 0.20·Aₜ + 0.15·Mₜ) | Value: ${value.toFixed(2)}`;
                }
                return `${ctx.dataset.label}: ${value.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          yPS: {
            position: "left",
            beginAtZero: true,
            suggestedMax: 4,
            title: {
              display: true,
              text: "Performance score (1–4)"
            }
          },
          yIndex: {
            position: "right",
            beginAtZero: true,
            suggestedMax: 100,
            title: {
              display: true,
              text: "Index scale (0–100)"
            },
            grid: {
              drawOnChartArea: false
            }
          },
          x: {
            ticks: {
              maxRotation: 0,
              autoSkip: true
            }
          }
        }
      }
    });
  }

  // SYSTEM ERROR GRAPH: sensor/equipment vs ML faults
  function renderSystemGraph(data) {
    if (!systemAnalysisCanvas || !window.Chart) return;

    const events = data.system_events || [];
    if (systemChart) {
      systemChart.destroy();
    }

    const sensorEvents = events.filter(e =>
      e.reason && !String(e.reason).toLowerCase().includes("mlfailure")
    );
    const mlEvents = events.filter(e =>
      e.reason && String(e.reason).toLowerCase().includes("mlfailure")
    );

    const sensorPoints = sensorEvents.map(e => ({
      x: shortDateLabel(e.timestamp),
      y: 1
    }));
    const mlPoints = mlEvents.map(e => ({
      x: shortDateLabel(e.timestamp),
      y: 1
    }));

    systemChart = new Chart(systemAnalysisCanvas, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "System faults – sensors / equipment",
            data: sensorPoints,
            backgroundColor: "#c4b5fd", // light purple
            pointRadius: 5
          },
          {
            label: "System faults – ML pipeline",
            data: mlPoints,
            backgroundColor: "#7c3aed", // deep purple
            pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        scales: {
          x: {
            type: "category",
            ticks: {
              maxRotation: 0,
              autoSkip: true
            }
          },
          y: {
            display: false
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const dsIndex = ctx.datasetIndex;
                const idx = ctx.dataIndex;
                const srcArray = dsIndex === 0 ? sensorEvents : mlEvents;
                const e = srcArray[idx];
                if (!e) return "";
                return `${e.timestamp} – ${e.reason}`;
              }
            }
          }
        }
      }
    });
  }

  btnLoadAll.addEventListener("click", loadAll);
  btnLoadDpp.addEventListener("click", loadDpp);

  accessEl.value = CONFIG.ACCESS_DEFAULT;
})();
