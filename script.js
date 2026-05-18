const FX = { USD: 1, EUR: 0.92, MXN: 16.8, COP: 3900 };
const SYMBOL = { USD: '$', EUR: '€', MXN: '$', COP: '$' };

function currentCurrency() { return localStorage.getItem('nova_currency') || 'USD'; }
function convert(valueUSD) { return (Number(valueUSD) || 0) * FX[currentCurrency()]; }
function currency(valueUSD) { return `${SYMBOL[currentCurrency()]}${Math.round(convert(valueUSD)).toLocaleString('es-ES')}`; }

function riskCap(risk) { if (risk === 'conservative') return 0.25; if (risk === 'balanced') return 0.4; return 0.55; }

function calculatePlan(profile) {
  const income = Number(profile.income || 0), essentials = Number(profile.essentials || 0);
  const hasDebt = profile.hasDebt === 'yes', debtMin = hasDebt ? Number(profile.debtMin || 0) : 0;
  const emergency = Number(profile.emergency || 0), emergencyMonths = Number(profile.emergencyMonths || 3);
  const risk = profile.risk || 'balanced';
  const emergencyTarget = essentials * emergencyMonths, emergencyRatio = emergencyTarget > 0 ? emergency / emergencyTarget : 0;
  const surplus = income - essentials - debtMin;
  let alloc = { debt: 0, emergency: 0, investing: 0, goals: 0, liquidity: 0 };
  if (surplus > 0) {
    if (hasDebt) {
      if (emergencyRatio < (1 / emergencyMonths)) alloc = { debt: surplus * 0.6, emergency: surplus * 0.4, investing: 0, goals: 0, liquidity: 0 };
      else if (emergencyRatio < 1) alloc = { debt: surplus * 0.5, emergency: surplus * 0.3, investing: surplus * 0.2, goals: 0, liquidity: 0 };
      else alloc = { debt: surplus * 0.65, emergency: 0, investing: surplus * 0.25, goals: surplus * 0.1, liquidity: 0 };
    } else if (emergencyRatio < 1) alloc = { debt: 0, emergency: surplus * 0.5, investing: surplus * 0.3, goals: surplus * 0.2, liquidity: 0 };
    else alloc = { debt: 0, emergency: 0, investing: surplus * 0.55, goals: surplus * 0.25, liquidity: surplus * 0.2 };
    const maxInvest = surplus * riskCap(risk);
    if (alloc.investing > maxInvest) { const extra = alloc.investing - maxInvest; alloc.investing = maxInvest; alloc.emergency += extra; }
  }
  return { income, essentials, debtMin, emergency, emergencyTarget, surplus, alloc, hasDebt, profile };
}

function getProfile() {
  const saved = JSON.parse(localStorage.getItem('nova_profile') || '{}');
  return Object.keys(saved).length ? saved : { income: 2500, essentials: 1500, hasDebt: 'yes', debtMin: 220, emergency: 300, emergencyMonths: 3, risk: 'balanced', goalName: 'Viaje', goalAmount: 2000 };
}

function drawAllocationChart(canvas, alloc) {
  if (!canvas) return; const ctx = canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight; canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const entries = [['Deuda', alloc.debt, '#f59e0b'], ['Emergencia', alloc.emergency, '#22c55e'], ['Inversión', alloc.investing, '#5b8cff'], ['Metas', alloc.goals + alloc.liquidity, '#c084fc']].filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  entries.forEach(([label, value, color], i) => { const y = 22 + i * 46; const width = (value / total) * (w - 170); ctx.fillStyle = 'rgba(148,163,184,0.18)'; ctx.fillRect(120, y, w - 150, 28); ctx.fillStyle = color; ctx.fillRect(120, y, width, 28); ctx.fillStyle = '#E6ECFF'; ctx.font = '600 12px Inter'; ctx.fillText(label, 14, y + 18); ctx.fillText(currency(value), Math.min(w - 135, 128 + width), y + 18); });
}

function initCurrencySelector() {
  document.querySelectorAll('#currency').forEach((s) => {
    s.value = currentCurrency();
    s.addEventListener('change', () => { localStorage.setItem('nova_currency', s.value); window.location.reload(); });
  });
}

function initOnboarding() {
  const form = document.getElementById('onboarding-form'); if (!form) return;
  form.addEventListener('submit', (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(form).entries()); localStorage.setItem('nova_profile', JSON.stringify(data)); window.location.href = 'dashboard.html'; });
}

function initDashboardLike() {
  const plan = calculatePlan(getProfile());
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('kpi-surplus', currency(Math.max(0, plan.surplus))); set('kpi-debt', currency(plan.alloc.debt)); set('kpi-emergency', currency(plan.alloc.emergency)); set('kpi-invest', currency(plan.alloc.investing));
  set('debt-extra', currency(plan.alloc.debt)); set('debt-weekly', currency(plan.alloc.debt / 4));
  set('save-month', currency(plan.alloc.emergency)); set('goal-name', plan.profile.goalName || 'Meta principal'); set('goal-amount', currency(Number(plan.profile.goalAmount || 0)));
  set('emergency-progress', `${currency(plan.emergency)} de ${currency(plan.emergencyTarget)} objetivo`);
  set('invest-month', currency(plan.alloc.investing)); set('invest-weekly', currency(plan.alloc.investing / 4));

  const userData = document.getElementById('user-data');
  if (userData) userData.innerHTML = `<p>Ingreso: <strong>${currency(plan.income)}</strong></p><p>Gastos esenciales: <strong>${currency(plan.essentials)}</strong></p><p>Tiene deuda: <strong>${plan.hasDebt ? 'Sí' : 'No'}</strong></p><p>Pago mínimo deuda: <strong>${currency(plan.debtMin)}</strong></p>`;
  const goalData = document.getElementById('goal-data');
  if (goalData) goalData.innerHTML = `<p>Objetivo: <strong>${plan.profile.goalName || 'Meta principal'}</strong></p><p>Monto objetivo: <strong>${currency(Number(plan.profile.goalAmount || 0))}</strong></p><p>Fondo emergencia objetivo: <strong>${currency(plan.emergencyTarget)}</strong></p>`;
  const weekly = Object.fromEntries(Object.entries(plan.alloc).map(([k, v]) => [k, v / 4]));
  const actions = document.getElementById('weekly-actions');
  if (actions) actions.innerHTML = `<li>Transferir ${currency(weekly.emergency)} al fondo de emergencia.</li><li>${plan.hasDebt ? `Pagar ${currency(weekly.debt)} extra a deuda prioritaria.` : `Aportar ${currency(weekly.goals)} a meta ${plan.profile.goalName || ''}.`}</li><li>Invertir ${currency(weekly.investing)} en ETFs diversificados.</li>`;
  drawAllocationChart(document.getElementById('allocationChart'), plan.alloc);
}

document.querySelectorAll('.reveal').forEach((el) => new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible')), { threshold: 0.15 }).observe(el));
initCurrencySelector(); initOnboarding(); initDashboardLike();
