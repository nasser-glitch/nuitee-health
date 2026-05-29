/* Nuitee Health Dashboard — live aggregation engine.
   Operates on packed events: [partnerIdx, supplierIdx, hotel, shown, outcome, bval, margin, lat, mask, day]
   outcome: 0 searched, 1 shown, 2 clicked, 3 booked, 4 book_failed
   mask bits: F1=1 F2=2 F3=4 F4=8 F5=16 F6=32
     F1 No rate returned      F2 Uncompetitive rate    F3 Booking failed
     F4 High latency          F5 Competitive not shown  F6 Dead search
   Health = equally weighted average of availability, competitiveness, reliability (all as % success). */
(function () {
  var P = 0, S = 1, H = 2, SH = 3, O = 4, BV = 5, MG = 6, LT = 7, MK = 8, DY = 9;
  var F1 = 1, F2 = 2, F3 = 4, F4 = 8, F5 = 16, F6 = 32;
  var W = [1/3, 1/3, 1/3];

  function wk(day) { var w = Math.floor((day - 1) / 7); return w > 3 ? 3 : w; }
  function p95(arr) { if (!arr.length) return 0; arr.sort(function (a, b) { return a - b; }); return arr[Math.floor(0.95 * arr.length)] || arr[arr.length - 1]; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function health(av, co, re) { return r1(W[0] * av + W[1] * co + W[2] * re); }

  // opts: { partners:Set(name), suppliers:Set(name), dayFrom, dayTo }
  window.aggregate = function (events, opts) {
    var PARTNERS = window.NUITEE_PARTNERS, SUPPLIERS = window.NUITEE_SUPPLIERS;
    opts = opts || {};
    var pFilter = opts.partners && opts.partners.size ? opts.partners : null;
    var sFilter = opts.suppliers && opts.suppliers.size ? opts.suppliers : null;
    var dFrom = opts.dayFrom || 1, dTo = opts.dayTo || 31;

    function blank() { return { n: 0, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, shown: 0, clicked: 0, booked: 0, bf: 0, bval: 0, margin: 0, lat: [], wk: [[0, 0], [0, 0], [0, 0], [0, 0]] }; }

    var supA = {}, partA = {}, supHotel = {}, supPartner = {}, supWk = {};
    var cellA = {}; // p|s
    SUPPLIERS.forEach(function (s) { supA[s] = blank(); supHotel[s] = {}; supPartner[s] = {}; supWk[s] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; });
    PARTNERS.forEach(function (p) { partA[p] = blank(); });
    PARTNERS.forEach(function (p) { SUPPLIERS.forEach(function (s) { cellA[p + '|' + s] = blank(); }); });

    var totF5 = 0, totF6 = 0, totN = 0, totBval = 0, totMargin = 0, totBooked = 0;
    var f5byP = {}, f6byS = {}, f5combo = {}, f6combo = {};

    function bump(o, e) {
      o.n++; var m = e[MK];
      if (m & F1) o.f1++; if (m & F2) o.f2++; if (m & F3) o.f3++; if (m & F4) o.f4++; if (m & F5) o.f5++; if (m & F6) o.f6++;
      if (e[SH]) o.shown++;
      var oc = e[O];
      if (oc === 2 || oc === 3 || oc === 4) o.clicked++;
      if (oc === 3) o.booked++;
      if (oc === 4) o.bf++;
      o.bval += e[BV]; o.margin += e[MG]; o.lat.push(e[LT]);
      var w = wk(e[DY]); o.wk[w][0]++; if (oc === 3) o.wk[w][1]++;
    }

    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      var pn = PARTNERS[e[P]], sn = SUPPLIERS[e[S]];
      if (pFilter && !pFilter.has(pn)) continue;
      if (sFilter && !sFilter.has(sn)) continue;
      var d = e[DY]; if (d < dFrom || d > dTo) continue;
      var m = e[MK], fail = (m & (F1 | F2 | F3)) ? 1 : 0;  // availability + competitiveness + reliability

      bump(supA[sn], e); bump(partA[pn], e); bump(cellA[pn + '|' + sn], e);
      totN++; totBval += e[BV]; totMargin += e[MG];
      if (e[O] === 3) totBooked++;
      if (m & F5) { totF5++; f5byP[pn] = (f5byP[pn] || 0) + 1; var k5 = pn + '|' + e[H]; f5combo[k5] = (f5combo[k5] || 0) + 1; }
      if (m & F6) { totF6++; f6byS[sn] = (f6byS[sn] || 0) + 1; var k6 = pn + '|' + sn; f6combo[k6] = (f6combo[k6] || 0) + 1; }
      if (fail) { supHotel[sn][e[H]] = (supHotel[sn][e[H]] || 0) + 1; }
      var sp = supPartner[sn][pn] || (supPartner[sn][pn] = { n: 0, fail: 0 });
      sp.n++; if (fail) sp.fail++;
    }

    // ---- suppliers ----
    var suppliers = SUPPLIERS.map(function (s) {
      var o = supA[s]; if (!o.n) return null;
      var av = 100 * (1 - o.f1 / o.n), co = 100 * (1 - o.f2 / o.n), re = 100 * (1 - o.f3 / o.n);
      var hotels = Object.keys(supHotel[s]).map(function (h) { return { hotel: h, fails: supHotel[s][h] }; }).sort(function (a, b) { return b.fails - a.fails; }).slice(0, 3);
      var parts = Object.keys(supPartner[s]).map(function (p) { var d = supPartner[s][p]; return { partner: p, failRate: r1(100 * d.fail / d.n), n: d.n }; }).sort(function (a, b) { return b.failRate - a.failRate; }).slice(0, 2);
      var weekly = supWk[s].map(function (w) { return w[0] ? { avail: r1(100 * (1 - w[1] / w[0])), compet: r1(100 * (1 - w[2] / w[0])), rel: r2(100 * (1 - w[3] / w[0])) } : null; });
      return {
        name: s, searches: o.n, availability: r1(av), competitiveness: r1(co), reliability: r2(re),
        health: health(av, co, re), p95: p95(o.lat),
        f1: o.f1, f2: o.f2, f3: o.f3, f4: o.f4, f5: o.f5, f6: o.f6,
        donut: { f1: o.f1, f2: o.f2, f3: o.f3, f4: o.f4 },
        topHotels: hotels, topPartners: parts,
        weeklyHealth: o.wk.map(function (w) { return w[0] ? r1(100 * w[1] / w[0]) : 0; })
      };
    }).filter(Boolean).sort(function (a, b) { return a.health - b.health; });

    // supplier weekly health from supWk (avail/compet/rel)
    suppliers.forEach(function (sup) {
      var w = supWk[sup.name];
      sup.weekly = w.map(function (x) {
        if (!x[0]) return null;
        var av = 100 * (1 - x[1] / x[0]), co = 100 * (1 - x[2] / x[0]), re = 100 * (1 - x[3] / x[0]);
        return { avail: r1(av), compet: r1(co), rel: r2(re), health: health(av, co, re) };
      });
      sup.weeklyHealth = sup.weekly.map(function (x) { return x ? x.health : 0; });
    });

    // ---- helper: cell health ----
    function cellObj(d) {
      var av = 100 * (1 - d.f1 / d.n), co = 100 * (1 - d.f2 / d.n), re = 100 * (1 - d.f3 / d.n);
      var h = health(av, co, re);
      return {
        searches: d.n, availability: r1(av), competitiveness: r1(co), reliability: r2(re),
        health: h, failRate: r1(100 - h), booked: d.booked, shown: d.shown, clicked: d.clicked,
        conv: r2(100 * d.booked / d.n), margin: Math.round(d.margin), revenue: Math.round(d.bval),
        f1: d.f1, f2: d.f2, f3: d.f3, f4: d.f4, f5: d.f5, f6: d.f6
      };
    }

    // ---- partners ----
    var totMarginAll = totMargin || 1;
    var partners = PARTNERS.map(function (p) {
      var o = partA[p]; if (!o.n) return null;
      var conv = 100 * o.booked / Math.max(1, o.shown);
      var pav = 100 * (1 - o.f1 / o.n), pco = 100 * (1 - o.f2 / o.n), pre = 100 * (1 - o.f3 / o.n);
      var earlyVol = o.wk[0][0] + o.wk[1][0];
      var recentVol = o.wk[2][0] + o.wk[3][0];
      var eng = recentVol > earlyVol * 1.05 ? 'up' : recentVol < earlyVol * 0.95 ? 'down' : 'flat';
      var supHealths = SUPPLIERS.map(function (s) {
        var d = cellA[p + '|' + s]; if (!d.n) return null;
        var av = 100 * (1 - d.f1 / d.n), co = 100 * (1 - d.f2 / d.n), re = 100 * (1 - d.f3 / d.n);
        return { supplier: s, health: health(av, co, re), n: d.n };
      }).filter(Boolean).sort(function (a, b) { return b.health - a.health; });
      return {
        name: p, searched: o.n, shown: o.shown, clicked: o.clicked, booked: o.booked, bookFailed: o.bf,
        availability: r1(pav), competitiveness: r1(pco), reliability: r2(pre), health: health(pav, pco, pre),
        revenue: Math.round(o.bval), margin: Math.round(o.margin), marginShare: r1(100 * o.margin / totMarginAll),
        f5: o.f5, f5rate: r1(100 * o.f5 / o.n),
        clickThrough: r1(100 * o.clicked / Math.max(1, o.shown)), showRate: r1(100 * o.shown / o.n),
        conv: r2(conv), engagement: eng,
        avgBookingValue: Math.round(o.bval / Math.max(1, o.booked)),
        weeklySearches: [o.wk[0][0], o.wk[1][0], o.wk[2][0], o.wk[3][0]],
        weeklyConv: o.wk.map(function (w) { return w[0] ? r2(100 * w[1] / w[0]) : 0; }),
        bestSuppliers: supHealths.slice(0, 2), worstSuppliers: supHealths.slice(-2).reverse()
      };
    }).filter(Boolean).sort(function (a, b) { return b.conv - a.conv; });

    // ---- matrix ----
    var matrix = {};
    PARTNERS.forEach(function (p) {
      matrix[p] = {};
      SUPPLIERS.forEach(function (s) {
        var d = cellA[p + '|' + s];
        matrix[p][s] = d.n ? cellObj(d) : null;
      });
    });

    // ---- platform ----
    var f5byPartner = Object.keys(f5byP).map(function (p) { return { partner: p, count: f5byP[p], rate: r1(100 * f5byP[p] / partA[p].n) }; }).sort(function (a, b) { return b.count - a.count; });
    var f6bySupplier = Object.keys(f6byS).map(function (s) { return { supplier: s, count: f6byS[s], rate: r2(100 * f6byS[s] / supA[s].n) }; }).sort(function (a, b) { return b.count - a.count; });
    var f5affected = Object.keys(f5combo).map(function (k) { var x = k.split('|'); return { partner: x[0], hotel: x[1], count: f5combo[k] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 25);
    var f6affected = Object.keys(f6combo).map(function (k) { var x = k.split('|'); return { partner: x[0], supplier: x[1], count: f6combo[k] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 25);

    // ---- summary ----
    var overallConv = totBooked / Math.max(1, totN);
    var avgBval = totBooked ? totBval / totBooked : 0;
    var f5notBooked = 0;
    for (var j = 0; j < events.length; j++) {
      var ev2 = events[j];
      if (pFilter && !pFilter.has(PARTNERS[ev2[P]])) continue;
      if (sFilter && !sFilter.has(SUPPLIERS[ev2[S]])) continue;
      if (ev2[DY] < dFrom || ev2[DY] > dTo) continue;
      if ((ev2[MK] & F5) && ev2[O] !== 3) f5notBooked++;
    }
    var worstSup = suppliers[0] || { name: '—', health: 100 };
    var worstPartner = partners[partners.length - 1] || { name: '—', conv: 0 };
    var summary = {
      totalSearches: totN,
      bookingConv: r2(100 * overallConv), bookingBenchmark: 2.50,
      revenueAtRisk: Math.round(f5notBooked * overallConv * avgBval),
      revenueAtRiskAssumption: 'F5 searches that didn\'t book, recovered at platform baseline conversion (' + r2(100 * overallConv) + '%) × avg booking value ($' + Math.round(avgBval) + ')',
      topFailingSupplier: { name: worstSup.name, failRate: r1(100 - worstSup.health), health: worstSup.health },
      topFailingPartner: { name: worstPartner.name, conv: worstPartner.conv },
      deadSearchRate: r2(100 * totF6 / Math.max(1, totN)),
      f5rate: r1(100 * totF5 / Math.max(1, totN)),
      gmv: Math.round(totBval), margin: Math.round(totMargin), bookings: totBooked
    };

    return {
      summary: summary, suppliers: suppliers, partners: partners, matrix: matrix,
      platform: {
        f5rate: r1(100 * totF5 / Math.max(1, totN)), f5count: totF5, f5byPartner: f5byPartner,
        f6rate: r2(100 * totF6 / Math.max(1, totN)), f6count: totF6, f6bySupplier: f6bySupplier,
        f5affected: f5affected, f6affected: f6affected
      }
    };
  };

  // ---- shared formatting + RAG helpers (used across components) ----
  window.NF = {
    int: function (n) { return (n | 0).toLocaleString('en-US'); },
    pct: function (n, d) { return (n == null ? '—' : Number(n).toFixed(d == null ? 1 : d) + '%'); },
    money: function (n) {
      if (n == null) return '—';
      if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
      if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
      return '$' + Math.round(n).toLocaleString('en-US');
    },
    money0: function (n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  };

  // RAG by failure rate, thresholds [green<g, amber g..a, red>a]
  window.ragOf = function (failRate, g, a) {
    if (failRate < g) return 'green';
    if (failRate <= a) return 'amber';
    return 'red';
  };
})();
