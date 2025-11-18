(() => {
  const CONFIG = {
    BACKEND_BASE: "https://dpp-update-frontend-af02.onrender.com",
    ACCESS_DEFAULT: "public"
    // RPC_URL, CONTRACT_ADDRESS, EVENT_SIG NOT NEEDED ANYMORE (backend-only)
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

  function badgeFor(predRaw) {
    const pred = Number(predRaw);
    if (pred === 0) return '<span class="badge b-blue">normal</span>';
    if (pred === 1) return '<span class="badge b-red">fault</span>';
    if (pred === 2) return '<span class="badge b-yellow">warning</span>';
    if (pred === -1) return '<span class="badge b-purple">system error</span>';
    return `<span class="badge">?</span>`;
  }

  function fmtShortAxis(tsSec) {
    if (!tsSec) return "-";
    const d = new Date(Number(tsSec) * 1000);
    return d.toLocaleString("en-US", {
      month: "short",
      year: "2-digit"
    });
  }

  function fmtShortDateTime(date) {
    if (!date) return "-";
    return date.toLocaleTimeString([], {
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
  // Load DPP JSON  (also returns payload so we can reuse events)
  // -------------------------------------------------------
  async function loadDpp() {
    jsonOut.textContent = "Loading JSON...";
    const base = CONFIG.BACKEND_BASE.replace(/\/+$/, "");
    const panelId = panelIdEl.value.trim();
    const access = accessEl.value || CONFIG.ACCESS_DEFAULT;
    if (!panelId) { alert("Enter a Panel ID."); return null; }

    const url = `${base}/api/dpp/${encodeURIComponent(panelId)}?access=${access}`;
    jsonLink.href = url;
    jsonLink.textContent = "Open raw JSON";

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json();

      // Show raw JSON
      jsonOut.textContent = JSON.stringify(payload, null, 2);

      const data = payload.data || {};
      const factory = data.factory_registration || {};
      const install = data.installation_metadata || {};
      const sustainability = data.sustainability_declaration || {};

      // Project info loading
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

      return payload; // 🔥 we reuse this for events (no more RPC)
    } catch (err) {
      jsonOut.textContent = `Failed to fetch JSON.\n${String(err)}`;
      projectMeta.innerHTML = `<div class="muted">Project metadata unavailable.</div>`;
      return null;
    }
  }

  // -------------------------------------------------------
  // Blockchain Logs — now taken from DPP JSON (fault_log_operation)
  // -------------------------------------------------------
  function loadEventsFromDpp(dppData) {
    // dppData is payload.data from /api/dpp
    eventsHelp.classList.add("hidden");
    eventsTable.classList.remove("hidden");

    const opLog = dppData?.fault_log_operation || [];
    const instLog = dppData?.fault_log_installation || [];

    // Combine installation + operation logs if you want full history
    const allEvents = [...instLog, ...opLog];

    if (!allEvents.length) {
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">No events found.</td></tr>`;
      return;
    }

    // Sort by timestamp (assuming ISO string)
    allEvents.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    });

    const rows = allEvents.map(ev => {
      const d = new Date(ev.timestamp);
      const timeStr = fmtShortDateTime(d);
      const color = ev.color || "-";
      const status = ev.status || "-";
      const reason = ev.reason || "-";
      const prediction = ev.prediction;

      return `
        <tr>
          <td>${timeStr}</td>
          <td>${badgeFor(prediction)}</td>
          <td>${color}</td>
          <td>${status}</td>
          <td>${reason}</td>
          <td>-</td>
        </tr>`;
    });

    eventsBody.innerHTML = rows.join("");
  }

  // -------------------------------------------------------
  // LOAD PERFORMANCE
  // -------------------------------------------------------
  async function loadPerformance() {
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

      // Fill section with graphs
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
    perfLoadingModal.classList.remove("hidden"); // show popup

    projectMeta.innerHTML = `<div class="muted">Loading project information...</div>`;
    perfContent.innerHTML = `<div class="muted">Loading performance overview...</div>`;
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading blockchain logs...</td></tr>`;
    jsonOut.textContent = "Loading JSON...";

    // 1) Load DPP (fast, from backend only)
    const dppPayload = await loadDpp();
    const access = accessEl.value || CONFIG.ACCESS_DEFAULT;

    if (access === "tier1" || access === "tier2") {
      if (dppPayload && dppPayload.data) {
        loadEventsFromDpp(dppPayload.data); // 🔥 no ethers, no RPC
      } else {
        eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Events unavailable.</td></tr>`;
      }
      await loadPerformance(); // from /api/performance
    } else {
      eventsHelp.classList.remove("hidden");
      eventsHelp.textContent = "Blockchain logs are restricted to Tier 1 and Tier 2.";
      eventsTable.classList.add("hidden");
      perfContent.innerHTML = '';
    }

    perfLoadingModal.classList.add("hidden"); // hide popup when everything done
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
              callback: function (val) {
                return this.getLabelForValue(val);
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
                    "Overall envelope condition",
                    "PS = (SSI × 0.5 + TBI × 0.5) / 25",
                    `Value: ${y}`
                  ];
                }
                if (ctx.dataset.label.includes("SSI")) {
                  return [
                    "Structural Stability Index",
                    "Tilt/sensor stability",
                    "SSI = 100 − (0.35·Fₛ + 0.35·Sₛ + 0.20·T_last + 0.10·Nₛ)",
                    `Value: ${y}`
                  ];
                }
                if (ctx.dataset.label.includes("TBI")) {
                  return [
                    "Thermal–Behavior Index",
                    "Thermal deviation behavior",
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
  // SYSTEM ERROR GRAPH  (uses data.system_events from backend)
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
      if ((e.reason || "").toLowerCase().includes("ml")) {
        mlPoints.push(point);
      } else {
        sensorPoints.push(point);
      }
    });

    let minDate = null, maxDate = null;
    if (events.length > 0) {
      minDate = new Date(Math.min(...events.map(e => e.timestamp_unix * 1000)));
      maxDate = new Date(Math.max(...events.map(e => e.timestamp_unix * 1000)));
      if (minDate.getTime() === maxDate.getTime()) {
        minDate = new Date(minDate.getTime() - 24 * 3600 * 1000);
        maxDate = new Date(maxDate.getTime() + 24 * 3600 * 1000);
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
              tooltipFormat: "MMM d, yyyy HH:mm"
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
                return `${label} @ ${d.toLocaleDateString()} — ${reason}`;
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
