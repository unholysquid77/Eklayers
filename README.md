# SupplyChain Sentinel

Hackathon implementation scaffold for PS #3 (disruption prediction) and PS #9 (continuous supplier-risk scoring).

`frontend/` is a source-complete import of Paqshi Brain (excluding local secrets and build artifacts). It preserves the original globe code, map style, data APIs, and the package lockfile so it can be installed and run before the supply-chain trim begins.

```powershell
cd frontend
npm ci
npm run dev
```

Use the specs before changing the imported app:

- [Product single source of truth](docs/PRODUCT_SPEC.md)
- [Backend specification](docs/BACKEND_SPEC.md)
- [Frontend specification](docs/FRONTEND_SPEC.md)
- [I/O and mathematical-engine contract](docs/IO_CONTRACT.md)

`backend/math_engine.py` is a standard-library, executable reference engine for per-node stress and category priors, Bayesian posterior updates, Kalman lead-time forecasts, Monte Carlo exposure/stress tests and false-alarm control. `backend/ingestion.py` records the selected Paqshi weather, advisory, freight, hazard, trade-policy and trade-baseline sources and normalizes them into the I/O contract. Run its offline scenario with `python -c "from backend.demo import run_demo; print(run_demo())"`. Do not copy Paqshi credentials or its database files into this repository.
