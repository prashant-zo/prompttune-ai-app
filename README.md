# PromptTune

A modern AI chat application built with Next.js 14 App Router, Gemini, Firebase, and Tailwind CSS. PromptTune helps users craft exceptional prompts for a wide range of AI systems, with a focus on accessibility and professional UX.

## Features
- AI chat with leveled prompt suggestions (Beginner, Intermediate, Advanced)
- Beautiful, responsive UI with dark mode
- User authentication (Firebase)
- Persistent chat history (Firestore)
- Copy-to-clipboard for prompts
- Markdown support with code/prompt blocks
- Theme and accessibility best practices

## Tech Stack
- [Next.js 14 (App Router)](https://nextjs.org/docs/app)
- [Google Gemini](https://ai.google.dev/)
- [Firebase (Auth, Firestore)](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn UI](https://ui.shadcn.com/)
- [React Markdown](https://github.com/remarkjs/react-markdown)

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/your-username/prompttune.git
cd prompttune
```

### 2. Install dependencies
```bash
npm install
# or
yarn install
```

### 3. Set up environment variables
Create a `.env.local` file in the root directory and add the following:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
GEMINI_API_KEY=your_gemini_api_key
# Optional: defaults to gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-flash
```

### 4. Run the development server
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

New model add-on soon!

## Deployment
- Deploy easily to [Vercel](https://vercel.com/) or your preferred platform.
- Set all environment variables in your deployment dashboard.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

**Note:**
- You must provide your own API keys and Firebase project configuration.
- The app will not function without valid environment variables.
- For production, review security and environment settings carefully.
