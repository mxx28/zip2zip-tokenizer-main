# Data layout

The app loads displayable model runs from `public/demo-runs`.

## Runtime data

- `public/demo-runs/index.json` lists the run folders that should appear in the UI.
- Each run folder keeps the generator output as-is: `manifest.json`, `validation.json`, `run_config.json`, `metrics.csv`, `generation_traces.jsonl`, and `models/*.json`.
- The UI reads every listed run manifest and loads that run's referenced model result file directly.

Do not aggregate run results into one large `public/demo-data/manifest.json`. Add a new generated run folder under `public/demo-runs`, then add one entry to `public/demo-runs/index.json`.

## Naming

The model dropdown uses the run label from `index.json`. For folders like:

```text
andrea-z2z-phi35-4B-zeroinit-1BData-v0.6.4-Zip2zipCore_step_8000_demo_data
```

the label should be:

```text
phi35-4B
```

## Checks

Run `npm run check:data` before copying or deploying data. It validates that:

- `public/demo-runs/index.json` exists.
- every listed run folder exists.
- every run has `manifest.json` and `validation.json`.
- every manifest model points to an existing result file.
- there are no unlisted run folders under `public/demo-runs`.

Large files under `public/demo-runs` may work locally but can still require Git LFS or hosting changes before publishing.
