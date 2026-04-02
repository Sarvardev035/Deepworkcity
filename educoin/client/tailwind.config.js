/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6C5CE7',
        'primary-dark': '#5849C4',
        accent: '#00CEC9',
        bg: '#0F0F13',
        card: '#1A1A24',
        'card-hover': '#22222F',
        border: '#2A2A3A',
        text: '#EAEAEA',
        muted: '#8A8A9A',
        success: '#00B894',
        error: '#FF6B6B',
        gold: '#FFD700',
        silver: '#C0C0C0',
        bronze: '#CD7F32',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        btn: '8px',
      },
      animation: {
        'count-up': 'countUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glow: {
          from: { boxShadow: '0 0 10px rgba(108, 92, 231, 0.3)' },
          to: { boxShadow: '0 0 30px rgba(108, 92, 231, 0.7)' },
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6C5CE7, #a29bfe)',
        'gradient-teal': 'linear-gradient(135deg, #00CEC9, #00b894)',
        'gradient-hero': 'radial-gradient(ellipse at top, #1e1a38 0%, #0F0F13 70%)',
      },
    },
  },
  plugins: [],
};
