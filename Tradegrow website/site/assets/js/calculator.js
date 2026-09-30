/* Trade Grow — trading cost calculator.
 *
 * The engine is fully config-driven: it reads /assets/config/charges.json, which the
 * builder emits from site/config/charges.config.json. Changing a statutory rate or a
 * brokerage plan is a config edit and a rebuild — never a code change.
 *
 * Design rules this file must keep:
 *   1. Brokerage and statutory charges are always shown as two separate groups.
 *   2. A charge whose rate is not configured renders as "to be verified", not as zero.
 *      Showing an unconfigured charge as 0 would understate cost, which is the exact
 *      failure mode this page exists to prevent.
 *   3. If charges.verification.ratesVerified is false, output is labelled indicative.
 */

(function () {
  'use strict';

  var root = document.getElementById('calculator');
  if (!root) return;

  var CFG = null;

  var el = {
    segment: root.querySelectorAll('input[name="segment"]'),
    side: root.querySelectorAll('input[name="side"]'),
    qty: root.querySelector('#calc-qty'),
    price: root.querySelector('#calc-price'),
    priceLabel: root.querySelector('#calc-price-label'),
    priceHint: root.querySelector('#calc-price-hint'),
    scrips: root.querySelector('#calc-scrips'),
    scripsField: root.querySelector('#calc-scrips-field'),
    total: root.querySelector('#calc-total'),
    turnover: root.querySelector('#calc-turnover'),
    lines: root.querySelector('#calc-lines'),
    note: root.querySelector('#calc-note'),
  };

  var inr = function (n) {
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function selected(list) {
    for (var i = 0; i < list.length; i++) if (list[i].checked) return list[i].value;
    return null;
  }

  /** Round a charge the way the levying authority rounds it. */
  function roundTo(v, dp) {
    if (dp === 0) return Math.round(v);
    var f = Math.pow(10, dp == null ? 2 : dp);
    return Math.round(v * f) / f;
  }

  /**
   * Compute all charges for one leg or a round trip.
   * Returns { turnover, brokerage, statutory: [...], gst, total, unverified: [...] }
   */
  function compute(segKey, side, qty, price, scrips) {
    var seg = CFG.segments.find(function (s) { return s.key === segKey; });
    if (!seg) return null;

    var legs = side === 'both' ? ['buy', 'sell'] : [side];
    var turnoverPerLeg = qty * price;
    var turnover = turnoverPerLeg * legs.length;

    var unverified = [];

    // --- brokerage (Trade Grow's own charge) ---------------------------------
    var broCfg = (CFG.brokerage.segments || {})[segKey] || {};
    var brokerage = 0;
    var brokerageKnown = broCfg.value !== null && broCfg.value !== undefined && broCfg.value !== '';

    if (!brokerageKnown) {
      unverified.push('Brokerage');
    } else {
      legs.forEach(function () {
        var b;
        if (broCfg.type === 'percent') b = (turnoverPerLeg * broCfg.value) / 100;
        else b = Number(broCfg.value); // flat per order
        if (broCfg.max != null) b = Math.min(b, broCfg.max);
        if (broCfg.min != null) b = Math.max(b, broCfg.min);
        brokerage += b;
      });
      brokerage = roundTo(brokerage, 2);
    }

    // --- statutory charges ---------------------------------------------------
    var statutory = [];
    var gstBase = brokerageKnown ? brokerage : 0;

    seg.charges.forEach(function (c) {
      if (c.value === null || c.value === undefined || c.value === '') {
        unverified.push(c.label);
        statutory.push({ label: c.label, amount: null });
        return;
      }

      var applicableLegs = c.side === 'both' ? legs : legs.indexOf(c.side) > -1 ? [c.side] : [];
      var amount = 0;

      if (c.key === 'dp_charges') {
        // Flat, per scrip per day, on delivery sell only.
        if (applicableLegs.length) amount = Number(c.value) * Math.max(1, scrips || 1);
      } else if (c.type === 'percent') {
        amount = (turnoverPerLeg * applicableLegs.length * Number(c.value)) / 100;
      } else {
        amount = Number(c.value) * applicableLegs.length;
      }

      amount = roundTo(amount, c.roundTo);
      statutory.push({ label: c.label, amount: amount, basis: c.basis, side: c.side });

      if ((CFG.gst.appliesTo || []).indexOf(c.key) > -1) gstBase += amount;
    });

    // --- GST -----------------------------------------------------------------
    var gst = roundTo((gstBase * CFG.gst.ratePercent) / 100, 2);

    var statutoryTotal = statutory.reduce(function (a, s) { return a + (s.amount || 0); }, 0) + gst;
    var total = roundTo((brokerageKnown ? brokerage : 0) + statutoryTotal, 2);

    return {
      turnover: turnover,
      brokerage: brokerageKnown ? brokerage : null,
      statutory: statutory,
      gst: gst,
      statutoryTotal: roundTo(statutoryTotal, 2),
      total: total,
      unverified: unverified,
      breakeven: qty > 0 ? roundTo(total / qty, 4) : 0,
    };
  }

  // ------------------------------------------------------------------ render

  function line(label, value, cls) {
    return (
      '<div class="' + (cls || '') + '"><dt>' + label + '</dt><dd>' +
      (value === null ? '<span class="pending">To be verified</span>' : inr(value)) +
      '</dd></div>'
    );
  }

  function update() {
    if (!CFG) return;

    var segKey = selected(el.segment);
    var side = selected(el.side);
    var qty = Math.max(0, Number(el.qty.value) || 0);
    var price = Math.max(0, Number(el.price.value) || 0);
    var scrips = Math.max(1, Number(el.scrips.value) || 1);

    var seg = CFG.segments.find(function (s) { return s.key === segKey; });
    var isOptions = seg && seg.turnoverBasis === 'premium';

    // Relabel the price input for options, where turnover is premium, not strike.
    el.priceLabel.textContent = isOptions ? 'Premium per unit (₹)' : 'Price per share (₹)';
    el.priceHint.textContent = isOptions
      ? 'Options turnover is calculated on premium, not on strike price or contract value.'
      : 'Enter the price at which you expect to transact.';

    // DP charges only exist on equity delivery.
    var hasDp = seg && seg.charges.some(function (c) { return c.key === 'dp_charges'; });
    el.scripsField.hidden = !hasDp || side === 'buy';

    var r = compute(segKey, side, qty, price, scrips);
    if (!r) return;

    el.total.innerHTML = inr(r.total);
    el.turnover.textContent =
      'On a turnover of ' + inr(r.turnover) +
      (qty > 0 ? ' · ' + inr(r.breakeven) + ' per unit to break even' : '');

    // A <dl> may only contain dt/dd pairs (optionally wrapped in a div), so the group
    // headings sit between separate lists rather than inside one.
    var html = '';
    html += '<p class="calc__group">Charged by Trade Grow</p>';
    html += '<dl class="calc__lines">' + line('Brokerage', r.brokerage, 'is-brokerage') + '</dl>';

    html += '<p class="calc__group">Statutory &amp; regulatory (set by Govt / Exchange / SEBI)</p>';
    var stat = '';
    r.statutory.forEach(function (s) { stat += line(s.label, s.amount); });
    stat += line(CFG.gst.label + ' (' + CFG.gst.ratePercent + '%)', r.gst);
    html += '<dl class="calc__lines">' + stat + '</dl>';

    html += '<dl class="calc__lines">' +
            line('<strong>Total estimated cost</strong>', r.total, 'is-total') + '</dl>';
    el.lines.innerHTML = html;

    var notes = [];
    if (!CFG.verification.ratesVerified) {
      notes.push('Statutory rates are not yet verified by Compliance. Treat this result as indicative only.');
    }
    if (r.unverified.length) {
      notes.push('Not yet configured and therefore excluded from the total: ' + r.unverified.join(', ') + '. Your actual cost will be higher than shown.');
    }
    notes.push('The contract note issued after your trade is the authoritative record of charges.');
    el.note.innerHTML = notes.map(function (n) { return '<p>' + n + '</p>'; }).join('');

    if (window.tgTrack) window.tgTrack('calculator_used', { segment: segKey, side: side });
  }

  // Debounce so typing a quantity does not fire an event per keystroke.
  var t;
  function onInput() {
    clearTimeout(t);
    t = setTimeout(update, 180);
  }

  fetch((window.TG_BASE || '') + '/assets/config/charges.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      CFG = data;
      root.querySelectorAll('input').forEach(function (i) {
        i.addEventListener(i.type === 'radio' ? 'change' : 'input', onInput);
      });
      update();
    })
    .catch(function () {
      el.note.innerHTML =
        '<p>The calculator could not load its charge configuration. Please refer to the charge tables above.</p>';
    });
})();
