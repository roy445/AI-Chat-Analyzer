# Gemini API implementation notes

Sources:
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/api/generate-content

The official model catalog lists `gemini-3.7-flash` as a stable Flash model and the endpoint model string is `gemini-3.7-flash`.

The official REST generateContent endpoint is `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. Requests use the `x-goog-api-key` header, `contents` with text parts, and can include `systemInstruction` plus `generationConfig.responseMimeType: application/json` for JSON output.

Google's API key guidance recommends storing `GEMINI_API_KEY` in server-side environment variables, never committing it to Git or exposing it in client-side code. Vercel must receive `GEMINI_API_KEY` and optionally `GEMINI_MODEL=gemini-3.7-flash` as Environment Variables.
