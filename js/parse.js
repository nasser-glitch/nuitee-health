/* CSV parser — reads raw input columns and computes all failure flags from scratch.
   Sets window.NUITEE_PARTNERS, NUITEE_SUPPLIERS, NUITEE_EVENTS, NUITEE_DATE_LABEL.

   Packed event format: [partnerIdx, supplierIdx, hotel, shown, outcome, bval, margin, lat, mask, day]
   outcome: 0=searched 1=shown 2=clicked 3=booked 4=book_failed
   mask bits — F1=1 F2=2 F3=4 F4=8 F5=16 F6=32
     F1 No rate returned          rate_returned blank
     F2 Uncompetitive rate        rate exists AND rate > comp * 1.05
     F3 Booking failed            outcome = 'book_failed'
     F4 High latency              latency_ms > 1500
     F5 Competitive not shown     rate exists AND rate <= comp * 1.05 AND shown = false
     F6 Dead search               all supplier rows for search_id have shown = false
*/
(function () {
  var OUTCOME = { searched: 0, shown: 1, clicked: 2, booked: 3, book_failed: 4 };
  var MONTHS = { '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
                 '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' };

  window.parseNuiteeCSV = function (text) {
    var lines = text.split('\n');
    var rawHeader = lines[0].split(',');
    var header = rawHeader.map(function (h) { return h.trim().toLowerCase().replace(/\s+/g, '_'); });

    function idx(name) { return header.indexOf(name); }

    var C = {
      searchId:  idx('search_id'),
      timestamp: idx('timestamp'),
      partner:   idx('demand_partner'),
      supplier:  idx('supplier'),
      hotel:     idx('hotel_id'),
      rate:      idx('rate_returned'),
      comp:      idx('competitor_best_rate'),
      shown:     idx('shown_to_partner'),
      outcome:   idx('outcome'),
      bval:      idx('booking_value'),
      margin:    idx('margin'),
      lat:       idx('latency_ms')
    };

    var missing = Object.keys(C).filter(function (k) { return C[k] === -1; });
    if (missing.length) throw new Error('CSV missing columns: ' + missing.join(', '));

    /* ---- parse rows ---- */
    var rows = [];
    var minDate = null, maxDate = null;
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var f = line.split(',');

      var rateRaw = f[C.rate].trim();
      var hasRate = rateRaw !== '';
      var compRaw = f[C.comp].trim();
      var hasComp = compRaw !== '';
      var ts = f[C.timestamp].trim();
      // timestamp: "2026-04-30 23:01:15"
      var dayNum = ts ? parseInt(ts.split('-')[2]) || 1 : 1;
      var dateKey = ts ? ts.slice(0, 10) : null; // "2026-04-30"
      if (dateKey) {
        if (!minDate || dateKey < minDate) minDate = dateKey;
        if (!maxDate || dateKey > maxDate) maxDate = dateKey;
      }

      rows.push({
        searchId: f[C.searchId].trim(),
        partner:  f[C.partner].trim(),
        supplier: f[C.supplier].trim(),
        hotel:    parseInt(f[C.hotel]) || 0,
        hasRate:  hasRate,
        rate:     hasRate ? parseFloat(rateRaw) : 0,
        comp:     hasComp ? parseFloat(compRaw) : 0,
        shown:    f[C.shown].trim().toLowerCase() === 'true' ? 1 : 0,
        outcome:  OUTCOME[f[C.outcome].trim()] !== undefined ? OUTCOME[f[C.outcome].trim()] : 0,
        bval:     parseFloat(f[C.bval]) || 0,
        margin:   parseFloat(f[C.margin]) || 0,
        lat:      parseInt(f[C.lat]) || 0,
        day:      dayNum
      });
    }

    /* ---- F6 pre-pass + unique search index ---- */
    var searchHasShown = {};
    var searchIdxMap = {};
    var searchIdxCounter = 0;
    for (var j = 0; j < rows.length; j++) {
      var sid = rows[j].searchId;
      if (searchHasShown[sid] === undefined) {
        searchHasShown[sid] = false;
        searchIdxMap[sid] = searchIdxCounter++;
      }
      if (rows[j].shown) searchHasShown[sid] = true;
    }

    /* ---- build sorted partner/supplier index ---- */
    var pSet = {}, sSet = {};
    for (var k = 0; k < rows.length; k++) { pSet[rows[k].partner] = 1; sSet[rows[k].supplier] = 1; }
    var PARTNERS = Object.keys(pSet).sort();
    var SUPPLIERS = Object.keys(sSet).sort();
    var pIdx = {}, sIdx = {};
    PARTNERS.forEach(function (p, i) { pIdx[p] = i; });
    SUPPLIERS.forEach(function (s, i) { sIdx[s] = i; });

    /* ---- compute mask and pack events ---- */
    var F1 = 1, F2 = 2, F3 = 4, F4 = 8, F5 = 16, F6 = 32;
    var events = new Array(rows.length);
    for (var m = 0; m < rows.length; m++) {
      var r = rows[m];
      var mask = 0;

      if (!r.hasRate)                                             mask |= F1;
      if (r.hasRate && r.rate > r.comp * 1.05)                  mask |= F2;
      if (r.outcome === 4)                                        mask |= F3;
      if (r.lat > 1500)                                           mask |= F4;
      if (r.hasRate && r.rate <= r.comp * 1.05 && !r.shown)     mask |= F5;
      if (!searchHasShown[r.searchId])                           mask |= F6;

      events[m] = [pIdx[r.partner], sIdx[r.supplier], r.hotel,
                   r.shown, r.outcome, r.bval, r.margin, r.lat, mask, r.day, searchIdxMap[r.searchId]];
    }

    /* ---- date label ---- */
    function fmtDate(iso) {
      if (!iso) return '';
      var p = iso.split('-'); // ['2026','04','30']
      return (MONTHS[p[1]] || p[1]) + ' ' + parseInt(p[2]) + ', ' + p[0];
    }
    var dateLabel = minDate
      ? (minDate === maxDate ? fmtDate(minDate) : fmtDate(minDate) + ' – ' + fmtDate(maxDate))
      : 'Uploaded data';

    window.NUITEE_PARTNERS  = PARTNERS;
    window.NUITEE_SUPPLIERS = SUPPLIERS;
    window.NUITEE_EVENTS    = events;
    window.NUITEE_DATE_LABEL = dateLabel;

    return { partners: PARTNERS, suppliers: SUPPLIERS, eventCount: events.length, dateLabel: dateLabel };
  };
})();
