/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coach: {
          50:  '#f0faf4',
          100: '#d8f2e4',
          200: '#b3e5cc',
          300: '#7fd0ab',
          400: '#4bb584',
          500: '#2d9a57',
          600: '#1e6b3c',
          700: '#175530',
          800: '#114023',
          900: '#0a2b17',
          950: '#050f08',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      animation: {
        'slide-in': 'slideIn 0.25s ease-out',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}
