//+------------------------------------------------------------------+
//|                                              GannAngleEA_PRO.mq5 |
//|               Fast Gann Daily Breakout Engine - PRO Version      |
//|                                                                  |
//| Core idea preserved:                                             |
//| - Daily Gann sqrt levels                                         |
//| - Buy Stop / Sell Stop                                           |
//| - 50% TP1 partial                                                |
//| - 30% TP2 partial                                                |
//| - 20% runner                                                     |
//|                                                                  |
//| Improvements:                                                    |
//| - Ultra-fast OCO cancellation with short-circuit flag            |
//| - O(1) position ticket caching for zero tick overhead            |
//| - Cached broker parameters (stops/freeze levels & volume steps)  |
//| - Vectorized Gann levels for fast loop-based trailing            |
//| - Break-even protection & daily trend/regime filters             |
//+------------------------------------------------------------------+
#property copyright "Gann PRO"
#property version   "2.20"
#property strict

#include <Trade\Trade.mqh>

enum ENUM_CALC_BASE
  {
   CALC_TODAY_OPEN = 0,
   CALC_PREV_HIGH  = 1,
   CALC_PREV_LOW   = 2,
   CALC_PREV_CLOSE = 3
  };

enum ENUM_DAILY_CLOSE_MODE
  {
   CLOSE_ALL_NEW_DAY = 0,
   CLOSE_ONLY_PENDING = 1
  };

//--------------------------------------------------------------------
// INPUTS
//--------------------------------------------------------------------
// No license secret is distributed to the terminal. Authorization is account/device bound
// by the HTTPS API, so a readable .set file cannot be used to copy an activation.
const string LICENSE_API_URL = "https://ved-algo.vercel.app/api/ea/validate";
const int    LICENSE_HEARTBEAT_MINUTES = 15;

// This is the only value exposed in the MT5 Inputs dialog.
const ENUM_CALC_BASE InpCalcBase       = CALC_TODAY_OPEN;
const double         InpLotSize        = 0.10;
input ulong          InpMagicNumber    = 888123;
const ulong          InpSlippage       = 10;

const double InpTP1ClosePercent = 50.0;
const double InpTP2ClosePercent = 30.0;
const bool   InpBreakEvenAtTP1  = true;
const double InpBEExtraPoints   = 0.0;
const bool   InpUseLevelTrail   = true;

const bool   InpUseOCO             = true;
const bool   InpOneTradePerDay     = true;
const bool   InpUseTrendBias       = true;
const int    InpTrendPeriod        = 10;
const double InpTrendDeadZoneATR   = 0.05;

const bool   InpUseRegimeFilter    = true;
const int    InpATRPeriod          = 14;
const double InpMinRangeATR        = 0.55;
const double InpMaxRangeATR        = 2.80;

const double InpMaxSpreadPoints    = 0.0;

const double InpMaxDayEquityLossPc = 0.0;

const ENUM_DAILY_CLOSE_MODE InpDayCloseMode = CLOSE_ALL_NEW_DAY;

//--------------------------------------------------------------------
// GLOBALS & CACHED SYMBOL SPECS
//--------------------------------------------------------------------
CTrade trade;

datetime g_dayTime        = 0;
double   g_dayStartEquity = 0.0;

// Cached symbol parameters for max execution speed
double g_minLot       = 0.01;
double g_maxLot       = 100.0;
double g_lotStep      = 0.01;
int    g_volDigits    = 2;
double g_minStopDist  = 0.0;

// Dynamic position/OCO state cache
ulong  g_activePositionTicket = 0;
bool   g_ocoProcessed         = false;

// Base Gann trigger levels
double Bat = 0.0;
double Bsl = 0.0;
double Sat = 0.0;
double Ssl = 0.0;

// Vectorized Gann targets [0..7] for Bt1..Bt8 and St1..St8
double g_Bt[8];
double g_St[8];

bool g_buyTP1Hit  = false;
bool g_buyTP2Hit  = false;
bool g_sellTP1Hit = false;
bool g_sellTP2Hit = false;

