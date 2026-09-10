# Socket.IO Chat – Exercise 18: AI-Powered Chat Suggestions with Gemini

This is the final version of the chat application from Exercises 1–17, now extended with Gemini-powered predictive typing and smart replies.

## Exercise 18 features

### Predictive typing
- Waits for the user to pause typing (700 ms debounce).
- Sends the current draft and a small amount of recent room context to the backend.
- Gemini returns 2–3 concise phrase suggestions.
- Clicking a suggestion appends it to the message input.

### Smart replies
- When an incoming text message arrives in the currently open room, the client requests 2–3 short replies.
- Suggestions appear as quick-select buttons above the composer.
- Clicking a smart reply places it in the input so the user can review/edit it before sending.

### Lightweight personalization
The backend includes examples of the current user's recent messages in the Gemini prompt. This helps Gemini adapt suggestions toward the user's recent tone, wording and emoji style without storing a separate AI profile.

### AI kill switch
AI is optional and controlled completely from the server environment:

```env
AI_SUGGESTIONS_ENABLED=true
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
```

To disable Gemini completely:

```env
AI_SUGGESTIONS_ENABLED=false
```

When disabled, the frontend receives no AI suggestions and the backend does not create a Gemini client or make Gemini API calls. If the API key is missing while AI is enabled, the chat server still starts and AI is treated as unavailable.

## Existing features preserved

- Signup and login with hashed passwords.
- JWT authentication for REST APIs and Socket.IO.
- Personal rooms with deterministic room IDs.
- MongoDB user validation before starting personal chats.
- Group creation and group membership validation.
- Real-time room messages with Socket.IO.
- AWS S3 multimedia sharing.
- Image, video, audio and document/file rendering.
- Upload progress, validation and retry handling.
- Cron-based movement of old messages to `ArchivedChat`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Copy `.env.example` to `.env` and fill in your real credentials. Do not commit `.env`.

Important AI settings:

```env
AI_SUGGESTIONS_ENABLED=true
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
```

For normal usage without AI cost/API calls:

```env
AI_SUGGESTIONS_ENABLED=false
```

## Deployment

For Render, configure all MongoDB, JWT, AWS and Gemini environment variables in the Render dashboard. `PORT` is read from `process.env.PORT`, so the application remains platform-compatible.
