/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          cyan: '#00C2FF',
          green: '#3BFFA4',
          bg: '#101A31',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #00C2FF, #3BFFA4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
