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
