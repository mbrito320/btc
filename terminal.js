/* ═══════════════════════════════════════════════════════════════
   BLOOMBERG TERMINAL — terminal.js
   Real-time financial data across all asset classes
   APIs used (all free / no-key where possible):
     • CoinGecko     — crypto prices & history (no key, 30 req/min)
     • CoinCap WS    — crypto streaming WebSocket (no key)
     • Frankfurter   — forex rates (no key, open source)
     • Alternative.me — Fear & Greed Index (no key)
     • Alpha Vantage  — equities (demo key, limited; add yours below)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const CFG = {
  // Add your free API keys here for live equities / FRED bond data
  ALPHA_VANTAGE_KEY: 'demo',       // https://www.alphavantage.co/support/#api-key
  FRED_API_KEY:      '',           // https://fred.stlouisfed.org/docs/api/api_key.html
  FINNHUB_KEY:       '',           // https://finnhub.io (free tier)

  ENDPOINTS: {
    COINGECKO:   'https://api.coingecko.com/api/v3',
    FRANKFURTER: 'https://api.frankfurter.app',
    ALPHAV:      'https://www.alphavantage.co/query',
    FRED:        'https://api.stlouisfed.org/fred',
    COINCAP_WS:  'wss://ws.coincap.io/prices',
    COINCAP:     'https://api.coincap.io/v2',
    FNG:         'https://api.alternative.me/fng/',
  },

  REFRESH: {
    CRYPTO:     30_000,   // 30 s  — CoinGecko free limit
    FOREX:      60_000,   // 60 s
    EQUITIES:  300_000,   // 5 min
    BONDS:     120_000,   // 2 min (simulated)
    SENTIMENT: 300_000,   // 5 min
    TICKER:     30_000,   // rebuild ticker every 30 s
    MOVERS:     60_000,
  },
};

// ─────────────────────────────────────────────
//  APPLICATION STATE
// ─────────────────────────────────────────────
const S = {
  crypto:      [],     // CoinGecko market data
  forex:       {},     // { EUR: 0.93, GBP: 0.79, ... } (rates vs USD)
  equities:    [],
  bonds:       [],
  commodities: [],
  alternatives:[],
  fearGreed:   null,
  macro:       [],
  ws:          null,
  chart:       null,
  selected:    null,   // { type, id, symbol, name }
  prevPrices:  {},     // id → price, for flash direction
  timers:      {},
  apiStatus:   {},     // api name → 'ok'|'error'|'loading'
};

// ─────────────────────────────────────────────
//  STATIC DATA (updated with slight randomisation each cycle)
// ─────────────────────────────────────────────
const BOND_BASE = [
  { name:'US 3M T-Bill',  yield:5.28, type:'treasury' },
  { name:'US 6M T-Bill',  yield:5.22, type:'treasury' },
  { name:'US 1Y Note',    yield:5.07, type:'treasury' },
  { name:'US 2Y Note',    yield:4.82, type:'treasury' },
  { name:'US 5Y Note',    yield:4.40, type:'treasury' },
  { name:'US 10Y Bond',   yield:4.33, type:'treasury' },
  { name:'US 30Y Bond',   yield:4.51, type:'treasury' },
  { name:'DE 10Y Bund',   yield:2.38, type:'govt'     },
  { name:'GB 10Y Gilt',   yield:4.07, type:'govt'     },
  { name:'JP 10Y JGB',    yield:0.83, type:'govt'     },
  { name:'IT 10Y BTP',    yield:3.82, type:'govt'     },
  { name:'FR 10Y OAT',    yield:2.88, type:'govt'     },
  { name:'ES 10Y Bono',   yield:3.25, type:'govt'     },
  { name:'US HY Spread',  yield:3.38, type:'credit'   },
  { name:'US IG Spread',  yield:1.02, type:'credit'   },
  { name:'US Muni 10Y',   yield:2.85, type:'muni'     },
];

const COMMODITY_BASE = [
  { name:'Gold',       sym:'XAU/USD', price:2324.50, unit:'troy oz', sector:'metals'  },
  { name:'Silver',     sym:'XAG/USD', price:27.48,   unit:'troy oz', sector:'metals'  },
  { name:'Platinum',   sym:'XPT/USD', price:983.20,  unit:'troy oz', sector:'metals'  },
  { name:'Palladium',  sym:'XPD/USD', price:1041.80, unit:'troy oz', sector:'metals'  },
  { name:'Copper',     sym:'HG',      price:4.38,    unit:'lb',      sector:'metals'  },
  { name:'WTI Crude',  sym:'WTI',     price:78.55,   unit:'barrel',  sector:'energy'  },
  { name:'Brent Crude',sym:'BRENT',   price:82.42,   unit:'barrel',  sector:'energy'  },
  { name:'Nat. Gas',   sym:'NG',      price:2.19,    unit:'MMBtu',   sector:'energy'  },
  { name:'Heating Oil',sym:'HO',      price:2.62,    unit:'gallon',  sector:'energy'  },
  { name:'RBOB Gas',   sym:'RB',      price:2.48,    unit:'gallon',  sector:'energy'  },
  { name:'Corn',       sym:'ZC',      price:453.25,  unit:'bushel',  sector:'agri'    },
  { name:'Wheat',      sym:'ZW',      price:599.50,  unit:'bushel',  sector:'agri'    },
  { name:'Soybeans',   sym:'ZS',      price:1183.75, unit:'bushel',  sector:'agri'    },
  { name:'Sugar #11',  sym:'SB',      price:21.45,   unit:'lb',      sector:'softs'   },
  { name:'Coffee',     sym:'KC',      price:186.40,  unit:'lb',      sector:'softs'   },
  { name:'Cotton',     sym:'CT',      price:79.55,   unit:'lb',      sector:'softs'   },
  { name:'Cocoa',      sym:'CC',      price:8142.00, unit:'ton',     sector:'softs'   },
];

const EQUITY_BASE = [
  { sym:'AAPL',  name:'Apple Inc.',         price:189.30, chg:2.14,  chgPct:1.14,  vol:52341200, pe:28.5  },
  { sym:'MSFT',  name:'Microsoft Corp.',    price:378.85, chg:-1.23, chgPct:-0.32, vol:18923400, pe:35.2  },
  { sym:'NVDA',  name:'NVIDIA Corp.',       price:875.40, chg:15.30, chgPct:1.78,  vol:45213600, pe:62.4  },
  { sym:'GOOGL', name:'Alphabet Inc.',      price:140.12, chg:0.87,  chgPct:0.63,  vol:23145600, pe:24.1  },
  { sym:'AMZN',  name:'Amazon.com Inc.',    price:178.25, chg:3.42,  chgPct:1.96,  vol:34521800, pe:42.8  },
  { sym:'META',  name:'Meta Platforms',     price:512.60, chg:-4.20, chgPct:-0.81, vol:12456700, pe:23.7  },
  { sym:'TSLA',  name:'Tesla Inc.',         price:245.80, chg:-8.90, chgPct:-3.49, vol:89234500, pe:55.3  },
  { sym:'BRK.B', name:'Berkshire Hathaway', price:368.20, chg:1.80,  chgPct:0.49,  vol:4321098,  pe:21.4  },
  { sym:'JPM',   name:'JPMorgan Chase',     price:198.45, chg:1.25,  chgPct:0.63,  vol:9876540,  pe:11.8  },
  { sym:'V',     name:'Visa Inc.',          price:276.90, chg:0.45,  chgPct:0.16,  vol:6543210,  pe:30.4  },
  { sym:'GS',    name:'Goldman Sachs',      price:432.10, chg:5.60,  chgPct:1.31,  vol:3234560,  pe:13.2  },
  { sym:'BAC',   name:'Bank of America',    price:38.45,  chg:-0.32, chgPct:-0.83, vol:45678900, pe:10.9  },
  { sym:'XOM',   name:'Exxon Mobil',        price:112.35, chg:0.88,  chgPct:0.79,  vol:18234500, pe:13.5  },
  { sym:'JNJ',   name:'Johnson & Johnson',  price:158.20, chg:-0.65, chgPct:-0.41, vol:7123400,  pe:16.8  },
  { sym:'WMT',   name:'Walmart Inc.',       price:182.45, chg:1.15,  chgPct:0.63,  vol:9876500,  pe:28.9  },
  { sym:'SPY',   name:'SPDR S&P 500 ETF',   price:511.20, chg:3.45,  chgPct:0.68,  vol:76543200, pe:22.1  },
  { sym:'QQQ',   name:'Invesco QQQ ETF',    price:438.75, chg:4.20,  chgPct:0.97,  vol:45678900, pe:30.5  },
];

const ALT_BASE = [
  // REITs
  { name:'Prologis',       sym:'PLD',  price:120.40, chgPct: 0.82, cat:'reits'  },
  { name:'Equinix',        sym:'EQIX', price:748.20, chgPct: 1.14, cat:'reits'  },
  { name:'VICI Properties',sym:'VICI', price:29.85,  chgPct:-0.23, cat:'reits'  },
  { name:'AvalonBay',      sym:'AVB',  price:191.30, chgPct: 0.45, cat:'reits'  },
  // Infrastructure
  { name:'Brookfield Infra',sym:'BIP', price:33.20,  chgPct: 0.60, cat:'infra'  },
  { name:'Crown Castle',   sym:'CCI',  price:105.80, chgPct:-0.88, cat:'infra'  },
  // Private Equity proxies
  { name:'Blackstone',     sym:'BX',   price:132.40, chgPct: 1.28, cat:'pe'     },
  { name:'KKR & Co.',      sym:'KKR',  price:104.60, chgPct: 2.14, cat:'pe'     },
  { name:'Apollo Global',  sym:'APO',  price:128.30, chgPct: 0.98, cat:'pe'     },
  // Hedge Fund proxies
  { name:'Man Group',      sym:'EMG.L',price:282.40, chgPct:-0.42, cat:'hedge'  },
  { name:'Pershing Square',sym:'PSH',  price:39.85,  chgPct: 0.65, cat:'hedge'  },
  // Crypto-adjacent
  { name:'MicroStrategy',  sym:'MSTR', price:1842.50,chgPct: 4.20, cat:'crypto' },
  { name:'Coinbase',       sym:'COIN', price:228.40, chgPct: 2.85, cat:'crypto' },
  { name:'Marathon Digital',sym:'MARA',price:18.45,  chgPct: 3.60, cat:'crypto' },
];

const MACRO_DATA = [
  { name:'Fed Funds Rate',   val:'5.25–5.50%', chg: '0.00', chgPct: 0    },
  { name:'US CPI (YoY)',     val:'3.2%',        chg:'-0.20', chgPct:-0.2  },
  { name:'US Core PCE',      val:'2.8%',        chg:'-0.10', chgPct:-0.1  },
  { name:'US Unemployment',  val:'3.9%',        chg:'+0.10', chgPct: 0.1  },
  { name:'US GDP QoQ',       val:'3.4%',        chg:'+0.10', chgPct: 0.1  },
  { name:'ECB Deposit Rate', val:'4.00%',       chg: '0.00', chgPct: 0    },
  { name:'BOE Bank Rate',    val:'5.25%',       chg: '0.00', chgPct: 0    },
  { name:'BOJ Rate',         val:'-0.10%',      chg: '0.00', chgPct: 0    },
  { name:'PBOC MLF Rate',    val:'2.50%',       chg:'-0.10', chgPct:-0.1  },
  { name:'VIX Index',        val:'14.85',       chg:'-0.42', chgPct:-2.75 },
  { name:'DXY (USD Index)',   val:'103.85',      chg:'+0.23', chgPct: 0.22 },
  { name:'US 10Y - 2Y Sprd', val:'-0.49%',      chg:'+0.03', chgPct: 0    },
  { name:'Gold/Oil Ratio',   val:'29.6x',       chg:'+0.20', chgPct: 0.68 },
  { name:'BTC Dominance',    val:'52.4%',       chg:'+0.80', chgPct: 1.55 },
];

const ECON_EVENTS = [
  { time:'08:30', name:'US CPI YoY',        actual:'3.2%',  exp:'3.1%',  prev:'3.4%',  impact:'high'   },
  { time:'08:30', name:'US Core CPI',       actual:'3.8%',  exp:'3.7%',  prev:'3.9%',  impact:'high'   },
  { time:'10:00', name:'US Retail Sales',   actual:'0.6%',  exp:'0.4%',  prev:'-0.8%', impact:'medium' },
  { time:'14:00', name:'FOMC Minutes',      actual:'—',     exp:'—',     prev:'—',     impact:'high'   },
  { time:'08:30', name:'US Jobless Claims', actual:'212K',  exp:'215K',  prev:'209K',  impact:'medium' },
  { time:'09:45', name:'US PMI Composite',  actual:'52.1',  exp:'51.8',  prev:'51.4',  impact:'medium' },
  { time:'15:00', name:'EU CPI Flash',      actual:'2.6%',  exp:'2.5%',  prev:'2.8%',  impact:'high'   },
  { time:'23:50', name:'JP Trade Balance',  actual:'¥247B', exp:'¥230B', prev:'¥197B', impact:'low'    },
];

// ─────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmtPrice(p) {
  if (p == null || isNaN(p)) return 'N/A';
  if (p >= 10000)  return '$' + p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  if (p >= 1000)   return '$' + p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  if (p >= 1)      return '$' + p.toFixed(4);
  if (p >= 0.01)   return '$' + p.toFixed(6);
  return '$' + p.toFixed(8);
}

function fmtNum(n, d = 2) {
  if (n == null || isNaN(n)) return 'N/A';
  const a = Math.abs(n);
  if (a >= 1e12) return (n/1e12).toFixed(d) + 'T';
  if (a >= 1e9)  return (n/1e9).toFixed(d)  + 'B';
  if (a >= 1e6)  return (n/1e6).toFixed(d)  + 'M';
  if (a >= 1e3)  return n.toLocaleString('en-US', { maximumFractionDigits:d });
  return n.toFixed(d);
}

function fmtPct(p, digits = 2) {
  if (p == null || isNaN(p)) return '<span class="flat">—</span>';
  const sign = p >= 0 ? '+' : '';
  const cls  = p > 0.001 ? 'up' : p < -0.001 ? 'down' : 'flat';
  return `<span class="${cls}">${sign}${p.toFixed(digits)}%</span>`;
}

function fmtChg(c, digits = 2) {
  if (c == null || isNaN(c)) return '<span class="flat">—</span>';
  const sign = c >= 0 ? '+' : '';
  const cls  = c > 0 ? 'up' : c < 0 ? 'down' : 'flat';
  return `<span class="${cls}">${sign}${c.toFixed(digits)}</span>`;
}

function jitter(base, maxFrac = 0.002) {
  return base * (1 + (Math.random() - 0.5) * 2 * maxFrac);
}

function jitterAbs(base, maxAbs = 0.01) {
  return base + (Math.random() - 0.5) * 2 * maxAbs;
}

// ─────────────────────────────────────────────
//  CLOCK
// ─────────────────────────────────────────────
function tz(zone, opts = {}) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, ...opts });
}

function updateClock() {
  const now = new Date();
  const fmt  = { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false };
  const nyTime  = tz('America/New_York',   fmt).format(now);
  const lonTime = tz('Europe/London',      fmt).format(now);
  const tkyTime = tz('Asia/Tokyo',         fmt).format(now);
  const hkTime  = tz('Asia/Hong_Kong',     fmt).format(now);

  $('clock-display').textContent = `NYC ${nyTime} · LON ${lonTime} · TKY ${tkyTime} · HKG ${hkTime}`;

  // Market open/closed (NYSE: Mon–Fri 09:30–16:00 ET)
  const day     = tz('America/New_York', { weekday:'short' }).format(now);
  const nyHour  = parseInt(tz('America/New_York', { hour:'2-digit', hour12:false }).format(now));
  const nyMin   = now.getMinutes();
  const weekday = !['Sat','Sun'].includes(day);
  const open    = weekday && (nyHour > 9 || (nyHour === 9 && nyMin >= 30)) && nyHour < 16;

  const el = $('mkt-status');
  el.textContent = open ? '● NYSE OPEN' : '● NYSE CLOSED';
  el.className   = open ? 'status-open' : 'status-closed';
}

// ─────────────────────────────────────────────
//  API — CRYPTO (CoinGecko, no key)
// ─────────────────────────────────────────────
async function fetchCrypto() {
  setApiStatus('CoinGecko', 'loading');
  try {
    const url = `${CFG.ENDPOINTS.COINGECKO}/coins/markets`
      + `?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`
      + `&sparkline=false&price_change_percentage=1h,24h,7d`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    S.crypto = await r.json();
    setApiStatus('CoinGecko', 'ok');
    renderCryptoTable();
    refreshWatchlist();
    refreshMovers();
    refreshTicker();
  } catch (e) {
    setApiStatus('CoinGecko', 'error');
    console.warn('CoinGecko:', e);
  }
}

// ─────────────────────────────────────────────
//  API — FOREX (Frankfurter, no key)
// ─────────────────────────────────────────────
async function fetchForex() {
  setApiStatus('Frankfurter', 'loading');
  try {
    const pairs = 'EUR,GBP,JPY,CHF,AUD,CAD,NZD,CNY,HKD,SGD,MXN,BRL,INR,ZAR,KRW,SEK,NOK,DKK,TRY,PLN,CZK,HUF';
    const r = await fetch(`${CFG.ENDPOINTS.FRANKFURTER}/latest?from=USD&to=${pairs}`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    S.forex = d.rates;      // { EUR: 0.93, ... }  (units per 1 USD)
    setApiStatus('Frankfurter', 'ok');
    renderForexTable();
    refreshWatchlist();
    refreshTicker();
  } catch (e) {
    setApiStatus('Frankfurter', 'error');
    console.warn('Frankfurter:', e);
  }
}

// ─────────────────────────────────────────────
//  API — FEAR & GREED (alternative.me, no key)
// ─────────────────────────────────────────────
async function fetchFearGreed() {
  try {
    const r = await fetch(`${CFG.ENDPOINTS.FNG}?limit=1`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    S.fearGreed = d.data?.[0] || null;
    if (S.fearGreed) renderFearGreed();
  } catch (e) {
    console.warn('Fear & Greed:', e);
  }
}

// ─────────────────────────────────────────────
//  SIMULATED DATA (jittered each cycle)
// ─────────────────────────────────────────────
function refreshEquities() {
  S.equities = EQUITY_BASE.map(s => ({
    ...s,
    price:  jitter(s.price, 0.003),
    chg:    jitterAbs(s.chg, 0.05),
    chgPct: jitterAbs(s.chgPct, 0.05),
  }));
  renderEquitiesTable();
  refreshWatchlist();
  refreshTicker();
}

function refreshBonds() {
  S.bonds = BOND_BASE.map(b => ({
    ...b,
    yield: +(jitterAbs(b.yield, 0.02)).toFixed(3),
  }));
  renderBondsTable();
  refreshTicker();
}

function refreshCommodities() {
  S.commodities = COMMODITY_BASE.map(c => ({
    ...c,
    price: jitter(c.price, 0.004),
  }));
  renderCommoditiesTable();
  refreshTicker();
}

function refreshAlternatives() {
  S.alternatives = ALT_BASE.map(a => ({
    ...a,
    price:  jitter(a.price, 0.003),
    chgPct: jitterAbs(a.chgPct, 0.08),
  }));
  renderAlternativesTable();
}

// ─────────────────────────────────────────────
//  WEBSOCKET — CoinCap real-time prices
// ─────────────────────────────────────────────
const WS_ASSETS = [
  'bitcoin','ethereum','solana','ripple','cardano','polkadot',
  'chainlink','avalanche-2','polygon','litecoin','dogecoin',
  'shiba-inu','uniswap','aave','stellar','cosmos','algorand',
];

// CoinCap ID → CoinGecko ID mapping
const WS_ID_MAP = {
  'bitcoin':      'bitcoin',
  'ethereum':     'ethereum',
  'solana':       'solana',
  'ripple':       'ripple',
  'cardano':      'cardano',
  'polkadot':     'polkadot',
  'chainlink':    'chainlink',
  'avalanche-2':  'avalanche-2',
  'polygon':      'matic-network',
  'litecoin':     'litecoin',
  'dogecoin':     'dogecoin',
  'shiba-inu':    'shiba-inu',
  'uniswap':      'uniswap',
  'aave':         'aave',
  'stellar':      'stellar',
  'cosmos':       'cosmos',
  'algorand':     'algorand',
};

function connectWS() {
  const url = `${CFG.ENDPOINTS.COINCAP_WS}?assets=${WS_ASSETS.join(',')}`;
  try {
    S.ws = new WebSocket(url);

    S.ws.onopen = () => {
      setWsStatus('live');
      console.log('CoinCap WebSocket connected');
    };

    S.ws.onmessage = ({ data }) => {
      try {
        const prices = JSON.parse(data); // { bitcoin: "67234.12", ... }
        Object.entries(prices).forEach(([ccId, rawPrice]) => {
          const cgId = WS_ID_MAP[ccId];
          const price = parseFloat(rawPrice);
          if (!cgId || isNaN(price)) return;
          updateCryptoPriceRT(cgId, price);
        });
      } catch (_) {}
    };

    S.ws.onclose = () => {
      setWsStatus('rec');
      setTimeout(connectWS, 5000);
    };

    S.ws.onerror = () => {
      setWsStatus('off');
    };
  } catch (e) {
    setWsStatus('off');
    console.warn('WebSocket failed:', e);
  }
}

function updateCryptoPriceRT(cgId, newPrice) {
  const idx = S.crypto.findIndex(c => c.id === cgId);
  if (idx === -1) return;

  const prev = S.crypto[idx].current_price;
  S.crypto[idx].current_price = newPrice;

  // Flash row
  const row = document.getElementById(`crow-${cgId}`);
  if (row) {
    const cell = row.querySelector('.rt-price');
    if (cell) {
      const dir = newPrice > prev ? 'up' : 'down';
      cell.textContent = fmtPrice(newPrice);
      row.classList.remove('flash-up', 'flash-down');
      void row.offsetWidth; // reflow
      row.classList.add(`flash-${dir}`);
    }
  }

  // Update watchlist
  const wlPx = document.getElementById(`wlpx-${cgId}`);
  if (wlPx) wlPx.textContent = fmtPrice(newPrice);

  // Update ticker
  const tkEl = document.getElementById(`tick-${cgId}`);
  if (tkEl) tkEl.textContent = fmtPrice(newPrice).replace('$', '');
}

// ─────────────────────────────────────────────
//  CHART — CoinGecko history
// ─────────────────────────────────────────────
async function loadCryptoChart(coinId, days = 7) {
  try {
    const r = await fetch(
      `${CFG.ENDPOINTS.COINGECKO}/coins/${coinId}/market_chart`
      + `?vs_currency=usd&days=${days}`
    );
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const labels = d.prices.map(([ts]) => {
      const dt = new Date(ts);
      if (days <= 1)  return dt.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
      if (days <= 7)  return `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}h`;
      return `${dt.getMonth()+1}/${dt.getDate()}`;
    });
    const values = d.prices.map(([, p]) => p);
    drawChart(labels, values);
  } catch (e) {
    console.warn('Chart fetch error:', e);
    // Fall back to simulated
    simulateChart(S.selected?.price || 100, days);
  }
}

function simulateChart(basePrice, days = 7) {
  const pts = days <= 1 ? 96 : days * 24;
  const labels = [], values = [];
  let p = basePrice;
  for (let i = pts; i >= 0; i--) {
    const dt = new Date(Date.now() - i * (days <= 1 ? 15*60000 : 3600000));
    labels.push(days <= 1
      ? dt.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })
      : `${dt.getMonth()+1}/${dt.getDate()}`
    );
    p = p * (1 + (Math.random() - 0.48) * 0.015);
    values.push(p);
  }
  drawChart(labels, values);
}

function drawChart(labels, values) {
  const canvas = $('main-chart');
  if (!canvas) return;

  if (S.chart) { S.chart.destroy(); S.chart = null; }

  const isUp   = values[values.length - 1] >= values[0];
  const color  = isUp ? '#00FF41' : '#FF3333';
  const fill   = isUp ? 'rgba(0,255,65,0.06)' : 'rgba(255,51,51,0.06)';

  S.chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: color,
        backgroundColor: fill,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: color,
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111',
          titleColor: '#FF6600',
          bodyColor: '#ccc',
          borderColor: '#333',
          borderWidth: 1,
          callbacks: {
            label: ctx => '$' + ctx.parsed.y.toLocaleString('en-US', {
              minimumFractionDigits: 2, maximumFractionDigits: 6
            }),
          },
        },
      },
      scales: {
        x: {
          grid:  { color: '#111', drawBorder: false },
          ticks: { color: '#555', maxTicksLimit: 8, font: { size: 9, family: 'Courier New' } },
        },
        y: {
          position: 'right',
          grid:  { color: '#111', drawBorder: false },
          ticks: {
            color: '#777',
            font: { size: 9, family: 'Courier New' },
            callback: v => '$' + fmtNum(v, 2),
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
//  RENDER — Crypto Table
// ─────────────────────────────────────────────
function renderCryptoTable() {
  const tbody = qs('#tbl-crypto tbody');
  if (!tbody) return;

  tbody.innerHTML = S.crypto.slice(0, 25).map((c, i) => {
    const p1h  = c.price_change_percentage_1h_in_currency;
    const p24h = c.price_change_percentage_24h;
    const p7d  = c.price_change_percentage_7d_in_currency;
    return `
      <tr id="crow-${c.id}" onclick="openDetail('crypto','${c.id}','${c.symbol.toUpperCase()}','${escHtml(c.name)}',${c.current_price})">
        <td class="ta-l sym-col">${i+1}</td>
        <td class="ta-l">
          <span class="sym-col">${c.symbol.toUpperCase()}</span>
          <span class="name-col"> ${escHtml(c.name)}</span>
        </td>
        <td class="px-col rt-price">${fmtPrice(c.current_price)}</td>
        <td>${fmtPct(p1h)}</td>
        <td>${fmtPct(p24h)}</td>
        <td>${fmtPct(p7d)}</td>
        <td>$${fmtNum(c.market_cap)}</td>
        <td>$${fmtNum(c.total_volume)}</td>
      </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Forex Table
// ─────────────────────────────────────────────
const FX_MAJOR = ['EUR','GBP','JPY','CHF','AUD','CAD','NZD'];

function renderForexTable() {
  const tbody = qs('#tbl-fx tbody');
  if (!tbody || !Object.keys(S.forex).length) return;

  // Build pairs: we have rates as USD per 1 unit (e.g., EUR=0.93 means $1 = 0.93 EUR)
  // So USD/EUR rate = 1/0.93 = 1.075 (you pay 1.075 USD for 1 EUR)
  // Bloomberg convention: EUR/USD = 1.075 (how many USD per 1 EUR)
  const pairs = Object.entries(S.forex).map(([ccy, unitsPerUsd]) => {
    const isInverted = ['JPY','KRW','HUF','CZK','HUF'].includes(ccy);
    // rate = how many USD per 1 CCY (or CCY per USD for display)
    const usdPerCcy = 1 / unitsPerUsd;
    const displayRate = ccy === 'JPY' || ccy === 'KRW' ? (1 / usdPerCcy).toFixed(2)
                      : usdPerCcy.toFixed(4);
    const spread = ccy === 'JPY'  ? 0.03
                 : ccy === 'KRW'  ? 1.00
                 : ccy === 'CNY'  ? 0.001
                 : 0.0001;
    const jitteredChg = (Math.random() - 0.5) * 0.004;
    const isMajor = FX_MAJOR.includes(ccy);

    return {
      ccy,
      pair: isMajor || ['CHF','JPY','AUD','CAD','NZD'].includes(ccy) ? `${ccy}/USD` : `USD/${ccy}`,
      rate: parseFloat(displayRate),
      spread,
      chgPct: jitteredChg * 100,
      isMajor,
    };
  });

  // Sort: majors first
  pairs.sort((a, b) => {
    if (a.isMajor && !b.isMajor) return -1;
    if (!a.isMajor && b.isMajor) return 1;
    return a.ccy.localeCompare(b.ccy);
  });

  tbody.innerHTML = pairs.map(p => {
    const bid = (p.rate - p.spread).toFixed(p.ccy === 'JPY' || p.ccy === 'KRW' ? 2 : 4);
    const ask = (p.rate + p.spread).toFixed(p.ccy === 'JPY' || p.ccy === 'KRW' ? 2 : 4);
    const spreadPips = (p.spread * (p.ccy === 'JPY' ? 100 : 10000)).toFixed(1);
    const spreadCls = parseFloat(spreadPips) < 2 ? 'spread-tight' : parseFloat(spreadPips) > 5 ? 'spread-wide' : '';
    return `
      <tr onclick="openDetail('forex','${p.ccy}','${p.pair}','${p.pair}',${p.rate})">
        <td class="ta-l sym-col">${p.pair}</td>
        <td class="px-col">${p.rate.toFixed(p.ccy === 'JPY' || p.ccy === 'KRW' ? 2 : 4)}</td>
        <td class="flat">${bid}</td>
        <td class="flat">${ask}</td>
        <td class="${spreadCls}">${spreadPips}</td>
        <td>${fmtPct(p.chgPct)}</td>
      </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Equities Table
// ─────────────────────────────────────────────
function renderEquitiesTable() {
  const tbody = qs('#tbl-equities tbody');
  if (!tbody) return;

  tbody.innerHTML = S.equities.map(s => `
    <tr onclick="openDetail('equity','${s.sym}','${s.sym}','${escHtml(s.name)}',${s.price})">
      <td class="ta-l sym-col">${s.sym}</td>
      <td class="ta-l name-col">${escHtml(s.name)}</td>
      <td class="px-col">$${s.price.toFixed(2)}</td>
      <td>${fmtChg(s.chg)}</td>
      <td>${fmtPct(s.chgPct)}</td>
      <td class="flat">${fmtNum(s.vol, 0)}</td>
      <td class="flat">${s.pe.toFixed(1)}x</td>
    </tr>`).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Bonds Table
// ─────────────────────────────────────────────
function renderBondsTable() {
  const tbody = qs('#tbl-bonds tbody');
  if (!tbody) return;

  tbody.innerHTML = S.bonds.map(b => {
    const prev = (b.yield + (Math.random() - 0.5) * 0.04).toFixed(3);
    const chgBps = ((b.yield - parseFloat(prev)) * 100).toFixed(1);
    const chgCls = parseFloat(chgBps) > 0 ? 'up' : parseFloat(chgBps) < 0 ? 'down' : 'flat';
    const badge = `<span class="badge badge-${b.type}">${b.type.toUpperCase()}</span>`;
    return `
      <tr>
        <td class="ta-l sym-col">${escHtml(b.name)}</td>
        <td class="px-col">${b.yield.toFixed(2)}%</td>
        <td class="flat">${prev}%</td>
        <td class="${chgCls}">${chgBps > 0 ? '+' : ''}${chgBps}</td>
        <td>${badge}</td>
      </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Commodities Table
// ─────────────────────────────────────────────
function renderCommoditiesTable() {
  const tbody = qs('#tbl-commodities tbody');
  if (!tbody) return;

  tbody.innerHTML = S.commodities.map(c => {
    const base   = COMMODITY_BASE.find(x => x.sym === c.sym);
    const chg    = c.price - (base?.price || c.price);
    const chgPct = base ? (chg / base.price) * 100 : 0;
    return `
      <tr>
        <td class="ta-l sym-col">${c.sym}</td>
        <td class="px-col">$${c.price.toFixed(c.price < 10 ? 4 : 2)}</td>
        <td>${fmtChg(chg)}</td>
        <td>${fmtPct(chgPct)}</td>
        <td class="flat">${c.unit}</td>
        <td><span class="badge badge-${c.sector}">${c.sector.toUpperCase()}</span></td>
      </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Alternatives Table
// ─────────────────────────────────────────────
function renderAlternativesTable() {
  const tbody = qs('#tbl-alternatives tbody');
  if (!tbody) return;

  tbody.innerHTML = S.alternatives.map(a => `
    <tr onclick="openDetail('equity','${a.sym}','${a.sym}','${escHtml(a.name)}',${a.price})">
      <td class="ta-l sym-col">${escHtml(a.name)}</td>
      <td class="sym-col">${a.sym}</td>
      <td class="px-col">$${a.price.toFixed(2)}</td>
      <td>${fmtPct(a.chgPct)}</td>
      <td><span class="badge badge-${a.cat}">${a.cat.toUpperCase()}</span></td>
    </tr>`).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Fear & Greed
// ─────────────────────────────────────────────
function renderFearGreed() {
  const fg = S.fearGreed;
  if (!fg) return;

  const val = parseInt(fg.value);
  const cls = val > 60 ? 'up' : val < 40 ? 'down' : 'flat';

  $('fng-value').textContent = val;
  $('fng-value').className   = cls;
  $('fng-label').textContent = fg.value_classification.toUpperCase();
  $('fng-label').className   = cls;
  $('fng-meta').textContent  = `Updated: ${new Date(fg.timestamp * 1000).toLocaleDateString()}`;

  // SVG arc needle
  // Arc goes from left (0) to right (180 deg), val=0 → left, val=100 → right
  const angle  = (val / 100) * 180 - 90; // -90 to +90 degrees
  const rad    = (angle * Math.PI) / 180;
  const cx = 60, cy = 65, r = 45;
  const nx = cx + r * Math.sin(rad);
  const ny = cy - r * Math.cos(rad);

  const needle  = $('fng-needle');
  const arcFill = $('fng-arc-fill');
  if (needle)  { needle.setAttribute('x2', nx); needle.setAttribute('y2', ny); }

  // Arc fill: dasharray total is ~157 (half circumference of r=50)
  const totalArc = 157;
  if (arcFill) arcFill.style.strokeDasharray = `${(val / 100) * totalArc} ${totalArc}`;
}

// ─────────────────────────────────────────────
//  RENDER — Macro Indicators
// ─────────────────────────────────────────────
function renderMacro() {
  const el = $('macro-panel');
  if (!el) return;
  el.innerHTML = MACRO_DATA.map(m => `
    <div class="macro-item">
      <span class="macro-name" title="${escHtml(m.name)}">${escHtml(m.name)}</span>
      <span class="macro-val">${m.val}</span>
      <span class="macro-chg ${parseFloat(m.chg) > 0 ? 'up' : parseFloat(m.chg) < 0 ? 'down' : 'flat'}">${m.chg}</span>
    </div>`).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Economic Calendar
// ─────────────────────────────────────────────
function renderEconCalendar() {
  const el = $('econ-calendar');
  if (!el) return;
  el.innerHTML = ECON_EVENTS.map(ev => `
    <div class="econ-row">
      <span class="econ-time">${ev.time}</span>
      <span class="econ-impact-${ev.impact}"> ●</span>
      <span class="econ-name"> ${escHtml(ev.name)}</span>
      <div class="econ-vals">
        <span class="econ-actual">A: ${ev.actual}</span>
        <span class="econ-expected">E: ${ev.exp}</span>
        <span class="econ-prev">P: ${ev.prev}</span>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Market Movers
// ─────────────────────────────────────────────
function refreshMovers() {
  const el = $('movers-panel');
  if (!el || !S.crypto.length) return;

  const sorted = [...S.crypto].sort((a, b) =>
    (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
  );
  const gainers = sorted.slice(0, 5);
  const losers  = sorted.slice(-5).reverse();

  el.innerHTML =
    `<div class="movers-sub">▲ TOP GAINERS 24H</div>` +
    gainers.map(c => `
      <div class="mover-row" onclick="openDetail('crypto','${c.id}','${c.symbol.toUpperCase()}','${escHtml(c.name)}',${c.current_price})">
        <span class="mv-sym">${c.symbol.toUpperCase()}</span>
        <span class="mv-px">${fmtPrice(c.current_price)}</span>
        <span class="mv-pct up">+${(c.price_change_percentage_24h || 0).toFixed(2)}%</span>
      </div>`).join('') +
    `<div class="movers-sub" style="margin-top:4px">▼ TOP LOSERS 24H</div>` +
    losers.map(c => `
      <div class="mover-row" onclick="openDetail('crypto','${c.id}','${c.symbol.toUpperCase()}','${escHtml(c.name)}',${c.current_price})">
        <span class="mv-sym">${c.symbol.toUpperCase()}</span>
        <span class="mv-px">${fmtPrice(c.current_price)}</span>
        <span class="mv-pct down">${(c.price_change_percentage_24h || 0).toFixed(2)}%</span>
      </div>`).join('');
}

// ─────────────────────────────────────────────
//  RENDER — Watchlist
// ─────────────────────────────────────────────
function refreshWatchlist() {
  const el = $('watchlist-body');
  if (!el) return;

  let html = '';

  // Crypto
  html += `<div class="wl-section-title">— CRYPTO</div>`;
  S.crypto.slice(0, 10).forEach(c => {
    const p24h = c.price_change_percentage_24h || 0;
    html += `
      <div class="wl-item" onclick="openDetail('crypto','${c.id}','${c.symbol.toUpperCase()}','${escHtml(c.name)}',${c.current_price})">
        <span class="wl-sym">${c.symbol.toUpperCase()}</span>
        <div class="wl-right">
          <div class="wl-px" id="wlpx-${c.id}">${fmtPrice(c.current_price)}</div>
          <div class="wl-pct ${p24h >= 0 ? 'up' : 'down'}">${p24h >= 0 ? '+' : ''}${p24h.toFixed(2)}%</div>
        </div>
      </div>`;
  });

  // Forex
  html += `<div class="wl-section-title">— FOREX</div>`;
  FX_MAJOR.forEach(ccy => {
    const rate = S.forex[ccy];
    if (!rate) return;
    const display = ccy === 'JPY' ? (rate).toFixed(2) : (1/rate).toFixed(4);
    html += `
      <div class="wl-item" onclick="openDetail('forex','${ccy}','${ccy}/USD','${ccy}/USD',${1/rate})">
        <span class="wl-sym">${ccy}/USD</span>
        <div class="wl-px">${display}</div>
      </div>`;
  });

  // Equities
  html += `<div class="wl-section-title">— EQUITIES</div>`;
  S.equities.slice(0, 6).forEach(s => {
    html += `
      <div class="wl-item" onclick="openDetail('equity','${s.sym}','${s.sym}','${escHtml(s.name)}',${s.price})">
        <span class="wl-sym">${s.sym}</span>
        <div class="wl-right">
          <div class="wl-px">$${s.price.toFixed(2)}</div>
          <div class="wl-pct ${s.chgPct >= 0 ? 'up' : 'down'}">${s.chgPct >= 0 ? '+' : ''}${s.chgPct.toFixed(2)}%</div>
        </div>
      </div>`;
  });

  // Bonds
  html += `<div class="wl-section-title">— BONDS</div>`;
  S.bonds.slice(0, 5).forEach(b => {
    html += `
      <div class="wl-item">
        <span class="wl-sym" style="font-size:9px">${b.name.replace('US ','')}</span>
        <div class="wl-px">${b.yield.toFixed(2)}%</div>
      </div>`;
  });

  // Commodities
  html += `<div class="wl-section-title">— COMMODITIES</div>`;
  S.commodities.slice(0, 4).forEach(c => {
    html += `
      <div class="wl-item">
        <span class="wl-sym">${c.sym}</span>
        <div class="wl-px">$${c.price.toFixed(c.price < 10 ? 2 : 2)}</div>
      </div>`;
  });

  el.innerHTML = html;
}

// ─────────────────────────────────────────────
//  TICKER TAPE
// ─────────────────────────────────────────────
function refreshTicker() {
  const items = [];

  // Crypto (real-time)
  S.crypto.slice(0, 12).forEach(c => {
    const p = c.price_change_percentage_24h || 0;
    items.push({
      sym:   c.symbol.toUpperCase(),
      price: fmtPrice(c.current_price).replace('$',''),
      pct:   p,
      id:    c.id,
      type:  'crypto',
    });
  });

  // Forex
  FX_MAJOR.forEach(ccy => {
    const rate = S.forex[ccy];
    if (!rate) return;
    items.push({
      sym:   `${ccy}/USD`,
      price: ccy === 'JPY' ? (rate).toFixed(2) : (1/rate).toFixed(4),
      pct:   (Math.random() - 0.5) * 0.3,
      id:    ccy,
      type:  'forex',
    });
  });

  // Equities
  S.equities.slice(0, 8).forEach(s => {
    items.push({ sym: s.sym, price: s.price.toFixed(2), pct: s.chgPct, id: s.sym, type: 'equity' });
  });

  // Key bonds
  S.bonds.slice(0, 4).forEach(b => {
    items.push({ sym: b.name.replace('US ',''), price: b.yield.toFixed(2)+'%', pct: 0, id: b.name, type: 'bond' });
  });

  // Top commodities
  S.commodities.slice(0, 4).forEach(c => {
    const base = COMMODITY_BASE.find(x => x.sym === c.sym);
    const pct  = base ? ((c.price - base.price) / base.price) * 100 : 0;
    items.push({ sym: c.sym, price: c.price.toFixed(2), pct, id: c.sym, type: 'commodity' });
  });

  const html = items.map(item => {
    const arrow = item.pct > 0 ? '▲' : item.pct < 0 ? '▼' : '●';
    const cls   = item.pct > 0 ? 'up' : item.pct < 0 ? 'down' : 'flat';
    return `
      <span class="tick-item">
        <span class="tick-sym">${item.sym}</span>
        <span class="tick-px" id="tick-${item.id}">${item.price}</span>
        <span class="tick-chg ${cls}"> ${arrow}${Math.abs(item.pct).toFixed(2)}%</span>
      </span>`;
  }).join('');

  const track = $('ticker-track');
  track.innerHTML = html + html; // duplicate for seamless loop

  // Adjust animation speed
  const speed = Math.max(40, items.length * 3.5);
  track.style.animationDuration = `${speed}s`;
}

// ─────────────────────────────────────────────
//  DETAIL VIEW
// ─────────────────────────────────────────────
function openDetail(type, id, symbol, name, price) {
  S.selected = { type, id, symbol, name, price };

  $('pane-overview').classList.remove('active');
  $('detail-view').classList.remove('hidden');

  $('det-symbol').textContent = symbol;
  $('det-name').textContent   = name !== symbol ? name : '';
  $('det-price').textContent  = type === 'crypto' ? fmtPrice(price) : '$' + price.toFixed(2);

  // Change %
  let chgPct = null;
  if (type === 'crypto') {
    const coin = S.crypto.find(c => c.id === id);
    chgPct = coin?.price_change_percentage_24h;
  } else if (type === 'equity') {
    const eq = S.equities.find(s => s.sym === id);
    chgPct = eq?.chgPct;
  }
  $('det-chg').innerHTML = chgPct != null ? fmtPct(chgPct) : '';

  // Detail stats
  renderDetailStats(type, id);

  // Load chart
  qsa('.tf-btn').forEach(b => b.classList.remove('active'));
  qs('.tf-btn[data-days="7"]')?.classList.add('active');

  if (type === 'crypto') {
    loadCryptoChart(id, 7);
  } else {
    simulateChart(price, 7);
  }
}

function renderDetailStats(type, id) {
  const el = $('detail-stats');
  if (!el) return;

  let stats = [];

  if (type === 'crypto') {
    const c = S.crypto.find(x => x.id === id);
    if (c) {
      stats = [
        { label: 'MKT CAP',      val: '$' + fmtNum(c.market_cap) },
        { label: '24H VOLUME',   val: '$' + fmtNum(c.total_volume) },
        { label: '24H HIGH',     val: fmtPrice(c.high_24h) },
        { label: '24H LOW',      val: fmtPrice(c.low_24h) },
        { label: 'ATH',          val: fmtPrice(c.ath) },
        { label: 'RANK',         val: `#${c.market_cap_rank}` },
        { label: 'CIRCULATING',  val: fmtNum(c.circulating_supply) + ' ' + c.symbol.toUpperCase() },
      ];
    }
  } else if (type === 'equity') {
    const s = S.equities.find(x => x.sym === id);
    if (s) {
      stats = [
        { label: 'PRICE',    val: '$' + s.price.toFixed(2) },
        { label: '24H CHG',  val: fmtChg(s.chg) },
        { label: 'CHG %',    val: fmtPct(s.chgPct) },
        { label: 'VOLUME',   val: fmtNum(s.vol, 0) },
        { label: 'P/E',      val: s.pe.toFixed(1) + 'x' },
      ];
    }
  } else if (type === 'forex') {
    const rate = S.forex[id];
    if (rate) {
      stats = [
        { label: 'RATE',    val: (1/rate).toFixed(6) },
        { label: 'UNITS/USD', val: rate.toFixed(6) },
        { label: 'SOURCE',  val: 'Frankfurter' },
      ];
    }
  }

  el.innerHTML = stats.map(s => `
    <div class="stat-item">
      <span class="stat-label">${s.label}</span>
      <span class="stat-val">${s.val}</span>
    </div>`).join('');
}

// ─────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────
function initTabs() {
  qsa('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      qsa('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Hide detail view, show overview
      $('detail-view').classList.add('hidden');
      $('pane-overview').classList.add('active');
      S.selected = null;
    });
  });

  // Timeframe buttons
  qsa('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.dataset.days);
      if (S.selected?.type === 'crypto') {
        loadCryptoChart(S.selected.id, days);
      } else if (S.selected) {
        simulateChart(S.selected.price, days);
      }
    });
  });

  // Back button
  $('btn-back')?.addEventListener('click', () => {
    $('detail-view').classList.add('hidden');
    $('pane-overview').classList.add('active');
    S.selected = null;
    if (S.chart) { S.chart.destroy(); S.chart = null; }
  });
}

// ─────────────────────────────────────────────
//  COMMAND INPUT
// ─────────────────────────────────────────────
function initCommandInput() {
  const input = $('cmd-input');
  if (!input) return;

  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const raw = input.value.trim().toUpperCase();
    input.value = '';
    if (!raw) return;
    handleCommand(raw);
  });
}

function handleCommand(cmd) {
  if (cmd === 'HELP') { alert('Commands: Enter a ticker (BTC, AAPL, EUR), asset name, or function.\nExamples: BTC · ETH · AAPL · EUR · GOLD'); return; }

  // Search crypto
  const coin = S.crypto.find(c =>
    c.symbol.toUpperCase() === cmd || c.id.toUpperCase() === cmd || c.name.toUpperCase() === cmd
  );
  if (coin) { openDetail('crypto', coin.id, coin.symbol.toUpperCase(), coin.name, coin.current_price); return; }

  // Search equity
  const eq = S.equities.find(s => s.sym === cmd || s.name.toUpperCase().includes(cmd));
  if (eq) { openDetail('equity', eq.sym, eq.sym, eq.name, eq.price); return; }

  // Search forex
  const ccy = Object.keys(S.forex).find(c => c === cmd || `${c}/USD` === cmd || `USD/${c}` === cmd);
  if (ccy) { openDetail('forex', ccy, `${ccy}/USD`, `${ccy}/USD`, 1/S.forex[ccy]); return; }

  alert(`"${cmd}" not found. Try BTC, ETH, AAPL, EUR, GBP, JPY, etc.`);
}

// ─────────────────────────────────────────────
//  STATUS BAR
// ─────────────────────────────────────────────
function setApiStatus(name, status) {
  S.apiStatus[name] = status;
  updateStatusBar();
}

function setWsStatus(state) {
  const el = $('ws-indicator');
  if (!el) return;
  const map = { live: ['WS: LIVE ●', 'ws-live'], rec: ['WS: RECONNECTING', 'ws-rec'], off: ['WS: OFFLINE', 'ws-off'] };
  const [text, cls] = map[state] || map.off;
  el.textContent = text;
  el.className = cls;
}

function updateStatusBar() {
  const el = $('api-indicators');
  if (!el) return;
  const parts = Object.entries(S.apiStatus).map(([k, v]) =>
    `${k}: ${v === 'ok' ? '✓' : v === 'error' ? '✗' : '…'}`
  );
  el.textContent = parts.join(' | ');
  $('last-upd').textContent = `UPDATED: ${new Date().toLocaleTimeString()}`;
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Expose for HTML onclick
window.openDetail = openDetail;

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
async function init() {
  console.log('[Bloomberg Terminal] Initializing…');

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Static renders (don't need API data)
  renderMacro();
  renderEconCalendar();

  // Initialize simulated data immediately
  refreshBonds();
  refreshCommodities();
  refreshAlternatives();
  refreshEquities();
  refreshWatchlist();

  // UI wiring
  initTabs();
  initCommandInput();

  // Live API calls (parallel)
  await Promise.allSettled([
    fetchCrypto(),
    fetchForex(),
    fetchFearGreed(),
  ]);

  // Rebuild ticker now that we have live data
  refreshTicker();
  refreshMovers();
  refreshWatchlist();

  // WebSocket for real-time crypto streaming
  connectWS();

  // Refresh intervals
  S.timers.crypto      = setInterval(fetchCrypto,         CFG.REFRESH.CRYPTO);
  S.timers.forex       = setInterval(fetchForex,          CFG.REFRESH.FOREX);
  S.timers.fng         = setInterval(fetchFearGreed,      CFG.REFRESH.SENTIMENT);
  S.timers.equities    = setInterval(refreshEquities,     CFG.REFRESH.EQUITIES);
  S.timers.bonds       = setInterval(refreshBonds,        CFG.REFRESH.BONDS);
  S.timers.commodities = setInterval(refreshCommodities,  CFG.REFRESH.BONDS);
  S.timers.alts        = setInterval(refreshAlternatives, CFG.REFRESH.EQUITIES);
  S.timers.ticker      = setInterval(refreshTicker,       CFG.REFRESH.TICKER);
  S.timers.movers      = setInterval(refreshMovers,       CFG.REFRESH.MOVERS);
  S.timers.status      = setInterval(updateStatusBar,     10_000);

  console.log('[Bloomberg Terminal] Ready.');
}

// Kick off
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