bool g_tradeTriggeredToday = false;
bool g_tradingBlocked      = false;

// Live authorization is deliberately server-controlled. Strategy Tester is exempt so
// historical backtests never require a network allow-list or license connection.
bool     g_licenseAuthorized = false;
datetime g_licenseLastGood   = 0;
datetime g_licenseLastCheck  = 0;
int      g_licenseGraceSecs  = 12 * 60 * 60;

int g_dailyBias = 0;

//--------------------------------------------------------------------
// INIT
//--------------------------------------------------------------------
int OnInit()
  {
   if(!MQLInfoInteger(MQL_TESTER))
     {
      if(!LicenseVerify())
         Print("Gann PRO: waiting for live license authorization. Add https://ved-algo.vercel.app to MT5 WebRequest allowed URLs; the EA will retry automatically.");
      EventSetTimer(60);
     }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpSlippage);
   trade.SetAsyncMode(false);

   SetBestFillingMode();
   UpdateSymbolCache();

   g_dayTime = iTime(_Symbol, PERIOD_D1, 0);

   if(g_dayTime <= 0)
      return INIT_FAILED;

   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);

   CalculateDailyLevels();
   RecoverCurrentState();

   if(!HasOurPosition() && !HasOurPendingOrders())
      CreateDailyOrders();

   return INIT_SUCCEEDED;
  }

//--------------------------------------------------------------------
// MAIN TICK
//--------------------------------------------------------------------
void OnTick()
  {
   if(!MQLInfoInteger(MQL_TESTER) && !LicenseCanTrade())
     {
      // Never open new trades without current authorization. Existing positions are left untouched
      // so that a license/network change cannot unexpectedly close a customer's market exposure.
      DeleteAllOurPendingOrders();
      return;
     }

   datetime nowDay = iTime(_Symbol, PERIOD_D1, 0);

   if(nowDay > 0 && nowDay != g_dayTime)
     {
      g_dayTime = nowDay;
      StartNewTradingDay();
     }

   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick))
      return;

   // Emergency Equity Guard (Short-circuited if disabled)
   if(InpMaxDayEquityLossPc > 0.0 && CheckEmergencyProtection())
      return;

   // Manage OCO Cancellations
   if(InpUseOCO && !g_ocoProcessed)
     ManageOCO();

   ManageOpenPosition(tick);
  }

