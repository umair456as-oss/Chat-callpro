importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const firebaseConfig = {
  projectId: "gen-lang-client-0459240900",
  appId: "1:711881759609:web:306f331cfb31799df2ada8",
  apiKey: "AIzaSyCoUGlo1F53R3YMGxL2GiAU8sebxiyemzo",
  authDomain: "gen-lang-client-0459240900.firebaseapp.com",
  storageBucket: "gen-lang-client-0459240900.firebasestorage.app",
  messagingSenderId: "711881759609",
  measurementId: "G-BYEVEW37EW"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
