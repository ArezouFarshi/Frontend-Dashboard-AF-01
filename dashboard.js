(() => {
  const $ = (id) => document.getElementById(id);

  const panelIdEl = $("panelId");
  const accessEl = $("accessTier");
  const fromBlockEl = $("fromBlock");
  const toBlockEl = $("toBlock");
  const rpcUrlEl = $("rpcUrl");
  const contractEl = $("contractAddress");
  const backendEl = $("backendBase"); // hidden field, but still in DOM!
  const jsonOut = $("jsonOut");
  const jsonLink = $("jsonLink");
  const hashLink = $("hashLink");
  const eventsTable = $("eventsTable");
  const eventsBody = $("eventsBody");
  const eventsHelp = $("eventsHelp");

  const EVENT_SIG = "PanelEventAdded(string,string,string,string,string,bytes32,address,uint256)";

  function badgeFor(type) {
    const t = (type || "").toLowerCase();
    if (t === "fault") return '<span class="badge b-red">fault</span>';
    if (t === "warning") return '<span class="badge b-yellow">warning</span>';
    if (t === "systemerror") return '<span class="badge b-purple">systemerror</span>';
    if (t === "installation") return '<span class="badge b-blue">installation</span>';
    return `<span class="badge">${type || "-"}</span>`;
  }

  function fmtTime(ts) {
    if (!ts) return "-";
    const d = new Date(Number(ts) * 1000);
    return d.toISOString().replace("T"," ").replace(".000Z"," UTC");
  }

  async function loadEvents() {
    eventsHelp.classList.add("hidden");
    eventsTable.classList.remove("hidden");
    eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Loading...</td></tr>`;

    const panelId = panelIdEl.value.trim();
    const rpcUrl = rpcUrlEl.value.trim();
    const contractAddress = contractEl.value.trim();

    if (!panelId) { alert("Enter a Panel ID."); return; }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const iface = new ethers.Interface([`event ${EVENT_SIG}`]);
      // ETHERS v6+ topic hash:
      const topic0 = iface.getEvent("PanelEventAdded").topicHash;

      let fromBlock = fromBlockEl.value ? Number(fromBlockEl.value) : 0;
      let toBlock = toBlockEl.value ? Number(toBlockEl.value) : await provider.getBlockNumber();

      const filter = {
        address: contractAddress,
        topics: [topic0],
        fromBlock,
        toBlock
      };

      const logs = await provider.getLogs(filter);

      const rows = [];
      for (const log of logs) {
        let parsed;
        try {
          parsed = iface.parseLog(log);
        } catch (_) {
          continue;
        }
        const args = parsed.args;
        const ev = {
          panelId: args[0],
          eventType: args[1],
          faultType: args[2],
          faultSeverity: args[3],
          actionTaken: args[4],
          eventHash: args[5],
          validatedBy: args[6],
          timestamp: args[7]
        };
        if (String(ev.panelId) !== panelId) continue;

        const tsNum = typeof ev.timestamp === "bigint" ? Number(ev.timestamp) : Number(ev.timestamp || 0);
        const timeStr = fmtTime(tsNum);
        const txUrl = `https://sepolia.etherscan.io/tx/${log.transactionHash}`;

        rows.push(`
          <tr>
            <td>${timeStr}</td>
            <td>${badgeFor(ev.eventType)}</td>
            <td>${ev.faultType || "-"}</td>
            <td>${ev.faultSeverity || "-"}</td>
            <td>${ev.actionTaken || "-"}</td>
            <td><a class="tiny" href="${txUrl}" target="_blank">tx</a></td>
          </tr>
        `);
      }

      if (rows.length === 0) {
        eventsBody.innerHTML = `<tr><td colspan="6" class="muted">No events found for panel “${panelId}” in blocks ${fromBlock} → ${toBlock}.</td></tr>`;
      } else {
        eventsBody.innerHTML = rows.join("");
      }
    } catch (err) {
      console.error(err);
      eventsBody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${String(err)}</td></tr>`;
    }
  }

  async function loadDpp() {
    const base = backendEl.value.replace(/\/+$/,"");
    const panelId = encodeURIComponent(panelIdEl.value.trim());
    const access = accessEl.value;

    const url = `${base}/api/dpp/${panelId}?access=${access}`;
    jsonLink.href = url;
    jsonLink.textContent = "Open raw JSON";

    try {
      const res = await fetch(url, {cache:"no-store"});
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      jsonOut.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      jsonOut.textContent = `Failed to fetch JSON.\n${String(err)}\n\nIf this is a browser CORS error, enable CORS on the Flask backend:\nfrom flask_cors import CORS\nCORS(app)`;
    }
  }

  async function getHash() {
    const base = backendEl.value.replace(/\/+$/,"");
    const panelId = encodeURIComponent(panelIdEl.value.trim());
    const url = `${base}/api/hash/${panelId}`;
    hashLink.href = url;
    hashLink.textContent = "Open hash endpoint";

    try {
      const res = await fetch(url, {cache:"no-store"});
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      jsonOut.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      jsonOut.textContent = `Failed to fetch hash.\n${String(err)}`;
    }
  }

  $("btnLoadEvents").addEventListener("click", loadEvents);
  $("btnLoadDpp").addEventListener("click", loadDpp);
  $("btnHash").addEventListener("click", getHash);
})();