//--------------------------------------------------------------------
// LICENSE HEARTBEAT / KILL SWITCH
//--------------------------------------------------------------------
void OnTimer()
  {
   if(MQLInfoInteger(MQL_TESTER)) return;
   // Retry every minute until the chart is authorized (for example while the
   // owner is adding the WebRequest origin), then use the normal heartbeat.
   int interval = g_licenseAuthorized ? LICENSE_HEARTBEAT_MINUTES * 60 : 60;
   if((TimeCurrent() - g_licenseLastCheck) >= interval)
      LicenseVerify();
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

bool LicenseCanTrade()
  {
   if(g_licenseAuthorized) return true;
   // Grace applies only to a temporary transport failure after a successful authorization,
   // never to an explicit server denial (expired, suspended, revoked, wrong account/device).
   return (g_licenseLastGood > 0 && (TimeCurrent() - g_licenseLastGood) <= g_licenseGraceSecs);
  }

bool LicenseVerify()
  {
   g_licenseLastCheck = TimeCurrent();
   string device = BuildDeviceFingerprint();
   long account  = AccountInfoInteger(ACCOUNT_LOGIN);
   if(account <= 0 || StringFind(LICENSE_API_URL, "https://") != 0)
     {
      g_licenseAuthorized = false;
      return false;
     }

   string json = StringFormat("{\"accountNumber\":%I64d,\"deviceFingerprint\":\"%s\",\"nonce\":\"%s\",\"eaVersion\":\"2.20\",\"telemetry\":{\"magicNumber\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"freeMargin\":%.2f,\"openPositions\":%d,\"dealsToday\":%d,\"symbol\":\"%s\",\"broker\":\"%s\"}}",
                              account, device, BuildNonce(), (long)InpMagicNumber, AccountInfoDouble(ACCOUNT_BALANCE),
                              AccountInfoDouble(ACCOUNT_EQUITY), AccountInfoDouble(ACCOUNT_MARGIN_FREE),
                              PositionsTotal(), DealsToday(), _Symbol, AccountInfoString(ACCOUNT_COMPANY));
   char post[];
   int size = StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(size > 0) ArrayResize(post, size - 1);
   char response[];
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   ResetLastError();
   int code = WebRequest("POST", LICENSE_API_URL, headers, 8000, post, response, responseHeaders);
   if(code == -1)
     {
      PrintFormat("Gann PRO license transport unavailable (%d)", GetLastError());
      return LicenseCanTrade();
     }

   string body = CharArrayToString(response, 0, -1, CP_UTF8);
   if(code == 200 && StringFind(body, "\"authorized\":true") >= 0)
     {
      g_licenseAuthorized = true;
      g_licenseLastGood = TimeCurrent();
      return true;
     }

   // Any server response that is not an authorization is an explicit denial: no offline grace.
   g_licenseAuthorized = false;
   PrintFormat("Gann PRO license denied (HTTP %d): %s", code, body);
   return false;
  }

int DealsToday()
  {
   datetime start = iTime(_Symbol, PERIOD_D1, 0);
   if(start <= 0 || !HistorySelect(start, TimeCurrent())) return 0;
   return HistoryDealsTotal();
  }

ulong Fnv1a64(const string value, const ulong seed)
  {
   ulong hash = seed;
   for(int i = 0; i < StringLen(value); i++)
     {
      hash ^= (ulong)StringGetCharacter(value, i);
      hash *= 1099511628211;
     }
   return hash;
  }

string HashPart(const string value, const ulong seed)
  {
   string part = StringFormat("%016I64X", Fnv1a64(value, seed));
   return StringToLower(part);
  }

string BuildDeviceFingerprint()
  {
   // Only a one-way fingerprint is sent; terminal paths and machine identity never leave the terminal.
   string source = TerminalInfoString(TERMINAL_DATA_PATH) + "|" + TerminalInfoString(TERMINAL_COMMONDATA_PATH) + "|" + (string)AccountInfoInteger(ACCOUNT_LOGIN);
   return HashPart(source, 1469598103934665603) + HashPart(source, 1099511628211) +
          HashPart(source, 7809847782465536322) + HashPart(source, 1609587929392839161);
  }

string BuildNonce()
  {
   string source = BuildDeviceFingerprint() + "|" + (string)TimeLocal() + "|" + (string)GetTickCount64() + "|" + (string)MathRand();
   return HashPart(source, 1469598103934665603) + HashPart(source, 7809847782465536322);
  }

//--------------------------------------------------------------------
// SYMBOL CACHE UPDATER
//--------------------------------------------------------------------
void UpdateSymbolCache()
  {
   g_minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   g_maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   g_lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(g_lotStep >= 1.0)        g_volDigits = 0;
   else if(g_lotStep >= 0.1)  g_volDigits = 1;
   else if(g_lotStep >= 0.01) g_volDigits = 2;
   else if(g_lotStep >= 0.001)g_volDigits = 3;
   else                       g_volDigits = 4;

   long stops  = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   long freeze = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   g_minStopDist = (double)MathMax(stops, freeze) * _Point;
  }

//--------------------------------------------------------------------
// NEW DAY
//--------------------------------------------------------------------
void StartNewTradingDay()
  {
   UpdateSymbolCache();

   if(InpDayCloseMode == CLOSE_ALL_NEW_DAY)
     {
      CloseAllOurPositions();
      DeleteAllOurPendingOrders();
     }
   else
     {
      DeleteAllOurPendingOrders();
     }

   g_buyTP1Hit  = false;
   g_buyTP2Hit  = false;
   g_sellTP1Hit = false;
   g_sellTP2Hit = false;

   g_tradeTriggeredToday  = false;
   g_tradingBlocked       = false;
   g_ocoProcessed         = false;
   g_activePositionTicket = 0;

   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);

   if(!CalculateDailyLevels())
      return;

   if(!HasOurPosition())
      CreateDailyOrders();
  }

