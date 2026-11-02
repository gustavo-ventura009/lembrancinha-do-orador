// Depois de "cap add android": permissões (Android 13+), ícone do app e ícone pequeno das notificações.
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const res = path.join(raiz, 'android', 'app', 'src', 'main', 'res');

// 1) Permissões
const f = path.join(raiz, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let x = fs.readFileSync(f, 'utf8');
for (const p of ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE', 'WAKE_LOCK']) {
  if (!x.includes(`android.permission.${p}"`)) x = x.replace('</manifest>', `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`);
}
fs.writeFileSync(f, x);

// 2) Ícone do app (a imagem enviada): troca os PNGs e remove o ícone adaptativo padrão do Capacitor
fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
for (const d of fs.readdirSync(path.join(raiz, 'icone'))) {
  const dest = path.join(res, d);
  fs.mkdirSync(dest, { recursive: true });
  for (const a of fs.readdirSync(path.join(raiz, 'icone', d))) fs.copyFileSync(path.join(raiz, 'icone', d, a), path.join(dest, a));
  fs.rmSync(path.join(dest, 'ic_launcher_foreground.png'), { force: true });
}

// 3) Ícone pequeno (monocromático) da barra de notificações: um sino
fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
fs.writeFileSync(path.join(res, 'drawable', 'ic_stat_lembrancinha.xml'),
`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,22c1.1,0 2,-0.9 2,-2h-4c0,1.1 0.89,2 2,2zM18,16v-5c0,-3.07 -1.64,-5.64 -4.5,-6.32V4c0,-0.83 -0.67,-1.5 -1.5,-1.5s-1.5,0.67 -1.5,1.5v0.68C7.63,5.36 6,7.92 6,11v5l-2,2v1h16v-1l-2,-2z"/>
</vector>
`);

// 4) Vibração (e som) contínuos até a notificação ser aberta/arrastada: liga FLAG_INSISTENT no plugin de notificações
function achar(dir, nome) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const c = path.join(dir, e.name);
    if (e.isDirectory()) { const r = achar(c, nome); if (r) return r; } else if (e.name === nome) return c;
  }
  return null;
}
const plugin = path.join(raiz, 'node_modules', '@capacitor', 'local-notifications', 'android');
const java = fs.existsSync(plugin) ? achar(plugin, 'LocalNotificationManager.java') : null;
if (java) {
  let j = fs.readFileSync(java, 'utf8');
  const re = /(Notification\s+(\w+)\s*=\s*\w+\.build\(\);)/g;
  if (re.test(j) && !j.includes('FLAG_INSISTENT')) {
    j = j.replace(re, '$1\n        $2.flags |= android.app.Notification.FLAG_INSISTENT;');
    fs.writeFileSync(java, j);
    console.log('Vibração contínua (FLAG_INSISTENT) ativada.');
  } else if (!j.includes('FLAG_INSISTENT')) {
    console.log('::warning::Não achei onde ligar a vibração contínua no plugin; o app usará a vibração padrão.');
  }
} else console.log('::warning::Plugin de notificações não encontrado; vibração contínua não aplicada.');
console.log('Android ajustado (permissões, ícone e notificações).');
