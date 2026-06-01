/* ================================================================
   app.js — BudgetWise
   ================================================================ */

/* ================================================================
   CONFIGURATION
   Keys are loaded from Vercel Environment Variables via a small
   inline <script> in index.html that sets window.__env.
   For local dev, create a `.env` file and use a dev server,
   OR temporarily hardcode test keys (pk_test_... only) here.
   ================================================================ */

const PAYSTACK_PUBLIC_KEY = 'pk_live_1c4936cf2f7b49454c7c772d5a6bf618898bd4e5';
const PAYSTACK_CURRENCY   = 'KES';

const PAYSTACK_PRICES = {
  pro:                { amount: 49900,  label: 'BudgetWise Pro — KES 499/mo',          plan: 'PLN_cuik8bupbldbxdu' },
  annual:             { amount: 359900, label: 'BudgetWise Annual Pro — KES 3,599/yr', plan: 'PLN_10kb4gdfrtwi21i' },
  tax_report:         { amount: 29900,  label: '2025 Tax Report — KES 299'           },
  investment_tracker: { amount: 49900,  label: 'Investment Tracker — KES 499'        },
  family_pack:        { amount: 79900,  label: 'Family Budget Pack — KES 799'        },
  net_worth:          { amount: 19900,  label: 'Net Worth Snapshot — KES 199'        },
};

const SUPABASE_URL      = 'https://eijegtikhnxjhofxdfwq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpamVndGlraG54amhvZnhkZndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDk3OTgsImV4cCI6MjA5NTgyNTc5OH0.0PzySvMMqWuzRlM6zxC6Am-84WW7q4C17IgvrYK812Q';

// PLAID (optional — build backend endpoints to enable)
const PLAID_LINK_TOKEN_ENDPOINT = '/api/create-link-token';
const PLAID_EXCHANGE_ENDPOINT   = '/api/exchange-token';

/* ================================================================
   SUPABASE CLIENT INIT
   ================================================================ */
let supabase = null;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn('Supabase init failed:', e);
}

/* ================================================================
   PAYSTACK CHECKOUT
   ================================================================ */
function paystackCheckout(planKey) {
  const config = PAYSTACK_PRICES[planKey];
  if (!config) { showToast('Unknown plan: ' + planKey, 'error'); return; }

  const getUserEmail = async () => {
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) return session.user.email;
    }
    return await promptEmailModal(config.label);
  };

  getUserEmail().then(email => {
    if (!email) return;
    const ref = 'BW-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    const hasplan = Boolean(config.plan);

    const paystack = new PaystackPop();
    paystack.newTransaction({
      key:      PAYSTACK_PUBLIC_KEY,
      email:    email,
      amount:   config.amount,
      currency: PAYSTACK_CURRENCY,
      ref:      ref,
      label:    config.label,
      ...(hasplan ? { plan: config.plan } : {}),
      onSuccess: (tx) => {
        showToast('Payment successful! Ref: ' + tx.reference);
        // TODO: verify on your backend → POST /api/verify-payment { reference }
      },
      onCancel: () => showToast('Payment cancelled — no charge made.', 'error'),
    });
  });
}

/* Email prompt for unauthenticated checkout */
function promptEmailModal(productLabel) {
  return new Promise(resolve => {
    currentModalType = '_emailPrompt';
    document.getElementById('modalContent').innerHTML = `
      <h3>Enter your email</h3>
      <p style="font-size:14px;color:var(--text2);margin-bottom:1rem">
        To purchase <strong>${productLabel}</strong>, enter the email for your receipt.
      </p>
      <input class="modal-input" id="mPayEmail" placeholder="Email address" type="email"/>
      <div class="modal-error" id="modalError"></div>
      <div class="modal-btns">
        <button class="modal-close" onclick="closeModal()">Cancel</button>
        <button class="modal-submit" onclick="
          var v=document.getElementById('mPayEmail').value.trim();
          if(!v||!v.includes('@')){
            var e=document.getElementById('modalError');
            e.textContent='Enter a valid email';e.classList.add('visible');return;
          }
          closeModal();window.__emailResolve(v);
        ">Continue to payment</button>
      </div>`;
    document.getElementById('modalOverlay').classList.add('open');
    window.__emailResolve = resolve;
  });
}