//--------------------------------------------------------------------
// DAILY LEVEL ENGINE
//--------------------------------------------------------------------
bool CalculateDailyLevels()
  {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int needBars = MathMax(InpATRPeriod + 3, InpTrendPeriod + 3);
   if(needBars < 20)
      needBars = 20;

   if(CopyRates(_Symbol, PERIOD_D1, 0, needBars, rates) < needBars)
      return false;

   double anchor = 0.0;

   switch(InpCalcBase)
     {
      case CALC_TODAY_OPEN: anchor = rates[0].open;  break;
      case CALC_PREV_HIGH:  anchor = rates[1].high;  break;
      case CALC_PREV_LOW:   anchor = rates[1].low;   break;
      case CALC_PREV_CLOSE: anchor = rates[1].close; break;
     }

   if(anchor <= 0.0)
      return false;

   double root = MathSqrt(anchor);

   Bsl = MathPow(root - 0.0625, 2.0);
   Bat = MathPow(root + 0.1250, 2.0);

   g_Bt[0] = MathPow(root + 0.2500, 2.0); // Bt1
   g_Bt[1] = MathPow(root + 0.5000, 2.0); // Bt2
   g_Bt[2] = MathPow(root + 0.7500, 2.0); // Bt3
   g_Bt[3] = MathPow(root + 1.0000, 2.0); // Bt4
   g_Bt[4] = MathPow(root + 1.2500, 2.0); // Bt5
   g_Bt[5] = MathPow(root + 1.5000, 2.0); // Bt6
   g_Bt[6] = MathPow(root + 1.7500, 2.0); // Bt7
   g_Bt[7] = MathPow(root + 2.0000, 2.0); // Bt8

   Ssl = MathPow(root + 0.0625, 2.0);
   Sat = MathPow(root - 0.1250, 2.0);

   g_St[0] = MathPow(root - 0.2500, 2.0); // St1
   g_St[1] = MathPow(root - 0.5000, 2.0); // St2
   g_St[2] = MathPow(root - 0.7500, 2.0); // St3
   g_St[3] = MathPow(root - 1.0000, 2.0); // St4
   g_St[4] = MathPow(root - 1.2500, 2.0); // St5
   g_St[5] = MathPow(root - 1.5000, 2.0); // St6
   g_St[6] = MathPow(root - 1.7500, 2.0); // St7
   g_St[7] = MathPow(root - 2.0000, 2.0); // St8

   double atr = CalculateATR(rates);

   if(atr <= 0.0)
     {
      g_dailyBias = 0;
      if(InpUseRegimeFilter)
         g_tradingBlocked = true;
      return true;
     }

   // REGIME FILTER
   if(InpUseRegimeFilter)
     {
      double previousRange = rates[1].high - rates[1].low;
      double rangeRatio    = previousRange / atr;

      if(rangeRatio < InpMinRangeATR || rangeRatio > InpMaxRangeATR)
         g_tradingBlocked = true;
     }

   // TREND BIAS
   g_dailyBias = 0;
   if(InpUseTrendBias && InpTrendPeriod > 1)
     {
      double sum = 0.0;
      int count  = 0;

      for(int i = 1; i <= InpTrendPeriod && i < ArraySize(rates); i++)
        {
         sum += rates[i].close;
         count++;
        }

      if(count > 0)
        {
         double avg      = sum / count;
         double deadZone = atr * InpTrendDeadZoneATR;

         if(rates[1].close > avg + deadZone)
            g_dailyBias = 1;
         else if(rates[1].close < avg - deadZone)
            g_dailyBias = -1;
        }
     }

   return true;
  }

