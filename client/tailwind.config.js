/*
 * @Author: flwfdd
 * @Date: 2025-01-17 21:43:17
 * @LastEditTime: 2025-02-07 17:17:27
 * @Description: _(:з」∠)_
 */
import {heroui} from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    './src/layouts/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: {
            //... 50 to 900
            foreground: "#FFFFFF",
            DEFAULT: "#00BCEB",
          },
          // ... rest of the colors
        },
      },
      dark: {
        colors: {
          primary: {
            //... 50 to 900
            foreground: "#FFFFFF",
            DEFAULT: "#00ABD6",
          },
          // ... rest of the colors
        },
      }}}
    )],
}