/* ================================================================
   MODAL SYSTEM
   ================================================================ */
let currentModalType = '';

const modalTemplates = {
  signup: {
    title: 'Create your free account',
    desc:  'Start tracking your money in 2 minutes. No credit card needed.',
    fields: `
      <input class="modal-input" id="mName"     placeholder="Full name"/>
      <input class="modal-input" id="mEmail"    placeholder="Email address" type="email"/>
      <input class="modal-input" id="mPassword" placeholder="Password (min 6 chars)" type="password"/>
      <div class="modal-error" id="modalError"></div>`,
    btn: 'Create free account',
    async submit() {
      const name  = document.getElementById('mName').value.trim();
      const email = document.getElementById('mEmail').value.trim();
      const pass  = document.getElementById('mPassword').value;
      if (!name || !email || !pass) { showModalError('Please fill in all fields.'); return; }
      if (pass.length < 6)          { showModalError('Password must be at least 6 characters.'); return; }
      if (!supabase) { showModalError('Auth not configured — add Supabase keys to Vercel env vars.'); return; }
      setSubmitLoading(true);
      await supabaseSignUp(email, pass, name);
      setSubmitLoading(false);
    },
  },

  signin: {
    title: 'Sign in to BudgetWise',
    desc:  'Welcome back.',
    fields: `
      <input class="modal-input" id="mEmail"    placeholder="Email address" type="email"/>
      <input class="modal-input" id="mPassword" placeholder="Password" type="password"/>
      <div class="modal-error" id="modalError"></div>`,
    btn: 'Sign in',
    async submit() {
      const email = document.getElementById('mEmail').value.trim();
      const pass  = document.getElementById('mPassword').value;
      if (!email || !pass) { showModalError('Please fill in all fields.'); return; }
      if (!supabase) { showModalError('Auth not configured — add Supabase keys to Vercel env vars.'); return; }
      setSubmitLoading(true);
      await supabaseSignIn(email, pass);
      setSubmitLoading(false);
    },
  },

  pro: {
    title: 'Start BudgetWise Pro',
    desc:  'Unlimited features, no ads — KES 499/month. Pay with M-Pesa, Visa, Mastercard, or bank transfer.',
    fields: '', btn: 'Continue to payment →',
    submit() { closeModal(); paystackCheckout('pro'); },
  },

  annual: {
    title: 'Annual Pro — Best value',
    desc:  'All Pro features for KES 3,599/year (40% off). Pay with M-Pesa, card, or bank transfer.',
    fields: '', btn: 'Continue to payment →',
    submit() { closeModal(); paystackCheckout('annual'); },
  },

  upgrade: {
    title: 'Upgrade to Pro',
    desc:  'Unlock bill predictions, unlimited goals, and an ad-free experience.',
    fields: '', btn: 'Upgrade — KES 499/mo',
    submit() { closeModal(); paystackCheckout('pro'); },
  },
};

