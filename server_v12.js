// ============== SERVIDOR DE ASESORES Y VENTAS (v17.4 - API de Asesores) ==============
const { Pool } = require('pg');
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');




const { assembleQuote } = require('./pricingEngine.js');
const { checkRole } = require('./permissions.js');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// --- INICIO: CONFIGURACIÓN DE SEGURIDAD PARA API ---
const API_KEY = process.env.GESTION_API_KEY;
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
        // ¡NUEVO! Añadimos esta línea para eliminar la tabla incorrecta antes de volver a crearla.
        // await client.query('DROP TABLE IF EXISTS formalized_centers;');
        
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

            -- TABLA CORREGIDA: Se añade la restricción UNIQUE a center_id
            CREATE TABLE IF NOT EXISTS formalized_centers (
                id SERIAL PRIMARY KEY,
                center_id INTEGER REFERENCES centers(id) ON DELETE CASCADE UNIQUE,
                center_name VARCHAR(255) NOT NULL,
                advisor_name VARCHAR(255),
                quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
                quote_number VARCHAR(50),
                formalization_date TIMESTAMPTZ DEFAULT NOW()
            );
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
        // Esta consulta busca en 'Visitas' y verifica que el centro exista.
        // No busca el número de cotización para evitar errores por ahora.
        const query = `
            SELECT DISTINCT v.centername AS name
            FROM visits v
            INNER JOIN centers c ON TRIM(v.centername) = TRIM(c.name)
            WHERE LOWER(TRIM(v.commenttext)) = 'formalizar acuerdo'
            ORDER BY name ASC;
        `;
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            return res.status(204).send();
        }
        res.json(result.rows);

    } catch (err) {
        console.error('Error al obtener centros formalizados por visita:', err);
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

// REEMPLAZA TU RUTA 'app.post('/api/visits', ...)' EXISTENTE CON ESTA VERSIÓN COMPLETA

app.post('/api/visits', requireLogin, async (req, res) => {
    const { centerName, centerAddress, centerSector, advisorName, visitDate, commentText, contactName, contactNumber, formalizedQuoteId } = req.body;
    
    if (!centerName || !centerAddress) {
        return res.status(400).json({ message: 'El nombre del centro y la dirección son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Lógica para crear o actualizar el centro (SIN CAMBIOS)
        let centerResult = await client.query('SELECT id FROM centers WHERE name = $1 AND address = $2', [centerName, centerAddress]);
        let centerId;
        if (centerResult.rows.length === 0) {
            const newCenterResult = await client.query(
                'INSERT INTO centers (name, address, sector, contactname, contactnumber, etapa_venta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [centerName, centerAddress, centerSector || '', contactName || '', contactNumber || '', 'Prospecto']
            );
            centerId = newCenterResult.rows[0].id;
        } else {
            centerId = centerResult.rows[0].id;
            if (contactName || contactNumber) {
                 await client.query(
                     'UPDATE centers SET contactname = $1, contactnumber = $2 WHERE id = $3',
                     [contactName || '', contactNumber || '', centerId]
                 );
            }
        }

        // Registrar la visita (SIN CAMBIOS)
        await client.query(
            'INSERT INTO visits (centername, advisorname, visitdate, commenttext) VALUES ($1, $2, $3, $4)',
            [centerName, advisorName, visitDate, commentText]
        );
        
        // ==========================================================
        // ========= INICIO DE LA NUEVA LÓGICA DE ETAPAS ============
        // ==========================================================
        
        // 1. Determinamos la nueva etapa de venta basándonos en el comentario.
        let newStage = null;
        switch (commentText) {
            case 'Presentacion de Propuesta a Direccion':
            case 'Presentacion de Propuesta a Estudiantes':
                newStage = 'Cotización Presentada';
                break;
            case 'Visita de Seguimiento':
                newStage = 'Negociación';
                break;
            case 'Formalizar Acuerdo':
                newStage = 'Acuerdo Formalizado';
                break;
            case 'No Logrado':
                newStage = 'No Logrado';
                break;
        }

        // 2. Si el comentario indica un cambio de etapa, actualizamos el centro.
        if (newStage) {
            await client.query(
                'UPDATE centers SET etapa_venta = $1 WHERE id = $2',
                [newStage, centerId]
            );
        }

        // ==========================================================
        // ========= FIN DE LA NUEVA LÓGICA DE ETAPAS ===============
        // ==========================================================
        
        // Lógica de formalización (SIN CAMBIOS)
        if (commentText === 'Formalizar Acuerdo' && formalizedQuoteId) {
            const quoteUpdateResult = await client.query(
                "UPDATE quotes SET status = 'formalizada' WHERE id = $1 AND (status = 'aprobada' OR status = 'archivada') RETURNING quotenumber",
                [formalizedQuoteId]
            );

            if (quoteUpdateResult.rowCount > 0) {
                const quoteNumber = quoteUpdateResult.rows[0].quotenumber;
                await client.query(`
                    INSERT INTO formalized_centers (center_id, center_name, advisor_name, quote_id, quote_number)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (center_id) DO UPDATE SET
                        advisor_name = EXCLUDED.advisor_name,
                        quote_id = EXCLUDED.quote_id,
                        quote_number = EXCLUDED.quote_number,
                        formalization_date = NOW();
                `, [centerId, centerName, advisorName, formalizedQuoteId, quoteNumber]);
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ message: "Visita registrada y centro de estudios gestionado correctamente." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error al registrar visita:", err);
        res.status(500).json({ message: 'Error en el servidor al registrar la visita.' });
    } finally {
        client.release();
    }
});
app.get('/api/centers', requireLogin, async (req, res) => {
    try {
        const { advisor, comment } = req.query;
        let queryParams = [];
        let whereClauses = [];

        // CORRECCIÓN: Ahora también seleccionamos la fecha de la última visita (visitdate)
        let query = `
            SELECT
                c.id, c.name, c.address, c.sector, c.contactname, c.contactnumber,
                latest_visit.advisorname,
                latest_visit.commenttext,
                latest_visit.visitdate 
            FROM
                centers c
            LEFT JOIN LATERAL (
                SELECT v.advisorname, v.commenttext, v.visitdate
                FROM visits v
                WHERE v.centername = c.name
                ORDER BY v.visitdate DESC, v.createdat DESC
                LIMIT 1
            ) AS latest_visit ON true
        `;

        if (advisor) {
            queryParams.push(advisor);
            whereClauses.push(`latest_visit.advisorname = $${queryParams.length}`);
        }
        if (comment) {
            queryParams.push(comment);
            whereClauses.push(`latest_visit.commenttext = $${queryParams.length}`);
        }
        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        query += ' ORDER BY c.name ASC;';
        
        const result = await pool.query(query, queryParams);
        res.json(result.rows);

    } catch (err) {
        console.error('Error al obtener los centros con su última visita:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener la lista de centros.' });
    }
});
app.get('/api/centers/search', async (req, res) => {
    console.log("¡PETICIÓN RECIBIDA EN RUTA PÚBLICA /api/centers/search!"); // <-- AÑADE ESTO
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
    // 1. Añadimos 'membrete_tipo' a la lista de datos que recibimos
    const { clientName, advisorName, studentCount, productIds, quoteNumber, aporteInstitucion, membrete_tipo } = req.body; 
    
    const quoteInput = { clientName, advisorName, studentCount, productIds, quoteNumber, aporteInstitucion, membrete_tipo };
    const dbDataForCalculation = { products: products }; 
    const calculationResult = assembleQuote(quoteInput, dbDataForCalculation); 

    const { facilidadesAplicadas, items, totals } = calculationResult;
    const precios = calculationResult.calculatedPrices[0] || {};
    const precioFinalPorEstudiante = precios.precioFinalPorEstudiante;
    const estudiantesParaFacturar = precios.estudiantesFacturables;

    try { 
        // 2. Añadimos la nueva columna 'membrete_tipo' a la consulta para guardarla
        await pool.query(
            `INSERT INTO quotes (clientname, advisorname, studentcount, productids, preciofinalporestudiante, estudiantesparafacturar, facilidadesaplicadas, items, totals, status, quotenumber, aporte_institucion, membrete_tipo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente', $10, $11, $12)`,
            [clientName, advisorName, studentCount, productIds, precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, JSON.stringify(items), JSON.stringify(totals), quoteNumber, aporteInstitucion || 0, membrete_tipo || 'Be Eventos']
        ); 
        res.status(201).json({ message: 'Cotización guardada con éxito' }); 
    } catch (err) { 
        console.error('Error al guardar cotización:', err); 
        res.status(500).json({ message: 'Error interno del servidor.' }); 
    } 
});
app.get('/api/quote-requests', requireLogin, checkRole(['Administrador', 'Asesor', 'Coordinador']), async (req, res) => {
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

        // Esta es la lógica correcta y final
        if (userRole === 'Administrador') {
            // El administrador ve todo
            query = `${baseQuery} ORDER BY createdat DESC`;
        } else {
            // Un asesor o coordinador solo ve lo suyo
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
            "SELECT id, quotenumber, studentcount, preciofinalporestudiante FROM quotes WHERE clientname = $1 AND (status = 'aprobada' OR status = 'archivada') ORDER BY createdat DESC",
            [clientName]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener cotizaciones aprobadas/archivadas:', err);
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

// REEMPLAZA ESTE BLOQUE COMPLETO EN TU server.js
app.delete('/api/quote-requests/:id', requireLogin, checkRole(['Administrador', 'Coordinador', 'Asesor']), async (req, res) => {
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
        // Un Administrador o Coordinador puede borrar todo (excepto lo formalizado).
        // Un Asesor solo puede borrar lo suyo.
        if (user.rol === 'Asesor' && quote.advisorname !== user.nombre) {
            return res.status(403).json({ message: 'No tienes permiso para eliminar esta cotización.' });
        }

        // Si pasamos las validaciones, procedemos a eliminar
        await client.query('BEGIN');
        await client.query('DELETE FROM payments WHERE quote_id = $1', [quoteId]);
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
        
        // --- LÓGICA DE SELECCIÓN DE MEMBRETE ---
      let backgroundImagePath;
      if (quote.membrete_tipo === 'Peque Planner') {
          backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete_peque_planner.jpg');
      } else {
          // Si es 'Be Eventos' o cualquier otro caso, usa el membrete normal
          backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete.jpg');
      }
      
      if (fs.existsSync(backgroundImagePath)) {
          doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height });
      }
      // --- FIN DE LA LÓGICA ---
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
});
// ======================================================================
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
// ========= INICIO: APIS PARA IDE Y PULSO DE EQUIPO ====================
// ======================================================================

// 1. API PARA EL ÍNDICE DE DESEMPEÑO ESTRATÉGICO (IDE)
app.get('/api/strategic-performance-index', requireLogin, async (req, res) => {
    try {
        // Obtenemos los datos base de los otros rankings
        const reachQuery = `SELECT advisorname, COUNT(DISTINCT centername) as value FROM visits GROUP BY advisorname`;
        const followUpQuery = `WITH LastVisits AS (SELECT v.advisorname, (CURRENT_DATE - v.visitdate) AS days FROM visits v JOIN centers c ON v.centername = c.name WHERE c.etapa_venta NOT IN ('Acuerdo Formalizado', 'No Logrado')) SELECT advisorname, AVG(days) as value FROM LastVisits GROUP BY advisorname`;
        const conversionQuery = `WITH M AS (SELECT advisorname, COUNT(DISTINCT centername) AS total FROM visits GROUP BY advisorname), F AS (SELECT advisor_name, COUNT(*) AS total FROM formalized_centers GROUP BY advisor_name) SELECT M.advisorname, (COALESCE(F.total, 0) * 100.0 / M.total) AS value FROM M LEFT JOIN F ON M.advisorname = F.advisor_name`;

        const [reachRes, followUpRes, conversionRes] = await Promise.all([
            pool.query(reachQuery),
            pool.query(followUpQuery),
            pool.query(conversionQuery)
        ]);

        const advisors = {};
        const initAdvisor = (name) => {
            if (!advisors[name]) {
                advisors[name] = { advisorname: name, reach: 0, followUp: 0, conversion: 0 };
            }
        };

        reachRes.rows.forEach(r => { initAdvisor(r.advisorname); advisors[r.advisorname].reach = parseFloat(r.value); });
        followUpRes.rows.forEach(r => { initAdvisor(r.advisorname); advisors[r.advisorname].followUp = parseFloat(r.value); });
        conversionRes.rows.forEach(r => { initAdvisor(r.advisorname); advisors[r.advisorname].conversion = parseFloat(r.value); });

        const advisorList = Object.values(advisors);
        const maxReach = Math.max(...advisorList.map(a => a.reach));
        const followUpDays = advisorList.filter(a => a.followUp > 0).map(a => a.followUp);
        const minFollowUp = Math.min(...followUpDays);
        const maxFollowUp = Math.max(...followUpDays);
        const maxConversion = Math.max(...advisorList.map(a => a.conversion));

        const performanceData = advisorList.map(advisor => {
            const reachScore = (maxReach > 0) ? (advisor.reach / maxReach) : 0;
            let followUpScore = 0;
            if (advisor.followUp > 0) {
                if (maxFollowUp === minFollowUp) {
                    followUpScore = 1;
                } else {
                    followUpScore = 1 - ((advisor.followUp - minFollowUp) / (maxFollowUp - minFollowUp));
                }
            }
            const conversionScore = (maxConversion > 0) ? (advisor.conversion / maxConversion) : 0;

            const totalScore = (reachScore * 40) + (followUpScore * 40) + (conversionScore * 20);
            return { advisorname: advisor.advisorname, performance_score: totalScore };
        });

        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        res.json(performanceData);
    } catch (err) {
        console.error("Error al calcular el IDE:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// 2. API PARA EL PANEL "PULSO DEL EQUIPO"
app.get('/api/team-pulse', requireLogin, checkRole(['Administrador', 'Coordinador']), async (req, res) => {
    try {
        const activeProspectsQuery = `SELECT COUNT(*) as value FROM centers WHERE etapa_venta NOT IN ('Acuerdo Formalizado', 'No Logrado')`;
        const conversionRateQuery = `SELECT (SELECT COUNT(*) FROM formalized_centers) * 100.0 / (SELECT COUNT(DISTINCT centername) FROM visits) as value`;
        const salesCycleQuery = `WITH FirstVisits AS (SELECT centername, MIN(visitdate) as first_visit_date FROM visits GROUP BY centername) SELECT AVG(fc.formalization_date::date - fv.first_visit_date) as value FROM formalized_centers fc JOIN FirstVisits fv ON fc.center_name = fv.centername`;
        const bottleneckQuery = `SELECT etapa_venta as value, COUNT(*) as count FROM centers WHERE etapa_venta NOT IN ('Prospecto', 'Acuerdo Formalizado', 'No Logrado') GROUP BY etapa_venta ORDER BY count DESC LIMIT 1`;

        const [activeProspectsRes, conversionRateRes, salesCycleRes, bottleneckRes] = await Promise.all([
            pool.query(activeProspectsQuery),
            pool.query(conversionRateQuery),
            pool.query(salesCycleQuery),
            pool.query(bottleneckQuery)
        ]);

        res.json({
            activeProspects: activeProspectsRes.rows[0]?.value || 0,
            overallConversionRate: parseFloat(conversionRateRes.rows[0]?.value || 0).toFixed(1),
            averageSalesCycle: parseFloat(salesCycleRes.rows[0]?.value || 0).toFixed(0),
            mainBottleneck: bottleneckRes.rows[0]?.value || 'N/A'
        });
    } catch (err) {
        console.error("Error al calcular el Pulso del Equipo:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// ======================================================================
// ========= FIN: APIS PARA IDE Y PULSO DE EQUIPO =======================
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
// ========= INICIO: HERRAMIENTA DE DEBUG PARA VER TABLAS CRUDAS ========
// ======================================================================
app.get('/api/debug/raw-table', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { tableName } = req.query;

        // Lista de tablas permitidas para evitar riesgos de seguridad
        const allowedTables = ['centers', 'visits', 'quotes', 'users', 'advisors', 'formalized_centers'];

        if (!tableName || !allowedTables.includes(tableName)) {
            return res.status(400).json({ message: 'Nombre de tabla no válido o no permitido.' });
        }

        // Usamos una sintaxis segura para construir la consulta
        const query = `SELECT * FROM ${tableName} ORDER BY id DESC;`;
        const result = await pool.query(query);
        
        res.json(result.rows);

    } catch (error) {
        console.error(`Error al leer la tabla cruda ${req.query.tableName}:`, error);
        res.status(500).json({ message: 'Error en el servidor al leer la tabla.' });
    }
});
// ======================================================================
// ========= FIN: HERRAMIENTA DE DEBUG PARA VER TABLAS CRUDAS ===========
// ======================================================================

// ======================================================================
// ========= INICIO: HERRAMIENTA DE AUDITORÍA DE RANKING DE SEGUIMIENTO ==
// ======================================================================
app.get('/api/debug/audit-advisor-follow-up', requireLogin, requireAdmin, async (req, res) => {
    const { advisor } = req.query;

    if (!advisor) {
        return res.status(400).send('<h1>Error</h1><p>Debes especificar un asesor en la URL. Ejemplo: ...?advisor=Isolina%20Pacheco</p>');
    }

    try {
        // Consulta para obtener la última visita de CADA centro asociado al asesor
        const query = `
            WITH ActiveCentersLastVisit AS (
                SELECT
                    c.name AS center_name,
                    latest_visit.visitdate,
                    (CURRENT_DATE - latest_visit.visitdate) AS days_since_last_visit
                FROM
                    centers c
                JOIN LATERAL (
                    SELECT v.advisorname, v.commenttext, v.visitdate
                    FROM visits v
                    WHERE v.centername = c.name AND v.advisorname = $1
                    ORDER BY v.visitdate DESC, v.createdat DESC
                    LIMIT 1
                ) AS latest_visit ON true
                WHERE
                    latest_visit.commenttext NOT IN ('Formalizar Acuerdo', 'No Logrado')
            )
            SELECT * FROM ActiveCentersLastVisit ORDER BY days_since_last_visit DESC;
        `;
        
        const { rows: centers } = await pool.query(query, [advisor]);

        if (centers.length === 0) {
            return res.send(`<h1>Auditoría para ${advisor}</h1><p>No se encontraron centros de seguimiento activo para este asesor.</p>`);
        }

        // Construir la respuesta HTML
        let htmlResponse = `<h1>Auditoría de Seguimiento para: ${advisor}</h1>`;
        htmlResponse += `<p>Se encontraron ${centers.length} centros en seguimiento activo.</p>`;
        htmlResponse += '<table border="1" cellpadding="5" cellspacing="0"><tr><th>Centro</th><th>Días Transcurridos</th></tr>';
        
        let totalDays = 0;
        centers.forEach(center => {
            totalDays += center.days_since_last_visit;
            htmlResponse += `<tr><td>${center.center_name}</td><td>${center.days_since_last_visit}</td></tr>`;
        });

        const average = totalDays / centers.length;

        htmlResponse += '</table>';
        htmlResponse += `<hr>`;
        htmlResponse += `<h2>Cálculo Final</h2>`;
        htmlResponse += `<p><strong>Suma Total de Días:</strong> ${totalDays}</p>`;
        htmlResponse += `<p><strong>Cantidad de Centros:</strong> ${centers.length}</p>`;
        htmlResponse += `<p><strong>Promedio (Total Días / Cantidad Centros):</strong> ${average.toFixed(1)} días</p>`;

        res.status(200).send(htmlResponse);

    } catch (err) {
        console.error('Error en la herramienta de auditoría:', err);
        res.status(500).send('Error en el servidor al realizar la auditoría.');
    }
});
// ======================================================================
// ========= FIN: HERRAMIENTA DE AUDITORÍA ==============================
// ======================================================================

// ======================================================================
// ========= INICIO: RUTA PARA RANKING DE EFICIENCIA DE SEGUIMIENTO =====
// ======================================================================
app.get('/api/advisor-follow-up-ranking', requireLogin, async (req, res) => {
    try {
        // Esta consulta calcula el promedio de días desde la última visita
        // para todos los centros que no están en un estado final.
        const query = `
            WITH ActiveCentersLastVisit AS (
                SELECT
                    latest_visit.advisorname,
                    (CURRENT_DATE - latest_visit.visitdate) AS days_since_last_visit
                FROM
                    centers c
                JOIN LATERAL (
                    SELECT v.advisorname, v.commenttext, v.visitdate
                    FROM visits v
                    WHERE v.centername = c.name
                    ORDER BY v.visitdate DESC, v.createdat DESC
                    LIMIT 1
                ) AS latest_visit ON true
                WHERE latest_visit.commenttext NOT IN ('Formalizar Acuerdo', 'No Logrado')
            )
            SELECT
                advisorname,
                AVG(days_since_last_visit) AS average_follow_up_days
            FROM
                ActiveCentersLastVisit
            WHERE
                advisorname IS NOT NULL
            GROUP BY
                advisorname
            ORDER BY
                average_follow_up_days ASC;
        `;
        
        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error('Error al obtener el ranking de seguimiento:', err);
        res.status(500).json({ message: 'Error en el servidor al consultar el ranking.' });
    }
});
// ======================================================================
// ========= FIN: RUTA PARA RANKING DE EFICIENCIA DE SEGUIMIENTO ========
// ======================================================================



// ======================================================================
// ========= FIN: RUTA PARA EL CÁLCULO DE DESEMPEÑO (70/30) =============
// ======================================================================

// ======================================================================
// ========= API PARA LISTA DE CENTROS FORMALIZADOS (USO EXTERNO) =======
// ======================================================================
app.get('/api/formalized-centers-list', requireLogin, checkRole(['Administrador', 'Coordinador', 'Asesor']), async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                center_name, 
                advisor_name, 
                quote_id,
                quote_number, 
                formalization_date
            FROM formalized_centers
            ORDER BY formalization_date DESC;
        `;
        const result = await pool.query(query);

        // Construimos la respuesta final, añadiendo la URL completa al PDF
        const responseData = result.rows.map(row => ({
            "centro_nombre": row.center_name,
            "asesor_nombre": row.advisor_name,
            "cotizacion_numero": row.quote_number,
            "cotizacion_pdf_url": `https://be-gestion.onrender.com/api/quote-requests/${row.quote_id}/pdf`,
            "fecha_formalizacion": new Date(row.formalization_date).toISOString().split('T')[0] // Formato YYYY-MM-DD
        }));

        res.json(responseData);
    } catch (err) {
        console.error('Error al obtener la lista de centros formalizados:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// ======================================================================
// ========= INICIO: RUTAS DE API PARA GESTIÓN DE COMENTARIOS ===========
// ======================================================================
app.get('/api/comments', requireLogin, checkRole(['Administrador']), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM comments ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener comentarios:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

app.post('/api/comments', requireLogin, checkRole(['Administrador']), async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim() === '') {
        return res.status(400).json({ message: 'El texto del comentario no puede estar vacío.' });
    }
    try {
        const result = await pool.query('INSERT INTO comments (text) VALUES ($1) RETURNING *', [text.trim()]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al añadir comentario:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

app.delete('/api/comments/:id', requireLogin, checkRole(['Administrador']), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM comments WHERE id = $1', [id]);
        res.status(200).json({ message: 'Comentario eliminado con éxito.' });
    } catch (err) {
        console.error('Error al eliminar comentario:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});
// ======================================================================
// ========= FIN: RUTAS DE API PARA GESTIÓN DE COMENTARIOS ==============
// ======================================================================

// ======================================================================
// ========= INICIO: RUTA DE API PARA PANEL DE COORDINADORA =============
// ======================================================================
app.get('/api/coordinator/team-performance', requireLogin, checkRole(['Coordinador', 'Administrador']), async (req, res) => {
    try {
        // 1. OBTENER LAS MÉTRICAS DE TODOS LOS ASESORES A LA VEZ
        const visitsQuery = pool.query(`
            SELECT advisorname, COUNT(*) as total_visits FROM visits GROUP BY advisorname
        `);
        const formalizationsQuery = pool.query(`
            SELECT advisor_name, COUNT(*) as total_formalizations FROM formalized_centers GROUP BY advisor_name
        `);
        const followUpQuery = pool.query(`
            WITH ActiveCentersLastVisit AS (
                SELECT
                    latest_visit.advisorname,
                    (CURRENT_DATE - latest_visit.visitdate) AS days_since_last_visit
                FROM centers c
                JOIN LATERAL (
                    SELECT v.advisorname, v.commenttext, v.visitdate
                    FROM visits v WHERE v.centername = c.name
                    ORDER BY v.visitdate DESC, v.createdat DESC LIMIT 1
                ) AS latest_visit ON true
                WHERE latest_visit.commenttext NOT IN ('Formalizar Acuerdo', 'No Logrado')
            )
            SELECT advisorname, AVG(days_since_last_visit) AS average_follow_up_days
            FROM ActiveCentersLastVisit
            WHERE advisorname IS NOT NULL
            GROUP BY advisorname;
        `);

        // Ejecutamos todas las consultas en paralelo para máxima eficiencia
        const [visitsResults, formalizationsResults, followUpResults] = await Promise.all([
            visitsQuery, formalizationsQuery, followUpQuery
        ]);

        // 2. CONSOLIDAR LOS DATOS DEL EQUIPO
        let totalTeamVisits = 0;
        visitsResults.rows.forEach(row => { totalTeamVisits += parseInt(row.total_visits, 10); });

        let totalTeamFormalizations = 0;
        formalizationsResults.rows.forEach(row => { totalTeamFormalizations += parseInt(row.total_formalizations, 10); });
        
        let totalFollowUpDaysSum = 0;
        let advisorCountWithFollowUp = 0;
        followUpResults.rows.forEach(row => { 
            totalFollowUpDaysSum += parseFloat(row.average_follow_up_days);
            advisorCountWithFollowUp++;
        });

        // 3. CALCULAR LAS MÉTRICAS FINALES
        const teamClosingRate = (totalTeamVisits > 0) ? (totalTeamFormalizations / totalTeamVisits) * 100 : 0;
        const teamAverageFollowUpDays = (advisorCountWithFollowUp > 0) ? (totalFollowUpDaysSum / advisorCountWithFollowUp) : 0;

        // 4. IDENTIFICAR AL MEJOR Y PEOR ASESOR EN SEGUIMIENTO
        followUpResults.rows.sort((a, b) => a.average_follow_up_days - b.average_follow_up_days);
        const topPerformer = followUpResults.rows[0] || { advisorname: 'N/A', average_follow_up_days: 0 };
        const improvementOpportunity = followUpResults.rows[followUpResults.rows.length - 1] || { advisorname: 'N/A', average_follow_up_days: 0 };

        // 5. ENVIAR LA RESPUESTA
        res.json({
            teamClosingRate: teamClosingRate.toFixed(1),
            teamAverageFollowUpDays: teamAverageFollowUpDays.toFixed(1),
            topPerformer: {
                name: topPerformer.advisorname,
                days: parseFloat(topPerformer.average_follow_up_days).toFixed(1)
            },
            improvementOpportunity: {
                name: improvementOpportunity.advisorname,
                days: parseFloat(improvementOpportunity.average_follow_up_days).toFixed(1)
            }
        });

    } catch (err) {
        console.error("Error al calcular el desempeño del equipo:", err);
        res.status(500).json({ message: 'Error en el servidor al calcular las métricas del equipo.' });
    }
});
// ======================================================================
// ========= FIN: RUTA DE API PARA PANEL DE COORDINADORA ================
// ======================================================================

// ======================================================================
// ========= INICIO: APIS PARA LOS NUEVOS RANKINGS ESTRATÉGICOS =========
// ======================================================================

// 1. API PARA EL PIPELINE DE VENTAS (EMBUDO)
app.get('/api/pipeline-ranking', requireLogin, checkRole(['Administrador', 'Coordinador']), async (req, res) => {
    try {
        const query = `
            SELECT etapa_venta, COUNT(*) as count
            FROM centers
            WHERE etapa_venta IS NOT NULL
            GROUP BY etapa_venta
            ORDER BY
                CASE etapa_venta
                    WHEN 'Prospecto' THEN 1
                    WHEN 'Cotización Presentada' THEN 2
                    WHEN 'Negociación' THEN 3
                    WHEN 'Acuerdo Formalizado' THEN 4
                    WHEN 'No Logrado' THEN 5
                    ELSE 6
                END;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener datos del pipeline:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// 2. API PARA EL RANKING DE ALCANCE (CENTROS ÚNICOS)
app.get('/api/reach-ranking', requireLogin, checkRole(['Administrador', 'Coordinador']), async (req, res) => {
    try {
        const query = `
            SELECT advisorname, COUNT(DISTINCT centername) as unique_centers_count
            FROM visits
            GROUP BY advisorname
            ORDER BY unique_centers_count DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener ranking de alcance:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// 3. API PARA EL RANKING DE TASA DE CONVERSIÓN
app.get('/api/conversion-ranking', requireLogin, checkRole(['Administrador', 'Coordinador']), async (req, res) => {
    try {
        const managedQuery = `SELECT advisorname, COUNT(DISTINCT centername) as total_managed FROM visits GROUP BY advisorname`;
        const formalizedQuery = `SELECT advisor_name, COUNT(*) as total_formalized FROM formalized_centers GROUP BY advisor_name`;

        const [managedResults, formalizedResults] = await Promise.all([
            pool.query(managedQuery),
            pool.query(formalizedQuery)
        ]);

        const advisorData = {};
        managedResults.rows.forEach(row => {
            advisorData[row.advisorname] = {
                name: row.advisorname,
                managed: parseInt(row.total_managed, 10),
                formalized: 0
            };
        });

        formalizedResults.rows.forEach(row => {
            if (advisorData[row.advisor_name]) {
                advisorData[row.advisor_name].formalized = parseInt(row.total_formalized, 10);
            }
        });

        const conversionRates = Object.values(advisorData).map(advisor => {
            const rate = (advisor.managed > 0) ? (advisor.formalized / advisor.managed) * 100 : 0;
            return {
                advisorname: advisor.name,
                conversion_rate: rate
            };
        });

        conversionRates.sort((a, b) => b.conversion_rate - a.conversion_rate);

        res.json(conversionRates);
    } catch (err) {
        console.error("Error al obtener ranking de conversión:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// ======================================================================
// ========= FIN: APIS PARA LOS NUEVOS RANKINGS ESTRATÉGICOS ============
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
