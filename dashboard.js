(() => {
  const CONFIG = {
    BACKEND_BASE: "https://dpp-update-frontend-af02.onrender.com",
    ACCESS_DEFAULT: "public",
    RPC_URL: "https://sepolia.infura.io/v3/6ad85a144d0445a3b181add73f6a55d9",
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
  const perfLoadingModal = $("perfLoadingModal");

  const perfSection = document.querySelector(".performance-overview");
  const perfContent = document.getElementById("perfContent");

  let facadeChart = null;
  let systemChart = null;

  // -------------------------------------------------------
  // Panel ID autocomplete + validation
  // -------------------------------------------------------
  const PANEL_KEY = "saved_panel_ids";

  function savePanelId(id) {
    if (!id) return;
    const list = JSON.parse(localStorage.getItem(PANEL_KEY) || "[]");
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(PANEL_KEY, JSON.stringify(list));
      const dl = document.getElementById("panelSuggestions");
      if (dl) {
        dl.innerHTML = list.map(v => `<option value="${v}"></option>`).join("");
      }
    }
  }

  function attachAutocomplete() {
    const list = JSON.parse(localStorage.getItem(PANEL_KEY) || "[]");
    panelIdEl.setAttribute("list", "panelSuggestions");
    let datalist = document.getElementById("panelSuggestions");
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = "panelSuggestions";
      document.body.appendChild(datalist);
    }
    datalist.innerHTML = list.map(v => `<option value="${v}"></option>`).join("");
  }

  attachAutocomplete();

  function isValidPanelId(id) {
    return /^ID_\d+_[A-Z]_\d+$/.test(id);
  }

  function isValidAccessCode(code) {
    return ["00", "11", "22"].includes(code);
  }

  // -------------------------------------------------------
  // Access Code → Access Tier
  // -------------------------------------------------------
  function syncAccessTier() {
    const code = accessCodeEl.value.trim();
    accessEl.value = "";
    if (code === "00") accessEl.value = "public";
    else if (code === "11") accessEl.value = "tier1";
    else if (code === "22") accessEl.value = "tier2";
  }

  accessCodeEl.addEventListener("input", syncAccessTier);

  function ensureValidAccess(selectedTier) {
    syncAccessTier();
    const access = accessEl.value;
    if (selectedTier === "public") return true;
    if (!access) {
      alert("Enter a valid access code (11 or 22).");
      return false;
    }
    if (
      (access === "tier1" && selectedTier !== "tier1") ||
      (access === "tier2" && selectedTier !== "tier2")
    ) {
      alert("Access code does not match the selected tier.");
      return false;
    }
    return true;
  }

  function badgeFor(pred) {
    if (pred === 0) return '<span class="badge b-blue">normal</span>';
    if (pred === 1) return '<span class="badge b-red">fault</span>';
    if (pred === 2) return '<span class="badge b-yellow">warning</span>';
    if (pred === -1) return '<span class="badge b-purple">system error</span>';
    return `<span class="badge">?</span>`;
  }

  function fmtShortAxis(tsSec) {
  if (!tsSec) return "-";
  const d = new Date(Number(tsSec) * 1000);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

  function fmtShort(tsSec) {
    if (!tsSec) return "-";
    const d = new Date(Number(tsSec) * 1000);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
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
    // Show loading message for DPP
    jsonOut.textContent = "Loading JSON...";
    const base = CONFIG.BACKEND_BASE.replace(/\/+$/, "");
    const panelId = panelIdEl.value.trim();
    const access = accessEl.value || CONFIG.ACCESS_DEFAULT;
    if (!panelId) { alert("Enter a Panel ID."); return; }

    const url = `${base}/api/dpp/${encodeURIComponent(panelId)}?access=${access}`;
    jsonLink.href = url;
    jsonLink.textContent = "Open raw JSON";

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json();

      jsonOut.textContent = JSON.stringify(payload, null, 2);

      const data = payload.data || {};
      const factory = data.factory_registration || {};
      const install = data.installation_metadata || {};
      const sustainability = data.sustainability_declaration || {};

      // Show loading message for Project Info until loaded
      projectMeta.innerHTML = "";

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
    // Show loading message for Blockchain Logs
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading blockchain logs...</td></tr>`;
    eventsHelp.classList.add("hidden");
    eventsTable.classList.remove("hidden");

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

      evs.sort((a, b) => b.timestamp - a.timestamp);

      const rows = evs.map(ev => {
        const timeStr = fmtShort(ev.timestamp);
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
    // Show loading message for Performance Overview
    perfContent.innerHTML = `<div class="muted">Loading performance overview...</div>`;
    const base = CONFIG.BACKEND_BASE.replace(/\/+$/, "");
    const panelId = panelIdEl.value.trim();
    if (!panelId) return;
    if (!window.Chart) return;

    const url = `${base}/api/performance/${encodeURIComponent(panelId)}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      const data = payload.data || {};

      // Fill .performance-overview section with graphs after data loaded
      perfContent.innerHTML = `
        <h4>Façade Performance / SSI / TBI</h4>
        <div class="graph-wrapper">
          <canvas id="facadePerformanceGraph"></canvas>
        </div>
        <h4>System Error Timeline</h4>
        <div class="graph-wrapper">
          <canvas id="systemAnalysisGraph"></canvas>
        </div>
      `;

      const facadePerfCanvas = $("facadePerformanceGraph");
      const systemAnalysisCanvas = $("systemAnalysisGraph");

      renderPerformanceGraph(data, facadePerfCanvas);
      renderSystemGraph(data, systemAnalysisCanvas);

    } catch (err) {
      perfContent.innerHTML = '<div class="muted">Performance data unavailable.</div>';
      console.error("Perf error:", err);
    }
  }

  // -------------------------------------------------------
  // LOAD ALL (main)
  // -------------------------------------------------------
  async function loadAll() {
    const panelId = panelIdEl.value.trim();
    const accessCode = accessCodeEl.value.trim();

    // keep tier in sync with code
    syncAccessTier();
    let access = accessEl.value; // DO NOT default yet

    // Panel ID check → ONLY this message
    if (!isValidPanelId(panelId)) {
      alert("Invalid Panel ID");
      return;
    }

    // If no tier chosen
    if (!access) {
      if (!accessCode) {
        // no tier, no code → default to public
        access = CONFIG.ACCESS_DEFAULT; // "public"
        accessEl.value = access;
      } else {
        // code exists but no tier mapped → invalid code or wrong tier
        if (!isValidAccessCode(accessCode)) {
          alert("Invalid access code.");
        } else {
          alert("Choose access tier.");
        }
        return;
      }
    }

    // Public → no code needed
    if (access !== "public" && !isValidAccessCode(accessCode)) {
      alert("Invalid access code.");
      return;
    }

    savePanelId(panelId);
    
// ----- Live Digital Twin (same logic as other sections) -----
const liveTwinContent = document.getElementById("liveTwinContent");
const tplTier1 = document.getElementById("tplLiveTwinTier1").innerHTML;
const tplLocked = document.getElementById("tplLiveTwinLocked").innerHTML;

// always show section → reset loader
liveTwinContent.innerHTML = `<div class="muted">Loading project information...</div>`;

// apply access logic AFTER everything loads
setTimeout(() => {
  if (access === "tier1") {
    // full access → link + QR
    liveTwinContent.innerHTML = tplTier1;
  } else {
    // restricted → same behavior as blockchain logs + performance
    liveTwinContent.innerHTML = tplLocked;
  }
}, 300);


} else {
  liveTwin.classList.add("hidden");
}


    perfLoadingModal.classList.remove("hidden"); // SHOW POPUP IMMEDIATELY

    // Show loading messages in all sections
    projectMeta.innerHTML = `<div class="muted">Loading project information...</div>`;
    perfContent.innerHTML = `<div class="muted">Loading performance overview...</div>`;
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading blockchain logs...</td></tr>`;
    jsonOut.textContent = "Loading JSON...";

    await loadDpp();

    if (access === "tier1" || access === "tier2") {
      await loadEvents();
      await loadPerformance();
    } else {
      eventsHelp.classList.remove("hidden");
      eventsHelp.textContent = "Blockchain logs are restricted to Tier 1 and Tier 2.";
      eventsTable.classList.add("hidden");
      perfContent.innerHTML = '';
    }

    perfLoadingModal.classList.add("hidden"); // HIDE POPUP ONLY WHEN DONE
  }
// -------------------------------------------------------
// PERFORMANCE GRAPH (PS, SSI, TBI)
// -------------------------------------------------------
function renderPerformanceGraph(data, canvas) {
  const points = data.points || [];
  const labels = points.map(p => fmtShortAxis(p.timestamp_unix));
  const perf = points.map(p => p.performance_numeric);
  const ssi = points.map(p => p.ssi);
  const tbi = points.map(p => p.tbi);

  if (facadeChart) facadeChart.destroy();

  facadeChart = new Chart(canvas, {
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
      scales: {
        x: {
          title: { display: false },
          ticks: {
            maxTicksLimit: 12,
            callback: function(val) {
              const label = this.getLabelForValue(val);
              const d = new Date(label);
              return d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              });
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const y = ctx.parsed.y.toFixed(2);
              if (ctx.dataset.label.includes("PS")) {
                return [
                  "Façade Performance Score",
                  "A way of quantifying how well a building's exterior, or façade, performs in terms of factors like energy efficiency, safety, and durability",
                  "PS = (SSI × 0.5 + TBI × 0.5) / 25",
                  `Value: ${y}`
                ];
              }
              if (ctx.dataset.label.includes("SSI")) {
                return [
                  "Structural Stability Index",
                  "Quantifies a structure's ability to resist forces and maintain its integrity.",
                  "SSI = 100 − (0.35·Fₛ + 0.35·Sₛ + 0.20·T_last + 0.10·Nₛ)",
                  `Value: ${y}`
                ];
              }
              if (ctx.dataset.label.includes("TBI")) {
                return [
                  "Thermal–Behavior Index",
                  "Evaluates a façade's thermal characteristics and performance under different conditions",
                  "TBI = 100 − (0.40·Gₜ + 0.25·Rₜ + 0.20·Aₜ + 0.15·Mₜ)",
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
// SYSTEM ERROR GRAPH (Show ALL events, past/future)
// -------------------------------------------------------
function renderSystemGraph(data, canvas) {
  const events = data.system_events || [];
  if (systemChart) systemChart.destroy();

  const sensorPoints = [];
  const mlPoints = [];

  events.forEach((e) => {
    const point = {
      x: new Date(e.timestamp_unix * 1000),
      y: 1,
      reason: e.reason || ""
    };
    if (e.reason.toLowerCase().includes("ml")) {
      mlPoints.push(point);
    } else {
      sensorPoints.push(point);
    }
  });

  // Compute min/max for X axis
  let minDate = null, maxDate = null;
  if (events.length > 0) {
    minDate = new Date(Math.min(...events.map(e => e.timestamp_unix * 1000)));
    maxDate = new Date(Math.max(...events.map(e => e.timestamp_unix * 1000)));
    if (minDate.getTime() === maxDate.getTime()) {
      minDate = new Date(minDate.getTime() - 24*3600*1000);
      maxDate = new Date(maxDate.getTime() + 24*3600*1000);
    }
  }

  systemChart = new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Sensor / Equipment Faults",
          data: sensorPoints,
          backgroundColor: "#c084fc",
          pointRadius: 6
        },
        {
          label: "ML System Faults",
          data: mlPoints,
          backgroundColor: "#5b21b6",
          pointRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            tooltipFormat: "dd MMM yyyy"
          },
          ticks: {
            callback: function(value) {
              const d = new Date(value);
              return d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              });
            }
          },
          title: { display: true, text: "Date" },
          min: minDate,
          max: maxDate
        },
        y: {
          display: false,
          min: 0,
          max: 2
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw.x;
              const label = ctx.dataset.label;
              const reason = ctx.raw.reason;
              return `${label} @ ${d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              })} — ${reason}`;
            }
          }
        }
      }
    }
  });
}

  // -------------------------------------------------------
  btnLoadAll.addEventListener("click", loadAll);
  btnLoadDpp.addEventListener("click", loadDpp);

  accessEl.value = CONFIG.ACCESS_DEFAULT;
})();