//--------------------------------------------------------------------
// FAST ATR
//--------------------------------------------------------------------
double CalculateATR(MqlRates &rates[])
  {
   if(InpATRPeriod <= 0) return 0.0;

   int size = ArraySize(rates);
   if(size < InpATRPeriod + 2) return 0.0;

   double sumTR = 0.0;
   int count    = 0;

   for(int i = 1; i <= InpATRPeriod; i++)
     {
      if(i + 1 >= size) break;

      double high      = rates[i].high;
      double low       = rates[i].low;
      double prevClose = rates[i+1].close;

      double tr1 = high - low;
      double tr2 = MathAbs(high - prevClose);
      double tr3 = MathAbs(low - prevClose);

      sumTR += MathMax(tr1, MathMax(tr2, tr3));
      count++;
     }

   return (count > 0) ? (sumTR / count) : 0.0;
  }

//--------------------------------------------------------------------
// CREATE DAILY ORDERS
//--------------------------------------------------------------------
void CreateDailyOrders()
  {
   if(g_tradingBlocked) return;
   if(InpOneTradePerDay && g_tradeTriggeredToday) return;
   if(HasOurPosition()) return;
   if(!SpreadAllowed()) return;

   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick)) return;

   double lot = NormalizeOpeningVolume(InpLotSize);
   if(lot <= 0.0) return;

   bool allowBuy  = true;
   bool allowSell = true;

   if(InpUseTrendBias)
     {
      if(g_dailyBias > 0)      allowSell = false;
      else if(g_dailyBias < 0) allowBuy  = false;
     }

   // BUY STOP
   if(allowBuy && Bat > tick.ask)
     {
      double entry = NormalizeDouble(Bat, _Digits);
      double sl    = NormalizeDouble(Bsl, _Digits);

      if(IsValidBuyStop(entry, sl, tick))
        {
         trade.BuyStop(lot, entry, _Symbol, sl, 0.0, ORDER_TIME_DAY, 0, "GANN_PRO_BUY");
        }
     }

   // SELL STOP
   if(allowSell && Sat < tick.bid)
     {
      double entry = NormalizeDouble(Sat, _Digits);
      double sl    = NormalizeDouble(Ssl, _Digits);

      if(IsValidSellStop(entry, sl, tick))
        {
         trade.SellStop(lot, entry, _Symbol, sl, 0.0, ORDER_TIME_DAY, 0, "GANN_PRO_SELL");
        }
     }
  }

