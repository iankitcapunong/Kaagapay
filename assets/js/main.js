/* ==========================================================================
   Kaagapay — site script
   All loan pricing lives in LOAN_CONFIG. Change it here and every number on
   the site (calculator, representative example, apply summary) follows.
   Make sure these values match your SEC licence and the BSP interest caps
   that apply to your loan product before going live.
   ========================================================================== */

const LOAN_CONFIG = {
  // TODO(owner): PLACEHOLDER RATE. Replace with your actual licensed monthly rate before launch.
  monthlyRate: 0.015,        // 1.5% per month, add-on (flat) interest on the amount borrowed
  processingFee: 0,          // flat peso fee; 0 = no fee
  daysPerMonth: 30,
  min: 100000,               // ₱100,000
  max: 2000000,              // ₱2,000,000
  step: 10000,               // slider moves in ₱10,000 steps
  terms: [6, 12, 18, 24, 36, 48, 60],   // months
  default: { amount: 500000, term: 24 },
  example: { amount: 500000, term: 24 },   // worked example shown in the Costs section
};

const peso = (n, dp = 2) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: dp, maximumFractionDigits: dp });

// Short peso for range labels: ₱100K, ₱2M
const pesoShort = n => n >= 1e6 ? `₱${+(n / 1e6).toFixed(2)}M` : `₱${+(n / 1e3).toFixed(0)}K`;

function quote(amount, months) {
  const interest = amount * LOAN_CONFIG.monthlyRate * months;
  const fee = LOAN_CONFIG.processingFee;
  const total = amount + interest + fee;
  return {
    amount, months, days: months * LOAN_CONFIG.daysPerMonth, interest, fee, total,
    installment: total / months,
    monthlyRate: LOAN_CONFIG.monthlyRate,
    annualRate: LOAN_CONFIG.monthlyRate * 12,
  };
}

function firstDueDate(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + LOAN_CONFIG.daysPerMonth);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const pct = (x, dp = 1) => +(x * 100).toFixed(dp) + "%";

