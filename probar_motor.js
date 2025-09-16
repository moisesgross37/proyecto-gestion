const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { assembleQuote } = require('./pricingEngine.js');

const DB_PATH = path.join(__dirname, 'db_asesores.json');
const CSV_PATH = path.join(__dirname, 'Productos.csv');

console.log('--- Probando el Motor de Precios ---');

// 1. Cargar los productos del CSV
const products = [];
fs.createReadStream(CSV_PATH)
    .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
    .on('data', (row) => products.push(row))
    .on('end', () => {
        console.log(`Se cargaron ${products.length} productos del CSV.`);

        // 2. Leer la base de datos (para otros datos si fueran necesarios)
        const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        dbData.products = products.map((p, index) => ({ ...p, id: index + 1 }));

        // 3. Simular la entrada de una nueva cotización (como la que enviaste)
        const sampleQuoteInput = {
            "quoteNumber": "COT-240003",
            "clientName": "Colegio San Martin ",
            "productIds": [4, 9, 16, 19],
            "studentCount": 60,
            "aporteInstitucion": 0,
            "estudiantesCortesia": 0
        };
        console.log('\nDatos de entrada para la prueba:');
        console.log(sampleQuoteInput);

        // 4. Ejecutar el motor de precios
        const result = assembleQuote(sampleQuoteInput, dbData);

        // 5. Mostrar el resultado
        console.log('\nResultado devuelto por assembleQuote:');
        console.log(JSON.stringify(result, null, 2));
        console.log('------------------------------------');
    });