function openModal(type) {
  currentModalType = type;
  const tpl = modalTemplates[type] || modalTemplates.signup;
  document.getElementById('modalContent').innerHTML = `
    <h3>${tpl.title}</h3>
    <p>${tpl.desc}</p>
    ${tpl.fields}
    <div class="modal-btns">
      <button class="modal-close" onclick="closeModal()">Cancel</button>
      <button class="modal-submit" id="modalSubmitBtn" onclick="submitModal()">${tpl.btn}</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  if (currentModalType === '_emailPrompt' && window.__emailResolve) {
    window.__emailResolve(null);
    window.__emailResolve = null;
  }
}

async function submitModal() {
  const tpl = modalTemplates[currentModalType];
  if (tpl?.submit) await tpl.submit();
}

function showModalError(msg) {
  const el = document.getElementById('modalError');
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}

function setSubmitLoading(on) {
  const btn = document.getElementById('modalSubmitBtn');
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? 'Please wait…' : (modalTemplates[currentModalType]?.btn || 'Submit');
}

/* ================================================================
   SUPABASE AUTH
   ================================================================ */
async function supabaseSignUp(email, password, name) {
  if (!supabase) { showToast('Auth not ready — check console.', 'error'); return false; }
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name } },
  });
  if (error) { showModalError(error.message); return false; }
  closeModal();
  showToast(data.user?.identities?.length === 0
    ? 'Email already registered — try signing in.'
    : 'Account created! Check your email to confirm.');
  return true;
}

async function supabaseSignIn(email, password) {
  if (!supabase) { showToast('Auth not ready — check console.', 'error'); return false; }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { showModalError(error.message); return false; }
  closeModal();
  showToast('Welcome back!');
  return true;
}

/* ================================================================
   PLAID LINK  (enabled once you build the backend endpoints)
   ================================================================ */
async function openPlaidLink() {
  if (!window.Plaid) { showToast('Plaid SDK not loaded.', 'error'); return; }
  if (PLAID_LINK_TOKEN_ENDPOINT === '/api/create-link-token') {
    showToast('Build /api/create-link-token on your backend to enable bank sync.');
    return;
  }
  let linkToken;
  try {
    const res = await fetch(PLAID_LINK_TOKEN_ENDPOINT, { method: 'POST' });
    if (!res.ok) throw new Error('Status ' + res.status);
    linkToken = (await res.json()).link_token;
  } catch (err) {
    showToast('Could not get Plaid token: ' + err.message, 'error');
    return;
  }
  window.Plaid.create({
    token: linkToken,
    onSuccess: async (pub, meta) => {
      try {
        await fetch(PLAID_EXCHANGE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: pub, metadata: meta }),
        });
        showToast('Bank connected: ' + (meta.institution?.name || 'Done'));
      } catch (e) { showToast('Token exchange failed.', 'error'); }
    },
    onExit: (err) => { if (err) console.warn('Plaid exit:', err); },
  }).open();
}

/* ================================================================
   TOAST
   ================================================================ */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.remove('error');
  if (type === 'error') t.classList.add('error');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

/* ================================================================
   MINI BAR CHART
   ================================================================ */
(function () {
  const cats = ['Groceries','Dining','Transport','Entertain.','Health'];
  const vals = [340, 176, 60, 95, 45];
  const cols = ['#3ddc84','#f5b942','#5baaf5','#f06060','#a78bfa'];
  const max  = Math.max(...vals);
  const bc   = document.getElementById('miniBarChart');
  const bl   = document.getElementById('miniBarLabels');
  if (!bc || !bl) return;
  cats.forEach((c, i) => {
    const bar = document.createElement('div');
    bar.style.cssText = `flex:1;border-radius:3px 3px 0 0;background:${cols[i]};height:${Math.round(vals[i]/max*100)}%;transition:.3s`;
    bc.appendChild(bar);
    const lbl = document.createElement('div');
    lbl.style.cssText = 'flex:1;text-align:center;font-size:10px;color:var(--text3)';
    lbl.textContent = c;
    bl.appendChild(lbl);
  });
})();

/* ================================================================
   APP SWITCHER / FAQ / SCROLL REVEAL
   ================================================================ */
function switchApp(id, el) {
  document.querySelectorAll('.app-content-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('app' + id.charAt(0).toUpperCase() + id.slice(1));
  if (page) page.classList.add('active');
  if (el) setActive(el);
}

function setActive(el) {
  document.querySelectorAll('.app-nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  const was  = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!was) item.classList.add('open');
}

const ro = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => ro.observe(el));
