/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['next/babel'],
          plugins: [['@babel/plugin-transform-runtime', { regenerator: true }]]
        }
      }
    });
    return config;
  }
};

module.exports = nextConfig;
