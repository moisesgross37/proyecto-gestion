// ============== SERVIDOR DE ASESORES Y VENTAS (v17.4 - API de Asesores) ==============
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');

const { assembleQuote } = require('./pricingEngine.js');
const { checkRole } = require('./permissions.js');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// --- INICIO: CONFIGURACIÓN DE SEGURIDAD PARA API ---
const API_KEY = 'MI_LLAVE_SECRETA_12345';
const apiKeyAuth = (req, res, next) => {
    const providedKey = req.header('X-API-Key');
    if (providedKey && providedKey === API_KEY) {
        next();
    } else {
        res.status(401).json({ message: 'Acceso no autorizado: Llave de API inválida o ausente.' });
    }
};
// --- FIN: CONFIGURACIÓN DE SEGURIDAD PARA API ---


// PEGA ESTE NUEVO BLOQUE DE CÓDIGO AQUÍ
// =================================================================
// ============== NUEVO MIDDLEWARE DE ACCESO DUAL ==================
// =================================================================
const allowUserOrApiKey = (req, res, next) => {
    // 1. ¿Hay una sesión de usuario válida?
    if (req.session && req.session.user) {
        return next(); // Sí, es un usuario logueado. ¡Adelante!
    }

    // 2. Si no hay sesión, ¿hay una llave de API válida?
    const providedKey = req.header('X-API-Key');
    if (providedKey && providedKey === API_KEY) {
        return next(); // Sí, es un sistema autorizado. ¡Adelante!
    }

    // 3. Si no es ninguna de las dos, se niega el acceso.
    res.status(401).json({ message: 'Acceso no autorizado: Se requiere iniciar sesión o una llave de API válida.' });
};
// =================================================================
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users ( id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL, username VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, rol VARCHAR(50) NOT NULL, estado VARCHAR(50) DEFAULT 'activo' );
            CREATE TABLE IF NOT EXISTS advisors ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL );
            CREATE TABLE IF NOT EXISTS comments ( id SERIAL PRIMARY KEY, text TEXT NOT NULL );
            CREATE TABLE IF NOT EXISTS zones ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL );
            
            CREATE TABLE IF NOT EXISTS centers (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50),
                name VARCHAR(255) NOT NULL,
                address TEXT NOT NULL,
                sector TEXT,
                contactname VARCHAR(255),
                contactnumber VARCHAR(255),
                UNIQUE(name, address)
            );

            CREATE TABLE IF NOT EXISTS quotes (
                id SERIAL PRIMARY KEY,
                quotenumber VARCHAR(50),
                clientname VARCHAR(255),
                advisorname VARCHAR(255),
                studentcount INTEGER,
                productids INTEGER[],
                preciofinalporestudiante NUMERIC,
                estudiantesparafacturar INTEGER,
                facilidadesaplicadas TEXT[],
                status VARCHAR(50) DEFAULT 'pendiente',
                rejectionreason TEXT,
                createdat TIMESTAMPTZ DEFAULT NOW(),
                items JSONB,
                totals JSONB,
                aporte_institucion NUMERIC DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS visits ( id SERIAL PRIMARY KEY, centername VARCHAR(255), advisorname VARCHAR(255), visitdate DATE, commenttext TEXT, createdat TIMESTAMPTZ DEFAULT NOW() );
            CREATE TABLE IF NOT EXISTS payments ( id SERIAL PRIMARY KEY, quote_id INTEGER REFERENCES quotes(id), payment_date DATE NOT NULL, amount NUMERIC NOT NULL, students_covered INTEGER, comment TEXT, createdat TIMESTAMPTZ DEFAULT NOW() );
        `);
    } catch (err) {
       console.error('Error al inicializar las tablas de la aplicación:', err);
    } finally {
        client.release();
    }
};

let products = [];
const loadProducts = () => {
    const csvPath = path.join(__dirname, 'Productos.csv');
    if (!fs.existsSync(csvPath)) { return; }
    const tempProducts = [];
    fs.createReadStream(csvPath)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim(), mapValues: ({ value }) => value.trim() }))
        .on('data', (row) => { tempProducts.push(row); })
        .on('end', () => {
            products = tempProducts.map((p, index) => ({ ...p, id: index + 1 }));
            console.log(`${products.length} productos cargados y procesados exitosamente desde Productos.csv.`);
        });
};

// =======================================================
//   INICIO: BLOQUE CORREGIDO PARA CONEXIÓN Y SESIONES
// =======================================================

// 1. CREA LA CONEXIÓN A LA BASE DE DATOS ('pool')
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// 2. CONFIGURA LAS SESIONES (USA 'pool')
app.set('trust proxy', 1);
app.use(session({
    store: new pgSession({
        pool: pool, // Ahora 'pool' ya existe y no dará error
        tableName: 'session'
    }),
    secret: 'un_secreto_mucho_mas_largo_y_seguro_para_produccion_final',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    }
}));

// 3. MIDDLEWARE DE AUTENTICACIÓN
const requireLogin = (req, res, next) => { if (!req.session.user) { return res.status(401).json({ message: 'No autenticado.' }); } next(); };
const requireAdmin = checkRole(['Administrador']);

// =======================================================
//     FIN: BLOQUE CORREGIDO PARA CONEXIÓN Y SESIONES
// =======================================================
// --- RUTAS DE API ---

// Nueva ruta para obtener los datos del usuario actual en sesión
('/api/user-session', requireLogin, (req, res) => {
    res.json(req.session.user);
});

// Nueva ruta para obtener los datos del usuario actual en sesión

('/api/user-session', requireLogin, (req, res) => {
    res.json(req.session.user);
});

// PEGAR ESTE NUEVO BLOQUE EN SU LUGAR
app.get('/api/formalized-centers', apiKeyAuth, async (req, res) => {
    try {
        // Lógica mejorada: Buscamos directamente las cotizaciones formalizadas.
        // Es más rápido, directo y confiable.
        const query = `
            SELECT DISTINCT clientname AS name 
            FROM quotes 
            WHERE status = 'formalizada' 
            ORDER BY clientname ASC;
        `;
        const result = await pool.query(query);
        
        // Devolvemos un array de objetos con la propiedad 'name', 
        // que es lo que el frontend espera.
        res.json(result.rows);

    } catch (err) {
        console.error('Error al obtener centros con cotizaciones formalizadas:', err);
        res.status(500).json({ message: 'Error en el servidor al consultar los centros.' });
    }
});

app.get('/api/advisors-list', apiKeyAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM advisors ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener lista de asesores:', err);
        res.status(500).json({ message: 'Error en el servidor al consultar asesores.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND estado = $2', [username, 'activo']);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado o inactivo.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta.' });
        const userResponse = { id: user.id, nombre: user.nombre, username: user.username, rol: user.rol };
        req.session.user = userResponse;
        res.status(200).json({ message: 'Login exitoso', redirectTo: '/index.html', user: userResponse });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.status(500).json({ message: 'No se pudo cerrar la sesión.' }); }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
    });
});
app.get('/api/next-quote-number', requireLogin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT quotenumber FROM quotes WHERE quotenumber LIKE 'COT-%' ORDER BY CAST(SUBSTRING(quotenumber FROM 5) AS INTEGER) DESC LIMIT 1`);
        const lastNumber = result.rows.length > 0 ? parseInt(result.rows[0].quotenumber.split('-')[1]) : 240000;
        const nextNumber = lastNumber + 1;
        res.json({ quoteNumber: `COT-${nextNumber}` });
    } catch (err) {
        console.error("Error getting next quote number:", err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});
