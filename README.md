# Scrubbing

Prototipo web multipágina de **NOVA Finance OS**.

## Páginas
- `index.html`: landing y navegación general.
- `onboarding.html`: captura de datos financieros y metas.
- `dashboard.html`: KPIs, gráfico de distribución, datos del usuario y acciones.
- `deudas.html`: foco en estrategia/pago de deudas.
- `ahorro.html`: foco en fondo de emergencia y metas.
- `inversion.html`: foco en aportes de inversión.

## Extra
- Selector de divisa global (arriba derecha): USD, EUR, MXN, COP.
- Persistencia por `localStorage` para perfil y moneda.

## Ejecutar local
```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080`.