//--------------------------------------------------------------------
// MANAGE OPEN POSITION
//--------------------------------------------------------------------
void ManageOpenPosition(const MqlTick &tick)
  {
   ulong ticket = GetOurPositionTicket();
   if(ticket == 0) return;

   if(!PositionSelectByTicket(ticket)) return;

   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double volume           = PositionGetDouble(POSITION_VOLUME);
   double open             = PositionGetDouble(POSITION_PRICE_OPEN);
   double oldSL            = PositionGetDouble(POSITION_SL);

   if(volume <= 0.0) return;

   g_tradeTriggeredToday = true;

   // BUY MANAGEMENT
   if(type == POSITION_TYPE_BUY)
     {
      // TP1
      if(!g_buyTP1Hit && tick.bid >= g_Bt[0])
        {
         double closeVolume = NormalizePartialVolume(InpLotSize * InpTP1ClosePercent / 100.0, volume);

         if(closeVolume > 0.0)
           {
            if(ClosePartial(ticket, closeVolume))
              {
               g_buyTP1Hit = true;
               if(InpBreakEvenAtTP1)
                 {
                  double be = NormalizeDouble(open + InpBEExtraPoints * _Point, _Digits);
                  SafeModifyBuySL(ticket, be, tick);
                 }
              }
           }
         else
           {
            g_buyTP1Hit = true;
           }
        }

      // TP2
      if(g_buyTP1Hit && !g_buyTP2Hit && tick.bid >= g_Bt[1])
        {
         if(!PositionSelectByTicket(ticket)) return;
         volume = PositionGetDouble(POSITION_VOLUME);

         double closeVolume = NormalizePartialVolume(InpLotSize * InpTP2ClosePercent / 100.0, volume);

         if(closeVolume > 0.0)
           {
            if(ClosePartial(ticket, closeVolume)) g_buyTP2Hit = true;
           }
         else
           {
            g_buyTP2Hit = true;
           }

         if(g_buyTP2Hit)
            SafeModifyBuySL(ticket, g_Bt[0], tick);
        }

      // LEVEL TRAILING (Bt8 -> Bt7 down to Bt3 -> Bt2)
      if(g_buyTP2Hit && InpUseLevelTrail)
        {
         double newSL = 0.0;
         for(int i = 7; i >= 2; i--)
           {
            if(tick.bid >= g_Bt[i])
              {
               newSL = g_Bt[i-1];
               break;
              }
           }

         if(newSL > 0.0)
           {
            if(PositionSelectByTicket(ticket)) oldSL = PositionGetDouble(POSITION_SL);
            if(oldSL == 0.0 || newSL > oldSL + _Point)
               SafeModifyBuySL(ticket, newSL, tick);
           }
        }
     }

   // SELL MANAGEMENT
   else if(type == POSITION_TYPE_SELL)
     {
      // TP1
      if(!g_sellTP1Hit && tick.ask <= g_St[0])
        {
         double closeVolume = NormalizePartialVolume(InpLotSize * InpTP1ClosePercent / 100.0, volume);

         if(closeVolume > 0.0)
           {
            if(ClosePartial(ticket, closeVolume))
              {
               g_sellTP1Hit = true;
               if(InpBreakEvenAtTP1)
                 {
                  double be = NormalizeDouble(open - InpBEExtraPoints * _Point, _Digits);
                  SafeModifySellSL(ticket, be, tick);
                 }
              }
           }
         else
           {
            g_sellTP1Hit = true;
           }
        }

      // TP2
      if(g_sellTP1Hit && !g_sellTP2Hit && tick.ask <= g_St[1])
        {
         if(!PositionSelectByTicket(ticket)) return;
         volume = PositionGetDouble(POSITION_VOLUME);

         double closeVolume = NormalizePartialVolume(InpLotSize * InpTP2ClosePercent / 100.0, volume);

         if(closeVolume > 0.0)
           {
            if(ClosePartial(ticket, closeVolume)) g_sellTP2Hit = true;
           }
         else
           {
            g_sellTP2Hit = true;
           }

         if(g_sellTP2Hit)
            SafeModifySellSL(ticket, g_St[0], tick);
        }

      // LEVEL TRAILING (St8 -> St7 down to St3 -> St2)
      if(g_sellTP2Hit && InpUseLevelTrail)
        {
         double newSL = 0.0;
         for(int i = 7; i >= 2; i--)
           {
            if(tick.ask <= g_St[i])
              {
               newSL = g_St[i-1];
               break;
              }
           }

         if(newSL > 0.0)
           {
            if(PositionSelectByTicket(ticket)) oldSL = PositionGetDouble(POSITION_SL);
            if(oldSL == 0.0 || newSL < oldSL - _Point)
               SafeModifySellSL(ticket, newSL, tick);
           }
        }
     }
  }

//--------------------------------------------------------------------
// OCO (Optimized with processing flag)
//--------------------------------------------------------------------
void ManageOCO()
  {
   ulong positionTicket = GetOurPositionTicket();
   if(positionTicket == 0) return;

   if(!PositionSelectByTicket(positionTicket)) return;

   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   g_tradeTriggeredToday = true;

   bool remainingOppositePending = false;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0) continue;
      if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC) != InpMagicNumber) continue;

      ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);

      if((type == POSITION_TYPE_BUY && orderType == ORDER_TYPE_SELL_STOP) ||
         (type == POSITION_TYPE_SELL && orderType == ORDER_TYPE_BUY_STOP))
        {
         trade.OrderDelete(ticket);
        }
      else
        {
         remainingOppositePending = true;
        }
     }

   if(!remainingOppositePending)
      g_ocoProcessed = true; // Short-circuit future ticks
  }

