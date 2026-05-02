# Third-Party Notices

## DeerFlow

Hermes now includes code and implementation patterns adapted from the
MIT-licensed DeerFlow project:

- Repository: https://github.com/bytedance/deer-flow
- Relevant upstream files studied and adapted:
  - `backend/packages/harness/deerflow/utils/file_conversion.py`
  - `backend/packages/harness/deerflow/tools/builtins/view_image_tool.py`
  - `backend/packages/harness/deerflow/agents/middlewares/view_image_middleware.py`

Adapted areas in Hermes include:

- Legal PDF-first figure retrieval flow
- Server-side figure extraction from accessible PDFs
- Vision-based figure verification using real image content

DeerFlow license:

```text
MIT License

Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
Copyright (c) 2025-2026 DeerFlow Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
