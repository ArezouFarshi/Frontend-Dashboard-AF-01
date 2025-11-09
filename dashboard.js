(() => {
  const $ = (id) => document.getElementById(id);

  const panelIdEl = $("panelId");
  const accessEl = $("accessTier");
  const fromBlockEl = $("fromBlock");
  const toBlockEl = $("toBlock");
  const rpcUrlEl = $("rpcUrl");
  const contractEl = $("contractAddress");
  const backendEl = $("backendBase");
  const jsonOut = $("jsonOut");
  const jsonLink = $("jsonLink");
  const hashLink = $("hashLink");
  const eventsTable = $("eventsTable");
  const eventsBody = $("eventsBody");
  const eventsHelp = $("eventsHelp");

  // Correct event signature from final contract
  const EVENT_SIG = "PanelEventAdded(string,bool,string,string,int256,string,uint256)";

  function badgeFor(prediction) {
    if (prediction === 0) return '<span class="badge b-blue">normal</span>';
    if (prediction === 1) return '<span class="badge b-red">fault</span>';
    if (prediction === 2) return '<span class="badge b-yellow">warning</span>';
    if (prediction === -1) return '<span class="badge b-purple">system error</span>';
    return `<span class="badge">?</span>`;
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
          ok: args[1],
          color: args[2],
          status: args[3],
          prediction: Number(args[4]),
          reason: args[5],
          timestamp: Number(args[6])
        };
        if (String(ev.panelId) !== panelId) continue;

        const timeStr = fmtTime(ev.timestamp);
        const txUrl = `https://sepolia.etherscan.io/tx/${log.transactionHash}`;

        rows.push(`
          <tr>
            <td>${timeStr}</td>
            <td>${badgeFor(ev.prediction)}</td>
            <td>${ev.color}</td>
            <td>${ev.status}</td>
            <td>${ev.reason || "-"}</td>
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

  $("btnLoadEvents").addEventListener("click", loadEvents);
  $("btnLoadDpp").addEventListener("click", loadDpp);
})();
