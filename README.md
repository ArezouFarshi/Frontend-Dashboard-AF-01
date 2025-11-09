# 🌐 Blockchain-Powered DPP Dashboard

A web-based dashboard for monitoring **Digital Product Passports (DPPs)** of smart façade panels.  
This frontend connects to your deployed Flask backend and the Sepolia blockchain to display lifecycle records, anomaly logs, and event history.

---

## 🚀 Features
- Fetches DPP JSON data from the backend API (`/api/dpp/<panel_id>?access=<tier>`).
- Queries Sepolia blockchain logs from the `PanelEvents` smart contract.
- Displays anomalies with **color-coded badges**:
  - 🔵 Blue → Normal operation
  - 🔴 Red → Fault
  - 🟡 Yellow → Warning
  - 🟣 Purple → System error
- Shows **status messages** and **reason explanations** alongside each event.
- Links directly to Sepolia Etherscan transactions.

---

## 📂 Project Structure

