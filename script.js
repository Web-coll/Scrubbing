const form = document.getElementById('plan-form');
const results = document.getElementById('results');
const debtFields = document.getElementById('debt-fields');

function currency(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function riskCap(risk) {
  if (risk === 'conservative') return 0.25;
  if (risk === 'balanced') return 0.4;
  return 0.55;
}

function drawAllocationChart(canvas, alloc) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const entries = [
    ['Deuda', alloc.debt, '#f59e0b'],
    ['Emergencia', alloc.emergency, '#22c55e'],
    ['Inversión', alloc.investing, '#5b8cff'],
    ['Metas', alloc.goals + alloc.liquidity, '#c084fc']
  ].filter(([, value]) => value > 0);

  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  const barH = 28;
  const gap = 14;

  entries.forEach(([label, value, color], i) => {
    const y = 20 + i * (barH + gap);
    const width = (value / total) * (w - 170);
    ctx.fillStyle = 'rgba(148,163,184,0.18)';
    ctx.fillRect(120, y, w - 150, barH);
    ctx.fillStyle = color;
    ctx.fillRect(120, y, width, barH);
    ctx.fillStyle = '#E6ECFF';
    ctx.font = '600 12px Inter';
    ctx.fillText(label, 14, y + 18);
    ctx.fillText(currency(value), Math.min(w - 135, 128 + width), y + 18);
  });
}

document.querySelectorAll('input[name="hasDebt"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    debtFields.style.display = e.target.value === 'yes' ? 'block' : 'none';
  });
});

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const data = new FormData(form);
  const income = Number(data.get('income') || 0);
  const essentials = Number(data.get('essentials') || 0);
  const hasDebt = data.get('hasDebt') === 'yes';
  const debtMin = hasDebt ? Number(data.get('debtMin') || 0) : 0;
  const emergencyBalance = Number(data.get('emergencyBalance') || 0);
  const emergencyMonths = Number(data.get('emergencyMonths') || 3);
  const risk = data.get('risk');

  const emergencyTarget = essentials * emergencyMonths;
  const emergencyRatio = emergencyTarget > 0 ? emergencyBalance / emergencyTarget : 0;
  const surplus = income - essentials - debtMin;

  let alloc = { debt: 0, emergency: 0, investing: 0, goals: 0, liquidity: 0 };
  let status = 'ok';
  let statusText = 'Plan activo';

  if (surplus <= 0) {
    status = 'warn';
    statusText = 'Modo contención';
  } else if (hasDebt) {
    if (emergencyRatio < (1 / emergencyMonths)) {
      alloc = { debt: surplus * 0.6, emergency: surplus * 0.4, investing: 0, goals: 0, liquidity: 0 };
    } else if (emergencyRatio < 1) {
      alloc = { debt: surplus * 0.5, emergency: surplus * 0.3, investing: surplus * 0.2, goals: 0, liquidity: 0 };
    } else {
      alloc = { debt: surplus * 0.65, emergency: 0, investing: surplus * 0.25, goals: surplus * 0.1, liquidity: 0 };
    }
  } else if (emergencyRatio < 1) {
    alloc = { debt: 0, emergency: surplus * 0.5, investing: surplus * 0.3, goals: surplus * 0.2, liquidity: 0 };
  } else {
    alloc = { debt: 0, emergency: 0, investing: surplus * 0.55, goals: surplus * 0.25, liquidity: surplus * 0.2 };
  }

  const maxInvest = surplus > 0 ? surplus * riskCap(risk) : 0;
  if (alloc.investing > maxInvest) {
    const extra = alloc.investing - maxInvest;
    alloc.investing = maxInvest;
    alloc.emergency += extra;
  }

  const weekly = Object.fromEntries(Object.entries(alloc).map(([k, v]) => [k, v / 4]));

  results.innerHTML = `
    <h3>Plan mensual recomendado</h3>
    <p><span class="tag ${status}">${statusText}</span></p>
    <div class="line"><span>Ingreso mensual</span><strong>${currency(income)}</strong></div>
    <div class="line"><span>Gastos esenciales</span><strong>${currency(essentials)}</strong></div>
    <div class="line"><span>Pago mínimo deuda</span><strong>${currency(debtMin)}</strong></div>
    <div class="line"><span>Excedente</span><strong>${currency(Math.max(0, surplus))}</strong></div>
    <div class="line"><span>Asignación deuda extra</span><strong>${currency(alloc.debt)}</strong></div>
    <div class="line"><span>Asignación emergencia</span><strong>${currency(alloc.emergency)}</strong></div>
    <div class="line"><span>Asignación inversión</span><strong>${currency(alloc.investing)}</strong></div>
    <div class="line"><span>Asignación metas</span><strong>${currency(alloc.goals + alloc.liquidity)}</strong></div>
    <canvas id="allocationChart" width="620" height="280" aria-label="Gráfico de asignación" role="img"></canvas>
    <div class="actions">
      <h4>Acciones semanales sugeridas</h4>
      <ol>
        <li>Transfiere <strong>${currency(weekly.emergency)}</strong> a fondo de emergencia.</li>
        <li>${hasDebt ? `Haz pago extra de <strong>${currency(weekly.debt)}</strong> a deuda prioritaria.` : `Aporta <strong>${currency(weekly.goals)}</strong> a meta principal.`}</li>
        <li>Programa inversión automática de <strong>${currency(weekly.investing)}</strong> en ETFs diversificados.</li>
      </ol>
    </div>
  `;

  const canvas = document.getElementById('allocationChart');
  drawAllocationChart(canvas, alloc);
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const scrubSection = document.getElementById('scrub');
const scrubTitle = document.getElementById('scrub-title');
const scrubText = document.getElementById('scrub-text');
const orbit = document.getElementById('orbit');
const progressLine = document.querySelector('#progress-line i');

const scenes = [
  { title: 'Caos financiero', text: 'Tus gastos y metas compiten sin orden. El dinero se fuga.' },
  { title: 'Diagnóstico inteligente', text: 'NOVA identifica excedente real y elimina la niebla financiera.' },
  { title: 'Distribución automática', text: 'El capital se reparte con reglas claras entre seguridad, deuda y crecimiento.' },
  { title: 'Progreso visible', text: 'Cada semana ves menos fricción y más patrimonio en construcción.' }
];

function onScrollScrub() {
  const rect = scrubSection.getBoundingClientRect();
  const total = scrubSection.offsetHeight - window.innerHeight;
  const raw = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
  const index = Math.min(scenes.length - 1, Math.floor(raw * scenes.length));
  scrubTitle.textContent = scenes[index].title;
  scrubText.textContent = scenes[index].text;
  orbit.style.transform = `rotate(${raw * 220}deg) scale(${0.88 + raw * 0.18})`;
  progressLine.style.width = `${raw * 100}%`;
}

window.addEventListener('scroll', onScrollScrub, { passive: true });
window.addEventListener('resize', onScrollScrub);
onScrollScrub();
