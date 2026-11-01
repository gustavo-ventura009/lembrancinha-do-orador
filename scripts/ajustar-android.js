// Depois de "cap add android": declara as permissões de notificação/alarme (Android 13+) e a orientação.
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let x = fs.readFileSync(f, 'utf8');
const perms = ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE', 'WAKE_LOCK'];
for (const p of perms) {
  const linha = `<uses-permission android:name="android.permission.${p}" />`;
  if (!x.includes(`android.permission.${p}"`)) x = x.replace('</manifest>', `    ${linha}\n</manifest>`);
}
fs.writeFileSync(f, x);
console.log('AndroidManifest.xml ajustado.');