//--------------------------------------------------------------------
// SAFE BUY SL
//--------------------------------------------------------------------
bool SafeModifyBuySL(ulong ticket, double requestedSL, const MqlTick &tick)
  {
   if(!PositionSelectByTicket(ticket)) return false;

   double currentSL = PositionGetDouble(POSITION_SL);
   double maximumSL = tick.bid - g_minStopDist;
   double finalSL   = NormalizeDouble(MathMin(requestedSL, maximumSL), _Digits);

   if(finalSL <= 0.0) return false;
   if(currentSL > 0.0 && finalSL <= currentSL + (_Point * 0.5)) return false;

   return trade.PositionModify(ticket, finalSL, 0.0);
  }

//--------------------------------------------------------------------
// SAFE SELL SL
//--------------------------------------------------------------------
bool SafeModifySellSL(ulong ticket, double requestedSL, const MqlTick &tick)
  {
   if(!PositionSelectByTicket(ticket)) return false;

   double currentSL = PositionGetDouble(POSITION_SL);
   double minimumSL = tick.ask + g_minStopDist;
   double finalSL   = NormalizeDouble(MathMax(requestedSL, minimumSL), _Digits);

   if(finalSL <= 0.0) return false;
   if(currentSL > 0.0 && finalSL >= currentSL - (_Point * 0.5)) return false;

   return trade.PositionModify(ticket, finalSL, 0.0);
  }

//--------------------------------------------------------------------
// PARTIAL CLOSE
//--------------------------------------------------------------------
bool ClosePartial(ulong ticket, double volume)
  {
   if(volume <= 0.0) return false;
   if(!PositionSelectByTicket(ticket)) return false;

   double currentVolume = PositionGetDouble(POSITION_VOLUME);

   if(volume >= currentVolume)
      return trade.PositionClose(ticket);

   return trade.PositionClosePartial(ticket, volume);
  }

//--------------------------------------------------------------------
// NORMALIZE OPENING LOT
//--------------------------------------------------------------------
double NormalizeOpeningVolume(double volume)
  {
   if(g_lotStep <= 0.0) return 0.0;

   volume = MathMax(g_minLot, MathMin(g_maxLot, volume));
   volume = MathFloor(volume / g_lotStep + 0.0000001) * g_lotStep;

   return NormalizeDouble(volume, g_volDigits);
  }

//--------------------------------------------------------------------
// NORMALIZE PARTIAL LOT
//--------------------------------------------------------------------
double NormalizePartialVolume(double desired, double currentVolume)
  {
   if(g_lotStep <= 0.0) return 0.0;

   desired = MathFloor(desired / g_lotStep + 0.0000001) * g_lotStep;
   desired = NormalizeDouble(desired, g_volDigits);

   if(desired < g_minLot) return 0.0;

   if(desired >= currentVolume)
     {
      double remaining = currentVolume - desired;
      if(remaining > 0.0 && remaining < g_minLot)
        {
         desired = currentVolume - g_minLot;
         desired = MathFloor(desired / g_lotStep + 0.0000001) * g_lotStep;
        }
     }

   if(desired <= 0.0) return 0.0;

   return NormalizeDouble(desired, g_volDigits);
  }

//--------------------------------------------------------------------
// POSITION FINDER (O(1) Cached)
//--------------------------------------------------------------------
ulong GetOurPositionTicket()
  {
   if(g_activePositionTicket > 0)
     {
      if(PositionSelectByTicket(g_activePositionTicket))
        {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            (ulong)PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
            return g_activePositionTicket;
        }
      g_activePositionTicket = 0;
     }

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;

      g_activePositionTicket = ticket;
      return ticket;
     }

   return 0;
  }

//--------------------------------------------------------------------
// HAS POSITION
//--------------------------------------------------------------------
bool HasOurPosition()
  {
   return GetOurPositionTicket() > 0;
  }

//--------------------------------------------------------------------
// HAS PENDING
//--------------------------------------------------------------------
bool HasOurPendingOrders()
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0) continue;
      if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC) != InpMagicNumber) continue;

      ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      if(type == ORDER_TYPE_BUY_STOP || type == ORDER_TYPE_SELL_STOP ||
         type == ORDER_TYPE_BUY_STOP_LIMIT || type == ORDER_TYPE_SELL_STOP_LIMIT)
         return true;
     }

   return false;
  }

