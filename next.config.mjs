/** @type {import('next').NextConfig} */
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Desativa PWA enquanto você programa no PC
});

const nextConfig = {
  // Outras configs se necessário
};

export default withPWA(nextConfig);