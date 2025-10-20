<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Blockchain-Powered DPP: Smart Façade Panel Monitoring & Lifecycle Records</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; color: #333; }
    input, select, button { padding: 6px 10px; margin: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 8px 10px; border: 1px solid #ddd; text-align: left; }
    .badge { padding: 4px 8px; border-radius: 4px; color: #fff; font-weight: bold; font-size: 0.8em; }
    .b-blue { background-color: #007bff; }
    .b-yellow { background-color: #ffc107; color: #000; }
    .b-red { background-color: #dc3545; }
    .b-purple { background-color: #6f42c1; }
    .muted { color: #888; font-style: italic; }
    .hidden { display: none; }
    pre { background: #eee; padding: 10px; overflow-x: auto; }
    .tiny { font-size: 0.75em; }
  </style>
</head>
<body>
  <h1>Blockchain-Powered DPP: Smart Façade Panel Monitoring & Lifecycle Records</h1>

  <label for="panelId">Panel ID:</label>
  <input type="text" id="panelId" placeholder="e.g., ID_9_C_12" />

  <label for="accessTier">Access Tier:</label>
  <select id="accessTier">
    <option value="public">Public</option>
    <option value="tier1">Tier 1</option>
    <option value="tier2">Tier 2</option>
  </select>

  <br/>

  <label for="rpcUrl">RPC URL:</label>
  <input type="text" id="rpcUrl" value="https://sepolia.infura.io/v3/57ea67cde27f45f9af5a69bdc5c92332" size="60"/>

  <label for="contractAddress">Smart Contract:</label>
  <input type="text" id="contractAddress" value="0x59B649856d8c5Fb6991d30a345f0b923eA91a3f7" size="45" />

  <!-- Hidden backend base URL input -->
  <input type="hidden" id="backendBase" value="https://dpp-update-frontend-af02.onrender.com" />

  <br/>

  <label for="fromBlock">From Block:</label>
  <input type="number" id="fromBlock" placeholder="Optional" />
  <label for="toBlock">To Block:</label>
  <input type="number" id="toBlock" placeholder="Optional" />

  <br/>
  <button id="btnLoadEvents">📜 Load Blockchain Events</button>
  <button id="btnLoadDpp">📄 Load DPP JSON</button>
  <button id="btnHash">🔗 Get Hash</button>

  <p><a id="jsonLink" href="#" target="_blank">JSON Link</a> | <a id="hashLink" href="#" target="_blank">Hash Link</a></p>

  <pre id="jsonOut"></pre>

  <div id="eventsHelp">Click "Load Blockchain Events" to see color history for this panel.</div>

  <table id="eventsTable" class="hidden">
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Type</th>
        <th>Fault Type</th>
        <th>Severity</th>
        <th>Action</th>
        <th>TX</th>
      </tr>
    </thead>
    <tbody id="eventsBody">
      <!-- JS will populate here -->
    </tbody>
  </table>

  <script src="https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.umd.min.js"></script>
  <script src="dashboard.js"></script>
</body>
</html>
