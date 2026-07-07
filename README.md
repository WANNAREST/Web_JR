# JR Japanese Railway Term Extraction

Web app for uploading Japanese railway documents and extracting specialist terms with the BERT pipeline trained in the notebook.

## Run

```bash
npm run install:all
npm run dev
```

Frontend: http://localhost:5173

Backend API: http://localhost:4000



## Supported Uploads

- `.txt`
- `.pdf`
- `.docx`

PDF and DOCX extraction is handled in Node before the text is sent to the Python term extraction pipeline.
