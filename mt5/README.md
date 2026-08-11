# GannAngleEA_PRO

The complete EA source is [`GannAngleEA_PRO.mq5`](./GannAngleEA_PRO.mq5).

## MT5 installation

1. Copy `GannAngleEA_PRO.mq5` into `MQL5/Experts` and compile it in MetaEditor.
2. In MT5 open **Tools → Options → Expert Advisors**.
3. Enable **Allow WebRequest for listed URL** and add this origin exactly:

   `https://ved-algo.vercel.app`

   The EA posts license heartbeats to:

   `https://ved-algo.vercel.app/api/ea/validate`

4. In the owner dashboard create a license with the recipient's MT5 account number. Download the generated `.set` package, attach the EA, and set the Magic Number if needed.

Only `InpMagicNumber` is an MT5 input. The strategy defaults and API URL are compiled into the EA; no license key is stored in the `.set` file. Live trading is account/device-bound by the HTTPS API. Strategy Tester/backtests do not call the API.

