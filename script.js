function currency(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function riskCap(risk) {
  if (risk === 'conservative') return 0.25;
  if (risk === 'balanced') return 0.4;
  return 0.55;
}

function calculatePlan(profile) {
  const income = Number(profile.income || 0);
  const essentials = Number(profile.essentials || 0);
  const hasDebt = profile.hasDebt === 'yes';
  const debtMin = hasDebt ? Number(profile.debtMin || 0) : 0;
  const emergency = Number(profile.emergency || 0);
  const emergencyMonths = Number(profile.emergencyMonths || 3);
  const risk = profile.risk || 'balanced';

  const emergencyTarget = essentials * emergencyMonths;
  const emergencyRatio = emergencyTarget > 0 ? emergency / emergencyTarget : 0;
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
    if (alloc.investing > maxInvest) {
      const extra = alloc.investing - maxInvest;
      alloc.investing = maxInvest;
      alloc.emergency += extra;
    }
  }

  return { income, essentials, debtMin, emergencyTarget, surplus, alloc, hasDebt };
}

function drawAllocationChart(canvas, alloc) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const entries = [
    ['Deuda', alloc.debt, '#f59e0b'], ['Emergencia', alloc.emergency, '#22c55e'],
    ['Inversión', alloc.investing, '#5b8cff'], ['Metas', alloc.goals + alloc.liquidity, '#c084fc']
  ].filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;

  entries.forEach(([label, value, color], i) => {
    const y = 22 + i * 46;
    const width = (value / total) * (w - 170);
    ctx.fillStyle = 'rgba(148,163,184,0.18)'; ctx.fillRect(120, y, w - 150, 28);
    ctx.fillStyle = color; ctx.fillRect(120, y, width, 28);
    ctx.fillStyle = '#E6ECFF'; ctx.font = '600 12px Inter';
    ctx.fillText(label, 14, y + 18); ctx.fillText(currency(value), Math.min(w - 135, 128 + width), y + 18);
  });
}

function initOnboarding() {
  const form = document.getElementById('onboarding-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem('nova_profile', JSON.stringify(data));
    window.location.href = 'dashboard.html';
  });
}

function initDashboard() {
  const chart = document.getElementById('allocationChart');
  if (!chart) return;

  const saved = JSON.parse(localStorage.getItem('nova_profile') || '{}');
  const profile = Object.keys(saved).length ? saved : {
    income: 2500, essentials: 1500, hasDebt: 'yes', debtMin: 220, emergency: 300, emergencyMonths: 3, risk: 'balanced', goalName: 'Viaje', goalAmount: 2000
  };

  const plan = calculatePlan(profile);
  drawAllocationChart(chart, plan.alloc);

  document.getElementById('kpi-surplus').textContent = currency(Math.max(0, plan.surplus));
  document.getElementById('kpi-debt').textContent = currency(plan.alloc.debt);
  document.getElementById('kpi-emergency').textContent = currency(plan.alloc.emergency);
  document.getElementById('kpi-invest').textContent = currency(plan.alloc.investing);

  document.getElementById('user-data').innerHTML = `
    <p>Ingreso: <strong>${currency(plan.income)}</strong></p>
    <p>Gastos esenciales: <strong>${currency(plan.essentials)}</strong></p>
    <p>Tiene deuda: <strong>${plan.hasDebt ? 'Sí' : 'No'}</strong></p>
    <p>Pago mínimo deuda: <strong>${currency(plan.debtMin)}</strong></p>
  `;

  document.getElementById('goal-data').innerHTML = `
    <p>Objetivo: <strong>${profile.goalName || 'Meta principal'}</strong></p>
    <p>Monto objetivo: <strong>${currency(Number(profile.goalAmount || 0))}</strong></p>
    <p>Fondo emergencia objetivo: <strong>${currency(plan.emergencyTarget)}</strong></p>
  `;

  const weekly = Object.fromEntries(Object.entries(plan.alloc).map(([k, v]) => [k, v / 4]));
  document.getElementById('weekly-actions').innerHTML = `
    <li>Transferir ${currency(weekly.emergency)} al fondo de emergencia.</li>
    <li>${plan.hasDebt ? `Pagar ${currency(weekly.debt)} extra a deuda prioritaria.` : `Aportar ${currency(weekly.goals)} a meta ${profile.goalName || ''}.`}</li>
    <li>Invertir ${currency(weekly.investing)} en ETFs diversificados.</li>
  `;
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
initOnboarding();
initDashboard();
