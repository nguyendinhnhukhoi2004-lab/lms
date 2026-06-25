export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#dbeefe',
          200: '#beddfd',
          300: '#90bffc',
          400: '#5d98f3',
          500: '#3c7ae8',
          600: '#2e61c6',
          700: '#2b549d',
          800: '#28487a',
          900: '#243d64'
        },
        accent: {
          50: '#fff7e4',
          100: '#ffebc2',
          200: '#fedc94',
          300: '#fed16f',
          400: '#fdc54a',
          500: '#f7b122',
          600: '#d5941c',
          700: '#ad771a',
          800: '#8f621c',
          900: '#75531d'
        }
      }
    }
  },
  plugins: [],
};
