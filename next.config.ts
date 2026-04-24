import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   allowedDevOrigins: ['c8b6-105-157-215-111.ngrok-free.app'],
   images: {
     remotePatterns: [
       {
         protocol: 'https',
         hostname: 'ftqpkwbbrnvwpgcxiuli.supabase.co',
         pathname: '/storage/v1/object/public/desart-barber-shop/**',
       },
     ],
   },
};

export default nextConfig;
