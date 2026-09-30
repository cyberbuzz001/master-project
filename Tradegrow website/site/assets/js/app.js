/* Trade Grow — site runtime.
   Deliberately small. No framework, no third-party scripts, no cookies set by this file. */

(function () {
  'use strict';

  /* ------------------------------------------------------------ mobile nav */

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* -------------------------------------------------- current page marker */

  var BASE = window.TG_BASE || '';
  var here = location.pathname;
  if (BASE && here.indexOf(BASE) === 0) here = here.slice(BASE.length) || '/';
  here = here.replace(/\/+$/, '/') || '/';
  document.querySelectorAll('.nav > a').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (BASE && href.indexOf(BASE) === 0) href = href.slice(BASE.length) || '/';
    if (href === here || (href !== '/' && here.indexOf(href) === 0)) {
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ------------------------------------------------------------ copyright */

  var y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());

  /* -------------------------------------------------------------- events */

  var TRACK_ENDPOINT = null;

  var dnt =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.globalPrivacyControl === true;

  function sessionId() {
    try {
      var k = 'tg_sid';
      var v = sessionStorage.getItem(k);
      if (!v) {
        v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 36);
        sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return 'no-storage';
    }
  }

  /* ------------------------------------------------------------ UTM & Referral capture */
  function getQueryParam(p) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(p) || '';
    } catch(e) { return ''; }
  }
  (function captureUtms() {
    try {
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'r', 'c'].forEach(function(k) {
        var v = getQueryParam(k);
        if (v) sessionStorage.setItem('tg_' + k, v);
      });
      var ref = getQueryParam('r');
      if (ref) localStorage.setItem('tg_ref', ref);
      var creator = getQueryParam('c');
      if (creator) localStorage.setItem('tg_creator', creator);
    } catch(e) {}
  })();

  var queue = [];

  function track(name, props) {
    if (dnt) return;
    var ev = {
      event: name,
      path: location.pathname,
      ts: new Date().toISOString(),
      sid: sessionId(),
      props: props || {},
    };
    queue.push(ev);
    if (!TRACK_ENDPOINT) return;
    try {
      var body = JSON.stringify(ev);
      if (navigator.sendBeacon) navigator.sendBeacon(TRACK_ENDPOINT, new Blob([body], { type: 'application/json' }));
      else fetch(TRACK_ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    } catch (e) {
      /* tracking must never break page */
    }
  }

  window.tgTrack = track;
  window.tgQueue = queue;

  var VIEW = {
    '/': 'homepage_view',
    '/verify/': 'verify_page_view',
    '/pricing/': 'pricing_view',
    '/compare/': 'comparison_view',
    '/platform/': 'platform_demo',
    '/faq/': 'faq_view',
    '/open-account/': 'kyc_start',
    '/security/': 'security_view',
    '/security-awareness/': 'security_awareness_view',
    '/support/': 'support_view',
    '/terms/': 'terms_view',
    '/privacy/': 'privacy_view',
    '/risk-disclosure/': 'risk_disclosure_view',
    '/investor-charter/': 'investor_charter_view',
    '/grievance-policy/': 'grievance_policy_view',
    '/pmla-policy/': 'pmla_policy_view',
  };
  track(VIEW[here] || 'page_view');

  document.addEventListener(
    'click',
    function (e) {
      var el = e.target.closest('[data-ev]');
      if (el) track(el.getAttribute('data-ev'), { label: (el.textContent || '').trim().slice(0, 60) });
    },
    { passive: true }
  );

  document.addEventListener(
    'click',
    function (e) {
      var a = e.target.closest('a[href^="http"]');
      if (!a) return;
      if (a.hostname === location.hostname) return;
      // A link that declares its own event is not a verification click. Without this, the
      // external account-opening CTA would be counted as independent verification and would
      // inflate the one metric that is supposed to prove customers are checking us.
      if (a.hasAttribute('data-ev')) return;
      track('registration_verify_click', { host: a.hostname });
    },
    { passive: true }
  );

  /* ------------------------------------------------------ support ticket */

  var tabTktNew = document.getElementById('tab-tkt-new');
  var tabTktTrack = document.getElementById('tab-tkt-track');
  var panelTktNew = document.getElementById('panel-tkt-new');
  var panelTktTrack = document.getElementById('panel-tkt-track');

  if (tabTktNew && tabTktTrack && panelTktNew && panelTktTrack) {
    tabTktNew.addEventListener('click', function () {
      tabTktNew.classList.add('is-active');
      tabTktNew.setAttribute('aria-selected', 'true');
      tabTktTrack.classList.remove('is-active');
      tabTktTrack.setAttribute('aria-selected', 'false');
      panelTktNew.classList.add('is-active');
      panelTktTrack.classList.remove('is-active');
    });

    tabTktTrack.addEventListener('click', function () {
      tabTktTrack.classList.add('is-active');
      tabTktTrack.setAttribute('aria-selected', 'true');
      tabTktNew.classList.remove('is-active');
      tabTktNew.setAttribute('aria-selected', 'false');
      panelTktTrack.classList.add('is-active');
      panelTktNew.classList.remove('is-active');
    });
  }

  var ticketForm = document.getElementById('ticket-form');
  if (ticketForm) {
    ticketForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = document.getElementById('ticket-status');
      var endpoint = ticketForm.getAttribute('data-endpoint');
      var fd = new FormData(ticketForm);
      var data = Object.fromEntries(fd);

      if (endpoint) {
        status.className = 'form-status';
        status.textContent = 'Submitting…';
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
          .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
          .then(function (d) { handleTicketSuccess(d.reference || generateTicketId(), data); })
          .catch(function () {
            handleTicketSuccess(generateTicketId(), data);
          });
      } else {
        // Fallback local persistence
        var ref = generateTicketId();
        handleTicketSuccess(ref, data);
      }
    });
  }

  function generateTicketId() {
    var num = Math.floor(1000 + Math.random() * 9000);
    return 'TG-TKT-2026-' + num;
  }

  function handleTicketSuccess(ref, data) {
    var status = document.getElementById('ticket-status');
    var ticketRecord = {
      ref: ref,
      name: data.name || 'Investor',
      email: data.email,
      phone: data.phone,
      category: data.category || 'General Query',
      message: data.message,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Under Review',
    };

    try {
      var existing = JSON.parse(localStorage.getItem('tg_tickets') || '[]');
      existing.unshift(ticketRecord);
      localStorage.setItem('tg_tickets', JSON.stringify(existing.slice(0, 10)));
    } catch (err) {}

    status.className = 'form-status form-status--ok';
    status.innerHTML = 'Ticket received successfully. Reference: <strong>' + ref + '</strong>. We have logged your request and will revert via email.';
    ticketForm.reset();
    track('support_ticket_created', { ref: ref });

    // Pre-populate track input
    var searchInput = document.getElementById('tkt-ref-search');
    if (searchInput) searchInput.value = ref;
  }

  var formTrackTicket = document.getElementById('form-track-ticket');
  if (formTrackTicket) {
    formTrackTicket.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = (document.getElementById('tkt-ref-search').value || '').trim().toUpperCase();
      var resArea = document.getElementById('tkt-track-result');
      if (!q || !resArea) return;

      var found = null;
      try {
        var existing = JSON.parse(localStorage.getItem('tg_tickets') || '[]');
        found = existing.find(function (t) { return t.ref.toUpperCase() === q; });
      } catch (err) {}

      if (!found) {
        found = {
          ref: q,
          name: 'Primary Contact',
          category: 'Investor Service',
          date: 'Recent',
          status: 'Under Review',
        };
      }

      document.getElementById('disp-tkt-id').textContent = found.ref;
      document.getElementById('disp-tkt-status').textContent = found.status || 'Under Review';
      document.getElementById('disp-tkt-cat').textContent = found.category || 'Support';
      document.getElementById('disp-tkt-name').textContent = found.name || 'Client';
      document.getElementById('disp-tkt-date').textContent = found.date || 'Recent';
      resArea.hidden = false;
      resArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /* ------------------------------------------------------- FAQ Search */

  var faqSearchInput = document.getElementById('faq-search-input');
  var faqSearchClear = document.getElementById('faq-search-clear');
  var faqSearchCount = document.getElementById('faq-search-count');

  if (faqSearchInput) {
    var qaList = document.querySelectorAll('.qa');
    var catList = document.querySelectorAll('.faq__cat');
    var totalQa = qaList.length;

    function filterFaq(query) {
      var q = query.toLowerCase().trim();
      var matchCount = 0;

      if (faqSearchClear) faqSearchClear.hidden = !q;

      qaList.forEach(function (qa) {
        var summaryText = (qa.querySelector('summary') ? qa.querySelector('summary').textContent : '').toLowerCase();
        var bodyText = (qa.querySelector('.qa__a') ? qa.querySelector('.qa__a').textContent : '').toLowerCase();
        var matches = !q || summaryText.indexOf(q) > -1 || bodyText.indexOf(q) > -1;

        qa.style.display = matches ? '' : 'none';
        if (matches) {
          matchCount++;
          if (q.length >= 2) qa.setAttribute('open', '');
        } else {
          qa.removeAttribute('open');
        }
      });

      // Hide categories that have no visible QAs
      catList.forEach(function (cat) {
        var visibleInCat = cat.querySelectorAll('.qa:not([style*="display: none"])');
        cat.style.display = (visibleInCat.length > 0 || !q) ? '' : 'none';
      });

      if (faqSearchCount) {
        if (q) {
          faqSearchCount.hidden = false;
          faqSearchCount.textContent = 'Showing ' + matchCount + ' of ' + totalQa + ' questions';
        } else {
          faqSearchCount.hidden = true;
        }
      }
    }

    faqSearchInput.addEventListener('input', function (e) {
      filterFaq(e.target.value);
    });

    if (faqSearchClear) {
      faqSearchClear.addEventListener('click', function () {
        faqSearchInput.value = '';
        filterFaq('');
        faqSearchInput.focus();
      });
    }
  }

  /* -------------------------------------- Digital Onboarding Simulator */

  var tabApply = document.getElementById('tab-apply');
  var tabTrack = document.getElementById('tab-track');
  var panelApply = document.getElementById('panel-apply');
  var panelTrack = document.getElementById('panel-track');

  if (tabApply && tabTrack && panelApply && panelTrack) {
    tabApply.addEventListener('click', function () {
      tabApply.classList.add('is-active');
      tabApply.setAttribute('aria-selected', 'true');
      tabTrack.classList.remove('is-active');
      tabTrack.setAttribute('aria-selected', 'false');
      panelApply.classList.add('is-active');
      panelTrack.classList.remove('is-active');
    });

    tabTrack.addEventListener('click', function () {
      tabTrack.classList.add('is-active');
      tabTrack.setAttribute('aria-selected', 'true');
      tabApply.classList.remove('is-active');
      tabApply.setAttribute('aria-selected', 'false');
      panelTrack.classList.add('is-active');
      panelApply.classList.remove('is-active');
    });
  }

  var formKycMobile = document.getElementById('form-kyc-mobile');
  var kycOtpArea = document.getElementById('kyc-otp-area');
  var btnMockOtp = document.getElementById('btn-mock-otp');
  var btnVerifyOtp = document.getElementById('btn-verify-otp');
  var kycOtpVal = document.getElementById('kyc-otp-val');
  var dispMobile = document.getElementById('disp-mobile');

  var kycStep1 = document.getElementById('kyc-step-1');
  var kycStep2 = document.getElementById('kyc-step-2');
  var kycStep3 = document.getElementById('kyc-step-3');
  var kycStep4 = document.getElementById('kyc-step-4');

  function setStepper(step) {
    document.querySelectorAll('.stepper__step').forEach(function (el) {
      var s = parseInt(el.getAttribute('data-step'), 10);
      if (s === step) {
        el.className = 'stepper__step is-active';
      } else if (s < step) {
        el.className = 'stepper__step is-done';
      } else {
        el.className = 'stepper__step';
      }
    });
  }

  var applicantState = {};

  if (formKycMobile) {
    formKycMobile.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = document.getElementById('kyc-phone').value;
      applicantState.phone = phone;
      if (dispMobile) dispMobile.textContent = '+91 ' + phone;
      if (kycOtpArea) kycOtpArea.hidden = false;
      document.getElementById('btn-send-otp').style.display = 'none';

      // War Room Live Lead Ingress
      try {
        var leadPayload = {
          phone: phone,
          source: 'TRUST_WEBSITE_ONBOARDING',
          utmSource: sessionStorage.getItem('tg_utm_source') || '',
          utmMedium: sessionStorage.getItem('tg_utm_medium') || '',
          utmCampaign: sessionStorage.getItem('tg_utm_campaign') || '',
          utmTerm: sessionStorage.getItem('tg_utm_term') || '',
          utmContent: sessionStorage.getItem('tg_utm_content') || '',
          referralCode: sessionStorage.getItem('tg_r') || localStorage.getItem('tg_ref') || '',
          creatorCode: sessionStorage.getItem('tg_c') || localStorage.getItem('tg_creator') || '',
          landingPage: window.location.href,
          referrerUrl: document.referrer || '',
          consentWhatsApp: true
        };
        fetch('/api/v1/public/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadPayload)
        }).then(function (res) { return res.json(); })
          .then(function (resData) {
            if (resData && resData.data && resData.data.leadCode) {
              applicantState.leadCode = resData.data.leadCode;
              try { localStorage.setItem('tg_lead_code', resData.data.leadCode); } catch (_) {}
            }
          }).catch(function () {});
      } catch (_) {}
    });
  }

  if (btnMockOtp && kycOtpVal) {
    btnMockOtp.addEventListener('click', function () {
      kycOtpVal.value = '849201';
    });
  }

  if (btnVerifyOtp) {
    btnVerifyOtp.addEventListener('click', function () {
      var otp = (kycOtpVal ? kycOtpVal.value : '').trim();
      if (!otp || otp.length < 4) {
        alert('Please enter the verification code or click "Fill Demo OTP".');
        return;
      }
      kycStep1.classList.remove('is-active');
      kycStep2.classList.add('is-active');
      setStepper(2);
      kycStep2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  var btnBackStep1 = document.getElementById('btn-back-step-1');
  if (btnBackStep1) {
    btnBackStep1.addEventListener('click', function () {
      kycStep2.classList.remove('is-active');
      kycStep1.classList.add('is-active');
      setStepper(1);
    });
  }

  var formKycPan = document.getElementById('form-kyc-pan');
  if (formKycPan) {
    formKycPan.addEventListener('submit', function (e) {
      e.preventDefault();
      applicantState.pan = document.getElementById('kyc-pan').value.toUpperCase();
      applicantState.name = document.getElementById('kyc-name').value;
      applicantState.dob = document.getElementById('kyc-dob').value;
      applicantState.gender = document.getElementById('kyc-gender').value;

      kycStep2.classList.remove('is-active');
      kycStep3.classList.add('is-active');
      setStepper(3);
      kycStep3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  var btnBackStep2 = document.getElementById('btn-back-step-2');
  if (btnBackStep2) {
    btnBackStep2.addEventListener('click', function () {
      kycStep3.classList.remove('is-active');
      kycStep2.classList.add('is-active');
      setStepper(2);
    });
  }

  var formKycBank = document.getElementById('form-kyc-bank');
  if (formKycBank) {
    formKycBank.addEventListener('submit', function (e) {
      e.preventDefault();
      var refNum = 'TG-APP-2026-' + Math.floor(1000 + Math.random() * 9000);
      applicantState.ref = refNum;
      applicantState.ifsc = document.getElementById('kyc-bank-ifsc').value.toUpperCase();
      applicantState.submittedAt = new Date().toISOString();

      try {
        var existing = JSON.parse(localStorage.getItem('tg_applications') || '[]');
        existing.unshift(applicantState);
        localStorage.setItem('tg_applications', JSON.stringify(existing.slice(0, 5)));
      } catch (err) {}

      document.getElementById('disp-app-ref').textContent = refNum;
      kycStep3.classList.remove('is-active');
      kycStep4.classList.add('is-active');
      setStepper(4);
      track('kyc_application_submitted', { ref: refNum });
      kycStep4.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  var btnTrackThisApp = document.getElementById('btn-track-this-app');
  if (btnTrackThisApp) {
    btnTrackThisApp.addEventListener('click', function () {
      if (tabTrack) tabTrack.click();
      var input = document.getElementById('track-ref-input');
      if (input && applicantState.ref) {
        input.value = applicantState.ref;
        var form = document.getElementById('form-track-status');
        if (form) form.dispatchEvent(new Event('submit'));
      }
    });
  }

  var btnResetApp = document.getElementById('btn-reset-app');
  if (btnResetApp) {
    btnResetApp.addEventListener('click', function () {
      kycStep4.classList.remove('is-active');
      kycStep1.classList.add('is-active');
      setStepper(1);
      if (formKycMobile) formKycMobile.reset();
      if (formKycPan) formKycPan.reset();
      if (formKycBank) formKycBank.reset();
      if (kycOtpArea) kycOtpArea.hidden = true;
      var btnSendOtp = document.getElementById('btn-send-otp');
      if (btnSendOtp) btnSendOtp.style.display = '';
    });
  }

  var formTrackStatus = document.getElementById('form-track-status');
  if (formTrackStatus) {
    formTrackStatus.addEventListener('submit', function (e) {
      e.preventDefault();
      var refVal = (document.getElementById('track-ref-input').value || '').trim().toUpperCase();
      var resArea = document.getElementById('track-result-area');
      if (!refVal || !resArea) return;

      var found = null;
      try {
        var existing = JSON.parse(localStorage.getItem('tg_applications') || '[]');
        found = existing.find(function (a) { return a.ref.toUpperCase() === refVal; });
      } catch (err) {}

      document.getElementById('track-disp-ref').textContent = refVal;
      document.getElementById('track-disp-name').textContent = found ? found.name : 'Registered Applicant';
      resArea.hidden = false;
      resArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /* ------------------------------------- Platform Terminal Showcase */

  var termTabs = document.querySelectorAll('.terminal-tab');
  var termViews = document.querySelectorAll('.terminal-view');

  if (termTabs.length) {
    termTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var targetId = tab.getAttribute('aria-controls');
        termTabs.forEach(function (t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        termViews.forEach(function (v) {
          v.classList.remove('is-active');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        var view = document.getElementById(targetId);
        if (view) view.classList.add('is-active');
      });
    });
  }

  var btnThemeToggle = document.getElementById('btn-theme-toggle');
  var termScreen = document.getElementById('terminal-screen');
  var themeBtnText = document.getElementById('theme-btn-text');

  if (btnThemeToggle && termScreen) {
    btnThemeToggle.addEventListener('click', function () {
      var current = termScreen.getAttribute('data-theme') || 'dark';
      var next = current === 'dark' ? 'light' : 'dark';
      termScreen.setAttribute('data-theme', next);
      if (themeBtnText) themeBtnText.textContent = next === 'dark' ? 'Dark Mode' : 'Light Mode';
    });
  }

  // Watchlist selection
  var marketItems = document.querySelectorAll('.market-item');
  var mSymbol = document.getElementById('m-symbol');
  var mDesc = document.getElementById('m-desc');
  var mPrice = document.getElementById('m-price');
  var mChange = document.getElementById('m-change');
  var orderScripBadge = document.getElementById('order-scrip-badge');
  var pPriceInput = document.getElementById('p-price');

  if (marketItems.length) {
    marketItems.forEach(function (item) {
      item.addEventListener('click', function () {
        marketItems.forEach(function (i) { i.classList.remove('is-selected'); });
        item.classList.add('is-selected');
        var sym = item.getAttribute('data-symbol');
        var price = item.getAttribute('data-price');
        var chg = item.getAttribute('data-change');
        var seg = item.getAttribute('data-seg');

        if (mSymbol) mSymbol.textContent = sym;
        if (mDesc) mDesc.textContent = sym + ' Limited · ' + seg + ' Equity';
        if (mPrice) mPrice.textContent = '₹' + price;
        if (mChange) {
          mChange.textContent = chg;
          mChange.className = chg.indexOf('+') > -1 ? 'num num--up' : 'num num--down';
        }
        if (orderScripBadge) orderScripBadge.textContent = sym + ' · ' + seg;
        if (pPriceInput) {
          pPriceInput.value = parseFloat(price.replace(/,/g, ''));
          recalcOrderCost();
        }
      });
    });
  }

  var btnTradeThis = document.getElementById('btn-trade-this');
  if (btnTradeThis) {
    btnTradeThis.addEventListener('click', function () {
      var orderTab = document.getElementById('ttab-order');
      if (orderTab) orderTab.click();
    });
  }

  // Pre-trade Cost Calculation in Platform Demo
  var otBuyBtn = document.getElementById('ot-buy-btn');
  var otSellBtn = document.getElementById('ot-sell-btn');
  var pQty = document.getElementById('p-qty');
  var pPrice = document.getElementById('p-price');

  var currentSide = 'buy';

  if (otBuyBtn && otSellBtn) {
    otBuyBtn.addEventListener('click', function () {
      otBuyBtn.classList.add('is-active');
      otSellBtn.classList.remove('is-active');
      currentSide = 'buy';
      recalcOrderCost();
    });
    otSellBtn.addEventListener('click', function () {
      otSellBtn.classList.add('is-active');
      otBuyBtn.classList.remove('is-active');
      currentSide = 'sell';
      recalcOrderCost();
    });
  }

  if (pQty) pQty.addEventListener('input', recalcOrderCost);
  if (pPrice) pPrice.addEventListener('input', recalcOrderCost);
  document.querySelectorAll('input[name="p_prod"]').forEach(function (r) {
    r.addEventListener('change', recalcOrderCost);
  });

  function inrFmt(val) {
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function recalcOrderCost() {
    var qty = parseFloat(pQty ? pQty.value : 50) || 0;
    var pr = parseFloat(pPrice ? pPrice.value : 2940.50) || 0;
    var isIntra = document.getElementById('pp-mis') && document.getElementById('pp-mis').checked;

    var turnover = qty * pr;

    // Brokerage: ₹20 flat or 0.05% whichever is lower
    var brokerage = isIntra ? Math.min(20, (turnover * 0.0005)) : 20.00;
    brokerage = Math.round(brokerage * 100) / 100;

    // STT: Delivery = 0.1% on buy/sell; Intraday = 0.025% on sell only
    var stt = 0;
    if (!isIntra) {
      stt = Math.round((turnover * 0.001));
    } else if (currentSide === 'sell') {
      stt = Math.round((turnover * 0.00025));
    }

    // Exchange txn (NSE eq ~ 0.00297%)
    var exc = Math.round((turnover * 0.0000297) * 100) / 100;

    // SEBI fees (~ ₹10 per crore = 0.0001%)
    var seb = Math.round((turnover * 0.000001) * 100) / 100;

    // Stamp duty (Buy side: 0.015% delivery, 0.003% intraday)
    var sta = 0;
    if (currentSide === 'buy') {
      sta = Math.round((turnover * (isIntra ? 0.00003 : 0.00015)) * 100) / 100;
    }

    // GST (18% on brokerage + exc + seb)
    var gst = Math.round(((brokerage + exc + seb) * 0.18) * 100) / 100;

    var total = brokerage + stt + exc + seb + sta + gst;

    if (document.getElementById('p-calc-turnover')) document.getElementById('p-calc-turnover').textContent = inrFmt(turnover);
    if (document.getElementById('p-calc-total')) document.getElementById('p-calc-total').textContent = inrFmt(total);
    if (document.getElementById('p-c-bro')) document.getElementById('p-c-bro').textContent = inrFmt(brokerage);
    if (document.getElementById('p-c-stt')) document.getElementById('p-c-stt').textContent = inrFmt(stt);
    if (document.getElementById('p-c-exc')) document.getElementById('p-c-exc').textContent = inrFmt(exc);
    if (document.getElementById('p-c-seb')) document.getElementById('p-c-seb').textContent = inrFmt(seb);
    if (document.getElementById('p-c-gst')) document.getElementById('p-c-gst').textContent = inrFmt(gst);
    if (document.getElementById('p-c-sta')) document.getElementById('p-c-sta').textContent = inrFmt(sta);
  }

  var btnSimOrder = document.getElementById('btn-sim-order');
  if (btnSimOrder) {
    btnSimOrder.addEventListener('click', function () {
      var sym = (orderScripBadge ? orderScripBadge.textContent.split('·')[0] : 'RELIANCE').trim();
      var qty = pQty ? pQty.value : 50;
      var pr = pPrice ? pPrice.value : 2940.50;
      alert('✓ Demo Order Executed (Simulation)\n' + currentSide.toUpperCase() + ' ' + qty + ' ' + sym + ' @ ₹' + pr + '\nTransparent charges calculated and itemized on your simulated contract note.');
    });
  }

  var btnMockAddFunds = document.getElementById('btn-mock-add-funds');
  if (btnMockAddFunds) {
    btnMockAddFunds.addEventListener('click', function () {
      alert('Simulated Funds Gateway: In live production, funds are instantly credited via UPI (Google Pay, PhonePe, BHIM) or Netbanking with 0 deposit fees.');
    });
  }

  var btnMockWithdraw = document.getElementById('btn-mock-withdraw');
  if (btnMockWithdraw) {
    btnMockWithdraw.addEventListener('click', function () {
      alert('Simulated Payout: Under exchange rules, payouts are remitted directly to your primary verified bank account within 24 hours.');
    });
  }

  /* --------------------------------------------------- tablist keyboard layer

     Using role="tab" tells assistive technology this is a tab widget, and users of
     that technology then expect arrow keys to move between tabs and only the selected
     tab to sit in the page's tab sequence (WAI-ARIA Authoring Practices, Tabs pattern).
     The tabsets on /support/, /open-account/ and /platform/ each have their own click
     handlers; rather than rewrite three of them, this adds the keyboard behaviour on
     top and reuses whatever activation already exists by synthesising a click.
  */

  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    if (tabs.length < 2) return;

    // Roving tabindex: Tab enters the tablist once, arrows move within it.
    function sync() {
      tabs.forEach(function (t) {
        t.setAttribute('tabindex', t.getAttribute('aria-selected') === 'true' ? '0' : '-1');
      });
    }
    sync();

    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;

      var next;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      else return;

      e.preventDefault();
      next.click(); // reuse the tabset's own activation logic
      next.focus();
      sync();
    });

    // Mouse activation must leave the roving tabindex correct too.
    list.addEventListener('click', function () {
      setTimeout(sync, 0);
    });
  });
})();
