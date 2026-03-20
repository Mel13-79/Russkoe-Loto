import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.russkoeloto',
  appName: 'Русское Лото Онлайн',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'http',
    url: 'http://192.168.0.19:3000'
  }
};

export default config;
