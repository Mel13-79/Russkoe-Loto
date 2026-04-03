import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.russkoeloto',
  appName: 'Русское Лото Онлайн',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