//--------------------------------------------------------------------
// DELETE PENDING
//--------------------------------------------------------------------
void DeleteAllOurPendingOrders()
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0) continue;
      if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC) != InpMagicNumber) continue;

      trade.OrderDelete(ticket);
     }
  }

//--------------------------------------------------------------------
// CLOSE POSITIONS
//--------------------------------------------------------------------
void CloseAllOurPositions()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;

      trade.PositionClose(ticket);
     }
   g_activePositionTicket = 0;
  }

//--------------------------------------------------------------------
// SPREAD FILTER
//--------------------------------------------------------------------
bool SpreadAllowed()
  {
   if(InpMaxSpreadPoints <= 0.0) return true;

   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick)) return false;

   double spread = (tick.ask - tick.bid) / _Point;
   return spread <= InpMaxSpreadPoints;
  }

//--------------------------------------------------------------------
// EQUITY PROTECTION
//--------------------------------------------------------------------
bool CheckEmergencyProtection()
  {
   if(g_dayStartEquity <= 0.0) return false;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double lossPc = (g_dayStartEquity - equity) / g_dayStartEquity * 100.0;

   if(lossPc < InpMaxDayEquityLossPc) return false;

   g_tradingBlocked = true;
   DeleteAllOurPendingOrders();
   CloseAllOurPositions();

   return true;
  }

//--------------------------------------------------------------------
// VALIDATE BUY STOP
//--------------------------------------------------------------------
bool IsValidBuyStop(double entry, double sl, const MqlTick &tick)
  {
   if(entry <= tick.ask + g_minStopDist) return false;
   if(sl >= entry - g_minStopDist)       return false;
   if(sl <= 0.0)                         return false;

   return true;
  }

//--------------------------------------------------------------------
// VALIDATE SELL STOP
//--------------------------------------------------------------------
bool IsValidSellStop(double entry, double sl, const MqlTick &tick)
  {
   if(entry >= tick.bid - g_minStopDist) return false;
   if(sl <= entry + g_minStopDist)       return false;
   if(sl <= 0.0)                         return false;

   return true;
  }

//--------------------------------------------------------------------
// FILLING MODE
//--------------------------------------------------------------------
void SetBestFillingMode()
  {
   long filling = SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);

   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
     {
      trade.SetTypeFilling(ORDER_FILLING_FOK);
      return;
     }

   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
     {
      trade.SetTypeFilling(ORDER_FILLING_IOC);
      return;
     }

   trade.SetTypeFilling(ORDER_FILLING_RETURN);
  }

//--------------------------------------------------------------------
// STATE RECOVERY AFTER RESTART
//--------------------------------------------------------------------
void RecoverCurrentState()
  {
   ulong ticket = GetOurPositionTicket();
   if(ticket == 0) return;

   if(!PositionSelectByTicket(ticket)) return;

   g_tradeTriggeredToday = true;

   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double volume           = PositionGetDouble(POSITION_VOLUME);
   double original         = NormalizeOpeningVolume(InpLotSize);

   double afterTP1    = original - NormalizePartialVolume(original * InpTP1ClosePercent / 100.0, original);
   double secondClose = NormalizePartialVolume(original * InpTP2ClosePercent / 100.0, afterTP1);
   double afterTP2    = afterTP1 - secondClose;

   double tolerance = MathMax(g_lotStep * 0.51, 0.0000001);

   if(type == POSITION_TYPE_BUY)
     {
      if(volume <= afterTP1 + tolerance) g_buyTP1Hit = true;
      if(volume <= afterTP2 + tolerance)
        {
         g_buyTP1Hit = true;
         g_buyTP2Hit = true;
        }
     }

   if(type == POSITION_TYPE_SELL)
     {
      if(volume <= afterTP1 + tolerance) g_sellTP1Hit = true;
      if(volume <= afterTP2 + tolerance)
        {
         g_sellTP1Hit = true;
         g_sellTP2Hit = true;
        }
     }

   if(InpUseOCO) ManageOCO();
  }
//+------------------------------------------------------------------+
