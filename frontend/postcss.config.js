// Tailwind CSS 4's PostCSS plugin also adds vendor prefixes (via Lightning
// CSS), so autoprefixer is no longer needed.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
