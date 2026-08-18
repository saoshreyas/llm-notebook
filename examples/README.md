# Example pipelines

## Runnable now

- **`demo_mixed_pipeline.ndsl`** — One `kind: code` data step, one code stats step, one `kind: llm` summary step. Paste into a DSL notebook cell or run:

  ```bash
  cd backend
  python -c "
  from dsl.parser import parse_file
  from dsl.runtime import run_pipeline, make_litellm_caller
  import os
  p = parse_file('../examples/demo_mixed_pipeline.ndsl').pipelines[0]
  llm = make_litellm_caller(os.environ['DEFAULT_MODEL'], os.environ['VLLM_BASE_URL'])
  print(run_pipeline(p, llm).summary())
  "
  ```

## What we need from you (for linegraph + supercomputer)

To finish the advisor’s “realistic outputs” and cluster goals, please provide:

| Item | Why |
|------|-----|
| **Linegraph** link or repo | Exact format for metrics/plots so we can add `examples/linegraph/` fixtures |
| **1 flagship workflow** | 3–8 steps: which are code vs LLM vs cluster job |
| **Sample data** | Small CSV/HDF5 or schema description (can be synthetic if real data is restricted) |
| **Cluster access** | Slurm/PBS/SSH host, queue name, module load lines, or “mock only for now” |
| **Expected artifacts** | Files or JSON the notebook should show after a successful run |

Drop files in `examples/linegraph/` (or tell us paths) and we’ll wire `kind: remote` and golden tests next.