app.get('/api/users', requireLogin, requireAdmin, async (req, res) => { try { const result = await pool.query('SELECT id, nombre, username, rol, estado FROM users ORDER BY nombre ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

app.post('/api/users', requireLogin, requireAdmin, async (req, res) => {
    const { nombre, username, password, rol } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (nombre, username, password, rol) VALUES ($1, $2, $3, $4)', [nombre, username, hashedPassword, rol]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { return res.status(409).json({ message: 'El nombre de usuario ya existe.' }); }
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/users/:id/edit-role', requireLogin, requireAdmin, async (req, res) => { const { id } = req.params; const { newRole } = req.body; try { await pool.query('UPDATE users SET rol = $1 WHERE id = $2', [newRole, id]); res.status(200).json({ message: 'Rol actualizado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/users/:id/toggle-status', requireLogin, requireAdmin, async (req, res) => { const { id } = req.params; try { const result = await pool.query('SELECT estado FROM users WHERE id = $1', [id]); const newStatus = result.rows[0].estado === 'activo' ? 'inactivo' : 'activo'; await pool.query('UPDATE users SET estado = $1 WHERE id = $2', [newStatus, id]); res.status(200).json({ message: 'Estado actualizado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.get('/api/advisors', requireLogin, async (req, res) => { try { const result = await pool.query('SELECT * FROM advisors ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/advisors', requireLogin, requireAdmin, async (req, res) => { const { name } = req.body; try { const newAdvisor = await pool.query('INSERT INTO advisors (name) VALUES ($1) RETURNING *', [name]); res.status(201).json(newAdvisor.rows[0]); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.delete('/api/advisors/:id', requireLogin, requireAdmin, async (req, res) => { try { await pool.query('DELETE FROM advisors WHERE id = $1', [req.params.id]); res.status(200).json({ message: 'Asesor eliminado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.get('/api/visits', requireLogin, async (req, res) => { try { const result = await pool.query('SELECT * FROM visits ORDER BY visitdate DESC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

// ==================================================================
// ============== INICIO DE LA SECCIÓN MODIFICADA (VISITAS) ==============
// ==================================================================
app.post('/api/visits', requireLogin, async (req, res) => {
    // Leemos el nuevo campo 'formalizedQuoteId' que viene del formulario
    const { centerName, centerAddress, centerSector, advisorName, visitDate, commentText, contactName, contactNumber, formalizedQuoteId } = req.body;
    
    if (!centerName || !centerAddress) {
        return res.status(400).json({ message: 'El nombre del centro y la dirección son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let centerResult = await client.query('SELECT id FROM centers WHERE name = $1 AND address = $2', [centerName, centerAddress]);
        
        if (centerResult.rows.length === 0) {
            await client.query(
                'INSERT INTO centers (name, address, sector, contactname, contactnumber) VALUES ($1, $2, $3, $4, $5)',
                [centerName, centerAddress, centerSector || '', contactName || '', contactNumber || '']
            );
        } else {
            const centerId = centerResult.rows[0].id;
            if (contactName || contactNumber) {
                 await client.query(
                    'UPDATE centers SET contactname = $1, contactnumber = $2 WHERE id = $3',
                    [contactName || '', contactNumber || '', centerId]
                );
            }
        }

        await client.query(
            'INSERT INTO visits (centername, advisorname, visitdate, commenttext) VALUES ($1, $2, $3, $4)',
            [centerName, advisorName, visitDate, commentText]
        );
        
        // --- NUEVA LÓGICA ---
        // Si la visita es de formalización y se envió un ID de cotización, la actualizamos.
        if (commentText === 'Formalizar Acuerdo' && formalizedQuoteId) {
            await client.query(
                "UPDATE quotes SET status = 'formalizada' WHERE id = $1 AND status = 'aprobada'",
                [formalizedQuoteId]
            );
        }
        
        await client.query('COMMIT');
        res.status(201).json({ message: "Visita registrada y centro de estudios gestionado correctamente." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error al registrar visita:", err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'Ya existe un centro con este nombre y dirección.' });
        }
        res.status(500).json({ message: 'Error en el servidor al registrar la visita.' });
    } finally {
        client.release();
    }
});
// ==================================================================
// ============== FIN DE LA SECCIÓN MODIFICADA (VISITAS) ==============
// ==================================================================

app.get('/api/centers', requireLogin, async (req, res) => {
    try {
        // Obtenemos los posibles filtros desde la URL (ej: /api/centers?advisor=nombre)
        const { advisor, comment } = req.query;

        let queryParams = [];
        let whereClauses = [];

        // Construimos la consulta SQL base
        let query = `
            SELECT
                c.id, c.name, c.address, c.sector, c.contactname, c.contactnumber,
                latest_visit.advisorname,
                latest_visit.commenttext
            FROM
                centers c
            LEFT JOIN LATERAL (
                SELECT v.advisorname, v.commenttext
                FROM visits v
                WHERE v.centername = c.name
                ORDER BY v.visitdate DESC, v.createdat DESC
                LIMIT 1
            ) AS latest_visit ON true
        `;

        // Si se envió un filtro de asesor, lo añadimos a la consulta
        if (advisor) {
            queryParams.push(advisor);
            whereClauses.push(`latest_visit.advisorname = $${queryParams.length}`);
        }

        // Si se envió un filtro de comentario, lo añadimos a la consulta
        if (comment) {
            queryParams.push(comment);
            whereClauses.push(`latest_visit.commenttext = $${queryParams.length}`);
        }

        // Unimos todas las condiciones de filtro
        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        // Añadimos el orden alfabético al final
        query += ' ORDER BY c.name ASC;';
        
        const result = await pool.query(query, queryParams);
        res.json(result.rows);

    } catch (err) {
        console.error('Error al obtener los centros con su última visita:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener la lista de centros.' });
    }
});
app.get('/api/centers/search', requireLogin, async (req, res) => {
    const searchTerm = (req.query.q || '').toLowerCase();
    try {
        const result = await pool.query(
            "SELECT id, name, address, sector, contactname, contactnumber FROM centers WHERE LOWER(name) LIKE $1", 
            [`%${searchTerm}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error en la búsqueda de centros:', err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Se cambia 'requireAdmin' por 'checkRole' para permitir a los Asesores editar.
app.put('/api/centers/:id', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    const { id } = req.params;
    // Se incluyen todos los campos del formulario de edición.
    const { name, address, sector, contactName, contactNumber } = req.body;
    try {
        await pool.query(
            'UPDATE centers SET name = $1, address = $2, sector = $3, contactname = $4, contactnumber = $5 WHERE id = $6',
            [name, address, sector, contactName, contactNumber, id]
        );
        res.status(200).json({ message: 'Centro actualizado con éxito' });
    } catch (err) {
        console.error('Error actualizando centro:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// REEMPLAZA TU RUTA '/api/centers/:id' CON ESTA VERSIÓN MEJORADA

app.delete('/api/centers/:id', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Antes de borrar el centro, obtenemos su nombre.
        const centerResult = await client.query('SELECT name FROM centers WHERE id = $1', [id]);
        if (centerResult.rows.length === 0) {
            throw new Error('Centro no encontrado para eliminar.');
        }
        const centerName = centerResult.rows[0].name;

        // 2. Borramos todas las visitas asociadas.
        await client.query('DELETE FROM visits WHERE centername = $1', [centerName]);

        // 3. Borramos todas las cotizaciones asociadas.
        await client.query('DELETE FROM quotes WHERE clientname = $1', [centerName]);
        
        // 4. Finalmente, borramos el centro.
        await client.query('DELETE FROM centers WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Centro y todos sus datos asociados eliminados con éxito' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error eliminando centro y sus datos asociados:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    } finally {
        client.release();
    }
});
app.get('/api/data', requireLogin, async (req, res) => {
    try {
        const [advisors, comments, centers, zones] = await Promise.all([
            pool.query('SELECT * FROM advisors ORDER BY name ASC'),
            pool.query('SELECT * FROM comments ORDER BY text ASC'),
            pool.query('SELECT * FROM centers ORDER BY name ASC'),
            pool.query('SELECT * FROM zones ORDER BY name ASC')
        ]);
        res.json({ advisors: advisors.rows, comments: comments.rows, centers: centers.rows, zones: zones.rows, products: products });
    } catch (err) { console.error("Error fetching initial data:", err); res.status(500).json({ message: 'Error en el servidor' }); }
});
app.post('/api/quotes/calculate-estimate', requireLogin, (req, res) => {
    const quoteInput = req.body;
    const dbDataForCalculation = { products: products };
    try {
        const estimate = assembleQuote(quoteInput, dbDataForCalculation);
        res.json(estimate);
    } catch (error) {
        console.error("Error en el motor de precios:", error);
        res.status(500).json({ message: "Error al calcular la estimación." });
    }
});

app.post('/api/quote-requests', requireLogin, async (req, res) => { 
    const quoteInput = req.body; 
    const dbDataForCalculation = { products: products }; 
    const calculationResult = assembleQuote(quoteInput, dbDataForCalculation); 

    const { clientName, advisorName, studentCount, productIds, quoteNumber, aporteInstitucion } = quoteInput; 
    
    const { facilidadesAplicadas, items, totals } = calculationResult;
    const precios = calculationResult.calculatedPrices[0] || {};
    const precioFinalPorEstudiante = precios.precioFinalPorEstudiante;
    const estudiantesParaFacturar = precios.estudiantesFacturables;

    try { 
        await pool.query(
            `INSERT INTO quotes (clientname, advisorname, studentcount, productids, preciofinalporestudiante, estudiantesparafacturar, facilidadesaplicadas, items, totals, status, quotenumber, aporte_institucion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente', $10, $11)`,
            [clientName, advisorName, studentCount, productIds, precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, JSON.stringify(items), JSON.stringify(totals), quoteNumber, aporteInstitucion || 0]
        ); 
        res.status(201).json({ message: 'Cotización guardada con éxito' }); 
    } catch (err) { 
        console.error('Error al guardar cotización:', err); 
        res.status(500).json({ message: 'Error interno del servidor.' }); 
    } 
});

app.get('/api/quote-requests', requireLogin, checkRole(['Administrador', 'Asesor' ,'Coordinador']), async (req, res) => {
    const userRole = req.session.user.rol;
    const userName = req.session.user.nombre;

    try {
        const baseQuery = `
            SELECT 
                id, 
                quotenumber AS "quoteNumber", 
                clientname AS "clientName", 
                advisorname AS "advisorName", 
                status, 
                rejectionreason AS "rejectionReason", 
                createdat AS "createdAt" 
            FROM quotes 
        `;

        let query;
        let queryParams = [];

        if (userRole === 'Administrador') {
            query = `${baseQuery} ORDER BY createdat DESC`;
        } else {
            query = `${baseQuery} WHERE advisorname = $1 ORDER BY createdat DESC`;
            queryParams.push(userName);
        }

        const result = await pool.query(query, queryParams);
        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Error fetching quotes:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.get('/api/quotes/approved', requireLogin, async (req, res) => {
    const { clientName } = req.query;
    if (!clientName) {
        return res.status(400).json({ message: 'El nombre del cliente es requerido.' });
    }
    try {
        const result = await pool.query(
            "SELECT id, quotenumber, studentcount, preciofinalporestudiante FROM quotes WHERE clientname = $1 AND status = 'aprobada' ORDER BY createdat DESC",
            [clientName]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener cotizaciones aprobadas:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

app.get('/api/quotes/pending-approval', requireLogin, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM quotes WHERE status = 'pendiente' ORDER BY createdat DESC`);
        res.status(200).json(result.rows);
    } catch (err) { console.error('Error fetching pending quotes:', err); res.status(500).json({ message: 'Error interno del servidor.' }); }
});
app.post('/api/quote-requests/:id/approve', requireLogin, requireAdmin, async (req, res) => { try { await pool.query("UPDATE quotes SET status = 'aprobada' WHERE id = $1", [req.params.id]); res.status(200).json({ message: 'Cotización aprobada con éxito' }); } catch (err) { console.error('Error aprobando cotización:', err); res.status(500).json({ message: 'Error interno del servidor.' }); } });
app.post('/api/quote-requests/:id/reject', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
        return res.status(400).json({ message: 'Se requiere un motivo de rechazo.' });
    }
    try {
        await pool.query("UPDATE quotes SET status = 'rechazada', rejectionreason = $1 WHERE id = $2", [reason, id]);
        res.status(200).json({ message: 'Cotización rechazada con éxito' });
    } catch (err) {
        console.error('Error rechazando cotización:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.post('/api/quote-requests/:id/archive', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    try {
        await pool.query("UPDATE quotes SET status = 'archivada' WHERE id = $1", [req.params.id]);
        res.status(200).json({ message: 'Cotización archivada con éxito' });
    } catch (err) {
        console.error('Error archivando cotización:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// --- INICIO DEL NUEVO CÓDIGO PARA ELIMINAR COTIZACIÓN ---
app.delete('/api/quote-requests/:id', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    const quoteId = req.params.id;
    const user = req.session.user;

    const client = await pool.connect();
    try {
        // Primero, obtenemos la cotización para verificar su estado y propietario
        const quoteResult = await client.query('SELECT status, advisorname FROM quotes WHERE id = $1', [quoteId]);

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Cotización no encontrada.' });
        }
        const quote = quoteResult.rows[0];

        // REGLA 1: No se puede eliminar una cotización formalizada
        if (quote.status === 'formalizada') {
            return res.status(403).json({ message: 'ERROR: No se puede eliminar una cotización que ya ha sido formalizada.' });
        }

        // REGLA 2: Verificar permisos
        // Un Administrador puede borrar todo (excepto lo formalizado).
        // Un Asesor solo puede borrar lo suyo.
        if (user.rol !== 'Administrador' && quote.advisorname !== user.nombre) {
            return res.status(403).json({ message: 'No tienes permiso para eliminar esta cotización.' });
        }

        // Si pasamos las validaciones, procedemos a eliminar usando una transacción
        await client.query('BEGIN');
        // Primero eliminamos los pagos asociados para evitar errores de restricción de clave foránea
        await client.query('DELETE FROM payments WHERE quote_id = $1', [quoteId]);
        // Luego, eliminamos la cotización
        await client.query('DELETE FROM quotes WHERE id = $1', [quoteId]);
        await client.query('COMMIT');
        
        res.status(200).json({ message: 'Cotización eliminada con éxito.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar cotización:', err);
        res.status(500).json({ message: 'Error interno del servidor al intentar eliminar la cotización.' });
    } finally {
        client.release();
    }
});
// --- FIN DEL NUEVO CÓDIGO PARA ELIMINAR COTIZACIÓN ---
// PARA Habilitar acceso a PDF por API Key para panel de admin
app.get('/api/quote-requests/:id/pdf', allowUserOrApiKey, async (req, res) => {
    try {
        const quoteId = req.params.id;
        const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Cotización no encontrada');
        }
        const quote = result.rows[0];
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${quote.quotenumber}.pdf`);
        doc.pipe(res);
        
        const backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete.jpg');
        
        if (fs.existsSync(backgroundImagePath)) {
            doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height });
        }
        const pageMargin = 50;
        const contentWidth = doc.page.width - (pageMargin * 2);
        let currentY = 150; 
        const quoteDate = quote.createdat ? new Date(quote.createdat).toLocaleDateString('es-DO', { timeZone: 'UTC' }) : '';
        doc.font('Helvetica-Bold').fontSize(12).text(quote.quotenumber || '', 450, currentY, { align: 'left' });
        doc.font('Helvetica').fontSize(10).text(quoteDate, 450, currentY + 20, { align: 'left' });
        doc.font('Helvetica-Bold').fontSize(20).text('PROPUESTA', pageMargin, currentY + 40, { align: 'center' });
        currentY += 80;
        doc.font('Helvetica-Bold').fontSize(12).text(`Nombre del centro: ${quote.clientname || 'No especificado'}`, pageMargin, currentY);
        currentY += 20;
        doc.font('Helvetica').fontSize(12).text(`Nombre del Asesor: ${quote.advisorname || 'No especificado'}`, pageMargin, currentY);
        currentY += 30;
        doc.font('Helvetica').fontSize(10).text('Nos complace presentarle el presupuesto detallado. Este documento ha sido diseñado para ofrecerle una visión clara y transparente de los costos asociados a su proyecto, asegurando que cada aspecto esté cuidadosamente considerado y alineado con sus necesidades.', pageMargin, currentY, { 
            align: 'justify',
            width: contentWidth
        });
        doc.y = doc.y + 20;
        const selectedProducts = (quote.productids || []).map(id => products.find(p => p.id == id)).filter(p => p);
        if (selectedProducts.length > 0) {
            selectedProducts.forEach(product => {
                doc.font('Helvetica-Bold').fontSize(12).text(product['PRODUCTO / SERVICIO'].trim());
                doc.moveDown(0.5);
                const detail = product['DETALLE / INCLUYE'];
                if (detail && detail.trim() !== '') {
                    const detailItems = detail.split(',').map(item => `- ${item.trim()}`);
                    doc.font('Helvetica').fontSize(10).list(detailItems, {
                        width: contentWidth - 20,
                        lineGap: 2,
                        bulletIndent: 20
                    });
                }
                doc.moveDown();
            });
        }
        doc.moveTo(pageMargin, doc.y).lineTo(doc.page.width - pageMargin, doc.y).stroke();
        doc.moveDown();
        const pricePerStudent = quote.preciofinalporestudiante || 0;
        doc.font('Helvetica-Bold').fontSize(12).text('Presupuesto por estudiante:', { align: 'right', width: contentWidth - 110 });
        doc.font('Helvetica-Bold').fontSize(14).text(`RD$ ${parseFloat(pricePerStudent).toFixed(2)}`, { align: 'right' });
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(12).text('Comentarios y Condiciones:');
        doc.moveDown(0.5);
        
        const aporteValor = quote.aporte_institucion || 0;
        const codigoSecreto = `codigo wxz(${parseFloat(aporteValor).toFixed(0)})api`;

        const conditions = [
            `Cálculo basado en ${quote.studentcount || 0} estudiantes y evaluable a un mínimo de ${quote.estudiantesparafacturar || 0} estudiantes.`,
            'Condiciones de Pago a debatir.',
            codigoSecreto
        ];
        
        doc.font('Helvetica').fontSize(10).list(conditions, {
            width: contentWidth,
            lineGap: 2,
            bulletRadius: 1.5,
        });
        doc.moveDown();
        if(quote.facilidadesaplicadas && quote.facilidadesaplicadas.length > 0) {
            doc.font('Helvetica-Bold').fontSize(10).text('Facilidades Aplicadas:');
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(10).list(quote.facilidadesaplicadas, {
                width: contentWidth,
                lineGap: 2,
                bulletRadius: 1.5,
            });
            doc.moveDown();
        }
        doc.font('Helvetica').fontSize(10).text('Agradecemos la oportunidad de colaborar con usted y estamos comprometidos a brindarle un servicio excepcional. Si tiene alguna pregunta o necesita más detalles, no dude en ponerse en contacto con nosotros.', {
            align: 'justify',
            width: contentWidth
        });
        doc.end();
    } catch (error) {
        console.error('Error al generar el PDF:', error);
        res.status(500).send('Error interno al generar el PDF');
    }
});// ======================================================================
// ========= INICIO: RUTA DEFINITIVA PARA GENERAR PDF DEL ACUERDO =======
// ======================================================================
app.get('/api/agreements/:id/pdf', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    try {
        const quoteId = req.params.id;
        const client = await pool.connect();
        let quote;

        try {
            const quoteResult = await client.query("SELECT * FROM quotes WHERE id = $1 AND status = 'formalizada'", [quoteId]);
            if (quoteResult.rows.length === 0) {
                client.release();
                return res.status(404).send('Acuerdo no encontrado o la cotización no está formalizada.');
            }
            quote = quoteResult.rows[0];
        } finally {
            client.release();
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=ACUERDO-${quote.quotenumber}.pdf`);
        doc.pipe(res);

        // 1. DIBUJAR EL MEMBRETE (SOLO EN LA PRIMERA PÁGINA)
        const backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete.jpg');
        if (fs.existsSync(backgroundImagePath)) {
            doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height });
        }
        
        const pageMargin = 60;
        const contentWidth = doc.page.width - (pageMargin * 2);

        // 2. TÍTULO Y PARTES DEL ACUERDO
        doc.font('Helvetica-Bold').fontSize(16).text('Acuerdo de Colaboración de Servicios', pageMargin, 200, { 
            align: 'center', 
            width: contentWidth 
        });
        doc.moveDown(4);

        // Párrafo introductorio
        doc.font('Helvetica', 11)
           .text(`Este acuerdo se celebra el día ${new Date().toLocaleDateString('es-DO', { timeZone: 'UTC' })}, con el fin de establecer una colaboración profesional entre:`, {
            align: 'justify',
            width: contentWidth
        });
        doc.moveDown(1.5);

        // Partes
        doc.font('Helvetica-Bold', 12).text('Be Eventos SRL ("El Organizador")', { continued: true })
           .font('Helvetica', 11).text(', una empresa dedicada a la creación de momentos inolvidables, con RNC 1326794412 y domicilio en Calle Acacias No. 15B, Jardines del Ozama, Santo Domingo Este.');
        doc.moveDown(1);
        doc.font('Helvetica', 11).text('y');
        doc.moveDown(1);
        doc.font('Helvetica-Bold', 12).text(`${quote.clientname} ("El Centro")`, { continued: true })
           .font('Helvetica', 11).text(', con quien nos complace colaborar.');
        doc.moveDown(3);

        // 3. SECCIONES DEL ACUERDO
        const drawSection = (title, content) => {
            if (doc.y > 650) doc.addPage(); // <-- Agrega página en blanco si no hay espacio
            doc.font('Helvetica-Bold').fontSize(11).text(title);
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(10).text(content, { align: 'justify', width: contentWidth });
            doc.moveDown(1.5);
        };

        drawSection('1. Nuestro Propósito Común', 'Ambas partes unimos esfuerzos para la colaboración creativa, montaje o ejecución de un evento, asegurando una experiencia de la más alta calidad para todos los involucrados. Los servicios específicos, productos y detalles de esta colaboración se encuentran desglosados en la propuesta adjunta, que forma parte integral de este acuerdo.');
        
        if (doc.y > 650) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(11).text('2. Detalle de la Experiencia (Servicios Contratados)');
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).text(`Nos emociona crear la siguiente experiencia, cuyos detalles se describen en la Propuesta de Servicios No. ${quote.quotenumber}, la cual se adjunta y forma parte integral de este acuerdo:`);
        doc.moveDown(1);

        const selectedProducts = (quote.productids || []).map(id => products.find(p => p.id == id)).filter(p => p);
        if (selectedProducts.length > 0) {
            selectedProducts.forEach(product => {
                if (doc.y > 680) doc.addPage(); // <-- Agrega página en blanco
                doc.font('Helvetica-Bold').fontSize(10).text(product['PRODUCTO / SERVICIO'].trim(), { indent: 15 });
                const detail = product['DETALLE / INCLUYE'];
                if (detail && detail.trim() !== '') {
                    const detailItems = detail.split(',').map(item => `${item.trim()}`);
                    doc.font('Helvetica').fontSize(9).list(detailItems, { bulletIndent: 30, textIndent: 30, lineGap: 2, width: contentWidth - 30 });
                }
                doc.moveDown(0.8);
            });
        }
        doc.moveDown(1);
        
        if (doc.y > 500) doc.addPage();
        
        drawSection('3. Fechas Clave para Recordar', 'Las fechas principales del evento o actividades relacionadas serán coordinadas y confirmadas entre ambas partes a través de los canales de comunicación habituales.');
        
        drawSection('4. Acuerdo Económico', `El valor de la experiencia diseñada es de RD$ ${parseFloat(quote.preciofinalporestudiante).toFixed(2)} por estudiante.\n\nLa forma y el calendario de pagos serán coordinados y acordados directamente entre ambas partes para asegurar la comodidad y viabilidad del proyecto.\n\nSe acuerda que el Centro no asumirá el costo de los estudiantes que decidan no participar. Si el número final de participantes es inferior a ${quote.estudiantesparafacturar}, se revisará el acuerdo para un ajuste justo y transparente.`);

        drawSection('5. Nuestro Compromiso Mutuo', 'Calidad y Confianza: Be Eventos se compromete a entregar cada servicio con la máxima calidad. Si se sustituye un servicio, será por otro de valor y calidad equivalentes.\nColaboración: El Centro se compromete a facilitar la comunicación y coordinación necesarias.\nUso de Imagen: El Centro autoriza la realización de fotografías y grabaciones del evento para el disfrute y recuerdo de la comunidad educativa.');
        drawSection('6. Marco Legal', 'Este acuerdo se rige por las leyes de la República Dominicana. Cualquier modificación será formalizada por escrito entre ambas partes.');

        if (doc.y > doc.page.height - 200) doc.addPage();
        
        // 6. FIRMAS
        const signatureY = doc.page.height - 180;
        const signatureLineY = signatureY + 35;
        const col1X = pageMargin;
        const col2X = doc.page.width / 2;
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('___________________________', col1X, signatureY);
        doc.text('___________________________', col2X, signatureY, { align: 'right' });
        doc.text('Moisés Gross López', col1X, signatureLineY + 5);
        doc.text('[Nombre Representante]', col2X, signatureLineY + 5, { align: 'right' });
        doc.text('Gerente General', col1X, signatureLineY + 20);
        doc.text('Director(a) del Centro', col2X, signatureLineY + 20, { align: 'right' });
        doc.text('Cédula: 001-1189663-5', col1X, signatureLineY + 35);
        doc.text('Cédula: [Cédula Representante]', col2X, signatureLineY + 35, { align: 'right' });

        doc.end();

    } catch (error) {
        console.error('Error al generar el PDF del acuerdo:', error);
        res.status(500).send('Error interno al generar el PDF del acuerdo.');
    }
});

// ======================================================================
// ========= INICIO: NUEVA RUTA PARA OBTENER DETALLES DE COTIZACIÓN =====
// ======================================================================
app.get('/api/quote-requests/:id/details', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Cotización no encontrada.' });
        }

        const quote = result.rows[0];

        // Buscar los nombres de los productos basados en sus IDs
        const productDetails = (quote.productids || []).map(productId => {
            const product = products.find(p => p.id == productId);
            return product ? product['PRODUCTO / SERVICIO'] : 'Producto no encontrado';
        });

        // Preparar la respuesta con toda la información necesaria
        const responseData = {
            quoteNumber: quote.quotenumber,
            rejectionReason: quote.rejectionreason,
            products: productDetails,
            studentCount: quote.studentcount,
            pricePerStudent: quote.preciofinalporestudiante
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error al obtener detalles de la cotización:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});
// ======================================================================
// ========= RUTA ACTUALIZADA PARA EL RANKING DE ASESORES (LÓGICA ESTRICTA) =====
// ======================================================================
app.get('/api/advisor-ranking', requireLogin, async (req, res) => {
    try {
        // CORRECCIÓN: Esta consulta ahora solo cuenta si 'Formalizar Acuerdo'
        // es la ÚLTIMA visita registrada para un centro existente.
        const query = `
            WITH LatestVisits AS (
                SELECT
                    v.advisorname,
                    v.commenttext,
                    ROW_NUMBER() OVER(PARTITION BY v.centername ORDER BY v.visitdate DESC, v.createdat DESC) as rn
                FROM
                    visits v
                INNER JOIN
                    centers c ON v.centername = c.name
            )
            SELECT
                advisorname,
                COUNT(*) AS formalized_count
            FROM
                LatestVisits
            WHERE
                rn = 1 AND LOWER(TRIM(commenttext)) = 'formalizar acuerdo'
            GROUP BY
                advisorname
            ORDER BY
                formalized_count DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener el ranking de asesores:', error);
        res.status(500).json({ message: 'Error en el servidor al consultar el ranking.' });
    }
});
// ======================================================================
// ========= FIN: RUTA ACTUALIZADA PARA EL RANKING DE ASESORES =========
// ======================================================================


// ======================================================================
// ========= INICIO: NUEVA RUTA PARA RANKING DE VISITAS TOTALES =========
// ======================================================================
app.get('/api/advisor-visit-ranking', requireLogin, async (req, res) => {
    try {
        // Esta consulta cuenta TODAS las visitas de asesores a centros existentes.
        const query = `
            SELECT 
                v.advisorname, 
                COUNT(*) AS visit_count
            FROM 
                visits v
            INNER JOIN 
                centers c ON v.centername = c.name
            GROUP BY 
                v.advisorname
            ORDER BY 
                visit_count DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener el ranking de visitas:', error);
        res.status(500).json({ message: 'Error en el servidor al consultar el ranking de visitas.' });
    }
});
// ======================================================================
// ========= FIN: NUEVA RUTA PARA RANKING DE VISITAS TOTALES ==========
// ======================================================================

// ======================================================================
// ========= INICIO: RUTA PARA EL CÁLCULO DE DESEMPEÑO (70/30) ==========
// ======================================================================
app.get('/api/advisor-performance', requireLogin, async (req, res) => {
    try {
        console.log("Iniciando cálculo de /api/advisor-performance...");

        const query = `
            WITH VisitCounts AS (
                SELECT v.advisorname, COUNT(*) AS visit_count
                FROM visits v
                JOIN centers c ON v.centername = c.name
                GROUP BY v.advisorname
            ),
            FormalizationCounts AS (
                SELECT v.advisorname, COUNT(*) AS formalization_count
                FROM visits v
                JOIN centers c ON v.centername = c.name
                WHERE LOWER(TRIM(v.commenttext)) = 'formalizar acuerdo'
                GROUP BY v.advisorname
            )
            SELECT
                vc.advisorname,
                vc.visit_count,
                COALESCE(fc.formalization_count, 0) AS formalization_count
            FROM VisitCounts vc
            LEFT JOIN FormalizationCounts fc ON vc.advisorname = fc.advisorname;
        `;

        const { rows: advisorsData } = await pool.query(query);
        console.log(`Datos crudos de la BD: ${advisorsData.length} asesores encontrados.`);

        if (advisorsData.length === 0) {
            console.log("No hay datos de asesores, devolviendo array vacío.");
            return res.json([]);
        }

        const maxVisits = Math.max(...advisorsData.map(a => a.visit_count));
        const maxFormalizations = Math.max(...advisorsData.map(a => a.formalization_count));
        console.log(`Valores máximos - Visitas: ${maxVisits}, Formalizaciones: ${maxFormalizations}`);

        const performanceData = advisorsData.map(advisor => {
            const visitScore = (maxVisits > 0) ? (advisor.visit_count / maxVisits) * 70 : 0;
            const formalizationScore = (maxFormalizations > 0) ? (advisor.formalization_count / maxFormalizations) * 30 : 0;
            const totalScore = visitScore + formalizationScore;

            return {
                advisorname: advisor.advisorname,
                performance_score: parseFloat(totalScore.toFixed(1))
            };
        });

        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        console.log("Cálculo de desempeño completado exitosamente.");

        res.json(performanceData);

    } catch (error) {
        console.error('ERROR DETALLADO en /api/advisor-performance:', error);
        res.status(500).json({
            message: 'Error en el servidor al calcular el desempeño.',
            error: error.message
        });
    }
});
// ======================================================================
// ========= FIN: RUTA PARA EL CÁLCULO DE DESEMPEÑO (70/30) =============
// ======================================================================

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
// --- INICIO DEL CÓDIGO AÑADIDO ---
// Regla de seguridad específica para el reporte de visitas, ANTES de la regla general.
app.get('/reporte_visitas.html', requireLogin, checkRole(['Administrador', 'Coordinador']), (req, res) => {
    const requestedPath = path.join(__dirname, req.path);
    if (fs.existsSync(requestedPath)) {
        res.sendFile(requestedPath);
    } else {
        res.status(404).send('Página no encontrada');
    }
});
// --- FIN DEL CÓDIGO AÑADIDO ---
app.get('/*.html', requireLogin, (req, res) => { const requestedPath = path.join(__dirname, req.path); if (fs.existsSync(requestedPath)) { res.sendFile(requestedPath); } else { res.status(404).send('Página no encontrada'); } });

app.listen(PORT, async () => {
    loadProducts();
    await initializeDatabase();
    console.log(`✅ Servidor de Asesores (v17.1 - CORS Habilitado) corriendo en el puerto ${PORT}`);
});
