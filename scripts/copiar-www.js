// Copia o site (index.html, css, js) para www/, a pasta que o Capacitor empacota no app.
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), dest = path.join(raiz, 'www');
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const item of ['index.html', 'css', 'js', 'img']) fs.cpSync(path.join(raiz, item), path.join(dest, item), { recursive: true });
console.log('www/ pronto.');
