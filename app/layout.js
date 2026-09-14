import "./globals.css";
import { ToastProvider } from "../hooks/useToast";
import { AuthProvider } from "../hooks/useAuth";
import { ThemeProvider } from "../hooks/useTheme";

export const metadata = {
  title: "Chat",
  description: "Real-time chat"
};

// Without this, some mobile browsers (notably Chrome on Android) leave the
// layout viewport unchanged when the on-screen keyboard opens and just
// overlay the keyboard on top of the page instead - which is exactly why
// the message input box was getting covered. "resizes-content" forces the
// classic/expected behavior: the visible viewport actually shrinks, so
// 100dvh-based layouts below correctly shrink with it and the input stays
// above the keyboard.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content"
};

// Runs before React hydrates, so the correct theme is set on <html> before
// first paint - without this, the page would flash the default (dark)
// theme even for someone who has light saved, then snap to light a moment
// later once React mounts.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("chatapp_theme");
    var theme = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:ital,wght@0,500;0,600;1,500;1,600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
