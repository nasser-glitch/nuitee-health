/* Nuitee Health Dashboard — live aggregation engine.
   Operates on packed events: [partnerIdx, supplierIdx, hotel, shown, outcome, bval, margin, lat, mask, day]
   outcome: 0 searched, 1 shown, 2 clicked, 3 booked, 4 book_failed
   mask bits: F1=1 F2=2 F3=4 F4=8 F5=16 F6=32
     F1 No rate returned      F2 Uncompetitive rate    F3 Booking failed
     F4 High latency          F5 Competitive not shown  F6 Dead search
   Health = equally weighted average of availability, competitiveness, reliability (all as % success). */
(function () {
  var P = 0, S = 1, H = 2, SH = 3, O = 4, BV = 5, MG = 6, LT = 7, MK = 8, DY = 9, SI = 10;
  var F1 = 1, F2 = 2, F3 = 4, F4 = 8, F5 = 16, F6 = 32;
  var W = [1/4, 1/4, 1/4, 1/4];

  function wk(day) { var w = Math.floor((day - 1) / 7); return w > 3 ? 3 : w; }
  function p95(arr) { if (!arr.length) return 0; arr.sort(function (a, b) { return a - b; }); return arr[Math.floor(0.95 * arr.length)] || arr[arr.length - 1]; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function health(av, co, re, la) { return r1(W[0] * av + W[1] * co + W[2] * re + W[3] * (la == null ? 100 : la)); }

  // opts: { partners:Set(name), suppliers:Set(name), dayFrom, dayTo }
  window.aggregate = function (events, opts) {
    var PARTNERS = window.NUITEE_PARTNERS, SUPPLIERS = window.NUITEE_SUPPLIERS;
    opts = opts || {};
    var pFilter = opts.partners && opts.partners.size ? opts.partners : null;
    var sFilter = opts.suppliers && opts.suppliers.size ? opts.suppliers : null;
    var dFrom = opts.dayFrom || 1, dTo = opts.dayTo || 31;

    function blank() { return { n: 0, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, relfail: 0, latfail: 0, shown: 0, clicked: 0, booked: 0, bf: 0, bval: 0, margin: 0, lat: [], wk: [[0, 0], [0, 0], [0, 0], [0, 0]], sids: new Set() }; }

    var supA = {}, partA = {}, supHotel = {}, supPartner = {}, supWk = {}, supHotelA = {}, supWkBooked = {};
    var cellA = {}; // p|s
    SUPPLIERS.forEach(function (s) { supA[s] = blank(); supHotel[s] = {}; supPartner[s] = {}; supWk[s] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; supHotelA[s] = {}; supWkBooked[s] = [0, 0, 0, 0]; });
    PARTNERS.forEach(function (p) { partA[p] = blank(); });
    PARTNERS.forEach(function (p) { SUPPLIERS.forEach(function (s) { cellA[p + '|' + s] = blank(); }); });

    var totF5 = 0, totF6 = 0, totN = 0, totBval = 0, totMargin = 0, totBooked = 0; var totSearchIds = new Set();
    var f5byP = {}, f6byS = {}, f6byP = {}, f5combo = {}, f6combo = {};

    function bump(o, e) {
      o.n++; o.sids.add(e[SI]); var m = e[MK];
      if (m & F1) o.f1++; if (m & F2) o.f2++; if (m & F3) o.f3++; if (m & F4) o.f4++; if (m & F5) o.f5++; if (m & F6) o.f6++;
      if (m & F3) o.relfail++; if (m & F4) o.latfail++;
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
      var sw = wk(d); supWk[sn][sw][0]++; if (m & F1) supWk[sn][sw][1]++; if (m & F2) supWk[sn][sw][2]++; if (m & F3) supWk[sn][sw][3]++; if (e[O] === 3) supWkBooked[sn][sw]++;
      var hk = e[H]; if (!supHotelA[sn][hk]) supHotelA[sn][hk] = blank(); bump(supHotelA[sn][hk], e);
      totN++; totSearchIds.add(e[SI]); totBval += e[BV]; totMargin += e[MG];
      if (e[O] === 3) totBooked++;
      if (m & F5) { totF5++; f5byP[pn] = (f5byP[pn] || 0) + 1; var k5 = pn + '|' + e[H]; f5combo[k5] = (f5combo[k5] || 0) + 1; }
      if (m & F6) { totF6++; f6byS[sn] = (f6byS[sn] || 0) + 1; f6byP[pn] = (f6byP[pn] || 0) + 1; var k6 = pn + '|' + sn; f6combo[k6] = (f6combo[k6] || 0) + 1; }
      if (fail) { supHotel[sn][e[H]] = (supHotel[sn][e[H]] || 0) + 1; }
      var sp = supPartner[sn][pn] || (supPartner[sn][pn] = { n: 0, fail: 0 });
      sp.n++; if (fail) sp.fail++;
    }

    // ---- suppliers ----
    var suppliers = SUPPLIERS.map(function (s) {
      var o = supA[s]; if (!o.n) return null;
      var av = 100 * (1 - o.f1 / o.n), co = 100 * (1 - o.f2 / o.n), re = 100 * (1 - o.relfail / o.n), la = 100 * (1 - o.latfail / o.n);
      var hotels = Object.keys(supHotel[s]).map(function (h) { return { hotel: h, fails: supHotel[s][h] }; }).sort(function (a, b) { return b.fails - a.fails; }).slice(0, 3);
      var parts = Object.keys(supPartner[s]).map(function (p) { var d = supPartner[s][p]; return { partner: p, failRate: r1(100 * d.fail / d.n), n: d.n }; }).sort(function (a, b) { return b.failRate - a.failRate; }).slice(0, 2);
      var weekly = supWk[s].map(function (w) { return w[0] ? { avail: r1(100 * (1 - w[1] / w[0])), compet: r1(100 * (1 - w[2] / w[0])), rel: r2(100 * (1 - w[3] / w[0])) } : null; });
      return {
        name: s, searches: o.sids.size, booked: o.booked, availability: r1(av), competitiveness: r1(co), reliability: r2(re), latency: r1(la),
        health: health(av, co, re, la), p95: p95(o.lat),
        f1: o.f1, f2: o.f2, f3: o.f3, f4: o.f4, f5: o.f5, f6: o.f6,
        donut: { f1: o.f1, f2: o.f2, f3: o.f3, f4: o.f4 },
        topHotels: hotels, topPartners: parts,
        weeklySearches: supWk[s].map(function(w) { return w[0]; }),
        weeklyBookings: supWkBooked[s],
        weeklyHealth: o.wk.map(function (w) { return w[0] ? r1(100 * w[1] / w[0]) : 0; })
      };
    }).filter(Boolean).sort(function (a, b) { return a.health - b.health; });

    // supplier weekly health from supWk (avail/compet/rel)
    suppliers.forEach(function (sup) {
      var w = supWk[sup.name];
      sup.weekly = w.map(function (x) {
        if (!x[0]) return null;
        var av = 100 * (1 - x[1] / x[0]), co = 100 * (1 - x[2] / x[0]), re = 100 * (1 - x[3] / x[0]);
        return { avail: r1(av), compet: r1(co), rel: r2(re), health: health(av, co, re, 100) };
      });
      sup.weeklyHealth = sup.weekly.map(function (x) { return x ? x.health : 0; });
    });

    // ---- helper: cell health ----
    function cellObj(d) {
      var av = 100 * (1 - d.f1 / d.n), co = 100 * (1 - d.f2 / d.n), re = 100 * (1 - d.relfail / d.n), la = 100 * (1 - d.latfail / d.n);
      var h = health(av, co, re, la);
      return {
        searches: d.sids.size, availability: r1(av), competitiveness: r1(co), reliability: r2(re), latency: r1(la),
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
      var pav = 100 * (1 - o.f1 / o.n), pco = 100 * (1 - o.f2 / o.n), pre = 100 * (1 - o.relfail / o.n), pla = 100 * (1 - o.latfail / o.n);
      var earlyVol = o.wk[0][0] + o.wk[1][0];
      var recentVol = o.wk[2][0] + o.wk[3][0];
      var eng = recentVol > earlyVol * 1.05 ? 'up' : recentVol < earlyVol * 0.95 ? 'down' : 'flat';
      var supHealths = SUPPLIERS.map(function (s) {
        var d = cellA[p + '|' + s]; if (!d.n) return null;
        var av = 100 * (1 - d.f1 / d.n), co = 100 * (1 - d.f2 / d.n), re = 100 * (1 - d.relfail / d.n), la = 100 * (1 - d.latfail / d.n);
        return { supplier: s, health: health(av, co, re, la), n: d.n };
      }).filter(Boolean).sort(function (a, b) { return b.health - a.health; });
      return {
        name: p, searched: o.sids.size, shown: o.shown, clicked: o.clicked, booked: o.booked, bookFailed: o.bf,
        availability: r1(pav), competitiveness: r1(pco), reliability: r2(pre), latency: r1(pla), health: health(pav, pco, pre, pla),
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

    // ---- hotel matrix (supplier × hotel, top 15 hotels by volume) ----
    var hotelTotals = {};
    SUPPLIERS.forEach(function (s) {
      Object.keys(supHotelA[s]).forEach(function (h) { hotelTotals[h] = (hotelTotals[h] || 0) + supHotelA[s][h].n; });
    });
    var topHotels = Object.keys(hotelTotals).sort(function (a, b) { return hotelTotals[b] - hotelTotals[a]; }).slice(0, 15);
    var hotelMatrix = {};
    SUPPLIERS.forEach(function (s) {
      hotelMatrix[s] = {};
      topHotels.forEach(function (h) { var d = supHotelA[s][h]; hotelMatrix[s][h] = d && d.n ? cellObj(d) : null; });
    });

    // ---- platform ----
    var f5byPartner = Object.keys(f5byP).map(function (p) { return { partner: p, count: f5byP[p], rate: r1(100 * f5byP[p] / partA[p].n) }; }).sort(function (a, b) { return b.count - a.count; });
    var f6bySupplier = Object.keys(f6byS).map(function (s) { return { supplier: s, count: f6byS[s], rate: r2(100 * f6byS[s] / supA[s].n) }; }).sort(function (a, b) { return b.count - a.count; });
    var f6byPartner = Object.keys(f6byP).map(function (p) { return { partner: p, count: f6byP[p], rate: r2(100 * f6byP[p] / partA[p].n) }; }).sort(function (a, b) { return b.count - a.count; });
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
    var worstPartner = partners.length ? partners.reduce(function(a, b) { return b.revenue < a.revenue ? b : a; }) : { name: '—', conv: 0, revenue: 0 };
    var summary = {
      totalSearches: totSearchIds.size,
      bookingConv: r2(100 * overallConv), bookingBenchmark: 2.50,
      revenueAtRisk: Math.round(f5notBooked * overallConv * avgBval),
      revenueAtRiskAssumption: 'F5 searches that didn\'t book, recovered at platform baseline conversion (' + r2(100 * overallConv) + '%) × avg booking value ($' + Math.round(avgBval) + ')',
      topFailingSupplier: { name: worstSup.name, failRate: r1(100 - worstSup.health), health: worstSup.health },
      topFailingPartner: { name: worstPartner.name, conv: worstPartner.conv, revenue: worstPartner.revenue },
      deadSearchRate: r2(100 * totF6 / Math.max(1, totN)),
      f5rate: r1(100 * totF5 / Math.max(1, totN)),
      f5notBooked: f5notBooked, avgBookingValue: Math.round(avgBval),
      gmv: Math.round(totBval), margin: Math.round(totMargin), bookings: totBooked
    };

    // ---- benchmarks ----
    function median(arr) {
      if (!arr.length) return 0;
      var s = arr.slice().sort(function(a,b){return a-b;}); var m = Math.floor(s.length/2);
      return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
    }
    var benchmarks = {
      availability:       median(suppliers.map(function(s){return s.availability;})),
      competitiveness:    median(suppliers.map(function(s){return s.competitiveness;})),
      reliability:        median(suppliers.map(function(s){return s.reliability;})),
      latency:            median(suppliers.map(function(s){return s.latency;})),
      health:             median(suppliers.map(function(s){return s.health;})),
      f1rate:             median(suppliers.map(function(s){return 100*s.f1/Math.max(1,s.searches);})),
      f2rate:             median(suppliers.map(function(s){return 100*s.f2/Math.max(1,s.searches);})),
      f3rate:             median(suppliers.map(function(s){return 100*s.f3/Math.max(1,s.searches);})),
      f4rate:             median(suppliers.map(function(s){return 100*s.f4/Math.max(1,s.searches);})),
      partnerConv:        median(partners.map(function(p){return p.conv;})),
      medianSupSearches:  median(suppliers.map(function(s){return s.searches;})),
      medianSupBookings:  median(suppliers.map(function(s){return s.booked;})),
      medianSupBookRate:  median(suppliers.map(function(s){return 100*s.booked/Math.max(1,s.searches);})),
      medianPartSearches: median(partners.map(function(p){return p.searched;})),
      medianPartBookings: median(partners.map(function(p){return p.booked;})),
    };

    var data = {
      summary: summary, suppliers: suppliers, partners: partners, matrix: matrix, hotelMatrix: hotelMatrix, topHotels: topHotels,
      benchmarks: benchmarks,
      platform: {
        f5rate: r1(100 * totF5 / Math.max(1, totN)), f5count: totF5, f5byPartner: f5byPartner,
        f6rate: r2(100 * totF6 / Math.max(1, totN)), f6count: totF6, f6bySupplier: f6bySupplier, f6byPartner: f6byPartner,
        f5affected: f5affected, f6affected: f6affected
      }
    };
    generateInsights(data);
    return data;
  };

  // ---- insight helpers ----
  function getDominantFailure(f1r, f2r, f3r) {
    if (f1r >= f2r && f1r >= f3r) return { key: 'f1', label: 'F1 (no rate returned)', rate: f1r, explanation: 'No rate is returned for a high share of searches — no rate, no booking.' };
    if (f2r >= f1r && f2r >= f3r) return { key: 'f2', label: 'F2 (uncompetitive rate)', rate: f2r, explanation: 'Rates are returned but above market price — users choose competitors.' };
    return { key: 'f3', label: 'F3 (booking failures)', rate: f3r, explanation: 'Booking attempts are failing — confirmed user intent being lost at checkout.' };
  }
  function getFunnelBottleneck(showRate, clickRate, bookRate) {
    if (showRate < 60) return 'Only ' + showRate.toFixed(0) + '% of searches are shown a rate — availability gap is the primary blocker.';
    if (clickRate < 30) return showRate.toFixed(0) + '% shown but only ' + clickRate.toFixed(0) + '% click — rates are not competitive enough.';
    if (bookRate < 20) return showRate.toFixed(0) + '% shown, ' + clickRate.toFixed(0) + '% click, but only ' + bookRate.toFixed(0) + '% complete — booking failures or drop-off at checkout.';
    return 'Funnel appears healthy — investigate supplier-level failure codes for specific drops.';
  }
  function dedupeInsights(ins) {
    var seen = {};
    return ins.filter(function(x) { if (seen[x.headline]) return false; seen[x.headline] = true; return true; });
  }

  function generateInsights(data) {
    var bench = data.benchmarks;
    var NF2 = { int: function(n) { return (n|0).toLocaleString('en-US'); } };

    // --- Suppliers ---
    data.suppliers.forEach(function(sup) {
      var ins = [];
      var searches = Math.max(1, sup.searches);
      var f1r = 100 * sup.f1 / searches, f2r = 100 * sup.f2 / searches;
      var f3r = 100 * sup.f3 / searches, f4r = 100 * sup.f4 / searches, f6r = 100 * sup.f6 / searches;
      var bookRate = 100 * sup.booked / searches;
      var ws = sup.weeklySearches || [0,0,0,0], wb = sup.weeklyBookings || [0,0,0,0];
      var earlyVol = ws[0]+ws[1], recentVol = ws[2]+ws[3];
      var volDelta = earlyVol > 0 ? (recentVol - earlyVol) / earlyVol : 0;
      var earlyBook = wb[0]+wb[1], recentBook = wb[2]+wb[3];
      var bookDelta = earlyBook > 0 ? (recentBook - earlyBook) / earlyBook : 0;

      // WHY ARE SEARCHES LOW / DECLINING
      if (bench.medianSupSearches > 0 && sup.searches < bench.medianSupSearches * 0.3) {
        var pct = Math.round(100 * sup.searches / bench.medianSupSearches);
        ins.push({ priority: 3, category: 'Volume', headline: 'Search volume is low vs platform peers (' + pct + '% of median)', body: 'Only ' + NF2.int(sup.searches) + ' searches routed here vs a platform median of ' + NF2.int(Math.round(bench.medianSupSearches)) + '. Low routing may reflect poor historical health — improving quality metrics should increase share.' });
      }
      if (volDelta < -0.20 && f1r > bench.f1rate * 1.5) {
        ins.push({ priority: 2, category: 'Volume', headline: 'Search volume down ' + Math.round(Math.abs(volDelta)*100) + '% — no-rate rate may be reducing routing', body: 'Availability is ' + f1r.toFixed(0) + '% (platform avg ' + bench.f1rate.toFixed(0) + '%) — partners receiving fewer results may be routing fewer searches here.' });
      } else if (volDelta < -0.20 && f6r > 20) {
        ins.push({ priority: 2, category: 'Volume', headline: 'Search volume down ' + Math.round(Math.abs(volDelta)*100) + '% — dead searches may be driving disengagement', body: 'Dead search rate is ' + f6r.toFixed(0) + '% — most searches return nothing usable from any supplier. Platform may be reducing routing weight.' });
      }
      if (volDelta > 0.20) {
        ins.push({ priority: 4, category: 'Volume', headline: 'Search volume up ' + Math.round(volDelta*100) + '% over the period', body: 'Increased routing to this supplier. Monitor quality metrics to ensure health holds under higher load.' });
      }

      // WHY ARE BOOKINGS LOW / DECLINING — trend takes priority; among absolute checks emit only one
      var bookingDomKey = null;
      if (bookDelta < -0.25 && (earlyBook + recentBook) > 0) {
        var pctDown = Math.round(Math.abs(bookDelta)*100);
        var dom = getDominantFailure(f1r, f2r, f3r);
        bookingDomKey = dom.key;
        if (dom.key === 'f1') ins.push({ priority: 1, category: 'Availability', headline: 'Bookings down ' + pctDown + '% — no-rate failures (' + f1r.toFixed(0) + '%) are the primary blocker', body: 'If the supplier can\'t return a rate, there\'s nothing to book. ' + f1r.toFixed(0) + '% of searches return empty vs platform avg ' + bench.f1rate.toFixed(0) + '%.' });
        else if (dom.key === 'f2') ins.push({ priority: 2, category: 'Competitiveness', headline: 'Bookings down ' + pctDown + '% — rates losing to competitors on ' + f2r.toFixed(0) + '% of searches', body: 'Rates are returned but uncompetitive on ' + f2r.toFixed(0) + '% of searches vs platform average of ' + bench.f2rate.toFixed(0) + '%.' });
        else ins.push({ priority: 1, category: 'Reliability', headline: 'Bookings down ' + pctDown + '% — ' + f3r.toFixed(2) + '% of booking attempts are failing', body: 'Booking failures are directly losing confirmed revenue. Check inventory lock and rate-recheck behaviour.' });
      } else if (bench.medianSupBookings > 0 && sup.booked < bench.medianSupBookings * 0.3) {
        var dom = getDominantFailure(f1r, f2r, f3r);
        bookingDomKey = dom.key;
        ins.push({ priority: 2, category: 'Conversion', headline: 'Bookings low vs platform peers — ' + sup.booked + ' vs median ' + Math.round(bench.medianSupBookings), body: 'Primary cause: ' + dom.label + ' (' + dom.rate.toFixed(0) + '% of searches). ' + dom.explanation });
      } else if (bench.medianSupBookRate > 0 && bookRate < bench.medianSupBookRate * 0.5) {
        var mult = (bench.medianSupBookRate / Math.max(0.01, bookRate)).toFixed(1);
        var dom = getDominantFailure(f1r, f2r, f3r);
        bookingDomKey = dom.key;
        ins.push({ priority: 2, category: 'Conversion', headline: 'Booking rate ' + bookRate.toFixed(1) + '% — ' + mult + '× below platform median (' + bench.medianSupBookRate.toFixed(1) + '%)', body: 'Primary cause: ' + dom.label + '. ' + dom.explanation });
      }

      // WHY IS LATENCY HIGH
      if (f4r > bench.f4rate * 2 && f1r > bench.f1rate) {
        ins.push({ priority: 2, category: 'Latency', headline: 'Timeout signature — high latency (' + f4r.toFixed(0) + '%) and missing rates (' + f1r.toFixed(0) + '%) co-occurring', body: 'Rates may exist but time out before returning — a cache miss or slow property API, not genuinely missing inventory. P95 is ' + NF2.int(sup.p95) + 'ms.' });
      } else if (f4r > bench.f4rate * 2) {
        ins.push({ priority: 3, category: 'Latency', headline: 'Latency ' + (bench.f4rate > 0 ? (f4r/bench.f4rate).toFixed(1) : '—') + '× platform average — ' + f4r.toFixed(0) + '% exceed 1,500ms', body: 'P95 response time is ' + NF2.int(sup.p95) + 'ms. Investigate caching coverage or pipeline bottlenecks for the top failing hotels.' });
      }

      // WHY ARE BOOKINGS FAILING (F3)
      if (f3r > 0.5 && f2r > bench.f2rate * 1.5 && f4r > bench.f4rate * 1.5) {
        ins.push({ priority: 1, category: 'Reliability', headline: 'Booking failures (' + f3r.toFixed(2) + '%) with stale-rate and latency signals', body: 'Uncompetitive rates (' + f2r.toFixed(0) + '% F2) and high latency (' + f4r.toFixed(0) + '% F4) alongside failures suggest rates are stale and inventory gone by booking time.' });
      } else if (f3r > 0.5 && f2r > bench.f2rate * 1.5) {
        ins.push({ priority: 1, category: 'Reliability', headline: 'Stale-rate signature — uncompetitive rates (' + f2r.toFixed(0) + '%) and booking failures (' + f3r.toFixed(2) + '%) co-occurring', body: 'Rates are being selected despite being uncompetitive, then failing at booking — a sign of stale or misconfigured rate feeds.' });
      } else if (f3r > 0.5 && f4r > bench.f4rate * 1.5) {
        ins.push({ priority: 1, category: 'Reliability', headline: 'Latency-induced booking failures — ' + f3r.toFixed(2) + '% fail rate with high latency', body: 'High latency (' + f4r.toFixed(0) + '% F4, P95 ' + NF2.int(sup.p95) + 'ms) combined with booking failures suggests inventory may be gone by booking time.' });
      } else if (f3r > 0.5) {
        ins.push({ priority: 1, category: 'Reliability', headline: 'Booking failure rate is ' + f3r.toFixed(2) + '% — ' + sup.f3 + ' failed bookings', body: 'Each failure is a confirmed booking lost. Check inventory lock, rate recheck, and live availability.' });
      }

      // WHY ARE RATES NOT COMPETITIVE (F2) — skip if already the dominant cause in the booking insight
      if (bookingDomKey !== 'f2') {
        if (f2r > bench.f2rate * 2) {
          ins.push({ priority: 2, category: 'Competitiveness', headline: 'Uncompetitive on ' + f2r.toFixed(0) + '% of searches — ' + (bench.f2rate > 0 ? (f2r/bench.f2rate).toFixed(1) : '—') + '× the platform average', body: 'Rates exist but are systematically above market. Contracted rate levels or markup configuration is the likely cause.' });
        } else if (f2r > bench.f2rate * 1.5) {
          ins.push({ priority: 3, category: 'Competitiveness', headline: 'Competitiveness below platform median — ' + f2r.toFixed(0) + '% uncompetitive vs avg ' + bench.f2rate.toFixed(0) + '%', body: 'Room to improve — reducing the uncompetitive rate by half would materially lift booking volume.' });
        }
      }

      // WHY ARE RATES NOT SHOWING (F1) — skip if already the dominant cause in the booking insight
      if (bookingDomKey !== 'f1') {
        if (f1r > bench.f1rate * 2) {
          var hotelStr = sup.topHotels.length > 0 ? ' Top affected: hotel #' + sup.topHotels[0].hotel + (sup.topHotels[1] ? ', #' + sup.topHotels[1].hotel : '') + '.' : '';
          ins.push({ priority: 1, category: 'Availability', headline: 'No-rate rate ' + f1r.toFixed(0) + '% — ' + (bench.f1rate > 0 ? (f1r/bench.f1rate).toFixed(1) : '—') + '× the platform average (' + bench.f1rate.toFixed(0) + '%)', body: hotelStr + ' Indicates missing inventory mapping or thin coverage for the property types being searched.' });
        } else if (f1r > bench.f1rate * 1.5) {
          var hotelStr = sup.topHotels.length > 0 ? 'Most failures at hotel #' + sup.topHotels[0].hotel + ' (' + sup.topHotels[0].fails + ' fails). ' : '';
          ins.push({ priority: 2, category: 'Availability', headline: 'Availability below platform median — ' + f1r.toFixed(0) + '% of searches return nothing', body: hotelStr + 'Review inventory coverage for these properties.' });
        }
      }

      sup.insights = dedupeInsights(ins).sort(function(a,b){ return a.priority - b.priority; });
    });

    // --- Partners ---
    data.partners.forEach(function(p) {
      var ins = [];
      var searched = Math.max(1, p.searched);
      var showRate  = 100 * p.shown    / searched;
      var clickRate = 100 * p.clicked  / Math.max(1, p.shown);
      var bookRate  = 100 * p.booked   / Math.max(1, p.clicked);
      var ws = p.weeklySearches || [0,0,0,0];
      var earlyVol = ws[0]+ws[1], recentVol = ws[2]+ws[3];
      var volDelta = earlyVol > 0 ? (recentVol - earlyVol) / earlyVol : 0;
      var f6entry = data.platform.f6byPartner.filter(function(x){ return x.partner === p.name; })[0];
      var f6rate = f6entry ? f6entry.rate : 0;
      var worstSup = p.worstSuppliers && p.worstSuppliers[0] ? p.worstSuppliers[0].supplier + ' (' + Math.round(p.worstSuppliers[0].health) + ' health)' : null;

      // WHY ARE SEARCHES LOW / DECLINING
      if (bench.medianPartSearches > 0 && p.searched < bench.medianPartSearches * 0.3) {
        var pct = Math.round(100 * p.searched / bench.medianPartSearches);
        ins.push({ priority: 3, category: 'Volume', headline: 'Search volume is low vs other partners (' + pct + '% of median)', body: 'Only ' + NF2.int(p.searched) + ' searches vs a median of ' + NF2.int(Math.round(bench.medianPartSearches)) + '. May indicate limited integration depth or narrow use case — worth reviewing with the partner.' });
      }
      if (volDelta < -0.20 && f6rate > 15) {
        ins.push({ priority: 2, category: 'Volume', headline: 'Search volume down ' + Math.round(Math.abs(volDelta)*100) + '% — dead searches may be causing disengagement', body: f6rate.toFixed(0) + '% of searches returned no result from any supplier (F6). Partners typically reduce volume after sustained dead search exposure.' });
      } else if (volDelta < -0.20) {
        ins.push({ priority: 3, category: 'Volume', headline: 'Search volume fell ' + Math.round(Math.abs(volDelta)*100) + '% in the second half of the period', body: 'Engagement trend is down.' + (worstSup ? ' Worst-served supplier: ' + worstSup + ' — may be causing reduced platform confidence.' : '') });
      } else if (volDelta > 0.20) {
        ins.push({ priority: 4, category: 'Volume', headline: 'Search volume up ' + Math.round(volDelta*100) + '% — engagement growing', body: 'Rising volume from this partner. Ensure supplier coverage is sufficient to handle the increase.' });
      }

      // WHY ARE BOOKINGS LOW / DECLINING — emit only one absolute check
      if (bench.medianPartBookings > 0 && p.booked < bench.medianPartBookings * 0.3) {
        var bottleneck = getFunnelBottleneck(showRate, clickRate, bookRate);
        ins.push({ priority: 2, category: 'Conversion', headline: 'Bookings low vs platform peers — ' + p.booked + ' vs median ' + Math.round(bench.medianPartBookings), body: 'Funnel bottleneck: ' + bottleneck });
      } else if (bench.partnerConv > 0 && p.conv < bench.partnerConv * 0.5) {
        var bottleneck = getFunnelBottleneck(showRate, clickRate, bookRate);
        ins.push({ priority: 2, category: 'Conversion', headline: 'Booking conversion ' + p.conv.toFixed(1) + '% — below platform median (' + bench.partnerConv.toFixed(1) + '%)', body: 'Even with normal search volume, fewer than expected searches end in bookings. ' + bottleneck });
      }

      // Funnel drop-off
      var emittedBookFailed = false;
      if (showRate < 60) {
        ins.push({ priority: 1, category: 'Availability', headline: 'Only ' + showRate.toFixed(0) + '% of searches result in a rate being shown', body: 'Most searches result in nothing shown to the user. Primary cause: F1 (no rate returned) or F6 (dead search) — supplier-side coverage gap is blocking demand.' });
      } else if (clickRate < 30) {
        ins.push({ priority: 2, category: 'Competitiveness', headline: 'Rates shown but only ' + clickRate.toFixed(0) + '% are clicked', body: 'Users are seeing rates but not engaging. Rates may not be price-competitive for this partner\'s market — check F2 rates from the worst-served supplier.' });
      } else if (bookRate < 20 && p.bookFailed > 5) {
        emittedBookFailed = true;
        ins.push({ priority: 1, category: 'Reliability', headline: NF2.int(p.bookFailed) + ' booking attempts failed — users clicked but couldn\'t complete', body: 'Checkout failures destroy conversion. Likely cause: inventory lock or rate expiry between click and booking.' });
      }

      // Latency
      if (p.latency < bench.latency - 10) {
        ins.push({ priority: 3, category: 'Latency', headline: 'Latency health ' + p.latency.toFixed(0) + '% — ' + (bench.latency - p.latency).toFixed(0) + ' pts below platform average', body: 'Slow responses increase abandonment before users see prices.' + (worstSup ? ' Worst supplier: ' + worstSup + '.' : '') });
      }

      // Booking failures — only if not already surfaced in funnel block
      if (p.bookFailed > 10 && !emittedBookFailed) {
        ins.push({ priority: 1, category: 'Reliability', headline: NF2.int(p.bookFailed) + ' booking attempts failed this period', body: 'Each failure is a confirmed user intent lost.' + (worstSup ? ' Worst supplier: ' + worstSup + '.' : '') });
      }

      // Competitiveness
      if (p.competitiveness < bench.competitiveness - 10) {
        ins.push({ priority: 2, category: 'Competitiveness', headline: 'Competitiveness ' + p.competitiveness.toFixed(0) + '% — ' + (bench.competitiveness - p.competitiveness).toFixed(0) + ' pts below platform average', body: 'A significant share of rates shown to this partner\'s users have cheaper alternatives.' + (worstSup ? ' Primary drag: ' + worstSup + '.' : '') });
      }

      // Recoverable demand (F5)
      if (p.f5rate > 20) {
        ins.push({ priority: 2, category: 'Conversion', headline: p.f5rate.toFixed(0) + '% of searches had a competitive rate that was never surfaced (F5)', body: 'The supplier had a market-beating rate but it wasn\'t shown. This is a Nuitee-side routing or pricing logic gap — the demand is there and recoverable.' });
      }

      p.insights = dedupeInsights(ins).sort(function(a,b){ return a.priority - b.priority; });
    });
  }

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

  // Health score RAG: fixed thresholds on 0–100 scale
  window.healthRag = function (h) {
    return h >= 90 ? 'green' : h >= 80 ? 'amber' : 'red';
  };
})();
