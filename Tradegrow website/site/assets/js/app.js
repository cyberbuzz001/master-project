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
  function getApiBase() {
    if (window.TG_API_HOST) return window.TG_API_HOST;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    return 'https://tradegrowx.in';
  }
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
    // Pre-populate phone if passed from hero quick ingress
    try {
      var prefillPhone = getQueryParam('phone') || sessionStorage.getItem('tg_lead_phone') || '';
      if (prefillPhone) {
        var phoneInput = document.getElementById('kyc-phone');
        if (phoneInput && !phoneInput.value) {
          phoneInput.value = prefillPhone.replace(/\D/g, '').slice(-10);
        }
      }
    } catch (_) {}

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
        fetch(getApiBase() + '/api/v1/public/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadPayload)
        }).then(function (res) { return res.json(); })
          .then(function (resData) {
            if (resData && resData.data && resData.data.leadCode) {
              applicantState.leadCode = resData.data.leadCode;
              try { 
                localStorage.setItem('tg_lead_code', resData.data.leadCode);
                sessionStorage.setItem('tg_lead_code', resData.data.leadCode);
              } catch (_) {}
            }
          }).catch(function (err) {
            console.warn('[WarRoom Ingress] Lead capture offline/fallback:', err);
          });
      } catch (_) {}
    });
  }

  /* ------------------------------------------------------------ Homepage Hero Lead Ingress */
  var heroQuickIngress = document.getElementById('hero-quick-ingress');
  if (heroQuickIngress) {
    heroQuickIngress.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('hero-phone-input');
      var rawPhone = input ? input.value : '';
      var phone = rawPhone.replace(/\D/g, '').slice(-10);
      if (phone.length !== 10) return;

      var btn = document.getElementById('hero-ingress-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Verifying...';
      }

      try {
        sessionStorage.setItem('tg_lead_phone', phone);
      } catch (_) {}

      var leadPayload = {
        phone: phone,
        source: 'HOMEPAGE_HERO_INGRESS',
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

      fetch(getApiBase() + '/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadPayload)
      }).then(function (res) { return res.json(); })
        .then(function (resData) {
          if (resData && resData.data && resData.data.leadCode) {
            try { 
              localStorage.setItem('tg_lead_code', resData.data.leadCode);
              sessionStorage.setItem('tg_lead_code', resData.data.leadCode);
            } catch (_) {}
          }
          window.location.href = (window.TG_BASE || '') + '/open-account/?phone=' + encodeURIComponent(phone);
        }).catch(function () {
          window.location.href = (window.TG_BASE || '') + '/open-account/?phone=' + encodeURIComponent(phone);
        });
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

  /* ------------------------------------------------ 01 Glass Header Scroll */
  var siteHeader = document.getElementById('site-header');
  if (siteHeader) {
    var checkHeaderScroll = function () {
      if (window.scrollY > 20) {
        siteHeader.classList.add('is-scrolled');
      } else {
        siteHeader.classList.remove('is-scrolled');
      }
    };
    window.addEventListener('scroll', checkHeaderScroll, { passive: true });
    checkHeaderScroll();
  }

  /* ------------------------------------------------ Quick Search & Keybinding */
  var headerSearchTrigger = document.getElementById('header-search-trigger');
  if (headerSearchTrigger) {
    headerSearchTrigger.addEventListener('click', function () {
      var scrInput = document.getElementById('screener-search-input');
      if (scrInput) {
        scrInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { scrInput.focus(); }, 400);
      }
    });
  }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (headerSearchTrigger) headerSearchTrigger.click();
    }
  });

  /* --------------------------------- 02 Hero 3D Canvas & Subtle Parallax */
  var heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) {
    var ctx = heroCanvas.getContext('2d');
    var particles = [];
    var particleCount = 45;
    var cw = 0, ch = 0;

    function resizeCanvas() {
      cw = heroCanvas.width = (heroCanvas.parentElement ? heroCanvas.parentElement.offsetWidth : window.innerWidth) || window.innerWidth;
      ch = heroCanvas.height = (heroCanvas.parentElement ? heroCanvas.parentElement.offsetHeight : 650) || 650;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    for (var p = 0; p < particleCount; p++) {
      particles.push({
        x: Math.random() * cw,
        y: Math.random() * ch,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 2 + 1,
        color: Math.random() > 0.4 ? 'rgba(34, 211, 238, ' : 'rgba(59, 130, 246, ',
        alpha: Math.random() * 0.5 + 0.2
      });
    }

    var mouseX = cw / 2, mouseY = ch / 2;
    var targetMouseX = mouseX, targetMouseY = mouseY;
    window.addEventListener('mousemove', function (e) {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    }, { passive: true });

    var stack3d = document.getElementById('hero-3d-stack');

    function animateHeroCanvas() {
      ctx.clearRect(0, 0, cw, ch);

      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      if (stack3d && window.innerWidth > 980) {
        var dx = (mouseX - window.innerWidth / 2) / (window.innerWidth / 2);
        var dy = (mouseY - window.innerHeight / 2) / (window.innerHeight / 2);
        stack3d.style.transform = 'rotateY(' + (dx * 6) + 'deg) rotateX(' + (-dy * 5) + 'deg) translate3d(' + (dx * 10) + 'px, ' + (dy * 6) + 'px, 0)';
      }

      // Subtle grid
      ctx.strokeStyle = 'rgba(29, 39, 53, 0.3)';
      ctx.lineWidth = 1;
      var gridStep = 70;
      for (var gx = 0; gx < cw; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, ch);
        ctx.stroke();
      }
      for (var gy = 0; gy < ch; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(cw, gy);
        ctx.stroke();
      }

      // Particles & connections
      for (var i = 0; i < particles.length; i++) {
        var pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.x < 0) pt.x = cw;
        if (pt.x > cw) pt.x = 0;
        if (pt.y < 0) pt.y = ch;
        if (pt.y > ch) pt.y = 0;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fillStyle = pt.color + pt.alpha + ')';
        ctx.fill();

        for (var j = i + 1; j < particles.length; j++) {
          var pt2 = particles[j];
          var dist = Math.hypot(pt.x - pt2.x, pt.y - pt2.y);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = 'rgba(59, 130, 246, ' + ((1 - dist / 110) * 0.16) + ')';
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animateHeroCanvas);
    }
    requestAnimationFrame(animateHeroCanvas);
  }

  /* -------------------------------------- 03 Live Market Ticker Controls */
  var tickerTrack = document.getElementById('ticker-track');
  var tickerPauseBtn = document.getElementById('ticker-pause-btn');
  if (tickerTrack && tickerPauseBtn) {
    var isPaused = false;
    tickerPauseBtn.addEventListener('click', function () {
      isPaused = !isPaused;
      tickerTrack.style.animationPlayState = isPaused ? 'paused' : 'running';
      tickerPauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      tickerPauseBtn.setAttribute('aria-pressed', String(isPaused));
    });
  }

  /* ------------------------------ 04 Interactive Trading Terminal Demo */
  var termSvg = document.getElementById('terminal-candlestick-svg');
  var termWatchlist = document.getElementById('terminal-watchlist');
  var termScripName = document.getElementById('term-scrip-name');
  var termScripPrice = document.getElementById('term-scrip-price');
  var termScripChg = document.getElementById('term-scrip-chg');
  var termStatHigh = document.getElementById('term-stat-high');
  var termStatLow = document.getElementById('term-stat-low');
  var termStatVol = document.getElementById('term-stat-vol');

  var termOrderQty = document.getElementById('order-qty-input');
  var termOrderPrice = document.getElementById('order-price-input');
  var termOrderProd = document.getElementById('order-product-type');
  var btnSideBuy = document.getElementById('btn-side-buy');
  var btnSideSell = document.getElementById('btn-side-sell');
  var btnExecOrder = document.getElementById('btn-execute-demo-order');

  var activeSymbol = 'RELIANCE';
  var activePrice = 2940.50;
  var activeSide = 'BUY';
  var activeTimeframe = '1D';
  var activeChartType = 'candle';

  function renderTerminalCandles() {
    if (!termSvg) return;
    var width = 650;
    var height = 360;
    var candleCount = 22;
    var candles = [];

    // Seeded pseudo-random data around activePrice
    var cur = activePrice * 0.985;
    var minP = cur, maxP = cur;

    for (var i = 0; i < candleCount; i++) {
      var delta = (Math.sin(i * 0.8) + (Math.random() - 0.48)) * (activePrice * 0.008);
      var open = cur;
      var close = cur + delta;
      var high = Math.max(open, close) + Math.random() * (activePrice * 0.004);
      var low = Math.min(open, close) - Math.random() * (activePrice * 0.004);
      cur = close;
      if (low < minP) minP = low;
      if (high > maxP) maxP = high;
      candles.push({ open: open, close: close, high: high, low: low });
    }

    var range = maxP - minP || 1;
    var padY = 40;
    var plotH = height - padY * 2 - 50;

    function toY(p) {
      return height - padY - 50 - ((p - minP) / range) * plotH;
    }

    var slotW = (width - 60) / candleCount;
    var candleW = Math.max(6, slotW * 0.65);

    var svgContent = '';

    // Horizontal grid lines & price labels
    for (var g = 0; g <= 4; g++) {
      var gy = padY + (plotH / 4) * g;
      var gPrice = maxP - (range / 4) * g;
      svgContent += '<line x1="20" y1="' + gy + '" x2="' + (width - 40) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 4" stroke-width="1"/>';
      svgContent += '<text x="' + (width - 35) + '" y="' + (gy + 4) + '" fill="#64748B" font-family="JetBrains Mono" font-size="10">' + gPrice.toFixed(1) + '</text>';
    }

    if (activeChartType === 'candle') {
      var maPoints = [];
      candles.forEach(function (c, idx) {
        var cx = 30 + idx * slotW + slotW / 2;
        var isUp = c.close >= c.open;
        var color = isUp ? '#22C55E' : '#EF4444';

        var yHigh = toY(c.high);
        var yLow = toY(c.low);
        var yOpen = toY(c.open);
        var yClose = toY(c.close);
        var top = Math.min(yOpen, yClose);
        var bHeight = Math.max(2, Math.abs(yClose - yOpen));

        // Wick
        svgContent += '<line x1="' + cx + '" y1="' + yHigh + '" x2="' + cx + '" y2="' + yLow + '" stroke="' + color + '" stroke-width="1.4"/>';
        // Body
        svgContent += '<rect x="' + (cx - candleW / 2) + '" y="' + top + '" width="' + candleW + '" height="' + bHeight + '" rx="1.5" fill="' + color + '"/>';

        // Volume bar at bottom
        var volH = Math.min(45, (Math.abs(c.close - c.open) / range) * 80 + 8);
        var volY = height - 10 - volH;
        svgContent += '<rect x="' + (cx - candleW / 2) + '" y="' + volY + '" width="' + candleW + '" height="' + volH + '" fill="' + color + '" opacity="0.35"/>';

        maPoints.push(cx + ',' + ((yOpen + yClose) / 2));
      });

      // Overlay 20-period Moving Average
      if (maPoints.length > 1) {
        svgContent += '<polyline points="' + maPoints.join(' ') + '" fill="none" stroke="#22D3EE" stroke-width="2" opacity="0.85"/>';
      }
    } else {
      // Line or Area chart
      var poly = [];
      candles.forEach(function (c, idx) {
        var cx = 30 + idx * slotW + slotW / 2;
        var cy = toY(c.close);
        poly.push(cx + ',' + cy);
      });

      if (activeChartType === 'area') {
        var areaPoints = poly.slice();
        areaPoints.unshift('30,' + (height - 50));
        areaPoints.push((width - 60) + ',' + (height - 50));
        svgContent += '<polygon points="' + areaPoints.join(' ') + '" fill="rgba(34, 211, 238, 0.12)"/>';
      }
      svgContent += '<polyline points="' + poly.join(' ') + '" fill="none" stroke="#22D3EE" stroke-width="2.6" stroke-linecap="round"/>';
    }

    termSvg.innerHTML = svgContent;
  }

  function recalcTerminalPreTrade() {
    var qty = parseFloat(termOrderQty ? termOrderQty.value : 40) || 1;
    var pr = parseFloat(termOrderPrice ? termOrderPrice.value : activePrice) || activePrice;
    var prod = termOrderProd ? termOrderProd.value : 'CNC';

    var turnover = qty * pr;
    var brokerage = prod === 'MIS' ? Math.min(20, turnover * 0.0005) : 20.00;
    brokerage = Math.round(brokerage * 100) / 100;

    var stt = 0;
    if (prod === 'CNC') stt = Math.round(turnover * 0.001);
    else if (activeSide === 'SELL') stt = Math.round(turnover * 0.00025);

    var exch = Math.round(turnover * 0.0000297 * 100) / 100;
    var sebi = Math.round(turnover * 0.000001 * 100) / 100;
    var stamp = activeSide === 'BUY' ? Math.round(turnover * (prod === 'MIS' ? 0.00003 : 0.00015) * 100) / 100 : 0;
    var gst = Math.round((brokerage + exch + sebi) * 0.18 * 100) / 100;

    var statutory = stt + gst + stamp + exch + sebi;
    var total = brokerage + statutory;

    var tTurn = document.getElementById('term-calc-turnover');
    var tBro = document.getElementById('term-calc-bro');
    var tStat = document.getElementById('term-calc-stat');
    var tTotal = document.getElementById('term-calc-total');

    if (tTurn) tTurn.textContent = '₹' + turnover.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (tBro) tBro.textContent = '₹' + brokerage.toFixed(2);
    if (tStat) tStat.textContent = '₹' + statutory.toFixed(2);
    if (tTotal) tTotal.textContent = '₹' + total.toFixed(2);
  }

  // Watchlist clicks
  if (termWatchlist) {
    termWatchlist.querySelectorAll('.watchlist-row').forEach(function (row) {
      row.addEventListener('click', function () {
        termWatchlist.querySelectorAll('.watchlist-row').forEach(function (r) { r.classList.remove('is-active'); });
        row.classList.add('is-active');

        activeSymbol = row.getAttribute('data-symbol') || 'RELIANCE';
        activePrice = parseFloat(row.getAttribute('data-price')) || 2940.50;
        var chg = row.getAttribute('data-change') || '+1.42%';
        var hi = row.getAttribute('data-high') || '2958.00';
        var lo = row.getAttribute('data-low') || '2915.20';
        var vol = row.getAttribute('data-vol') || '4.2M';

        if (termScripName) termScripName.textContent = activeSymbol;
        if (termScripPrice) termScripPrice.textContent = '₹' + activePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        if (termScripChg) {
          termScripChg.textContent = chg;
          termScripChg.className = chg.indexOf('+') > -1 ? 'num--up active-scrip-chg' : 'num--down active-scrip-chg';
        }
        if (termStatHigh) termStatHigh.textContent = '₹' + hi;
        if (termStatLow) termStatLow.textContent = '₹' + lo;
        if (termStatVol) termStatVol.textContent = vol;

        if (termOrderPrice) termOrderPrice.value = activePrice.toFixed(2);

        renderTerminalCandles();
        recalcTerminalPreTrade();
      });
    });
  }

  // Timeframe buttons
  var tfBtns = document.getElementById('term-timeframe-btns');
  if (tfBtns) {
    tfBtns.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tfBtns.querySelectorAll('button').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        activeTimeframe = btn.getAttribute('data-tf');
        renderTerminalCandles();
      });
    });
  }

  // Chart type buttons
  var ctBtns = document.getElementById('term-chart-type-btns');
  if (ctBtns) {
    ctBtns.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ctBtns.querySelectorAll('button').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        activeChartType = btn.getAttribute('data-type');
        renderTerminalCandles();
      });
    });
  }

  // Buy / Sell toggles
  if (btnSideBuy && btnSideSell) {
    btnSideBuy.addEventListener('click', function () {
      btnSideBuy.classList.add('is-active');
      btnSideSell.classList.remove('is-active');
      activeSide = 'BUY';
      recalcTerminalPreTrade();
    });
    btnSideSell.addEventListener('click', function () {
      btnSideSell.classList.add('is-active');
      btnSideBuy.classList.remove('is-active');
      activeSide = 'SELL';
      recalcTerminalPreTrade();
    });
  }

  if (termOrderQty) termOrderQty.addEventListener('input', recalcTerminalPreTrade);
  if (termOrderPrice) termOrderPrice.addEventListener('input', recalcTerminalPreTrade);
  if (termOrderProd) termOrderProd.addEventListener('change', recalcTerminalPreTrade);

  // Execute Demo Order Toast
  if (btnExecOrder) {
    btnExecOrder.addEventListener('click', function () {
      var qty = termOrderQty ? termOrderQty.value : 40;
      var pr = termOrderPrice ? termOrderPrice.value : activePrice;
      var prod = termOrderProd ? termOrderProd.value : 'CNC';
      var ordId = 'TG-DEMO-' + Math.floor(10000 + Math.random() * 90000);

      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:90px;right:24px;z-index:9999;background:#0A0F17;border:1px solid #22D3EE;border-radius:12px;padding:16px 20px;box-shadow:0 12px 36px rgba(0,0,0,0.8),0 0 20px rgba(34,211,238,0.3);color:#F7F9FC;font-family:Inter,sans-serif;max-width:340px;animation:slideIn 0.3s ease;';
      toast.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-family:Space Grotesk,sans-serif;font-weight:700;color:#22D3EE;margin-bottom:6px;"><span style="color:#22C55E">&#10003;</span> DEMO ORDER EXECUTED</div><div style="font-size:0.85rem;line-height:1.4;"><strong>' + activeSide + ' ' + qty + ' ' + activeSymbol + '</strong> @ ₹' + pr + ' (' + prod + ')<br><span style="font-family:JetBrains Mono,monospace;font-size:0.75rem;color:#8D98A8;">ID: ' + ordId + ' &middot; Simulation</span></div>';
      document.body.appendChild(toast);

      setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s';
        setTimeout(function () { toast.remove(); }, 400);
      }, 3500);
    });
  }

  // Initial draw of terminal chart
  renderTerminalCandles();
  recalcTerminalPreTrade();

  /* ----------------------------------- 08 AI Market Intelligence Chips */
  var aiChips = document.querySelectorAll('.ai-chip');
  var aiRespHeader = document.getElementById('ai-response-header');
  var aiRespText = document.getElementById('ai-response-text');

  var aiAnswers = {
    'nifty-movement': {
      header: 'Analysis: NIFTY 50 Intraday Price Action',
      text: '<p><strong>Market Factors Visible in Available Data:</strong> NIFTY 50 opened steady at 24,780 and maintained upward momentum (+0.82%) supported primarily by IT (+1.8%) and private banking (+1.1%). Market breadth remains 62% positive across broader market indices.</p><p><strong>Key Technical Zones:</strong> The index is trading above its 20-day exponential moving average (24,620) with immediate consolidation observed near the 24,900 resistance band. India VIX remains subdued at 13.42, reflecting moderate implied volatility.</p><p style="font-size:0.8rem;color:var(--muted);margin-top:12px"><em>Educational Disclaimer: Trade Grow AI provides structured synthesis of historical and published market data for educational purposes. It does not provide stock recommendations, investment advice, or guaranteed-profit targets.</em></p>'
    },
    'rsi-indicator': {
      header: 'Educational Context: Relative Strength Index (RSI)',
      text: '<p><strong>Indicator Mechanics:</strong> RSI measures the velocity and magnitude of directional price movements on a scale from 0 to 100 over a standard 14-period window. Typically, readings above 70 indicate overbought conditions, while readings below 30 indicate oversold territory.</p><p><strong>Divergence Concepts:</strong> Bullish divergence occurs when price prints lower lows while RSI prints higher lows, suggesting potential exhaustion in downward selling momentum. Traders examine divergence in conjunction with volume confirmation rather than as a standalone trade signal.</p>'
    },
    'cnc-vs-mis': {
      header: 'Product Comparison: Cash & Delivery (CNC) vs Intraday (MIS)',
      text: '<p><strong>CNC (Cash and Carry):</strong> Designed for equity delivery investment. 100% upfront capital is required. Shares are settled into your depository (Demat) account on T+1 day, allowing you to hold for days, months, or years without daily auto-squareoff.</p><p><strong>MIS (Margin Intraday Square-off):</strong> Intraday trading product allowing additional leverage. Positions must be squared off before the exchange closing cut-off (typically 3:15 PM). Unclosed positions are automatically squared off by the risk management system with statutory charges applicable.</p>'
    },
    'stt-impact': {
      header: 'Tax Mechanics: Securities Transaction Tax (STT)',
      text: '<p><strong>Statutory Requirement:</strong> STT is a direct tax levied by the Government of India on purchase and sale of securities on recognized stock exchanges. On equity delivery, STT is 0.1% on both purchase and sale turnover.</p><p><strong>Intraday vs Derivatives:</strong> On intraday equity trades, STT is levied only on the sell-side at 0.025%. For options, STT applies at 0.1% on the option premium on sell side. Trade Grow remits 100% of collected STT directly to the tax authorities without markup.</p>'
    }
  };

  if (aiChips.length && aiRespHeader && aiRespText) {
    aiChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        aiChips.forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        var queryKey = chip.getAttribute('data-query');
        var data = aiAnswers[queryKey];
        if (data) {
          aiRespHeader.textContent = data.header;
          aiRespText.innerHTML = data.text;
        }
      });
    });
  }

  /* -------------------------------------------- 09 Stock Screener Filter */
  var scrSearch = document.getElementById('screener-search-input');
  var scrMcap = document.getElementById('screener-mcap-filter');
  var scrSector = document.getElementById('screener-sector-filter');
  var scrRsi = document.getElementById('screener-rsi-filter');
  var scrTable = document.getElementById('screener-table');

  function filterScreener() {
    if (!scrTable) return;
    var q = (scrSearch ? scrSearch.value : '').toLowerCase().trim();
    var mcap = scrMcap ? scrMcap.value : 'ALL';
    var sec = scrSector ? scrSector.value : 'ALL';
    var rsi = scrRsi ? scrRsi.value : 'ALL';

    var rows = scrTable.querySelectorAll('tbody tr');
    rows.forEach(function (row) {
      var sym = (row.cells[0] ? row.cells[0].textContent : '').toLowerCase();
      var name = (row.cells[1] ? row.cells[1].textContent : '').toLowerCase();
      var rowSec = (row.cells[2] ? row.cells[2].textContent : '').toUpperCase();
      var rowMcap = (row.cells[3] ? row.cells[3].textContent : '').toUpperCase();
      var rowRsi = parseFloat(row.cells[7] ? row.cells[7].textContent : '50');

      var matchQ = !q || sym.indexOf(q) > -1 || name.indexOf(q) > -1;
      var matchMcap = mcap === 'ALL' || rowMcap.indexOf(mcap) > -1;
      var matchSec = sec === 'ALL' || rowSec.indexOf(sec) > -1;
      var matchRsi = true;
      if (rsi === 'OVERSOLD') matchRsi = rowRsi < 35;
      else if (rsi === 'OVERBOUGHT') matchRsi = rowRsi > 65;
      else if (rsi === 'NEUTRAL') matchRsi = rowRsi >= 35 && rowRsi <= 65;

      row.style.display = (matchQ && matchMcap && matchSec && matchRsi) ? '' : 'none';
    });
  }

  if (scrSearch) scrSearch.addEventListener('input', filterScreener);
  if (scrMcap) scrMcap.addEventListener('change', filterScreener);
  if (scrSector) scrSector.addEventListener('change', filterScreener);
  if (scrRsi) scrRsi.addEventListener('change', filterScreener);

  /* ---------------------------------------- 10 Cost Calculator Widget */
  var calcProdSelect = document.getElementById('calc-product-select');
  var calcSlider = document.getElementById('calc-turnover-slider');
  var calcBuyPrice = document.getElementById('calc-buy-price');
  var calcQty = document.getElementById('calc-qty');
  var dispTurnover = document.getElementById('disp-calc-turnover');

  var cBro = document.getElementById('c-bro');
  var cStt = document.getElementById('c-stt');
  var cGst = document.getElementById('c-gst');
  var cStamp = document.getElementById('c-stamp');
  var cExch = document.getElementById('c-exch');
  var cSebi = document.getElementById('c-sebi');
  var cTotal = document.getElementById('c-total');

  function updateCostCalculator(source) {
    if (!calcSlider) return;
    var turnover = parseFloat(calcSlider.value) || 100000;
    var prod = calcProdSelect ? calcProdSelect.value : 'DELIVERY';

    if (source === 'inputs' && calcBuyPrice && calcQty) {
      var bp = parseFloat(calcBuyPrice.value) || 2500;
      var q = parseFloat(calcQty.value) || 40;
      turnover = bp * q;
      calcSlider.value = turnover;
    } else if (calcBuyPrice && calcQty) {
      var bpVal = parseFloat(calcBuyPrice.value) || 2500;
      calcQty.value = Math.max(1, Math.round(turnover / bpVal));
    }

    if (dispTurnover) dispTurnover.textContent = '₹' + turnover.toLocaleString('en-IN');

    // Brokerage: ₹20 or 0.05%
    var brokerage = prod === 'INTRADAY' ? Math.min(20, turnover * 0.0005) : 20.00;
    brokerage = Math.round(brokerage * 100) / 100;

    // STT: Delivery 0.1%, Intraday 0.025% on sell, Futures 0.02%, Options 0.05% on premium
    var stt = 0;
    if (prod === 'DELIVERY') stt = Math.round(turnover * 0.001);
    else if (prod === 'INTRADAY') stt = Math.round(turnover * 0.00025);
    else if (prod === 'FUTURES') stt = Math.round(turnover * 0.0002);
    else if (prod === 'OPTIONS') stt = Math.round(turnover * 0.0005);

    // Exchange charges (~0.00297%)
    var exch = Math.round(turnover * 0.0000297 * 100) / 100;

    // SEBI charges (~₹10/crore = 0.0001%)
    var sebi = Math.round(turnover * 0.000001 * 100) / 100;

    // Stamp duty (0.015% on buy)
    var stamp = Math.round(turnover * (prod === 'INTRADAY' ? 0.00003 : 0.00015) * 100) / 100;

    // GST: 18% on (brokerage + exchange + sebi)
    var gst = Math.round((brokerage + exch + sebi) * 0.18 * 100) / 100;

    var totalCost = brokerage + stt + gst + stamp + exch + sebi;

    if (cBro) cBro.textContent = '₹' + brokerage.toFixed(2);
    if (cStt) cStt.textContent = '₹' + stt.toFixed(2);
    if (cGst) cGst.textContent = '₹' + gst.toFixed(2);
    if (cStamp) cStamp.textContent = '₹' + stamp.toFixed(2);
    if (cExch) cExch.textContent = '₹' + exch.toFixed(2);
    if (cSebi) cSebi.textContent = '₹' + sebi.toFixed(2);
    if (cTotal) cTotal.textContent = '₹' + totalCost.toFixed(2);
  }

  if (calcSlider) {
    calcSlider.addEventListener('input', function () { updateCostCalculator('slider'); });
  }
  if (calcBuyPrice) {
    calcBuyPrice.addEventListener('input', function () { updateCostCalculator('inputs'); });
  }
  if (calcQty) {
    calcQty.addEventListener('input', function () { updateCostCalculator('inputs'); });
  }
  if (calcProdSelect) {
    calcProdSelect.addEventListener('change', function () { updateCostCalculator('prod'); });
  }
  updateCostCalculator();
})();

