// ESTE SCRIPT ES LA SOLUCIÓN DEFINITIVA PARA CONFIGURAR LOS USUARIOS LOCALES

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const CONTRASENA_PRUEBA = 'test123';

async function configurarUsuarios() {
    console.log('Iniciando configuración segura de usuarios locales...');
    
    // --- INICIO DE MODIFICACIÓN TEMPORAL PARA DEBUG LOCAL ---
    console.log("=======================================================");
    console.log("ATENCIÓN: Usando configuración de BD LOCAL FIJA.");
    console.log("Esto es solo para pruebas locales. No subir a producción.");
    console.log("=======================================================");
    const pool = new Pool({
        connectionString: "postgresql://moisesgross:admin123@localhost:5432/gestion_db",
    });
    // --- FIN DE MODIFICACIÓN TEMPORAL ---

    const client = await pool.connect();
    
    try {
        console.log('Limpiando la tabla de usuarios para un inicio limpio...');
        // TRUNCATE es más limpio que DELETE, reinicia los contadores de ID.
        await client.query('TRUNCATE users RESTART IDENTITY CASCADE');

        console.log(`Encriptando la contraseña '${CONTRASENA_PRUEBA}' para los nuevos usuarios...`);
        const hashedPassword = await bcrypt.hash(CONTRASENA_PRUEBA, 10);

        console.log("Insertando usuario 'localadmin'...");
        await client.query(
            'INSERT INTO users (nombre, username, password, rol, estado) VALUES ($1, $2, $3, $4, $5)',
            ['Admin Local', 'localadmin', hashedPassword, 'Administrador', 'activo']
        );

        console.log("Insertando usuario 'asesor'...");
        await client.query(
            'INSERT INTO users (nombre, username, password, rol, estado) VALUES ($1, $2, $3, $4, $5)',
            ['Asesor Prueba', 'asesor', hashedPassword, 'Asesor', 'activo']
        );

        console.log("\n✅ ¡ÉXITO! La configuración de usuarios se ha completado.");
        console.log("-------------------------------------------------");
        console.log("Puedes iniciar sesión con CUALQUIERA de estos usuarios:");
        console.log(`  - Usuario: localadmin / Contraseña: ${CONTRASENA_PRUEBA}`);
        console.log(`  - Usuario: asesor     / Contraseña: ${CONTRASENA_PRUEBA}`);
        console.log("-------------------------------------------------");

    } catch (err) {
        console.error('\n❌ ERROR: No se pudo configurar los usuarios.', err.message);
    } finally {
        await client.release();
        await pool.end();
        console.log('Conexión a la base de datos cerrada.');
    }
}

configurarUsuarios();