const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, 'plantillas', 'Timbrada BE EVENTOS.jpg');

console.log('--- Verificación de Ruta de Imagen ---');
console.log('Buscando archivo en la ruta:', imagePath);

if (fs.existsSync(imagePath)) {
  console.log('✅ ¡ÉXITO! El archivo fue encontrado.');
} else {
  console.log('❌ ERROR: El archivo NO fue encontrado en esa ruta.');
  console.log('Por favor, revisa que la carpeta "plantillas" y el archivo "Timbrada BE EVENTOS.jpg" existan y estén escritos exactamente igual (mayúsculas, minúsculas y espacios).');
}
console.log('------------------------------------');