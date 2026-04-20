/* ============================================
   ALPHA MARIO OSINT PLATFORM — APP.JS
   3D Globe, Live Feed, Animations
   ============================================ */

(function () {
  'use strict';

  // ── Globe ──────────────────────────────────────────
  function initGlobe() {
    var container = document.getElementById('globeContainer');
    if (!container || typeof Globe === 'undefined') return;

    var width = container.clientWidth;
    var height = container.clientHeight;

    var globe = Globe()
      .globeImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png')
      .backgroundImageUrl('')
      .backgroundColor('rgba(0,0,0,0)')
      .atmosphereColor('#00e5ff')
      .atmosphereAltitude(0.2)
      .width(width)
      .height(height)
      .pointOfView({ lat: 20, lng: 0, altitude: 2.5 })
      (container);

    // Arc data — simulated intelligence routes
    var arcs = generateArcs(30);
    globe
      .arcsData(arcs)
      .arcColor(function () { return ['rgba(0,229,255,0.6)', 'rgba(0,229,255,0.1)']; })
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(2500)
      .arcStroke(0.5);

    // Points — active signal nodes
    var points = generatePoints(80);
    globe
      .pointsData(points)
      .pointColor(function () { return '#00e5ff'; })
      .pointAltitude(0.01)
      .pointRadius(0.3)
      .pointsMerge(true);

    // Ring pulses at key locations
    var rings = generateRings(12);
    globe
      .ringsData(rings)
      .ringColor(function () { return function (t) { return 'rgba(0,229,255,' + (1 - t) + ')'; }; })
      .ringMaxRadius(3)
      .ringPropagationSpeed(1)
      .ringRepeatPeriod(3000);

    // Labels
    var labels = [
      { lat: 38.9, lng: -77.0, text: 'DC-NODE', size: 0.6 },
      { lat: 51.5, lng: -0.1, text: 'LDN-NODE', size: 0.6 },
      { lat: 35.7, lng: 139.7, text: 'TKY-NODE', size: 0.6 },
      { lat: 1.3, lng: 103.8, text: 'SGP-NODE', size: 0.6 },
      { lat: -33.9, lng: 18.4, text: 'CPT-NODE', size: 0.6 },
    ];
    globe
      .labelsData(labels)
      .labelText('text')
      .labelSize('size')
      .labelDotRadius(0.3)
      .labelColor(function () { return '#00e5ff'; })
      .labelResolution(2);

    // Auto-rotate
    var controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', function () {
      var pov = globe.pointOfView();
      globe.pointOfView({ altitude: Math.max(0.5, pov.altitude - 0.5) }, 400);
    });
    document.getElementById('zoomOut').addEventListener('click', function () {
      var pov = globe.pointOfView();
      globe.pointOfView({ altitude: Math.min(5, pov.altitude + 0.5) }, 400);
    });
    document.getElementById('resetView').addEventListener('click', function () {
      globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 800);
    });

    // Resize handler
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        globe.width(container.clientWidth).height(container.clientHeight);
      }, 200);
    });

    // Periodically refresh arcs & rings
    setInterval(function () {
      globe.arcsData(generateArcs(30));
    }, 8000);

    setInterval(function () {
      globe.ringsData(generateRings(12));
    }, 6000);
  }

  function generateArcs(count) {
    var arcs = [];
    for (var i = 0; i < count; i++) {
      arcs.push({
        startLat: (Math.random() - 0.5) * 160,
        startLng: (Math.random() - 0.5) * 340,
        endLat: (Math.random() - 0.5) * 160,
        endLng: (Math.random() - 0.5) * 340,
      });
    }
    return arcs;
  }

  function generatePoints(count) {
    var pts = [];
    for (var i = 0; i < count; i++) {
      pts.push({
        lat: (Math.random() - 0.5) * 160,
        lng: (Math.random() - 0.5) * 340,
      });
    }
    return pts;
  }

  function generateRings(count) {
    var rings = [];
    for (var i = 0; i < count; i++) {
      rings.push({
        lat: (Math.random() - 0.5) * 160,
        lng: (Math.random() - 0.5) * 340,
      });
    }
    return rings;
  }

  // ── Counter Animation ─────────────────────────────
  function animateCounters() {
    var counters = document.querySelectorAll('[data-counter]');
    counters.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-counter'), 10);
      var duration = 2000;
      var start = 0;
      var startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toLocaleString();
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target.toLocaleString();
        }
      }

      requestAnimationFrame(step);
    });
  }

  // ── Live Signal Feed ───────────────────────────────
  var SIGNAL_TYPES = ['cyber', 'geoint', 'sigint', 'humint', 'finint'];
  var SIGNAL_LEVELS = ['critical', 'high', 'moderate', 'low', 'info'];

  var SIGNAL_MESSAGES = {
    cyber: [
      'Anomalous SSH brute-force pattern detected — origin: Eastern Europe cluster',
      'New ransomware variant signature identified in dark web marketplace',
      'DNS tunneling activity observed on monitored corporate network',
      'Zero-day exploit discussion detected on closed forum',
      'Phishing campaign infrastructure linked to known APT group',
      'Credential dump containing 450K records posted on paste site',
      'C2 beacon traffic pattern matched — Cobalt Strike profile',
      'Suspicious BGP route hijack affecting APAC network segments',
    ],
    geoint: [
      'Satellite imagery shows increased vehicle activity at military installation',
      'New construction detected at previously inactive airfield',
      'Port facility cargo throughput deviation exceeds 3-sigma threshold',
      'Thermal anomaly detected near industrial complex — potential expansion',
      'Maritime vessel AIS transponder disabled in restricted zone',
      'Cross-border troop movement indicators via SAR imagery analysis',
    ],
    sigint: [
      'Burst transmission detected on previously dormant frequency band',
      'Communications pattern shift observed in monitored network cluster',
      'New encryption protocol deployment detected across diplomatic channels',
      'RF spectrum anomaly in contested maritime zone',
      'Satellite uplink frequency allocation change detected',
    ],
    humint: [
      'Social media analysis indicates emerging protest coordination',
      'Unusual executive travel pattern identified via public records',
      'Academic publication references dual-use technology advancement',
      'Key leadership change reported at state-affiliated research entity',
      'Diaspora community sentiment shift detected via NLP analysis',
    ],
    finint: [
      'Cryptocurrency mixer activity spike linked to sanctioned entity wallet',
      'Unusual options volume detected ahead of geopolitical event',
      'Shell company registration surge in offshore jurisdiction',
      'Trade finance anomaly flagged in sanctioned corridor',
      'Hawala network transaction volume exceeds established baseline',
    ],
  };

  var activeFilter = 'all';
  var allSignals = [];

  function generateSignal() {
    var type = SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)];
    var levelWeights = [0.05, 0.15, 0.3, 0.3, 0.2];
    var r = Math.random();
    var cumulative = 0;
    var levelIdx = 0;
    for (var i = 0; i < levelWeights.length; i++) {
      cumulative += levelWeights[i];
      if (r <= cumulative) { levelIdx = i; break; }
    }
    var level = SIGNAL_LEVELS[levelIdx];
    var messages = SIGNAL_MESSAGES[type];
    var text = messages[Math.floor(Math.random() * messages.length)];
    var now = new Date();
    var time = padZero(now.getHours()) + ':' + padZero(now.getMinutes()) + ':' + padZero(now.getSeconds());

    return { time: time, type: type, level: level, text: text };
  }

  function padZero(n) { return n < 10 ? '0' + n : '' + n; }

  function renderSignal(signal) {
    var div = document.createElement('div');
    div.className = 'signal-item';
    div.setAttribute('data-type', signal.type);
    div.innerHTML =
      '<span class="signal-item__time">' + signal.time + '</span>' +
      '<span class="signal-item__type signal-item__type--' + signal.type + '">' + signal.type.toUpperCase() + '</span>' +
      '<span class="signal-item__text">' + signal.text + '</span>' +
      '<span class="signal-item__level signal-item__level--' + signal.level + '">' + signal.level.toUpperCase() + '</span>';
    return div;
  }

  function updateFeed() {
    var feed = document.getElementById('signalFeed');
    if (!feed) return;

    var signal = generateSignal();
    allSignals.unshift(signal);
    if (allSignals.length > 100) allSignals.pop();

    if (activeFilter === 'all' || signal.type === activeFilter) {
      var el = renderSignal(signal);
      feed.insertBefore(el, feed.firstChild);

      var visible = feed.querySelectorAll('.signal-item');
      if (visible.length > 30) {
        feed.removeChild(visible[visible.length - 1]);
      }
    }

    updateCount();
  }

  function filterSignals(type) {
    activeFilter = type;
    var feed = document.getElementById('signalFeed');
    feed.innerHTML = '';

    var filtered = type === 'all' ? allSignals : allSignals.filter(function (s) { return s.type === type; });
    filtered.slice(0, 30).forEach(function (s) {
      feed.appendChild(renderSignal(s));
    });

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.classList.toggle('filter-btn--active', btn.getAttribute('data-filter') === type);
    });

    updateCount();
  }

  function updateCount() {
    var el = document.getElementById('signalCount');
    if (!el) return;
    var filtered = activeFilter === 'all' ? allSignals : allSignals.filter(function (s) { return s.type === activeFilter; });
    el.textContent = filtered.length + ' signal' + (filtered.length !== 1 ? 's' : '');
  }

  // ── Navigation ─────────────────────────────────────
  function initNav() {
    var nav = document.getElementById('nav');
    var toggle = document.getElementById('navToggle');
    var mobileMenu = document.getElementById('mobileMenu');

    window.addEventListener('scroll', function () {
      nav.classList.toggle('nav--scrolled', window.scrollY > 50);
    });

    toggle.addEventListener('click', function () {
      toggle.classList.toggle('active');
      mobileMenu.classList.toggle('active');
    });

    document.querySelectorAll('.mobile-menu__link, .nav__link').forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.classList.remove('active');
        mobileMenu.classList.remove('active');
      });
    });

    // Active link tracking
    var sections = document.querySelectorAll('.hero, .section');
    var navLinks = document.querySelectorAll('.nav__link');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          navLinks.forEach(function (l) {
            l.classList.toggle('nav__link--active', l.getAttribute('data-section') === id);
          });
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(function (sec) { observer.observe(sec); });
  }

  // ── Scroll Reveal ──────────────────────────────────
  function initReveal() {
    var items = document.querySelectorAll('.module-card, .guide__item, .about__feature, .guide__principles');
    items.forEach(function (el) { el.classList.add('reveal'); });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    items.forEach(function (el) { observer.observe(el); });
  }

  // ── Filter Buttons ─────────────────────────────────
  function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterSignals(btn.getAttribute('data-filter'));
      });
    });
  }

  // ── Terminal Typing Effect ─────────────────────────
  function initTerminal() {
    var body = document.getElementById('terminalBody');
    if (!body) return;

    var commands = [
      { cmd: 'alpha-mario scan --region=global', output: '→ Scanning 193 countries... 14,892 active signals detected.' },
      { cmd: 'alpha-mario threats --level=critical', output: '→ 3 critical threats identified. See dashboard for details.' },
      { cmd: 'alpha-mario export --format=stix2.1', output: '→ Exporting 847 indicators in STIX 2.1 format... done.' },
    ];

    var cmdIdx = 0;

    function typeCommand() {
      if (cmdIdx >= commands.length) cmdIdx = 0;
      var current = commands[cmdIdx];
      cmdIdx++;

      var line = document.createElement('div');
      line.className = 'terminal__line';
      line.innerHTML = '<span class="terminal__prompt">$</span> <span class="terminal__typed"></span><span class="terminal__cursor">_</span>';

      var lastCursorLine = body.querySelector('.terminal__line:last-child');
      body.insertBefore(line, lastCursorLine);

      var typed = line.querySelector('.terminal__typed');
      var charIdx = 0;

      function typeChar() {
        if (charIdx < current.cmd.length) {
          typed.textContent += current.cmd[charIdx];
          charIdx++;
          setTimeout(typeChar, 30 + Math.random() * 40);
        } else {
          line.querySelector('.terminal__cursor').remove();
          var output = document.createElement('div');
          output.className = 'terminal__output';
          output.textContent = current.output;
          output.style.color = '#00e5ff';
          body.insertBefore(output, lastCursorLine);
          setTimeout(typeCommand, 4000);
        }
      }

      setTimeout(typeChar, 500);
    }

    setTimeout(typeCommand, 3000);
  }

  // ── Boot ───────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initGlobe();
    animateCounters();
    initReveal();
    initFilters();
    initTerminal();

    // Seed initial signals
    for (var i = 0; i < 15; i++) {
      var s = generateSignal();
      allSignals.push(s);
    }
    filterSignals('all');

    // Live feed updates
    setInterval(updateFeed, 3000);
  });

})();
