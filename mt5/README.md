# GannAngleEA_PRO

The complete EA source is [`GannAngleEA_PRO.mq5`](./GannAngleEA_PRO.mq5).

## MT5 installation

1. Copy `GannAngleEA_PRO.mq5` into `MQL5/Experts` and compile it in MetaEditor.
2. In MT5 open **Tools → Options → Expert Advisors**.
3. Enable **Allow WebRequest for listed URL** and add this origin exactly:

   `https://ved-algo.vercel.app`

   The EA posts license heartbeats to:

   `https://ved-algo.vercel.app/api/ea/validate`

4. In the owner dashboard create a license. The account number is optional; if left blank, download the generated `.set` package and attach it to the recipient's MT5 terminal. Its unique Magic Number selects the license, and the EA automatically binds the detected MT5 account/device on first run.

Only `InpMagicNumber` is an MT5 input. The dashboard-generated `.set` writes the unique per-license Magic Number; no license key is stored. Live trading is account/device-bound by the HTTPS API. Strategy Tester/backtests do not call the API.

If the WebRequest origin is missing or the server is temporarily unreachable, the EA remains attached to the chart and shows a waiting message. It does not place new live orders until authorization succeeds, then retries automatically; it is not removed from the chart.
