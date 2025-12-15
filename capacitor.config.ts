import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7dc468995cb14ee8a059c136219ca9e6',
  appName: 'Pesagem Offline',
  webDir: 'dist',
  server: {
    url: 'https://7dc46899-5cb1-4ee8-a059-c136219ca9e6.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
};

export default config;