/* ---------- Motion helpers ---------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.add("js-anim");

// Count a number up/down to its new value. Restarts smoothly from whatever is on screen.
function tween(el, to, fmt, dur = 380) {
  if (!el) return;
  cancelAnimationFrame(el._raf);
  const from = el._cur;
  if (reduceMotion || from == null || from === to) {
    el._cur = to;
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el._cur = from + (to - from) * e;
    el.textContent = fmt(p === 1 ? to : el._cur);
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

// Re-trigger a one-shot CSS animation class
function replay(el, cls) {
  if (!el || reduceMotion) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
}

/* ---------- Scroll reveal ---------- */
(function reveal() {
  const sel = [
    ".section-head", ".steps li", ".product", ".audience", ".repay-card", ".costs-main", ".costs-fees", ".never-strip", ".costs-head",
    ".req-col", ".faq-list details", ".faq-layout > div:first-child", ".callout", ".channel",
    ".panel", ".partner-box", ".numbered li", ".cta-band .wrap > *", ".payout .wrap", ".audience-note",
    ".prose > *", ".form-card", ".next-steps", ".loan-type", ".doc-list li", ".facts-card",
  ].join(",");
  const items = [...document.querySelectorAll(sel)].filter(el => !el.closest(".hero"));
  if (reduceMotion || !("IntersectionObserver" in window)) return;

  items.forEach(el => {
    el.classList.add("reveal");
    const sibs = [...el.parentElement.children].filter(c => c.matches(sel));
    el.style.setProperty("--i", Math.min(sibs.indexOf(el), 6));
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      io.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  items.forEach(el => io.observe(el));
})();

/* ---------- Header shadow on scroll ---------- */
(function headerShadow() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();

/* ---------- Mobile nav ---------- */
(function nav() {
  const header = document.querySelector(".site-header");
  const btn = document.querySelector(".nav-toggle");
  if (!header || !btn) return;
  btn.addEventListener("click", () => {
    const open = header.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  header.querySelectorAll(".nav a").forEach(a =>
    a.addEventListener("click", () => {
      header.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    })
  );
})();

/* ---------- Fill any [data-cfg] text from config ---------- */
(function fillConfig() {
  const C = LOAN_CONFIG;
  const map = {
    monthly: pct(C.monthlyRate, 2),
    annual: pct(C.monthlyRate * 12),
    fee: C.processingFee ? peso(C.processingFee, 0) : "₱0",
    min: peso(C.min, 0),
    max: peso(C.max, 0),
    minShort: pesoShort(C.min),
    maxShort: pesoShort(C.max),
    terms: `${Math.min(...C.terms)}–${Math.max(...C.terms)} months`,
  };
  document.querySelectorAll("[data-cfg]").forEach(el => {
    const v = map[el.dataset.cfg];
    if (v != null) el.textContent = v;
  });
})();

/* ---------- Worked example (Costs section) ---------- */
(function example() {
  const root = document.getElementById("example");
  if (!root) return;
  const q = quote(LOAN_CONFIG.example.amount, LOAN_CONFIG.example.term);
  const set = (k, v) => root.querySelectorAll(`[data-ex="${k}"]`).forEach(el => (el.textContent = v));
  set("amount", peso(q.amount, 0));
  set("principal", peso(q.amount));
  set("term", `${q.months} months`);
  set("months", q.months);
  set("monthly", pct(LOAN_CONFIG.monthlyRate, 2));
  set("interest", peso(q.interest));
  set("fee", peso(q.fee));
  set("total", peso(q.total));
  set("installment", peso(q.installment));
  set("annual", pct(q.annualRate));

  // Proportion bar: how much of the total is your loan vs interest
  const bar = k => root.querySelector(`[data-ex-bar="${k}"]`);
  if (bar("principal")) bar("principal").style.flexGrow = q.amount;
  if (bar("interest")) bar("interest").style.flexGrow = q.interest + q.fee;

  // First and last due dates (a long schedule is summarised, not listed)
  const fmt = d => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const due = n => { const d = new Date(); d.setMonth(d.getMonth() + n); return fmt(d); };
  set("first-due", due(1));
  set("last-due", due(q.months));
})();

/* ---------- Hero calculator ---------- */
(function calculator() {
  const root = document.getElementById("calc");
  if (!root) return;
  const C = LOAN_CONFIG;

  const range = root.querySelector("#calc-amount");
  const amountOut = root.querySelector("[data-out='amount']");
  const termsBox = root.querySelector(".terms");
  const cta = root.querySelector("[data-out='cta']");
  const out = k => root.querySelector(`[data-out='${k}']`);

  let amount = C.default.amount;
  let term = C.default.term;

  function renderTerms() {
    termsBox.innerHTML = "";
    C.terms.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "term";
      b.dataset.term = m;
      b.setAttribute("aria-pressed", String(m === term));
      b.innerHTML = `${m} <small>mo</small>`;
      b.style.setProperty("--i", i);
      b.addEventListener("click", () => {
        if (term === m) return;
        term = m;
        termsBox.querySelectorAll(".term").forEach(x => x.setAttribute("aria-pressed", String(+x.dataset.term === m)));
        render(true);
      });
      termsBox.appendChild(b);
    });
  }

  function render(pulse = false) {
    range.min = C.min;
    range.max = C.max;
    range.step = C.step;
    range.value = amount;
    range.style.setProperty("--pct", ((amount - C.min) / (C.max - C.min)) * 100 + "%");
    range.setAttribute("aria-valuetext", peso(amount, 0));

    const q = quote(amount, term);
    tween(amountOut, amount, v => peso(Math.round(v / 1000) * 1000, 0), 260);
    out("min").textContent = pesoShort(C.min);
    out("max").textContent = pesoShort(C.max);
    tween(out("interest"), q.interest, v => peso(v, 0));
    tween(out("total"), q.total, v => peso(v, 0));
    tween(out("installment"), q.installment, v => peso(v));
    out("months").textContent = `× ${q.months} months`;
    if (pulse) {
      replay(out("total"), "pop");
      replay(out("installment"), "pop");
    }
    out("rate").textContent = `${pct(C.monthlyRate, 2)} per month`;
    cta.textContent = `Apply for ${peso(amount, 0)}`;
    cta.href = `apply.html?amount=${amount}&term=${term}`;
  }

  range.addEventListener("input", () => { amount = Number(range.value); render(); });

  renderTerms();
  render();
})();

/* ---------- Tabs (repay page) ---------- */
(function tabs() {
  document.querySelectorAll("[role='tablist']").forEach(list => {
    const buttons = [...list.querySelectorAll("[role='tab'][aria-controls]")];
    if (!buttons.length) return;
    const select = btn => {
      buttons.forEach(b => {
        const on = b === btn;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
      });
    };
    buttons.forEach((b, i) => {
      b.addEventListener("click", () => select(b));
      b.addEventListener("keydown", e => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const next = buttons[(i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
        next.focus();
        select(next);
      });
    });
  });
})();

/* ---------- Apply form (single page, front-end only) ---------- */
(function apply() {
  const form = document.getElementById("apply-form");
  if (!form) return;

  const $ = name => form.querySelector(`[name='${name}']`);
  const productSel = $("product"), amountIn = $("amount"), termSel = $("term"), incomeSel = $("income_type");
  const estimate = form.querySelector("[data-estimate]");
  const est = k => form.querySelector(`[data-est='${k}']`);
  const amountErr = form.querySelector("[data-err='amount']");
  const C = LOAN_CONFIG;

  // Sangla (collateral) loans also ask for vehicle/property details; amount is subject to appraisal
  const SANGLA = {
    "car-orcr":    { collateral: "vehicle",  word: "Car" },
    "moto-orcr":   { collateral: "vehicle",  word: "Motorcycle" },
    "real-estate": { collateral: "property", word: "" },
  };
  const amountHelp = form.querySelector("[data-help='amount']");
  const collateralSets = [...form.querySelectorAll("[data-collateral]")];

  function showCollateral(kind, word) {
    collateralSets.forEach(fs => {
      const on = fs.dataset.collateral === kind;
      const wasHidden = fs.hidden;
      fs.hidden = !on;
      fs.disabled = !on;                       // disabled fields are skipped by validation and not submitted
      if (on && wasHidden) replay(fs, "est-in");
    });
    const w = form.querySelector("[data-vehicle-word]");
    if (w && word) w.textContent = word;
  }

  // One amount range and one set of terms for every loan type
  amountIn.min = C.min; amountIn.max = C.max; amountIn.step = 1000;
  amountIn.placeholder = `e.g. ${C.default.amount.toLocaleString("en-PH")}`;
  amountErr.textContent = `Enter an amount from ${peso(C.min, 0)} to ${peso(C.max, 0)}.`;
  termSel.innerHTML = `<option value="">Choose one</option>` +
    C.terms.map(m => `<option value="${m}">${m} months</option>`).join("");

  function syncProduct() {
    const sangla = SANGLA[productSel.value];
    amountHelp.hidden = !sangla;
    showCollateral(sangla ? sangla.collateral : null, sangla && sangla.word);
  }

  function updateEstimate() {
    const amount = Number(amountIn.value), term = Number(termSel.value);
    const ok = term && amountIn.value !== "" && amountIn.checkValidity();
    if (!ok) { estimate.hidden = true; return; }
    const q = quote(amount, term);
    const wasHidden = estimate.hidden;
    estimate.hidden = false;
    tween(est("installment"), q.installment, v => peso(v));
    tween(est("total"), q.total, v => peso(v));
    tween(est("interest"), q.interest, v => peso(v));
    if (wasHidden) replay(estimate, "est-in");
  }

  // Prefill from the calculator, a loan page, or a "Who we lend to" link
  const params = new URLSearchParams(location.search);
  let wanted = params.get("product");
  if (wanted === "first" || wanted === "returning") wanted = "personal";   // old links
  if (wanted && productSel.querySelector(`option[value='${CSS.escape(wanted)}']`)) productSel.value = wanted;
  const income = params.get("income");
  if (income && incomeSel.querySelector(`option[value='${CSS.escape(income)}']`)) incomeSel.value = income;
  if (C.terms.includes(Number(params.get("term")))) termSel.value = params.get("term");
  if (params.get("amount")) amountIn.value = params.get("amount");
  syncProduct();
  updateEstimate();

  productSel.addEventListener("change", () => { syncProduct(); updateEstimate(); });
  amountIn.addEventListener("input", updateEstimate);
  termSel.addEventListener("change", updateEstimate);

  // Validation: shake invalid fields, clear errors as soon as they're fixed
  const fieldOf = el => el.closest(".field") || el.closest(".consent");
  function check(el, shake) {
    const valid = el.checkValidity();
    el.setAttribute("aria-invalid", String(!valid));
    const field = fieldOf(el);
    if (field) {
      field.classList.toggle("has-err", !valid);
      if (!valid && shake) replay(field, "shake");
    }
    return valid;
  }
  ["input", "change"].forEach(t => form.addEventListener(t, e => {
    const field = fieldOf(e.target);
    if (field && field.classList.contains("has-err")) check(e.target, false);
  }));

  form.addEventListener("submit", e => {
    e.preventDefault();
    let firstBad = null;
    form.querySelectorAll("input:not([type='hidden']):not([name='website']), select").forEach(el => {
      if (!check(el, true) && !firstBad) firstBad = el;
    });
    if (firstBad) return firstBad.focus();
    if ($("website").value) return; // spam trap filled: drop silently

    // TODO: send new FormData(form) to your backend / CRM here, then text the
    // applicant a secure link for ID and selfie verification.
    const first = $("full_name").value.trim().split(/\s+/)[0];
    const mobile = $("mobile").value;
    const msg = document.createElement("div");
    msg.className = "done-msg form-card";
    msg.innerHTML = `
      <span class="eyebrow">Application received</span>
      <h2></h2>
      <p>We'll review it and contact you at <strong></strong>, usually within the same business day.
      Next, we'll text you a secure link to upload your ID and a selfie.</p>
      <p>We will never ask you to pay anything before your loan is released.</p>
      <a class="btn btn-ghost" href="index.html">Back to home</a>`;
    msg.querySelector("h2").textContent = `Salamat, ${first}! We got your application.`;
    msg.querySelector("strong").textContent = mobile;
    form.replaceWith(msg);
    msg.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  });
})();

/* ---------- Call-back form (contact page, front-end only) ---------- */
(function callback() {
  const form = document.getElementById("callback-form");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    let firstBad = null;
    form.querySelectorAll("input, select, textarea").forEach(el => {
      const field = el.closest(".field") || el.closest(".consent");
      const valid = el.checkValidity();
      el.setAttribute("aria-invalid", String(!valid));
      if (field) {
        field.classList.toggle("has-err", !valid);
        if (!valid) replay(field, "shake");
      }
      if (!valid && !firstBad) firstBad = el;
    });
    if (firstBad) return firstBad.focus();
    if (form.querySelector("[name='website']").value) return;

    // TODO: send FormData(form) to your backend or CRM here.
    form.innerHTML = `
      <div class="done-msg">
        <span class="eyebrow">Request received</span>
        <h2>We'll call you back.</h2>
        <p>Expect a call from our official hotline during office hours. We'll never ask for a fee or your OTP over the phone.</p>
      </div>`;
  });
})();

/* ---------- Footer year ---------- */
document.querySelectorAll("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));
