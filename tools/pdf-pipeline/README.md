# Optional PDF Pipeline

This directory contains the optional offline PDF-to-JSON pipeline used during
development. It is intentionally separated from the app because the public
project should be usable with JSON question files only.

## Copyright And Repository Safety

- Do not commit original PDF question banks.
- `local-pdf-sources/`, `*.pdf`, and `*.PDF` are ignored by Git.
- Only run this pipeline for materials you own or are licensed to process.
- Generated JSON should still be reviewed before distribution.

## Expected Local Directory Layout

Create this directory at the repository root if you need to run the pipeline:

```text
local-pdf-sources/
  highway/
  regulations/
  management/
  past-exams/
    highway/
    regulations/
    management/
  mock-exams/
    highway/
    regulations/
    management/
```

The app itself does not require these folders. Normal users can import JSON or
Markdown question files from the web UI.

## Run

```bash
python tools/pdf-pipeline/build_construction_bank.py
```

The script regenerates:

```text
public/questions/construction/
public/question-assets/construction/
src/generated/constructionBank.ts
```

Treat the output as AI/OCR-assisted generated data. Always audit and spot-check
the generated question bank before publishing it.
