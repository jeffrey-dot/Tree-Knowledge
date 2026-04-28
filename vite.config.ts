import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "icons-vendor": ["lucide-react"],
          "markdown-vendor": [
            "katex",
            "react-markdown",
            "rehype-katex",
            "remark-gfm",
            "remark-math",
          ],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
