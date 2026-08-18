# Focus: translator & two tracks (not HPC)

This project is **not** waiting on linegraph/HPC fixtures right now.

See **`docs/TWO_TRACKS.md`** for the current architecture.

**LangGraph** (not “linegraph”) can be added later to orchestrate agents; local work uses the FastAPI translator endpoints.

You only need to provide something when you want:

- A specific domain vocabulary for CNL (`load spectrum`, `submit job`, …)
- LangGraph wiring preferences (which agents run in which order)

Otherwise, use `examples/demo.cnl` and `examples/demo_mixed_pipeline.ndsl` on a small local model.
