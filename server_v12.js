// ============== SERVIDOR DE ASESORES Y VENTAS (v17.4 - Base Nube + Ajustes Bloque 1) ==============
// --- INICIO: DEPENDENCIAS Y CONFIG INICIAL (DE LA NUBE) ---
require('dotenv').config(); // Para variables de entorno locales
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

// Asegúrate que estos archivos existen en tu proyecto
const { assembleQuote } = require('./pricingEngine.js');
const { checkRole } = require('./permissions.js');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
// --- FIN: DEPENDENCIAS Y CONFIG INICIAL ---

// --- API Key y Acceso Dual (DE LA NUBE) ---
const API_KEY = process.env.GESTION_API_KEY; // Asegúrate que esta variable exista en .env o en Render
const apiKeyAuth = (req, res, next) => {
    const providedKey = req.header('X-API-Key');
    if (providedKey && providedKey === API_KEY) {
        next();
    } else {
        res.status(401).json({ message: 'Acceso no autorizado: Llave de API inválida o ausente.' });
    }
};
const allowUserOrApiKey = (req, res, next) => {
    if (req.session && req.session.user) { return next(); }
    const providedKey = req.header('X-API-Key');
    if (providedKey && providedKey === API_KEY) { return next(); }
    if (req.originalUrl.startsWith('/api/')) {
         res.status(401).json({ message: 'Acceso no autorizado: Se requiere iniciar sesión o una llave de API válida.' });
    } else {
         res.redirect('/login.html?error=auth_required');
    }
};
// --- Fin API Key ---

// --- Base de Datos (Conexión, Inicialización - DE LA NUBE + AJUSTE EN TABLA QUOTES) ---
const isProduction = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
const dbConfig = {
    connectionString: process.env.DATABASE_URL,
};
if (isProduction) {
    dbConfig.ssl = { rejectUnauthorized: false };
} else {
    console.log("=======================================================");
    console.log("ATENCIÓN: Usando configuración de BD LOCAL (sin SSL).");
    console.log("=======================================================");
}
const pool = new Pool(dbConfig);

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        // --- INICIO: PRIMERA CONSULTA (Crear todas las tablas) ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS users ( id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL, username VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, rol VARCHAR(50) NOT NULL, estado VARCHAR(50) DEFAULT 'activo' );
            CREATE TABLE IF NOT EXISTS advisors ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, estado VARCHAR(50) DEFAULT 'activo' NOT NULL );
            CREATE TABLE IF NOT EXISTS comments ( id SERIAL PRIMARY KEY, text TEXT NOT NULL );
            CREATE TABLE IF NOT EXISTS zones ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL );
            CREATE TABLE IF NOT EXISTS centers (
                id SERIAL PRIMARY KEY, code VARCHAR(50), name VARCHAR(255) NOT NULL, address TEXT NOT NULL, sector TEXT,
                contactname VARCHAR(255), contactnumber VARCHAR(255), UNIQUE(name, address),
                etapa_venta VARCHAR(50) DEFAULT 'Prospecto'
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
                aporte_institucion NUMERIC DEFAULT 0,
                membrete_tipo VARCHAR(50),
                -- (La columna de cortesía se añade con ALTER TABLE abajo)
                ajuste_solicitado_monto DECIMAL(10, 2),
                ajuste_solicitado_comentario TEXT,
                ajuste_aprobado_monto DECIMAL(10, 2),
                ajuste_aprobado_comentario TEXT,
                ajuste_aprobado_por VARCHAR(255),
                ajuste_fecha TIMESTAMPTZ
            );
            CREATE TABLE IF NOT EXISTS visits ( id SERIAL PRIMARY KEY, centername VARCHAR(255), advisorname VARCHAR(255), visitdate DATE, commenttext TEXT, createdat TIMESTAMPTZ DEFAULT NOW() );
            CREATE TABLE IF NOT EXISTS payments ( id SERIAL PRIMARY KEY, quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE, payment_date DATE NOT NULL, amount NUMERIC NOT NULL, students_covered INTEGER, comment TEXT, createdat TIMESTAMPTZ DEFAULT NOW() );
            CREATE TABLE IF NOT EXISTS formalized_centers (
                id SERIAL PRIMARY KEY, center_id INTEGER REFERENCES centers(id) ON DELETE CASCADE UNIQUE, center_name VARCHAR(255) NOT NULL, advisor_name VARCHAR(255),
                quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL, quote_number VARCHAR(50), formalization_date TIMESTAMPTZ DEFAULT NOW()
            );
            -- Tabla de sesión (necesaria para local y nube)
            CREATE TABLE IF NOT EXISTS "session" ( "sid" varchar NOT NULL COLLATE "default", "sess" json NOT NULL, "expire" timestamp(6) NOT NULL ) WITH (OIDS=FALSE);
            DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey' ) THEN ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE; END IF; END$$;
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
        `);
        // --- FIN DE LA PRIMERA CONSULTA ---

        
        // --- INICIO: SEGUNDA CONSULTA (Asegurar la columna que falta) ---
        // Esto arregla el error "column does not exist" para tablas ya creadas
        await client.query(`
            ALTER TABLE quotes
            ADD COLUMN IF NOT EXISTS estudiantes_cortesia INTEGER DEFAULT 0;
        `);
        // --- FIN DE LA SEGUNDA CONSULTA ---

        
        console.log("Bloque 1: Inicialización de la base de datos completada.");
    } catch (err) {
        console.error('Error Crítico en Bloque 1 (initializeDatabase):', err);
    } finally {
        client.release();
    }
};// --- Fin Bloque 1 ---
// --- Bloque 2: Carga Productos, Sesiones, Auth y Rutas Base (DE LA NUBE) ---
let products = [];
const loadProducts = () => {
    const csvPath = path.join(__dirname, 'Productos.csv');
    if (!fs.existsSync(csvPath)) {
        console.error("ERROR CRÍTICO: No se encontró el archivo Productos.csv en", csvPath);
        return; // Salir si no existe
    }
    const tempProducts = [];
    fs.createReadStream(csvPath)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim(), mapValues: ({ value }) => value.trim() }))
        .on('data', (row) => { tempProducts.push(row); })
        .on('end', () => {
            products = tempProducts.map((p, index) => ({ ...p, id: index + 1 }));
            console.log(`Bloque 2: ${products.length} productos cargados desde Productos.csv.`);
        })
        .on('error', (error) => {
            console.error("Error al leer Productos.csv:", error);
        });
};

// --- Configuración de Sesiones (DE LA NUBE + AJUSTE LOCAL) ---
app.set('trust proxy', 1); // Necesario para Render
const sessionConfig = {
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'fallback_secret_muy_seguro_si_no_hay_variable_de_entorno', // Usar variable de entorno!
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Siempre
        sameSite: 'lax', // Buen default
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    }
};
if (isProduction) {
    sessionConfig.cookie.secure = true; // Solo HTTPS en producción
} else {
    console.warn("ADVERTENCIA: Corriendo en modo no seguro (HTTP). Las cookies de sesión no serán marcadas como 'Secure'.");
}
app.use(session(sessionConfig));
// --- Fin Sesiones ---

// --- Middlewares de Autenticación (DE LA NUBE) ---
const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        if (req.originalUrl.startsWith('/api/')) {
            res.status(401).json({ message: 'No autenticado.' });
        } else {
            // Guardar la URL original para redirigir después del login
            req.session.returnTo = req.originalUrl;
            res.redirect('/login.html?error=auth_required');
        }
    }
};
const requireAdmin = checkRole(['Administrador']);
// --- Fin Middlewares ---

// --- RUTAS DE API ---

// (Login, Logout, User-Session - DE LA NUBE + GUARDADO LOCAL)
app.post('/api/login', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] Intento de login recibido para usuario: ${req.body.username}`);
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND estado = $2', [username, 'activo']);
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado o inactivo.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }
        const userResponse = { id: user.id, nombre: user.nombre, username: user.username, rol: user.rol };
        req.session.user = userResponse;
        // Guardado explícito para asegurar que funcione bien localmente
        req.session.save((err) => {
            if (err) {
                console.error('Error al guardar la sesión:', err);
                return res.status(500).json({ message: 'Error en el servidor al guardar la sesión.' });
            }
            console.log(`[${new Date().toLocaleTimeString()}] Sesión guardada para ${user.username}. Enviando respuesta.`);
            // Redirigir a la URL original guardada o al index
            const redirectTo = req.session.returnTo || '/index.html';
            delete req.session.returnTo; // Limpiar la URL guardada
            res.status(200).json({ message: 'Login exitoso', redirectTo: redirectTo, user: userResponse });
        });
    } catch (err) {
        console.error('Error en el proceso de login:', err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.post('/api/logout', (req, res) => {
     req.session.destroy(err => {
        if (err) {
            console.error("Error al cerrar sesión:", err);
            return res.status(500).json({ message: 'No se pudo cerrar la sesión.' });
         }
        res.clearCookie('connect.sid'); // Nombre default de la cookie de sesión
        // Enviar respuesta JSON para SPAs o redirigir para páginas normales
         if (req.accepts('json')) {
             res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
         } else {
             res.redirect('/login.html?logout=success');
         }
    });
});

app.get('/api/user-session', requireLogin, (req, res) => {
    res.json(req.session.user);
});
// --- Fin Login/Logout ---

// --- Rutas de Datos Generales ( formalized-centers, advisors-list, next-quote-number, data) ---
// (DE LA NUBE - SIN CAMBIOS)
app.get('/api/formalized-centers', apiKeyAuth, async (req, res) => {
     try {
        const query = `
            SELECT DISTINCT v.centername AS name
            FROM visits v
            INNER JOIN centers c ON TRIM(v.centername) = TRIM(c.name)
            WHERE LOWER(TRIM(v.commenttext)) = 'formalizar acuerdo'
            ORDER BY name ASC;
        `;
        const result = await pool.query(query);
        if (result.rows.length === 0) { return res.status(204).send(); }
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener centros formalizados por visita:', err);
        res.status(500).json({ message: 'Error en el servidor al consultar los centros.' });
    }
});

app.get('/api/advisors-list', apiKeyAuth, async (req, res) => {
    try {
        // --- MODIFICADO --- Se añade "WHERE estado = 'activo'"
        const result = await pool.query("SELECT name FROM advisors WHERE estado = 'activo' ORDER BY name ASC");
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

app.get('/api/data', requireLogin, async (req, res) => {
    try {
        // Asegurarse que products se haya cargado antes de responder
        if (products.length === 0) {
            console.warn("WARN: /api/data llamada antes de que los productos se cargaran. Intentando recargar...");
            await new Promise(resolve => setTimeout(resolve, 500)); // Espera corta por si acaso
            if (products.length === 0) { // Si sigue vacío después de esperar
                 console.error("ERROR: No se pudieron cargar los productos para /api/data.");
                 // Podríamos intentar recargar aquí o devolver un error
                 // loadProducts(); // Intentar recargar explícitamente?
                 // await new Promise(resolve => setTimeout(resolve, 500));
                 return res.status(503).json({ message: 'Servicio no disponible temporalmente (productos no cargados).' });
            }
        }

        const [advisors, comments, centers, zones] = await Promise.all([
            pool.query('SELECT * FROM advisors ORDER BY name ASC'),
            pool.query('SELECT * FROM comments ORDER BY text ASC'),
            pool.query('SELECT * FROM centers ORDER BY name ASC'),
            pool.query('SELECT * FROM zones ORDER BY name ASC')
        ]);
        
        // Esta es la parte clave. Así debe lucir:
        res.json({
            advisors: advisors.rows,
            comments: comments.rows,
            centers: centers.rows,
            zones: zones.rows, // Sin ningún número o caracter antes
            products: products 
        });

    } catch (err) {
        console.error("Error fetching initial data for /api/data:", err);
        res.status(500).json({ message: 'Error en el servidor al obtener datos iniciales.' });
    }
});
// --- Fin Rutas Datos Generales ---
// --- Fin Bloque 2 ---
// --- Bloque 3: Gestión Usuarios, Asesores, Visitas, Centros (DE LA NUBE - SIN CAMBIOS) ---

// --- RUTAS DE GESTIÓN DE USUARIOS (ADMIN) ---
app.get('/api/users', requireLogin, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, username, rol, estado FROM users ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error en GET /api/users:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener usuarios.' });
    }
});

app.post('/api/users', requireLogin, requireAdmin, async (req, res) => {
    const { nombre, username, password, rol } = req.body;
    // Añadir validación básica
    if (!nombre || !username || !password || !rol) {
        return res.status(400).json({ message: 'Todos los campos son requeridos para crear un usuario.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (nombre, username, password, rol) VALUES ($1, $2, $3, $4)', [nombre, username, hashedPassword, rol]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (err) {
        console.error('Error en POST /api/users:', err);
        if (err.code === '23505') { // Código de error PostgreSQL para violación de unicidad
            return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        }
        res.status(500).json({ message: 'Error en el servidor al crear usuario.' });
    }
});

app.post('/api/users/:id/edit-role', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { newRole } = req.body;
    if (!newRole) {
         return res.status(400).json({ message: 'El nuevo rol es requerido.' });
    }
    try {
        const result = await pool.query('UPDATE users SET rol = $1 WHERE id = $2 RETURNING id', [newRole, id]);
        if (result.rowCount === 0) {
             return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        res.status(200).json({ message: 'Rol actualizado con éxito.' });
    } catch (err) {
        console.error(`Error en POST /api/users/${id}/edit-role:`, err);
        res.status(500).json({ message: 'Error en el servidor al actualizar rol.' });
    }
});
// ======================================================================
// ========= INICIO: RUTA MEJORADA PARA CAMBIAR ESTADO DE ASESOR ========
// ======================================================================
// (Esto REEMPLAZA tu app.delete('/api/advisors/:id', ...))
app.post('/api/advisors/:id/toggle-status', requireLogin, requireAdmin, async (req, res) => { 
    const { id } = req.params; 
    try { 
        // 1. Averiguamos el estado actual
        const result = await pool.query('SELECT estado FROM advisors WHERE id = $1', [id]); 
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Asesor no encontrado.' });
        }

        // 2. Calculamos el nuevo estado
        const newStatus = result.rows[0].estado === 'activo' ? 'inactivo' : 'activo'; 

        // 3. Actualizamos la base de datos
        await pool.query('UPDATE advisors SET estado = $1 WHERE id = $2', [newStatus, id]); 
        
        res.status(200).json({ message: 'Estado actualizado con éxito', newStatus }); 
    } catch (err) { 
        console.error(err); 
        res.status(500).json({ message: 'Error en el servidor' }); 
    } 
});
// ======================================================================
// ========= FIN: RUTA MEJORADA PARA CAMBIAR ESTADO DE ASESOR ===========
// ======================================================================
app.post('/api/users/:id/toggle-status', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT estado FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
             return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const currentStatus = result.rows[0].estado;
        const newStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
        await pool.query('UPDATE users SET estado = $1 WHERE id = $2', [newStatus, id]);
        res.status(200).json({ message: `Estado actualizado a ${newStatus}.` });
    } catch (err) {
        console.error(`Error en POST /api/users/${id}/toggle-status:`, err);
        res.status(500).json({ message: 'Error en el servidor al cambiar estado.' });
    }
});
// --- FIN RUTAS DE GESTIÓN DE USUARIOS ---

// --- RUTAS DE GESTIÓN DE ASESORES (ADMIN) ---
app.get('/api/advisors', requireLogin, requireAdmin, async (req, res) => { // Asegurado requireAdmin
    try {
        const result = await pool.query('SELECT * FROM advisors ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error en GET /api/advisors:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener asesores.' });
    }
});

app.post('/api/advisors', requireLogin, requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'El nombre del asesor es requerido.' });
    }
    try {
        const newAdvisor = await pool.query('INSERT INTO advisors (name) VALUES ($1) RETURNING *', [name.trim()]);
        res.status(201).json(newAdvisor.rows[0]);
    } catch (err) {
        console.error('Error en POST /api/advisors:', err);
         if (err.code === '23505') { // Asumiendo que 'name' es UNIQUE
            return res.status(409).json({ message: 'Ya existe un asesor con ese nombre.' });
        }
        res.status(500).json({ message: 'Error en el servidor al crear asesor.' });
    }
});
// --- FIN RUTAS DE GESTIÓN DE ASESORES ---

// --- RUTAS DE GESTIÓN DE VISITAS ---
app.get('/api/visits', requireLogin, async (req, res) => {
    try {
        // Considerar añadir paginación si la tabla crece mucho
        const result = await pool.query('SELECT * FROM visits ORDER BY visitdate DESC, createdat DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error en GET /api/visits:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener visitas.' });
    }
});

// Ruta POST /api/visits (DE LA NUBE - SIN CAMBIOS)
// Incluye la lógica de crear/actualizar centro y actualizar etapa_venta
app.post('/api/visits', requireLogin, async (req, res) => {
    const { centerName, centerAddress, centerSector, advisorName, visitDate, commentText, contactName, contactNumber, formalizedQuoteId } = req.body;

    if (!centerName || !centerAddress || !advisorName || !visitDate || !commentText) { // Añadida validación más completa
        return res.status(400).json({ message: 'Nombre del centro, dirección, asesor, fecha y comentario son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lógica para crear o actualizar el centro
        let centerResult = await client.query('SELECT id FROM centers WHERE name = $1 AND address = $2', [centerName, centerAddress]);
        let centerId;
        if (centerResult.rows.length === 0) {
            const newCenterResult = await client.query(
                'INSERT INTO centers (name, address, sector, contactname, contactnumber, etapa_venta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [centerName, centerAddress, centerSector || null, contactName || null, contactNumber || null, 'Prospecto'] // Usar NULL si están vacíos
            );
            centerId = newCenterResult.rows[0].id;
        } else {
            centerId = centerResult.rows[0].id;
            // Actualizar contacto solo si se proporcionaron datos
            if (contactName !== undefined || contactNumber !== undefined) { // Chequear si existen en el body
                 await client.query(
                     'UPDATE centers SET contactname = COALESCE($1, contactname), contactnumber = COALESCE($2, contactnumber) WHERE id = $3', // Usar COALESCE para no sobrescribir con null si no se envían
                     [contactName, contactNumber, centerId]
                 );
            }
        }

        // Registrar la visita
        await client.query(
            'INSERT INTO visits (centername, advisorname, visitdate, commenttext) VALUES ($1, $2, $3, $4)',
            [centerName, advisorName, visitDate, commentText]
        );

        // --- Lógica de Etapas del Embudo ---
        let newStage = null;
        const lowerComment = commentText.toLowerCase().trim(); // Normalizar comentario
        // Usar switch con los valores exactos esperados
        switch (commentText) { // Usar commentText original para el switch si el frontend envía los strings exactos
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
        if (newStage) {
            console.log(`Actualizando etapa de venta para centro ${centerId} a: ${newStage}`);
            await client.query(
                'UPDATE centers SET etapa_venta = $1 WHERE id = $2',
                [newStage, centerId]
            );
        }

        // Lógica de formalización (para tabla 'formalized_centers')
        if (commentText === 'Formalizar Acuerdo' && formalizedQuoteId) {
             console.log(`Intentando formalizar centro ${centerId} con cotización ID ${formalizedQuoteId}`);
            // Verificar que la cotización existe y está en estado válido
            const quoteCheck = await client.query("SELECT quotenumber, status FROM quotes WHERE id = $1", [formalizedQuoteId]);
            if (quoteCheck.rowCount === 0) {
                 throw new Error(`La cotización con ID ${formalizedQuoteId} no existe.`);
            }
            const quoteStatus = quoteCheck.rows[0].status;
            if (quoteStatus !== 'aprobada' && quoteStatus !== 'archivada') {
                 throw new Error(`La cotización ${quoteCheck.rows[0].quotenumber} no está en estado 'aprobada' o 'archivada' (estado actual: ${quoteStatus}). No se puede formalizar.`);
            }

            // Actualizar estado de la cotización
            const quoteUpdateResult = await client.query(
                "UPDATE quotes SET status = 'formalizada' WHERE id = $1 RETURNING quotenumber", // Solo necesitamos RETURNING si lo usamos
                [formalizedQuoteId]
            );
             console.log(`Cotización ID ${formalizedQuoteId} actualizada a 'formalizada'. Filas afectadas: ${quoteUpdateResult.rowCount}`);

            // Insertar o actualizar en formalized_centers
            if (quoteUpdateResult.rowCount > 0) { // Asegurarse que la actualización fue exitosa
                const quoteNumber = quoteCheck.rows[0].quotenumber; // Usar el número obtenido antes
                await client.query(`
                    INSERT INTO formalized_centers (center_id, center_name, advisor_name, quote_id, quote_number)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (center_id) DO UPDATE SET
                        advisor_name = EXCLUDED.advisor_name,
                        quote_id = EXCLUDED.quote_id,
                        quote_number = EXCLUDED.quote_number,
                        formalization_date = NOW();
                `, [centerId, centerName, advisorName, formalizedQuoteId, quoteNumber]);
                console.log(`Registro en formalized_centers insertado/actualizado para centro ${centerId}.`);
            } else {
                 console.warn(`WARN: No se actualizó la cotización ${formalizedQuoteId} a formalizada, posible problema concurrente o estado inválido.`);
                 // Considerar si lanzar un error aquí es más apropiado
                 // throw new Error(`No se pudo actualizar la cotización ${formalizedQuoteId} a 'formalizada'.`);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Visita registrada y centro de estudios gestionado correctamente." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error detallado al registrar visita:", err); // Log más detallado
        res.status(500).json({ message: `Error en el servidor: ${err.message}` }); // Enviar mensaje de error real
    } finally {
        client.release();
    }
});
// --- FIN RUTAS DE GESTIÓN DE VISITAS ---


// --- RUTAS DE GESTIÓN DE CENTROS (CORREGIDA) ---
app.get('/api/centers', requireLogin, async (req, res) => {
    // 1. OBTENEMOS EL ROL Y NOMBRE DEL USUARIO EN SESIÓN
    const { rol, nombre: userAdvisorName } = req.session.user;
    
    // 2. OBTENEMOS LOS FILTROS OPCIONALES DEL DROPDOWN
    // (Limpiado para evitar doble declaración)
    const { advisor, comment, stage } = req.query;

    try {
        let queryParams = [];
        let whereClauses = [];

        // Subconsulta optimizada (sin cambios)
        let query = `
            SELECT
                c.id, c.name, c.address, c.sector, c.contactname, c.contactnumber, c.etapa_venta,
                lv.advisorname, lv.commenttext, lv.visitdate
            FROM centers c
            LEFT JOIN LATERAL (
                SELECT advisorname, commenttext, visitdate
                FROM visits v
                WHERE v.centername = c.name
                ORDER BY v.visitdate DESC, v.createdat DESC
                LIMIT 1
            ) lv ON true
        `;

        // 3. LÓGICA DE FILTRADO (CORREGIDA)
        if (rol === 'Asesor') {
            // Si es Asesor, forzamos el filtro a su nombre.
            queryParams.push(userAdvisorName);
            
            // --- ¡CORRECCIÓN AQUÍ! ---
            // El alias es 'lv', no 'latest_visit'
            whereClauses.push(`lv.advisorname = $${queryParams.length}`);
            // --- FIN DE LA CORRECCIÓN ---
            
        } else if (advisor) {
            // Admin o Coordinador (sin cambios)
            queryParams.push(advisor);
            whereClauses.push(`lv.advisorname = $${queryParams.length}`);
        }

        // Filtros de comentario y etapa (sin cambios)
        if (comment) {
            queryParams.push(comment);
            whereClauses.push(`lv.commenttext = $${queryParams.length}`);
        }
        if (stage) { 
             queryParams.push(stage);
             whereClauses.push(`c.etapa_venta = $${queryParams.length}`);
        }
        // ========= FIN DE LA LÓGICA DE FILTRADO =========

        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        query += ' ORDER BY c.name ASC;';

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener los centros:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener la lista de centros.' });
    }
});
// ======================================================================
// ========= FIN: RUTA MEJORADA DE GESTIÓN DE CENTROS (CON ROLES) ========
// ======================================================================
app.get('/api/centers/search', async (req, res) => {
    console.log("¡PETICIÓN RECIBIDA EN RUTA PÚBLICA /api/centers/search!"); // <-- AÑADE ESTO
    const searchTerm = (req.query.q || '').toLowerCase();
    try {
        const result = await pool.query(
            `SELECT id, name, address, sector, contactname, contactnumber
             FROM centers
             WHERE LOWER(name) LIKE $1 OR LOWER(address) LIKE $1 OR LOWER(sector) LIKE $1
             LIMIT 10`, // Limitar resultados para performance
            [`%${searchTerm}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error en la búsqueda de centros:', err);
        res.status(500).json({ message: 'Error en el servidor durante la búsqueda.' });
    }
});

app.put('/api/centers/:id', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    const { id } = req.params;
    const { name, address, sector, contactName, contactNumber } = req.body;
    // Validar datos de entrada
    if (!name || !address) {
        return res.status(400).json({ message: 'Nombre y dirección son requeridos.' });
    }
    try {
        // Verificar si ya existe otro centro con el mismo nombre y dirección (excluyendo el actual)
         const checkResult = await pool.query(
             'SELECT id FROM centers WHERE name = $1 AND address = $2 AND id != $3',
             [name, address, id]
         );
         if (checkResult.rowCount > 0) {
              return res.status(409).json({ message: 'Ya existe otro centro con el mismo nombre y dirección.' });
         }

        const result = await pool.query(
            'UPDATE centers SET name = $1, address = $2, sector = $3, contactname = $4, contactnumber = $5 WHERE id = $6 RETURNING id',
            [name, address, sector || null, contactName || null, contactNumber || null, id]
        );
         if (result.rowCount === 0) {
             return res.status(404).json({ message: 'Centro no encontrado.' });
         }
        res.status(200).json({ message: 'Centro actualizado con éxito' });
    } catch (err) {
        console.error(`Error actualizando centro ${id}:`, err);
         if (err.code === '23505') { // Por si acaso hay otra constraint UNIQUE
             return res.status(409).json({ message: 'Error de duplicado al actualizar el centro.' });
         }
        res.status(500).json({ message: 'Error en el servidor al actualizar centro.' });
    }
});

app.delete('/api/centers/:id', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Obtener nombre para borrar visitas/cotizaciones asociadas
        const centerResult = await client.query('SELECT name FROM centers WHERE id = $1', [id]);
        if (centerResult.rows.length === 0) {
             // Si no existe, no hay nada que borrar, considerar éxito idempotente o 404
             // return res.status(404).json({ message: 'Centro no encontrado.' });
             await client.query('ROLLBACK'); // Deshacer BEGIN si no se encontró
             return res.status(200).json({ message: 'Centro no encontrado, no se realizó ninguna acción.' });
        }
        const centerName = centerResult.rows[0].name;

        // Borrar datos asociados (visitas, cotizaciones) ANTES de borrar el centro
        console.log(`Eliminando visitas para el centro: ${centerName}`);
        await client.query('DELETE FROM visits WHERE centername = $1', [centerName]);
        console.log(`Eliminando cotizaciones para el centro: ${centerName}`);
        // Considerar si realmente queremos borrar cotizaciones o solo desasociarlas
        await client.query('DELETE FROM quotes WHERE clientname = $1', [centerName]);
        // formalized_centers se borra en cascada por el ON DELETE CASCADE en center_id

        console.log(`Eliminando centro ID: ${id}`);
        const deleteResult = await client.query('DELETE FROM centers WHERE id = $1', [id]);
        if (deleteResult.rowCount === 0) {
             // Esto no debería pasar si la consulta SELECT anterior funcionó, pero por seguridad
             throw new Error('Centro no encontrado durante la eliminación, a pesar de haber sido encontrado antes.');
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Centro y todos sus datos asociados eliminados con éxito' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error eliminando centro ${id} y sus datos asociados:`, err);
        res.status(500).json({ message: `Error en el servidor al eliminar centro: ${err.message}` });
    } finally {
        client.release();
    }
});
// --- FIN RUTAS DE GESTIÓN DE CENTROS ---
// --- Fin Bloque 3 ---
// --- Bloque 4: Gestión de Cotizaciones (DE LA NUBE + MODIFICACIONES DE AJUSTE) ---

// Ruta para calcular estimación en pantalla (DE LA NUBE - SIN CAMBIOS)
// Esta ruta NO guarda nada y siempre calcula con ajuste 0.
app.post('/api/quotes/calculate-estimate', requireLogin, (req, res) => {
    const quoteInput = req.body;
    // Validar datos de entrada básicos
    if (!quoteInput || typeof quoteInput.studentCount !== 'number' || !Array.isArray(quoteInput.productIds)) {
        return res.status(400).json({ message: "Datos de entrada inválidos para la estimación." });
    }
    const dbDataForCalculation = { products: products };
    try {
        // Siempre se llama con ajuste 0 para la estimación visual
        const estimate = assembleQuote(quoteInput, dbDataForCalculation, 0);
        res.json(estimate);
    } catch (error) {
        console.error("Error en el motor de precios (estimación):", error);
        res.status(500).json({ message: `Error al calcular la estimación: ${error.message}` });
    }
});
// === INICIO: RUTA GUARDAR COTIZACIÓN (CORREGIDA) ===
// Guarda la cotización inicial con estado 'pendiente' y la solicitud de ajuste si existe.
app.post('/api/quote-requests', requireLogin, async (req, res) => {
    
    // --- INICIO DE LA CORRECCIÓN ---
    const {
        clientName, 
        studentCount, productIds, quoteNumber, aporteInstitucion, membrete_tipo,
        ajuste_solicitado_monto, ajuste_solicitado_comentario,
        estudiantesCortesia // <-- ¡CORRECCIÓN 1: LEEMOS EL DATO!
    } = req.body;

    // Obtener el nombre del asesor DIRECTAMENTE de la sesión
    const advisorName = req.session.user.nombre; 
    // --- FIN DE LA CORRECCIÓN ---


     // Validaciones básicas (sin cambios)
    if (!clientName || !advisorName || !studentCount || !productIds || !quoteNumber) {
        return res.status(400).json({ message: 'Faltan datos requeridos para crear la cotización.' });
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un producto.' });
    }
     const studentCountInt = parseInt(studentCount, 10);
    if (isNaN(studentCountInt) || studentCountInt <= 0) {
        return res.status(400).json({ message: 'La cantidad de estudiantes debe ser un número positivo.' });
    }

    // ... (El bloque del motor de precios no cambia) ...
    const quoteInput = { clientName, advisorName: advisorName, studentCount: studentCountInt, productIds, quoteNumber, aporteInstitucion, membrete_tipo };
    const dbDataForCalculation = { products: products };
    let calculationResult;
    try {
        if (products.length === 0) {
            console.error("Error Crítico: Intentando calcular cotización sin productos cargados.");
            throw new Error("Los datos de productos no están disponibles.");
        }
        calculationResult = assembleQuote(quoteInput, dbDataForCalculation, 0); // Ajuste 0
    } catch(calcError) {
         console.error('Error en assembleQuote al guardar cotización:', calcError);
         return res.status(500).json({ message: `Error interno al calcular precios: ${calcError.message}` });
    }
    const { facilidadesAplicadas, items, totals } = calculationResult;
    const precios = calculationResult.calculatedPrices?.[0]; 
    if (!precios) {
         console.error('Error: El resultado de assembleQuote no contiene calculatedPrices.', calculationResult);
         return res.status(500).json({ message: 'Error interno: No se pudieron determinar los precios finales.'});
    }
    const precioFinalPorEstudiante = precios.precioFinalPorEstudiante;
    const estudiantesParaFacturar = precios.estudiantesFacturables;
    const precioFinalNum = parseFloat(precioFinalPorEstudiante);
    const estudiantesFactNum = parseInt(estudiantesParaFacturar, 10);
    if (isNaN(precioFinalNum) || isNaN(estudiantesFactNum)) {
        console.error('Error: Precio o estudiantes calculados no son números válidos:', { precioFinalPorEstudiante, estudiantesParaFacturar });
        return res.status(500).json({ message: 'Error interno al validar valores finales calculados.' });
    }
    // ... (Fin bloque motor de precios) ...

    try {
        // Insertar la cotización con el estado 'pendiente' y los datos de la solicitud de ajuste
        const result = await pool.query(
            `INSERT INTO quotes (
                clientname, advisorname, studentcount, productids,
                preciofinalporestudiante,
                estudiantesparafacturar,
                facilidadesaplicadas, items, totals, status, quotenumber, aporte_institucion, membrete_tipo,
                ajuste_solicitado_monto, ajuste_solicitado_comentario,
                estudiantes_cortesia -- <-- ¡CORRECCIÓN 2: AÑADIMOS LA COLUMNA!
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente', $10, $11, $12, $13, $14, $15) -- <-- ¡Ahora $15!
            RETURNING id`, // Devolver ID para posible uso futuro
            [
                clientName, advisorName, studentCountInt, productIds,
                precioFinalNum,
                estudiantesFactNum,
                facilidadesAplicadas || [], 
                JSON.stringify(items || {}), JSON.stringify(totals || {}), quoteNumber, aporteInstitucion || 0, membrete_tipo || 'Be Eventos',
                ajuste_solicitado_monto || null, ajuste_solicitado_comentario || null,
                estudiantesCortesia || 0 // <-- ¡CORRECCIÓN 3: AÑADIMOS EL VALOR!
            ]
        );
        
        console.log(`Cotización ${quoteNumber} (ID: ${result.rows[0].id}) guardada como pendiente por ${advisorName}.`);
        res.status(201).json({ message: 'Cotización guardada con éxito como pendiente.', quoteId: result.rows[0].id });
    } catch (err) {
        console.error('Error al guardar cotización en BD:', err);
        if (err.code === '23505' && err.constraint === 'quotes_quotenumber_key') { 
             return res.status(409).json({ message: `Error: El número de cotización '${quoteNumber}' ya existe.` });
        }
        res.status(500).json({ message: `Error interno del servidor al guardar: ${err.message}` });
    }
});
// === FIN: RUTA GUARDAR COTIZACIÓN ===
app.get('/api/quote-requests', requireLogin, checkRole(['Administrador', 'Asesor', 'Coordinador']), async (req, res) => {
    const userRole = req.session.user.rol;
    const userName = req.session.user.nombre;
    try {
        // Seleccionar todas las columnas necesarias que el frontend (aprobacion.js) utiliza.
        const baseQuery = `
            SELECT
                id, quotenumber AS "quoteNumber", clientname AS "clientName", advisorname AS "advisorName",
                status, rejectionreason AS "rejectionReason", createdat AS "createdAt"
                -- No necesitamos enviar datos de ajuste aquí, solo en la ruta de "detalles"
            FROM quotes
        `;
        let query; 
        let queryParams = [];
        
        // Administrador y Coordinador ven todo, sin filtro de status
        if (userRole === 'Administrador' || userRole === 'Coordinador') {
            query = `${baseQuery} ORDER BY createdat DESC`;
        } else { 
            // Asesor ve solo lo suyo, sin filtro de status
            // El frontend se encarga de mover 'aprobada' a la tabla de arriba
            // y 'archivada'/'formalizada' a la tabla de historial.
            query = `${baseQuery} WHERE advisorname = $1 ORDER BY createdat DESC`;
            queryParams.push(userName);
        }
        
        const result = await pool.query(query, queryParams);
        res.status(200).json(result.rows);
        
    } catch (err) {
        console.error('Error en GET /api/quote-requests:', err);
        res.status(500).json({ message: 'Error interno del servidor al listar cotizaciones.' });
    }
});
// === FIN: RUTA LISTAR COTIZACIONES (CORREGIDA) ===


// Ruta para obtener cotizaciones aprobadas/archivadas para formalización (DE LA NUBE - SIN CAMBIOS)
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
        console.error('Error en GET /api/quotes/approved:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener cotizaciones aprobadas/archivadas.' });
    }
});


// === INICIO: RUTA PENDIENTES (MODIFICADA PARA ENVIAR DATOS DE AJUSTE) ===
// Envía las cotizaciones en estado 'pendiente' al panel del administrador, incluyendo la solicitud de ajuste.
app.get('/api/quotes/pending-approval', requireLogin, requireAdmin, async (req, res) => {
    try {
        // Seleccionar las columnas necesarias para el panel, incluyendo la solicitud de ajuste
        const result = await pool.query(`
            SELECT
                id, quotenumber, clientname, advisorname, createdat, status,
                ajuste_solicitado_monto,      -- <-- Enviar al frontend
                ajuste_solicitado_comentario  -- <-- Enviar al frontend
            FROM quotes
            WHERE status = 'pendiente'        -- Solo las que están pendientes de decisión inicial
            ORDER BY createdat DESC
        `);

        // Mapear a nombres de propiedad (camelCase) SI es necesario para el frontend JS
        const quotesToPend = result.rows.map(q => ({
            id: q.id,
            quotenumber: q.quotenumber,
            clientname: q.clientname,
            advisorname: q.advisorname,
            createdat: q.createdat,
            status: q.status,

            // --- INICIO DEL ARREGLO DEFENSIVO ---
            // Si el valor es NULL (o undefined), usa 0 como default.
            ajusteSolicitadoMonto: q.ajuste_solicitado_monto || 0,
            // Si el valor es NULL, usa un string vacío '' como default.
            ajusteSolicitadoComentario: q.ajuste_solicitado_comentario || '',
            // Añadimos el resto de columnas nuevas para estar seguros
            ajusteAprobadoMonto: q.ajuste_aprobado_monto || 0,
            estudiantesCortesia: q.estudiantes_cortesia || 0,
            menuCortesia: q.menu_cortesia || '',
            menuCortesiaCantidad: q.menu_cortesia_cantidad || 0
            // --- FIN DEL ARREGLO DEFENSIVO ---
        }));

        res.status(200).json(quotesToSend);
    } catch (err) {
        console.error('Error en GET /api/quotes/pending-approval:', err);
        res.status(500).json({ message: 'Error interno del servidor al obtener cotizaciones pendientes.' });
    }
});
// === FIN: RUTA PENDIENTES ===


// === INICIO: RUTAS DE DECISIÓN DEL ADMINISTRADOR (MODIFICADAS/NUEVAS) ===

// --- RUTA ORIGINAL "/approve" AHORA ES "APROBAR PRECIO ESTÁNDAR" ---
// Aprueba la cotización pero IGNORA el ajuste solicitado, recalculando el precio con ajuste 0.
app.post('/api/quote-requests/:id/approve', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const adminName = req.session.user?.nombre || 'Admin Sistema';
    // El comentario ahora viene del modal del admin, explicando por qué no aplica el ajuste
    const adminComment = req.body.comentario || 'Aprobado sin ajuste solicitado.';

    try {
        // Obtener datos necesarios para recalcular
        const quoteResult = await pool.query('SELECT studentcount, productids, aporte_institucion FROM quotes WHERE id = $1 AND status = $2', [id, 'pendiente']);
        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Cotización no encontrada o no está en estado pendiente.' });
        }
        const quote = quoteResult.rows[0];

        // Llamar al motor de precios CON AJUSTE CERO (0)
        const quoteInput = { studentCount: quote.studentcount, productIds: quote.productids, aporteInstitucion: quote.aporte_institucion, estudiantesCortesia: 0 }; // Asumir cortesías 0 para recálculo
        let calculationResult;
         try {
             // Asegurarse que products esté cargado
             if (products.length === 0) throw new Error("Los datos de productos no están disponibles.");
             calculationResult = assembleQuote(quoteInput, { products: products }, 0); // <-- AJUSTE CERO
         } catch(calcError) {
              console.error('Error en assembleQuote al aprobar estándar:', calcError);
              throw new Error(`Error recalculando precio estándar: ${calcError.message}`);
         }
        const finalPrice = calculationResult.calculatedPrices?.[0]?.precioFinalPorEstudiante;
        const finalStudents = calculationResult.calculatedPrices?.[0]?.estudiantesFacturables; // Actualizar también estudiantes facturables

        const finalPriceNum = parseFloat(finalPrice);
        const finalStudentsNum = parseInt(finalStudents, 10);
        if (isNaN(finalPriceNum) || isNaN(finalStudentsNum)) { // Validar resultado
             throw new Error("Precio o estudiantes estándar recalculados inválidos.");
        }

        // Actualizar la cotización en la BD
        const updateResult = await pool.query(
            `UPDATE quotes
             SET status = 'aprobada',
                 preciofinalporestudiante = $1,
                 estudiantesparafacturar = $2, -- Actualizar estudiantes
                 ajuste_aprobado_monto = 0,     -- Marcar CERO ajuste aprobado
                 ajuste_aprobado_comentario = $3, -- Guardar comentario del admin
                 ajuste_aprobado_por = $4,
                 ajuste_fecha = NOW(),
                 rejectionreason = NULL -- Limpiar motivo de rechazo si existía
             WHERE id = $5 AND status = 'pendiente'`, // Doble chequeo de estado
            [finalPriceNum, finalStudentsNum, adminComment, adminName, id]
        );

        if (updateResult.rowCount === 0) {
             console.warn(`WARN: Intento de aprobar cotización ${id} que ya no estaba pendiente.`);
             return res.status(409).json({ message: 'La cotización ya no estaba pendiente de aprobación.' });
        }

        console.log(`Cotización ${id} aprobada con precio estándar por ${adminName}.`);
        res.status(200).json({ message: 'Cotización aprobada con precio estándar.' });

    } catch (err) {
        console.error(`Error en POST /api/quote-requests/${id}/approve:`, err);
        res.status(500).json({ message: err.message || 'Error interno del servidor al aprobar estándar.' });
    }
});

// --- NUEVA RUTA PARA "APROBAR CON AJUSTE" ---
// Aprueba la cotización APLICANDO el ajuste decidido por el admin, recalculando el precio final.
app.post('/api/quote-requests/:id/approve-with-adjustment', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { monto, comentario } = req.body; // Monto y comentario final del Admin
    const adminName = req.session.user?.nombre || 'Admin Sistema';

    // Validar monto
    const montoFloat = parseFloat(monto);
    // Permitir monto 0, pero no NaN o undefined/null
    if (monto === undefined || monto === null || isNaN(montoFloat)) {
        return res.status(400).json({ message: 'El monto del ajuste aprobado es obligatorio y debe ser un número.' });
    }

    try {
        // Obtener datos necesarios para recalcular
        const quoteResult = await pool.query('SELECT studentcount, productids, aporte_institucion FROM quotes WHERE id = $1 AND status = $2', [id, 'pendiente']);
        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Cotización no encontrada o no está en estado pendiente.' });
        }
        const quote = quoteResult.rows[0];

        // Llamar al motor de precios CON el ajuste aprobado
        const quoteInput = { studentCount: quote.studentcount, productIds: quote.productids, aporteInstitucion: quote.aporte_institucion, estudiantesCortesia: 0 };
         let calculationResult;
         try {
              // Asegurarse que products esté cargado
             if (products.length === 0) throw new Error("Los datos de productos no están disponibles.");
             calculationResult = assembleQuote(quoteInput, { products: products }, montoFloat); // <-- Usar monto validado
         } catch(calcError) {
              console.error('Error en assembleQuote al aprobar con ajuste:', calcError);
              throw new Error(`Error recalculando precio con ajuste: ${calcError.message}`);
         }
        const finalPrice = calculationResult.calculatedPrices?.[0]?.precioFinalPorEstudiante;
        const finalStudents = calculationResult.calculatedPrices?.[0]?.estudiantesFacturables; // Actualizar también estudiantes

        const finalPriceNum = parseFloat(finalPrice);
        const finalStudentsNum = parseInt(finalStudents, 10);
        if (isNaN(finalPriceNum) || isNaN(finalStudentsNum)) { // Validar resultado
             throw new Error("Precio o estudiantes ajustados recalculados inválidos.");
        }

        // Actualizar la cotización en la BD
        const updateResult = await pool.query(
            `UPDATE quotes
             SET status = 'aprobada',
                 preciofinalporestudiante = $1,
                 estudiantesparafacturar = $2, -- Actualizar estudiantes
                 ajuste_aprobado_monto = $3,     -- Guardar ajuste aprobado
                 ajuste_aprobado_comentario = $4, -- Guardar comentario del admin
                 ajuste_aprobado_por = $5,
                 ajuste_fecha = NOW(),
                 rejectionreason = NULL -- Limpiar motivo de rechazo
             WHERE id = $6 AND status = 'pendiente'`, // Doble chequeo
            [finalPriceNum, finalStudentsNum, montoFloat, comentario || '', adminName, id]
        );

        if (updateResult.rowCount === 0) {
             console.warn(`WARN: Intento de aprobar con ajuste cotización ${id} que ya no estaba pendiente.`);
             return res.status(409).json({ message: 'La cotización ya no estaba pendiente de aprobación.' });
        }

        console.log(`Cotización ${id} aprobada con ajuste (${montoFloat}) por ${adminName}.`);
        res.status(200).json({ message: 'Cotización aprobada con ajuste aplicado.' });

    } catch (err) {
        console.error(`Error en POST /api/quote-requests/${id}/approve-with-adjustment:`, err);
        res.status(500).json({ message: err.message || 'Error interno del servidor al aprobar con ajuste.' });
    }
});

// --- RUTA DE RECHAZO (DE LA NUBE - Lógica SIN CAMBIOS) ---
// Simplemente cambia el estado a 'rechazada' y guarda el motivo.
app.post('/api/quote-requests/:id/reject', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body; // 'reason' viene del JS del admin
    if (!reason || reason.trim() === '') { // Validar que no esté vacío
        return res.status(400).json({ message: 'Se requiere un motivo de rechazo válido.' });
    }
    try {
        const updateResult = await pool.query(
            `UPDATE quotes
             SET status = 'rechazada',
                 rejectionreason = $1,
                 -- Limpiar campos de ajuste por si acaso se intentó aprobar antes
                 ajuste_aprobado_monto = NULL,
                 ajuste_aprobado_comentario = NULL,
                 ajuste_aprobado_por = NULL,
                 ajuste_fecha = NULL
             WHERE id = $2 AND status = 'pendiente'`, // Solo rechazar si está pendiente
             [reason, id]
         );

         if (updateResult.rowCount === 0) {
              // Podría ser que ya fue aprobada/rechazada por otro admin, o el ID no existe
             const currentState = await pool.query('SELECT status FROM quotes WHERE id = $1', [id]);
             if (currentState.rowCount === 0) {
                  return res.status(404).json({ message: 'Cotización no encontrada.' });
             }
             return res.status(409).json({ message: `La cotización ya no estaba pendiente (estado actual: ${currentState.rows[0].status}).` });
         }

        console.log(`Cotización ${id} rechazada. Motivo: ${reason}`);
        res.status(200).json({ message: 'Cotización rechazada con éxito.' });
    } catch (err) {
        console.error(`Error en POST /api/quote-requests/${id}/reject:`, err);
        res.status(500).json({ message: 'Error interno del servidor al rechazar cotización.' });
    }
});
// === FIN: RUTAS DE DECISIÓN DEL ADMINISTRADOR ===


// Ruta para Archivar (DE LA NUBE - SIN CAMBIOS)
app.post('/api/quote-requests/:id/archive', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    const { id } = req.params;
    try {
        // Solo permitir archivar si está 'aprobada'
        const result = await pool.query("UPDATE quotes SET status = 'archivada' WHERE id = $1 AND status = 'aprobada' RETURNING id", [id]);
        if (result.rowCount === 0) {
             const currentState = await pool.query('SELECT status FROM quotes WHERE id = $1', [id]);
             if (currentState.rowCount === 0) return res.status(404).json({ message: 'Cotización no encontrada.' });
             return res.status(400).json({ message: `Solo se pueden archivar cotizaciones aprobadas (estado actual: ${currentState.rows[0].status}).` });
        }
        res.status(200).json({ message: 'Cotización archivada con éxito.' });
    } catch (err) {
        console.error(`Error en POST /api/quote-requests/${id}/archive:`, err);
        res.status(500).json({ message: 'Error interno del servidor al archivar.' });
    }
});

// Ruta para Eliminar (DE LA NUBE - SIN CAMBIOS)
app.delete('/api/quote-requests/:id', requireLogin, checkRole(['Administrador', 'Coordinador', 'Asesor']), async (req, res) => {
    const quoteId = req.params.id;
    const user = req.session.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const quoteResult = await client.query('SELECT status, advisorname FROM quotes WHERE id = $1', [quoteId]);
        if (quoteResult.rows.length === 0) {
             await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Cotización no encontrada.' });
        }
        const quote = quoteResult.rows[0];

        // Reglas de negocio para eliminar
        if (quote.status === 'formalizada') {
             await client.query('ROLLBACK');
            return res.status(403).json({ message: 'ERROR: No se puede eliminar una cotización formalizada.' });
        }
        if (user.rol === 'Asesor' && quote.advisorname !== user.nombre) {
             await client.query('ROLLBACK');
            return res.status(403).json({ message: 'No tienes permiso para eliminar esta cotización.' });
        }

        // Eliminar pagos asociados primero (ON DELETE CASCADE en payments debería manejarlo, pero por si acaso)
        await client.query('DELETE FROM payments WHERE quote_id = $1', [quoteId]);
        // Eliminar la cotización
        const deleteResult = await client.query('DELETE FROM quotes WHERE id = $1', [quoteId]);
        await client.query('COMMIT');

        if (deleteResult.rowCount > 0) {
            res.status(200).json({ message: 'Cotización eliminada con éxito.' });
        } else {
             // Esto podría pasar si hubo una condición de carrera
             res.status(404).json({ message: 'Cotización no encontrada al intentar eliminar.' });
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error en DELETE /api/quote-requests/${quoteId}:`, err);
        res.status(500).json({ message: 'Error interno del servidor al eliminar cotización.' });
    } finally {
        client.release();
    }
});
// --- Fin Bloque 4 ---
// // --- Bloque 5: Generación de PDFs y Detalles de Cotización (DE LA NUBE + MODIFICACIONES DE AJUSTE) ---

// === INICIO: RUTA GET PDF PROPUESTA (MODIFICADA CON NOTA CONDICIONAL Y AJUSTES DE DISEÑO v2) ===
app.get('/api/quote-requests/:id/pdf', allowUserOrApiKey, async (req, res) => {
    const quoteId = req.params.id;
    console.log(`[PDF Req ${quoteId}] Solicitud recibida.`);
    try {
        const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
        if (result.rows.length === 0) {
            console.log(`[PDF Req ${quoteId}] Cotización no encontrada.`);
            return res.status(404).send('Cotización no encontrada');
        }
        const quote = result.rows[0];
        console.log(`[PDF Req ${quoteId}] Cotización encontrada (${quote.quotenumber}). Iniciando generación de PDF.`);

        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${quote.quotenumber || `cotizacion_${quoteId}`}.pdf`);
        doc.pipe(res);

        // --- Lógica de Membrete ---
        let backgroundImagePath;
        if (quote.membrete_tipo === 'Peque Planner') {
            backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete_peque_planner.jpg');
        } else {
            backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete.jpg');
        }
        if (fs.existsSync(backgroundImagePath)) {
             try {
                 doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height });
                 console.log(`[PDF Req ${quoteId}] Membrete aplicado: ${backgroundImagePath}`);
             } catch (imgErr) {
                  console.error(`[PDF Req ${quoteId}] Error al cargar imagen de membrete ${backgroundImagePath}:`, imgErr);
             }
        } else {
             console.warn(`[PDF Req ${quoteId}] WARN: Archivo de membrete no encontrado en ${backgroundImagePath}`);
        }

        const pageMargin = 50; // Margen estándar
        const contentWidth = doc.page.width - (pageMargin * 2);
        // Ajustar márgenes superior e inferior según la versión nube (visualmente)
        const topMarginForContent = 150;
        const bottomMargin = 50; // Margen inferior estándar de PDFKit
        const effectivePageHeight = doc.page.height - bottomMargin;

        // --- Renderizado Superior (Coordenadas Nube) ---
        let currentY = topMarginForContent;
        const quoteDate = quote.createdat ? new Date(quote.createdat).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : 'Fecha no disponible';

        // Número de cotización (Derecha arriba - Usando coordenada X fija como en la nube)
        doc.font('Helvetica-Bold').fontSize(12).text(quote.quotenumber || 'N/A', 450, currentY, { align: 'left' }); // Coordenada X fija ~450
        // Fecha (Debajo, misma X)
        doc.font('Helvetica').fontSize(10).text(quoteDate, 450, currentY + 15, { align: 'left' }); // Coordenada X fija ~450

        // Título PROPUESTA (Centrado, ajustando Y)
        currentY = 190; // Posición fija para PROPUESTA
        doc.font('Helvetica-Bold').fontSize(20).text('PROPUESTA', pageMargin, currentY, { align: 'center', width: contentWidth });
        currentY += 40; // Espacio después del título (~230)

        // Información Cliente y Asesor (Izquierda)
        doc.font('Helvetica-Bold').fontSize(12).text(`Nombre del centro: ${quote.clientname || 'No especificado'}`, pageMargin, currentY);
        currentY += 20;
        doc.font('Helvetica').fontSize(12).text(`Nombre del Asesor: ${quote.advisorname || 'No especificado'}`, pageMargin, currentY);
        currentY += 30;

        // Párrafo introductorio
        doc.font('Helvetica').fontSize(10).text('Nos complace presentarle el presupuesto detallado. Este documento ha sido diseñado para ofrecerle una visión clara y transparente de los costos asociados a su proyecto, asegurando que cada aspecto esté cuidadosamente considerado y alineado con sus necesidades.', pageMargin, currentY, { align: 'justify', width: contentWidth });
        doc.moveDown(2); // Espacio después del párrafo
        currentY = doc.y;

        console.log(`[PDF Req ${quoteId}] Cabecera y datos iniciales renderizados. Y actual: ${currentY}`);

        // --- Renderizar Productos (Manejo de página ajustado y estilo lista nube) ---
        const selectedProducts = (quote.productids || []).map(id => products.find(p => p && String(p.id) === String(id))).filter(p => p);
        console.log(`[PDF Req ${quoteId}] Productos seleccionados: ${selectedProducts.length}`);

        if (selectedProducts.length > 0) {
            selectedProducts.forEach((product, index) => {
                const productTitleHeight = 20;
                const detailLines = product['DETALLE / INCLUYE'] ? product['DETALLE / INCLUYE'].split(',').length : 1;
                const detailHeightEstimate = detailLines * 12 + 10;
                const requiredHeight = productTitleHeight + detailHeightEstimate + 20;

                // Verificar espacio antes de dibujar, usando effectivePageHeight
                if (doc.y + requiredHeight > effectivePageHeight) {
                    console.log(`[PDF Req ${quoteId}] Salto de página antes del producto ${index + 1}`);
                    doc.addPage();
                    // Pega esto para reemplazar desde la línea 1341 a la 1345 de tu imagen
if (fs.existsSync(backgroundImagePath)) {
    // INICIO DE LA CORRECCIÓN
    try { 
        doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height }); 
    } catch (imgErr) { 
        console.error(`[PDF Req ${quoteId}] Error membrete página nueva:`, imgErr); 
    }
    // FIN DE LA CORRECCIÓN
}
doc.y = pageMargin; // Resetear Y al margen superior estándar
                }

                // Renderizar producto
                doc.font('Helvetica-Bold').fontSize(12).text(product['PRODUCTO / SERVICIO']?.trim() || 'Producto sin nombre', { width: contentWidth });
                doc.moveDown(0.5); // Usar moveDown(0.5) como en la nube
                const detail = product['DETALLE / INCLUYE'];
                if (detail && detail.trim() !== '') {
                    const detailItems = detail.split(',').map(item => `- ${item.trim()}`);
                    // Usar bulletIndent como en la nube (parece 20) y lineGap
                    doc.font('Helvetica').fontSize(10).list(detailItems, { width: contentWidth - 20, lineGap: 2, bulletIndent: 20 });
                } else {
                    doc.font('Helvetica-Oblique').fontSize(9).text('(Sin detalles adicionales)', { indent: 20 });
                    doc.moveDown(0.5);
                }
                doc.moveDown(); // Espacio después de cada producto
            });
        } else {
             doc.font('Helvetica-Oblique').fontSize(10).text('(No se seleccionaron productos específicos)', pageMargin, doc.y, {width: contentWidth});
             doc.moveDown();
        }
        currentY = doc.y;
        console.log(`[PDF Req ${quoteId}] Productos renderizados. Y actual: ${currentY}`);

        // --- Línea separadora ---
        // Verificar espacio usando effectivePageHeight
        if (doc.y + 50 > effectivePageHeight) { doc.addPage(); /* ... membrete ... */ doc.y = pageMargin; }
        doc.moveTo(pageMargin, doc.y).lineTo(doc.page.width - pageMargin, doc.y).stroke();
        doc.moveDown();
        currentY = doc.y;

        // --- Renderizar Precio (Usando alineación derecha directa como en la nube) ---
        const pricePerStudent = quote.preciofinalporestudiante;
        const priceNum = parseFloat(pricePerStudent);
        const priceString = !isNaN(priceNum) ? `RD$ ${priceNum.toFixed(2)}` : 'RD$ ---.--';
        const priceLabel = 'Presupuesto por estudiante:';

        // Posicionar etiqueta y precio alineados a la derecha de forma simple
        doc.font('Helvetica-Bold').fontSize(12).text(priceLabel, pageMargin, currentY, { align: 'right', width: contentWidth - 110 }); // Ancho ajustado para etiqueta
        doc.font('Helvetica-Bold').fontSize(14).text(priceString, pageMargin, currentY - 2, { align: 'right', width: contentWidth }); // Ancho completo para precio, ajuste Y

        doc.moveDown(2); // Espacio después del precio
        currentY = doc.y;
        console.log(`[PDF Req ${quoteId}] Precio renderizado. Y actual: ${currentY}`);


        // --- Comentarios y Condiciones (CON TEXTO CONDICIONAL y estilo lista nube) ---
        if (doc.y + 100 > effectivePageHeight) { doc.addPage(); /* ... membrete ... */ doc.y = pageMargin; }
        doc.font('Helvetica-Bold').fontSize(12).text('Comentarios y Condiciones:');
        doc.moveDown(0.5); // moveDown(0.5)

        const aporteValor = quote.aporte_institucion || 0;
        const codigoSecreto = `codigo wxz(${parseFloat(aporteValor).toFixed(0)})api`;
        
        let conditions = [
            `Cálculo basado en ${quote.studentcount || 0} estudiantes y evaluable a un mínimo de ${quote.estudiantesparafacturar || 'N/A'} estudiantes.`,
            'Condiciones de Pago a debatir.',
            codigoSecreto
        ];

        // --- INICIO DE LA LÓGICA DE CORTESÍA AÑADIDA ---
        
        // 1. Obtenemos el número de cortesías.
        //    (Estoy asumiendo que se guarda en la base de datos como 'estudiantes_cortesia')
        const numCortesias = parseInt(quote.estudiantes_cortesia, 10) || 0;

        // 2. Si hay cortesías (es > 0), añadimos tu código secreto al array
        if (numCortesias > 0) {
            // Formateamos el número a dos dígitos (ej: 1 -> "01", 12 -> "12")
            const codigoCortesia = `referencia${numCortesias.toString().padStart(2, '0')}`;
            
            // Añadimos el código a la lista
            conditions.push(codigoCortesia);
        }
        // --- FIN DE LA LÓGICA DE CORTESÍA AÑADIDA ---

        // === LÓGICA CONDICIONAL PARA AJUSTE ===
        const ajusteMontoNum = parseFloat(quote.ajuste_aprobado_monto);
        if (!isNaN(ajusteMontoNum) && ajusteMontoNum !== 0) {
            console.log(`[PDF Req ${quoteId}] Ajuste detectado (${ajusteMontoNum}). Añadiendo nota a condiciones.`);
            conditions.push('Presupuesto con ajuste aplicado.');
        } else {
            console.log(`[PDF Req ${quoteId}] No hay ajuste o es cero. No se añade nota a condiciones.`);
        }
        // === FIN LÓGICA CONDICIONAL ===

        // Usar bulletRadius como en la nube (parece 1.5)
        doc.font('Helvetica').fontSize(10).list(conditions, { width: contentWidth, lineGap: 2, bulletRadius: 1.5 });
        doc.moveDown();
        currentY = doc.y;

        // --- Facilidades Aplicadas (estilo lista nube) ---
        if(quote.facilidadesaplicadas && Array.isArray(quote.facilidadesaplicadas) && quote.facilidadesaplicadas.length > 0) {
            const requiredHeight = 20 + (quote.facilidadesaplicadas.length * 12);
            if (doc.y + requiredHeight > effectivePageHeight) { doc.addPage(); /* ... membrete ... */ doc.y = pageMargin; }
            doc.font('Helvetica-Bold').fontSize(10).text('Facilidades Aplicadas:');
            doc.moveDown(0.5); // moveDown(0.5)
            // Usar bulletRadius
            doc.font('Helvetica').fontSize(10).list(quote.facilidadesaplicadas, { width: contentWidth, lineGap: 2, bulletRadius: 1.5 });
            doc.moveDown();
            currentY = doc.y;
        }

        // --- Párrafo de Cierre ---
        if (doc.y + 50 > effectivePageHeight) { doc.addPage(); /* ... membrete ... */ doc.y = pageMargin; }
        doc.font('Helvetica').fontSize(10).text('Agradecemos la oportunidad de colaborar con usted y estamos comprometidos a brindarle un servicio excepcional. Si tiene alguna pregunta o necesita más detalles, no dude en ponerse en contacto con nosotros.', { align: 'justify', width: contentWidth });
        console.log(`[PDF Req ${quoteId}] Cuerpo principal renderizado.`);

        // --- NOTA AL PIE (Opcional, comentada por defecto) ---
        /*
        // ... (código de nota al pie anterior) ...
        */

        // Finalizar el documento PDF
        console.log(`[PDF Req ${quoteId}] Finalizando PDF.`);
        doc.end();

    } catch (error) {
         console.error(`[PDF Req ${quoteId}] Error CRÍTICO al generar el PDF:`, error);
         if (!res.headersSent) {
             res.status(500).send(`Error interno al generar el PDF: ${error.message}`);
         } else {
             res.end();
         }
    }
    });
// Ruta para PDF del Acuerdo (DE LA NUBE - SIN CAMBIOS)
app.get('/api/agreements/:id/pdf', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    const quoteId = req.params.id;
    console.log(`[Agreement PDF Req ${quoteId}] Solicitud recibida.`);
    try {
        const client = await pool.connect(); // Usar cliente para asegurar liberación
        let quote;
        try {
            // Asegurarse que la cotización esté formalizada
            const quoteResult = await client.query("SELECT * FROM quotes WHERE id = $1 AND status = 'formalizada'", [quoteId]);
            if (quoteResult.rows.length === 0) {
                console.log(`[Agreement PDF Req ${quoteId}] Acuerdo no encontrado o cotización no formalizada.`);
                return res.status(404).send('Acuerdo no encontrado o la cotización no está formalizada.');
            }
            quote = quoteResult.rows[0];
            console.log(`[Agreement PDF Req ${quoteId}] Cotización formalizada encontrada (${quote.quotenumber}).`);
        } finally {
            client.release(); // Liberar cliente después de la consulta
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=ACUERDO-${quote.quotenumber || quoteId}.pdf`);
        doc.pipe(res);

        // --- Lógica de Membrete (de la nube) ---
        // 1. DIBUJAR EL MEMBRETE
        let backgroundImagePath;
        if (quote.membrete_tipo === 'Peque Planner') {
            backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete_peque_planner.jpg');
        } else {
            backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete.jpg');
        }
        // --- INICIO DE LA CORRECCIÓN ---

if (fs.existsSync(backgroundImagePath)) {
    try {
        doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height });
    } catch (err) {
        console.error(`[Agreement PDF Req ${quoteId}] Error al dibujar imagen de membrete:`, err);
    }
} else {
    console.warn(`[Agreement PDF Req ${quoteId}] WARN: Membrete acuerdo no encontrado en ${backgroundImagePath}`);
}

// --- FIN DE LA CORRECCIÓN ---

        const pageMargin = 60;
        const contentWidth = doc.page.width - (pageMargin * 2);
        
        // --- MODIFICADO: Fecha y Lugar en la parte superior ---
        const quoteDate = new Date(quote.createdat).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
        doc.font('Helvetica').fontSize(11).text(
            `Santo Domingo, R.D., ${quoteDate}`, 
            pageMargin, 
            180, // <-- Posición Y fija
            { align: 'right', width: contentWidth }
        );
        // --- FIN MODIFICADO ---

        // --- Contenido del Acuerdo (de la nube, sin cambios) ---
        // Título y Partes
        doc.font('Helvetica-Bold').fontSize(16).text('Acuerdo de Colaboración de Servicios', pageMargin, 200, { align: 'center', width: contentWidth });
        doc.moveDown(4);
        doc.font('Helvetica', 11).text(`Este acuerdo se celebra el día ${new Date(quote.ajuste_fecha || quote.createdat).toLocaleDateString('es-DO', { timeZone: 'UTC' })}, con el fin de establecer una colaboración profesional entre:`, { align: 'justify', width: contentWidth }); // Usar fecha de ajuste/creación
        doc.moveDown(1.5);
        doc.font('Helvetica-Bold', 12).text('Be Eventos SRL ("El Organizador")', { continued: true }).font('Helvetica', 11).text(', una empresa...'); // Acortado
        doc.moveDown(1); doc.font('Helvetica', 11).text('y'); doc.moveDown(1);
        doc.font('Helvetica-Bold', 12).text(`${quote.clientname} ("El Centro")`, { continued: true }).font('Helvetica', 11).text(', con quien nos complace colaborar.');
        doc.moveDown(3);

        // Secciones (simplificado para brevedad, usar el código completo de la nube)
        const drawSection = (title, content) => {
             if (doc.y > 650) { doc.addPage(); if (fs.existsSync(backgroundImagePath)) { try { doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height }); } catch(e){} } doc.y = pageMargin; } // Salto página con membrete
            doc.font('Helvetica-Bold').fontSize(11).text(title); doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(10).text(content, { align: 'justify', width: contentWidth }); doc.moveDown(1.5);
            if (doc.y > 680) doc.addPage(); // <-- MODIFICADO: Límite ajustado
            doc.font('Helvetica-Bold').fontSize(11).text(title);
            doc.moveDown(0.3); // <-- MODIFICADO: Espacio reducido (de 0.5 a 0.3)
            doc.font('Helvetica').fontSize(10).text(content, { align: 'justify', width: contentWidth });
            doc.moveDown(1.2); // <-- MODIFICADO: Espacio reducido (de 1.5 a 1.2)
        };
        drawSection('1. Nuestro Propósito Común', 'Ambas partes unimos esfuerzos...');
        // ... (resto de las llamadas a drawSection de la nube) ...
        drawSection('4. Acuerdo Económico', `El valor de la experiencia diseñada es de RD$ ${parseFloat(quote.precio).toFixed(2)} más el 18% de ITBIS`);
        // ...
        drawSection('6. Marco Legal', 'Este acuerdo se rige por...');

        // Firmas (de la nube)
        if (doc.y > doc.page.height - 200) { doc.addPage(); if (fs.existsSync(backgroundImagePath)) { try { doc.image(backgroundImagePath, 0, 0, { width: doc.page.width, height: doc.page.height }); } catch(e){} } doc.y = pageMargin; }
        const signatureY = doc.page.height - 180;
        // ... (resto del código de firmas de la nube) ...
        doc.text('Moisés Gross López', pageMargin, signatureY + 40);
        doc.text('[Nombre Representante]', doc.page.width / 2, signatureY + 40, { align: 'right' });


        console.log(`[Agreement PDF Req ${quoteId}] Finalizando PDF del acuerdo.`);
        doc.end();

    } catch (error) {
      console.error('Error al generar el PDF del acuerdo:', error);
		
        res.status(500).send('Error interno al generar el PDF del acuerdo.');
    }
});
app.get('/api/quote-requests/:id/details', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    const { id } = req.params;
    console.log(`[Details Req ${id}] Solicitud recibida.`);
    try {
        // Seleccionar todas las columnas de la tabla quotes
        const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            console.log(`[Details Req ${id}] Cotización no encontrada.`);
            return res.status(404).json({ message: 'Cotización no encontrada.' });
        }
        const quote = result.rows[0];
        console.log(`[Details Req ${id}] Cotización ${quote.quotenumber} encontrada.`);

        // Buscar nombres de productos (manejo seguro por si products no está cargado)
        let productDetails = [];
        if (products && products.length > 0) {
            productDetails = (quote.productids || []).map(productId => {
                const product = products.find(p => p && String(p.id) === String(productId));
                return product ? (product['PRODUCTO / SERVICIO'] || `ID ${productId} sin nombre`) : `ID ${productId} no encontrado`;
            });
        } else {
             console.warn(`[Details Req ${id}] WARN: Productos no cargados al obtener detalles.`);
             productDetails = (quote.productids || []).map(id => `ID ${id} (productos no cargados)`);
        }

        // Construir la respuesta JSON incluyendo TODOS los campos relevantes
        const responseData = {
            // Campos originales
            quoteNumber: quote.quotenumber,
            clientName: quote.clientname, // Añadido para contexto
            advisorName: quote.advisorname, // Añadido para contexto
            status: quote.status, // Añadido para contexto
            rejectionReason: quote.rejectionreason,
            products: productDetails,
            studentCount: quote.studentcount,
            pricePerStudent: quote.preciofinalporestudiante, // Precio final (puede tener ajuste)
            estudiantesFacturables: quote.estudiantesparafacturar, // Añadido
            facilidadesAplicadas: quote.facilidadesaplicadas, // Añadido
            aporteInstitucion: quote.aporte_institucion, // Añadido
            membreteTipo: quote.membrete_tipo, // Añadido

            // --- CAMPOS DE AJUSTE AÑADIDOS ---
            ajusteSolicitadoMonto: quote.ajuste_solicitado_monto,
            ajusteSolicitadoComentario: quote.ajuste_solicitado_comentario,
            ajusteAprobadoMonto: quote.ajuste_aprobado_monto,
            ajusteAprobadoComentario: quote.ajuste_aprobado_comentario,
            ajusteAprobadoPor: quote.ajuste_aprobado_por,
            ajusteFecha: quote.ajuste_fecha // Añadido fecha de aprobación
            // --- FIN CAMPOS DE AJUSTE ---
        };
        console.log(`[Details Req ${id}] Enviando detalles completos.`);
        res.json(responseData);
    } catch (error) {
        console.error(`[Details Req ${id}] Error al obtener detalles de la cotización:`, error);
        res.status(500).json({ message: `Error en el servidor al obtener detalles: ${error.message}` });
    }
});
// ======================================================================
// ========= RUTA ACTUALIZADA PARA EL RANKING DE ASESORES (LÓGICA ESTRICTA) =====
// ======================================================================
app.get('/api/advisor-ranking', requireLogin, async (req, res) => {
    try {
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
                -- --- INICIO: MODIFICACIÓN PARA FILTRAR ASESORES ACTIVOS ---
                INNER JOIN
                    advisors a ON v.advisorname = a.name
                WHERE
                    a.estado = 'activo'
                -- --- FIN: MODIFICACIÓN ---
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
            -- --- INICIO: MODIFICACIÓN PARA FILTRAR ASESORES ACTIVOS ---
            INNER JOIN 
                advisors a ON v.advisorname = a.name
            WHERE 
                a.estado = 'activo'
            -- --- FIN: MODIFICACIÓN ---
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
                -- --- INICIO: MODIFICACIÓN 1 (FILTRAR ACTIVOS) ---
                INNER JOIN advisors a ON v.advisorname = a.name
                WHERE a.estado = 'activo'
                -- --- FIN: MODIFICACIÓN 1 ---
                GROUP BY v.advisorname
            ),
            FormalizationCounts AS (
                SELECT v.advisorname, COUNT(*) AS formalization_count
                FROM visits v
                JOIN centers c ON v.centername = c.name
                -- --- INICIO: MODIFICACIÓN 2 (FILTRAR ACTIVOS) ---
                INNER JOIN advisors a ON v.advisorname = a.name
                WHERE LOWER(TRIM(v.commenttext)) = 'formalizar acuerdo' AND a.estado = 'activo'
                -- --- FIN: MODIFICACIÓN 2 ---
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

        // Manejo defensivo por si no hay visitas o formalizaciones
        const visits = advisorsData.map(a => a.visit_count);
        const formalizations = advisorsData.map(a => a.formalization_count);
        const maxVisits = visits.length > 0 ? Math.max(...visits) : 0;
        const maxFormalizations = formalizations.length > 0 ? Math.max(...formalizations) : 0;

        console.log(`Valores máximos - Visitas: ${maxVisits}, Formalizaciones: ${maxFormalizations}`);

        const performanceData = advisorsData.map(advisor => {
            const visitScore = (maxVisits > 0) ? (advisor.visit_count / maxVisits) * 70 : 0;
            const formalizationScore = (maxFormalizations > 0) ? (advisor.formalization_count / maxFormalizations) * 30 : 0;
            const totalScore = visitScore + formalizationScore;

            return {
                advisorname: advisor.advisorname,
                performance_score: parseFloat(totalScore.toFixed(1)) // Redondear a 1 decimal
            };
        });

       
        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        console.log('Cálculo de desempeño completado exitosamente.'); // <-- ¡LÍNEA CORREGIDA!

        res.json(performanceData);

    } catch (error) {
        console.error('ERROR DETALLADO en /api/advisor-performance:', error);
        res.status(500).json({
            message: 'Error en el servidor al calcular el desempeño.',
            error: error.message // Incluir mensaje de error real
        });
    }
});
// ======================================================================
// ========= INICIO: HERRAMIENTA DE DEBUG PARA VER TABLAS CRUDAS ========
// ======================================================================
app.get('/api/debug/raw-table', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { tableName } = req.query;

        // Lista de tablas permitidas para evitar riesgos de seguridad (SQL Injection)
        const allowedTables = ['centers', 'visits', 'quotes', 'users', 'advisors', 'formalized_centers', 'comments', 'zones', 'session']; // Añadir tablas si es necesario

        if (!tableName || !allowedTables.includes(tableName.toLowerCase())) { // Convertir a minúsculas para comparar
            return res.status(400).json({ message: 'Nombre de tabla no válido o no permitido.' });
        }

        // Usar parametrización de identificadores si la librería lo soporta, o validar estrictamente.
        // Forma segura pero básica (validación):
        const safeTableName = allowedTables.find(t => t === tableName.toLowerCase());
        if (!safeTableName) {
             return res.status(400).json({ message: 'Nombre de tabla inválido.'}); // Doble chequeo
        }

        // Construir la consulta de forma segura (asumiendo que safeTableName es válido)
        // Añadir LIMIT para evitar cargar tablas enormes accidentalmente
        const query = `SELECT * FROM "${safeTableName}" ORDER BY id DESC LIMIT 100;`; // Usar comillas dobles por si el nombre de tabla necesita escape
        console.log(`[DEBUG] Ejecutando consulta: ${query}`);
        const result = await pool.query(query);

        res.json(result.rows);

    } catch (error) {
        console.error(`Error al leer la tabla cruda ${req.query.tableName}:`, error);
        res.status(500).json({ message: 'Error en el servidor al leer la tabla.' });
    }
});

app.get('/api/debug/audit-advisor-follow-up', requireLogin, requireAdmin, async (req, res) => {
    const { advisor } = req.query;

    if (!advisor) {
        return res.status(400).send('<h1>Error</h1><p>Debes especificar un asesor en la URL. Ejemplo: ...?advisor=Nombre%20Asesor</p>');
    }

    try {
        // Consulta para obtener la última visita de CADA centro asociado al asesor que NO esté finalizado
        const query = `
            WITH LastVisitPerCenter AS (
                SELECT
                    v.centername,
                    v.advisorname,
                    v.commenttext,
                    v.visitdate,
                    ROW_NUMBER() OVER(PARTITION BY v.centername ORDER BY v.visitdate DESC, v.createdat DESC) as rn
                FROM visits v
                WHERE v.advisorname = $1 -- Filtrar por asesor aquí mejora eficiencia
            ),
            FilteredLastVisit AS (
                 SELECT * FROM LastVisitPerCenter WHERE rn = 1
            )
            SELECT
                flv.centername AS center_name,
                flv.visitdate,
                (CURRENT_DATE - flv.visitdate) AS days_since_last_visit
            FROM FilteredLastVisit flv
            JOIN centers c ON flv.centername = c.name -- Unir con centers para etapa_venta
            WHERE c.etapa_venta NOT IN ('Acuerdo Formalizado', 'No Logrado') -- Filtrar por estado del centro
            ORDER BY days_since_last_visit DESC;
        `;

        const { rows: centers } = await pool.query(query, [advisor]);

        if (centers.length === 0) {
            return res.send(`<h1>Auditoría para ${advisor}</h1><p>No se encontraron centros de seguimiento activo para este asesor.</p>`);
        }

        // Construir la respuesta HTML
        let htmlResponse = `<h1>Auditoría de Seguimiento para: ${advisor}</h1>`;
        htmlResponse += `<p>Se encontraron ${centers.length} centros en seguimiento activo.</p>`;
        htmlResponse += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 50%;"><thead><tr><th>Centro</th><th>Días Desde Última Visita</th></tr></thead><tbody>';

        let totalDays = 0;
        centers.forEach(center => {
            totalDays += center.days_since_last_visit;
            htmlResponse += `<tr><td>${center.center_name}</td><td style="text-align: right;">${center.days_since_last_visit}</td></tr>`;
        });

        const average = totalDays / centers.length;

        htmlResponse += '</tbody></table>';
        htmlResponse += `<hr style="margin: 20px 0;">`;
        htmlResponse += `<h2>Cálculo Final</h2>`;
        htmlResponse += `<p><strong>Suma Total de Días:</strong> ${totalDays}</p>`;
        htmlResponse += `<p><strong>Cantidad de Centros:</strong> ${centers.length}</p>`;
        htmlResponse += `<p><strong>Promedio de Días de Seguimiento:</strong> ${average.toFixed(1)} días</p>`;

        res.status(200).send(htmlResponse);

    } catch (err) {
        console.error('Error en la herramienta de auditoría:', err);
        res.status(500).send(`<h1>Error en Auditoría</h1><p>Ocurrió un error en el servidor al realizar la auditoría para ${advisor}.</p><pre>${err.message}</pre>`);
    }
});


app.get('/api/advisor-follow-up-ranking', requireLogin, async (req, res) => {
    try {
        // Esta consulta calcula el promedio de días desde la última visita
        // para todos los centros que no están en un estado final.
        // Re-escrita para eliminar caracteres invisibles.
        const query = `WITH ActiveCentersLastVisit AS (
            SELECT
                latest_visit.advisorname,
                (CURRENT_DATE - latest_visit.visitdate) AS days_since_last_visit
            FROM
                centers c
            -- --- INICIO: CORRECCIÓN LÓGICA ---
            -- Unimos con LATERAL para encontrar la última visita
            -- de un ASESOR ACTIVO.
            JOIN LATERAL (
                SELECT 
                    v.advisorname, 
                    v.commenttext, 
                    v.visitdate
                FROM 
                    visits v
                JOIN 
                    advisors a ON v.advisorname = a.name
                WHERE 
                    v.centername = c.name 
                    AND a.estado = 'activo'
                ORDER BY 
                    v.visitdate DESC, v.createdat DESC
                LIMIT 1
            ) AS latest_visit ON true
            -- --- FIN: CORRECCIÓN LÓGICA ---

            -- Ahora filtramos por el comentario de esa última visita de asesor activo
            WHERE 
                latest_visit.commenttext NOT IN ('Formalizar Acuerdo', 'No Logrado')
        )
        SELECT
            alv.advisorname,
            -- Añadimos ROUND para redondear a 1 decimal
            ROUND(AVG(alv.days_since_last_visit), 1) AS average_follow_up_days
        FROM
            ActiveCentersLastVisit alv
        -- El JOIN y el WHERE para 'advisors' y 'a.estado' ya no se necesitan aquí
        WHERE
            alv.advisorname IS NOT NULL
        GROUP BY
            alv.advisorname
        ORDER BY
            average_follow_up_days ASC;`;

        const result = await pool.query(query);
        // Devolver datos formateados si es necesario (ej: redondear)
        const formattedResults = result.rows.map(row => ({
            advisorname: row.advisorname,
            average_follow_up_days: parseFloat(row.average_follow_up_days).toFixed(1) // Redondear a 1 decimal
        }));
        res.json(formattedResults);

    } catch (err) {
        console.error('Error al obtener el ranking de seguimiento:', err);
        res.status(500).json({ message: 'Error en el servidor al consultar el ranking de seguimiento.' });
    }
});

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
                fc.id,
                fc.center_name,
                fc.advisor_name,
                fc.quote_id,
                fc.quote_number,
                fc.formalization_date,
                q.preciofinalporestudiante, -- Añadir precio
                q.studentcount              -- Añadir cantidad estudiantes
            FROM formalized_centers fc
            LEFT JOIN quotes q ON fc.quote_id = q.id -- Unir con quotes para obtener datos extra
            ORDER BY fc.formalization_date DESC;
        `;
        const result = await pool.query(query);

        // Construir URL base dinámicamente
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const responseData = result.rows.map(row => ({
            "centro_nombre": row.center_name,
            "asesor_nombre": row.advisor_name,
            "cotizacion_numero": row.quote_number,
            "cotizacion_pdf_url": row.quote_id ? `${baseUrl}/api/quote-requests/${row.quote_id}/pdf` : null, // URL completa y dinámica, null si no hay quote_id
            "acuerdo_pdf_url": row.quote_id ? `${baseUrl}/api/agreements/${row.quote_id}/pdf` : null, // Añadir URL del acuerdo
            "precio_por_estudiante": row.preciofinalporestudiante ? parseFloat(row.preciofinalporestudiante).toFixed(2) : null, // Añadir precio formateado
            "cantidad_estudiantes": row.studentcount, // Añadir cantidad
            "fecha_formalizacion": row.formalization_date ? new Date(row.formalization_date).toISOString().split('T')[0] : null // Formato YYYY-MM-DD, null si no hay fecha
        }));

        res.json(responseData);
    } catch (err) {
        console.error('Error al obtener la lista de centros formalizados:', err);
        res.status(500).json({ message: 'Error en el servidor al obtener lista de formalizados.' });
    }
});
app.get('/api/comments', requireLogin, requireAdmin, async (req, res) => { /* ... código completo de la Nube ... */ });
app.post('/api/comments', requireLogin, requireAdmin, async (req, res) => { /* ... código completo de la Nube ... */ });
app.delete('/api/comments/:id', requireLogin, requireAdmin, async (req, res) => { /* ... código completo de la Nube ... */ });
// --- FIN RUTAS DE GESTIÓN DE COMENTARIOS ---

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS (DE LA NUBE + AJUSTE LOCAL) ---
app.use(express.static(path.join(__dirname))); // Servir archivos estáticos (CSS, JS del cliente, imágenes)

// --- INICIO DE LA CORRECCIÓN 1 ---
// Silenciar la petición del favicon.ico para que no llene los logs
// Esto debe ir ANTES del app.use(express.static...) si el favicon NO existe,
// o justo después si SÍ existe pero queremos evitar logs. 
// Aquí lo ponemos antes de las rutas HTML.
app.get('/favicon.ico', (req, res) => res.status(204).end());
// --- FIN DE LA CORRECCIÓN 1 ---

// Ruta para el login (pública)
app.get('/', (req, res) => {
    // Si ya está logueado, redirigir al index, si no, mostrar login
    if (req.session && req.session.user) {
        res.redirect('/index.html');
    } else {
        res.sendFile(path.join(__dirname, 'login.html'));
    }
});
// Redirección explícita para login.html también
app.get('/login.html', (req, res) => {
     if (req.session && req.session.user) {
        res.redirect('/index.html');
    } else {
        res.sendFile(path.join(__dirname, 'login.html'));
    }
});
// --- INICIO DE LA CORRECCIÓN #2 (ASEGÚRATE DE PEGAR ESTO) ---

// Regla de seguridad específica para el reporte de visitas (solo Admin y Coordinador)
app.get('/reporte_visitas.html', requireLogin, checkRole(['Administrador', 'Coordinador']), (req, res, next) => {
    // --- ESTA ES LA LÓGICA QUE FALTABA PARA CERRAR ---
    const requestedPath = path.join(__dirname, req.path);
    if (fs.existsSync(requestedPath)) {
        res.sendFile(requestedPath);
    } else {
        next(); // Pasar al manejador 404 si no existe
    }
    // --- AQUÍ CERRAMOS LA RUTA app.get ---
});

// AHORA LA RUTA app.delete ESTÁ AFUERA Y ES VÁLIDA
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

// --- FIN DE LA CORRECCIÓN #2 ---
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
            SELECT v.advisorname, COUNT(*) as total_visits 
            FROM visits v
            -- --- INICIO: MODIFICACIÓN 1 (FILTRAR ACTIVOS) ---
            JOIN advisors a ON v.advisorname = a.name
            WHERE a.estado = 'activo'
            -- --- FIN: MODIFICACIÓN 1 ---
            GROUP BY v.advisorname
        `);
        const formalizationsQuery = pool.query(`
            SELECT fc.advisor_name, COUNT(*) as total_formalizations 
            FROM formalized_centers fc
            -- --- INICIO: MODIFICACIÓN 2 (FILTRAR ACTIVOS) ---
            JOIN advisors a ON fc.advisor_name = a.name
            WHERE a.estado = 'activo'
            -- --- FIN: MODIFICACIÓN 2 ---
            GROUP BY fc.advisor_name
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
            SELECT alv.advisorname, AVG(alv.days_since_last_visit) AS average_follow_up_days
            FROM ActiveCentersLastVisit alv
            -- --- INICIO: MODIFICACIÓN 3 (FILTRAR ACTIVOS) ---
            JOIN advisors a ON alv.advisorname = a.name
            WHERE alv.advisorname IS NOT NULL
              AND a.estado = 'activo'
            -- --- FIN: MODIFICACIÓN 3 ---
            GROUP BY alv.advisorname;
        `);

        // Ejecutamos todas las consultas en paralelo para máxima eficiencia
        const [visitsResults, formalizationsResults, followUpResults] = await Promise.all([
            visitsQuery, formalizationsQuery, followUpQuery
        ]);

        // 2. CONSOLIDAR LOS DATOS DEL EQUIPO
        // ... (El resto de tu lógica de JS no necesita cambios) ...
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
app.get('/api/pipeline-ranking', requireLogin, checkRole(['Administrador', 'Coordinador', 'Asesor']), async (req, res) => {
    try {
        // Re-escrito para eliminar cualquier posible carácter invisible.
        const query = `SELECT etapa_venta, COUNT(*) as count
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
                END;`;
        
        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error("Error al obtener datos del pipeline:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// 2. API PARA EL RANKING DE ALCANCE (CENTROS ÚNICOS)
app.get('/api/reach-ranking', requireLogin, checkRole(['Administrador', 'Coordinador', 'Asesor']), async (req, res) => {
    try {
        // Re-escrito para eliminar caracteres invisibles (error position: '2')
        const query = `SELECT 
                v.advisorname, 
                COUNT(DISTINCT v.centername) as unique_centers_count
            FROM 
                visits v
            -- --- INICIO: MODIFICACIÓN (FILTRAR ACTIVOS) ---
            JOIN 
                advisors a ON v.advisorname = a.name
            WHERE
                a.estado = 'activo'
            -- --- FIN: MODIFICACIÓN ---
            GROUP BY 
                v.advisorname
            ORDER BY 
                unique_centers_count DESC;`;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error("Error al obtener ranking de alcance:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});
// 3. API PARA EL RANKING DE TASA DE CONVERSIÓN
app.get('/api/conversion-ranking', requireLogin, checkRole(['Administrador', 'Coordinador', 'Asesor']), async (req, res) => {
    try {
        // Re-escrita para eliminar caracteres invisibles (error position: '2')
        const managedQuery = `SELECT 
                v.advisorname, 
                COUNT(DISTINCT v.centername) as total_managed 
            FROM visits v
            JOIN advisors a ON v.advisorname = a.name
            WHERE a.estado = 'activo'
            GROUP BY v.advisorname;`;
        
        // Re-escrita para eliminar caracteres invisibles (error position: '2')
        const formalizedQuery = `SELECT 
                fc.advisor_name, 
                COUNT(*) as total_formalized 
            FROM formalized_centers fc
            JOIN advisors a ON fc.advisor_name = a.name
            WHERE a.estado = 'activo'
            GROUP BY fc.advisor_name;`;

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
            // Se añade protección para evitar división por cero (aunque managed > 0 ya lo controla)
            const rate = (advisor.managed > 0) ? (advisor.formalized / advisor.managed) * 100 : 0;
            return {
                advisorname: advisor.name,
                conversion_rate: parseFloat(rate.toFixed(1)) // Aseguramos que sea un número con 1 decimal
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
// ========= INICIO: APIS PARA IDE (HISTÓRICO Y QUINCENAL) ==============
// ======================================================================

// 1. API PARA EL ÍNDICE DE DESEMPEÑO ESTRATÉGICO (IDE HISTÓRICO)
// (Esta es tu ruta original, ahora renombrada a /api/ide-historico
// y corregida para incluir a todos los asesores activos)
app.get('/api/ide-historico', requireLogin, async (req, res) => {
    try {
        // ALCANCE (40%): Conteo histórico de centros únicos
        const reachQuery = `
SELECT
    v.advisorname, 
    COUNT(DISTINCT v.centername) as value 
FROM visits v
JOIN advisors a ON v.advisorname = a.name
WHERE a.estado = 'activo'
GROUP BY v.advisorname;`;
        // SEGUIMIENTO (40%): Promedio histórico de días de seguimiento (eficiencia)
        const followUpQuery = `
WITH ActiveCentersLastVisit AS (
    SELECT
        latest_visit.advisorname,
        (CURRENT_DATE - latest_visit.visitdate) AS days_since_last_visit
    FROM
        centers c
    JOIN LATERAL (
        SELECT v.advisorname, v.commenttext, v.visitdate
        FROM visits v 
        JOIN advisors a ON v.advisorname = a.name
        WHERE v.centername = c.name AND a.estado = 'activo'
        ORDER BY v.visitdate DESC, v.createdat DESC
        LIMIT 1
    ) AS latest_visit ON true
    WHERE 
        latest_visit.commenttext NOT IN ('Formalizar Acuerdo', 'No Logrado')
)
SELECT
    advisorname,
    AVG(days_since_last_visit) as value
FROM
    ActiveCentersLastVisit
WHERE
    advisorname IS NOT NULL
GROUP BY
    advisorname;`;
        // CONVERSIÓN (20%): Tasa histórica de conversión
        const conversionQuery = `
WITH M AS (
    SELECT 
        v.advisorname, 
        COUNT(DISTINCT v.centername) AS total 
    FROM visits v
    JOIN advisors a ON v.advisorname = a.name
    WHERE a.estado = 'activo'
    GROUP BY v.advisorname
), 
F AS (
    SELECT 
        fc.advisor_name, 
        COUNT(*) AS total 
    FROM formalized_centers fc
    JOIN advisors a ON fc.advisor_name = a.name
    WHERE a.estado = 'activo'
    GROUP BY fc.advisor_name
) 
SELECT 
    M.advisorname, 
    (COALESCE(F.total, 0) * 100.0 / NULLIF(M.total, 0)) AS value
FROM M 
LEFT JOIN F ON M.advisorname = F.advisor_name;`;
        const [reachRes, followUpRes, conversionRes, allActiveAdvisorsRes] = await Promise.all([
            pool.query(reachQuery),
            pool.query(followUpQuery),
            pool.query(conversionQuery),
            pool.query("SELECT name FROM advisors WHERE estado = 'activo'") // <-- Obtenemos a todos los activos
        ]);

        const advisors = {};
        
        // CORRECCIÓN: Inicializamos a todos los asesores activos con 0
        allActiveAdvisorsRes.rows.forEach(a => {
            advisors[a.name] = { advisorname: a.name, reach: 0, followUp: 0, conversion: 0 };
        });

        // Llenamos los datos de los que sí tuvieron actividad
        reachRes.rows.forEach(r => { 
            if(advisors[r.advisorname]) advisors[r.advisorname].reach = parseFloat(r.value); 
        });
        followUpRes.rows.forEach(r => { 
            if(advisors[r.advisorname]) advisors[r.advisorname].followUp = parseFloat(r.value); 
        });
        conversionRes.rows.forEach(r => { 
            if(advisors[r.advisorname]) advisors[r.advisorname].conversion = parseFloat(r.value || 0); 
        });

        const advisorList = Object.values(advisors);
        
        // Lógica de normalización (sin cambios, pero verificada)
        const maxReach = Math.max(1, ...advisorList.map(a => a.reach)); // max(1,...) para evitar dividir por 0
        const followUpDays = advisorList.filter(a => a.followUp > 0).map(a => a.followUp);
        const minFollowUp = followUpDays.length > 0 ? Math.min(...followUpDays) : 1; // min(1,...)
        const maxFollowUp = followUpDays.length > 0 ? Math.max(...followUpDays) : 1; // max(1,...)
        const maxConversion = Math.max(1, ...advisorList.map(a => a.conversion)); // max(1,...)

        const performanceData = advisorList.map(advisor => {
            const reachScore = (advisor.reach / maxReach);
            
            // Lógica inversa para seguimiento: menos días es mejor
            let followUpScore = 0;
            if (advisor.followUp > 0) {
                if (maxFollowUp === minFollowUp) {
                    followUpScore = 1; // Solo hay un valor, todos obtienen el 100%
                } else {
                    // Normalización inversa
                    followUpScore = 1 - ((advisor.followUp - minFollowUp) / (maxFollowUp - minFollowUp));
                }
            }
            
            const conversionScore = (advisor.conversion / maxConversion);
            
            // Ponderación final del IDE Histórico
            const totalScore = (reachScore * 40) + (followUpScore * 40) + (conversionScore * 20);
            
            return { 
                advisorname: advisor.advisorname, 
                performance_score: parseFloat(totalScore.toFixed(1))
            };
        });

        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        res.json(performanceData);

    } catch (err) {
        console.error("Error al calcular el IDE Histórico:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});
// 2. ¡NUEVA API! API PARA EL BONO QUINCENAL (IDE QUINCENAL)
app.get('/api/ide-quincenal', requireLogin, async (req, res) => {
    try {
        // Define la fecha de inicio de la quincena actual (día 1 o 16)
        const quincenaStartDateSQL = `(CASE WHEN EXTRACT(DAY FROM NOW()) >= 16 THEN date_trunc('month', NOW()) + interval '15 days' ELSE date_trunc('month', NOW()) END)::date`;
// ALCANCE (40%): Conteo de centros únicos en los últimos 15 días
        const reachQuery = `
		SELECT 
		v.advisorname,
		COUNT(DISTINCT v.centername) as value
		FROM visits v
		JOIN advisors a ON v.advisorname = a.name
		WHERE a.estado = 'activo'
		AND v.visitdate >= ${quincenaStartDateSQL}
		GROUP BY v.advisorname;`;
		// SEGUIMIENTO (40%): Conteo de visitas de seguimiento activo
        const followUpQuery = `
SELECT 
    v.advisorname, 
    COUNT(*) as value 
FROM visits v
JOIN advisors a ON v.advisorname = a.name
WHERE a.estado = 'activo'
  AND v.commenttext IN (
      'Presentacion de Propuesta a Direccion', 
      'Presentacion de Propuesta a Estudiantes', 
      'Visita de Seguimiento'
    )
  AND v.visitdate >= ${quincenaStartDateSQL}
GROUP BY v.advisorname;`;
		// CONVERSIÓN (20%): Conteo de centros formalizados en los últimos 15 días
        const conversionQuery = `
SELECT 
    fc.advisor_name, 
    COUNT(*) AS value 
FROM formalized_centers fc
JOIN advisors a ON fc.advisor_name = a.name
WHERE a.estado = 'activo'
  AND fc.formalization_date >= ${quincenaStartDateSQL}
GROUP BY fc.advisor_name;`;
// -- PARTE 2.a: Ejecución de consultas y recolección de datos --
        const [reachRes, followUpRes, conversionRes, allActiveAdvisorsRes] = await Promise.all([
            pool.query(reachQuery),
            pool.query(followUpQuery),
            pool.query(conversionQuery),
            pool.query("SELECT name FROM advisors WHERE estado = 'activo'")
        ]);

        const advisors = {};
        
        // Inicializamos a todos los asesores activos con 0
        allActiveAdvisorsRes.rows.forEach(a => {
            advisors[a.name] = { advisorname: a.name, reach: 0, followUp: 0, conversion: 0 };
        });

        // Llenamos los datos de los que sí tuvieron actividad
        reachRes.rows.forEach(r => { 
            if(advisors[r.advisorname]) {
                advisors[r.advisorname].reach = parseFloat(r.value); 
            }
        });
        followUpRes.rows.forEach(r => { 
            if(advisors[r.advisorname]) {
                advisors[r.advisorname].followUp = parseFloat(r.value); 
            }
        });
        conversionRes.rows.forEach(r => { 
            // Ojo: la columna aquí es 'advisor_name'
            if(advisors[r.advisor_name]) {
                advisors[r.advisor_name].conversion = parseFloat(r.value || 0); 
            }
        });

// ---- Pídeme la Parte 2.b para pegar el resto del código aquí ----
		// -- PARTE 2.b: Cálculo de score y respuesta JSON --
        const advisorList = Object.values(advisors);

        // Normalización simple (más es mejor)
        const maxReach = Math.max(1, ...advisorList.map(a => a.reach)); 
        const maxFollowUp = Math.max(1, ...advisorList.map(a => a.followUp));
        const maxConversion = Math.max(1, ...advisorList.map(a => a.conversion));

        const performanceData = advisorList.map(advisor => {
            // Calculamos el score normalizado (valor / máximo)
            const reachScore = (advisor.reach / maxReach);
            const followUpScore = (advisor.followUp / maxFollowUp);
            const conversionScore = (advisor.conversion / maxConversion);
            
            // Ponderación final del IDE Quincenal (40/40/20)
            const totalScore = (reachScore * 40) + (followUpScore * 40) + (conversionScore * 20);
            
            return { 
                advisorname: advisor.advisorname, 
                performance_score: parseFloat(totalScore.toFixed(1))
            };
        });

        // Ordenamos y enviamos la respuesta
        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        res.json(performanceData);

    } catch (err) {
        // Bloque de manejo de errores
        console.error("Error al calcular el IDE Quincenal:", err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});
		// 2. API PARA EL PANEL "PULSO DEL EQUIPO"
app.get('/api/team-pulse', requireLogin, checkRole(['Administrador', 'Coordinador']), async (req, res) => {
    try {
        // Re-escrita para eliminar caracteres invisibles (error position: '2')
        const activeProspectsQuery = `SELECT 
                COUNT(*) as value 
            FROM centers 
            WHERE etapa_venta NOT IN ('Acuerdo Formalizado', 'No Logrado');`;
        
        // Re-escrita para eliminar caracteres invisibles (error position: '2')
        const conversionRateQuery = `SELECT
                (SELECT COUNT(fc.id) 
                FROM formalized_centers fc 
                JOIN advisors a ON fc.advisor_name = a.name 
                WHERE a.estado = 'activo') * 100.0
                /
                NULLIF((SELECT COUNT(DISTINCT v.centername)
                        FROM visits v 
                        JOIN advisors a ON v.advisorname = a.name 
                        WHERE a.estado = 'activo'), 0)
            as value;`;

        // Re-escrita para eliminar caracteres invisibles (error position: '2')
        const salesCycleQuery = `WITH FirstVisits AS (
                SELECT 
                    v.centername, 
                    MIN(v.visitdate) as first_visit_date 
                FROM visits v
                JOIN advisors a ON v.advisorname = a.name
                WHERE a.estado = 'activo'
                GROUP BY v.centername
            ) 
            SELECT 
                AVG(fc.formalization_date::date - fv.first_visit_date) as value 
            FROM formalized_centers fc 
            JOIN FirstVisits fv ON fc.center_name = fv.centername
            JOIN advisors a ON fc.advisor_name = a.name
            WHERE a.estado = 'activo';`;

        // Re-escrita para eliminar caracteres invisibles (error position: '2')
        const bottleneckQuery = `SELECT 
                etapa_venta as value, 
                COUNT(*) as count 
            FROM centers 
            WHERE etapa_venta NOT IN ('Prospecto', 'Acuerdo Formalizado', 'No Logrado') 
            GROUP BY etapa_venta 
            ORDER BY count DESC 
            LIMIT 1;`;

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

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/api/productos', (req, res) => {
  // Esta es la variable 'products' que encontramos antes
  res.json(products);
});

// --- FIN DEL CÓDIGO AÑADIDO ---
app.get('/*.html', requireLogin, (req, res) => { const requestedPath = path.join(__dirname, req.path); if (fs.existsSync(requestedPath)) { res.sendFile(requestedPath); } else { res.status(404).send('Página no encontrada'); } });

// Middleware final para todas las demás rutas .html (requiere login genérico)
app.get('/*.html', requireLogin, (req, res, next) => { // Añadido next
    // Evitar loop si se pide login.html y ya falló requireLogin (aunque no debería pasar)
    if (req.path.toLowerCase() === '/login.html') {
         return res.status(403).send("Acceso denegado."); // O manejar de otra forma
    }

    const requestedPath = path.join(__dirname, req.path);
    // Validar que el path no intente salir del directorio base (seguridad)
    if (requestedPath.indexOf(__dirname) !== 0) {
        return res.status(400).send("Ruta inválida.");
    }

    if (fs.existsSync(requestedPath) && fs.lstatSync(requestedPath).isFile()) { // Verificar que existe Y es un archivo
        res.sendFile(requestedPath);
    } else {
        // Si no existe el archivo HTML específico, pasar al manejador 404
        next();
    }
});
// --- Fin Rutas HTML ---

// --- Manejo de errores global (DE LA NUBE) ---
// Middleware 404 (si ninguna ruta anterior coincidió)
app.use((req, res, next) => {
  console.log(`404 - Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  
  // --- INICIO DE LA CORRECCIÓN 2 ---
  // Manejo de 404 más robusto para evitar crashear si 404.html no existe
  const file404 = path.join(__dirname, '404.html');
  res.status(404).sendFile(file404, (err) => {
      // Si hay un error (ej: 404.html no existe),
      // enviamos un texto simple para evitar un error 500.
      if (err) {
          console.error(`Advertencia: No se pudo enviar 404.html. ${err.message}`);
          // Asegurarse de que no se haya enviado ya una respuesta
          if (!res.headersSent) {
              res.status(404).send("Lo sentimos, no se encontró la página solicitada.");
          }
      }
  });
  // --- FIN DE LA CORRECCIÓN 2 ---
});

// Middleware de error general (captura errores de rutas síncronas/asíncronas con next(err))
app.use((err, req, res, next) => {
  console.error(`Error no manejado en ${req.method} ${req.originalUrl}:`, err.stack || err); // Log completo del error
  // Evitar enviar stack trace detallado en producción por seguridad
  const message = isProduction ? '¡Algo salió mal en el servidor!' : `Error: ${err.message}`;
  // Asegurarse de no intentar enviar respuesta si ya se envió
  if (!res.headersSent) {
      // Diferenciar respuesta API vs HTML
      if (req.originalUrl.startsWith('/api/')) {
           res.status(500).json({ message: message });
      } else {
           res.status(500).send(`<h1>Error del Servidor</h1><p>${message}</p>${isProduction ? '' : '<pre>' + err.stack + '</pre>'}`);
      }
  }
});
// --- Fin Manejo de errores ---

// --- Inicialización y Arranque (DE LA NUBE + AJUSTE LOCAL) ---
// Mover loadProducts y initializeDatabase ANTES de app.listen para asegurar que estén listos
async function startServer() {
    try {
        console.log("Iniciando carga de productos...");
        loadProducts(); // Inicia la carga async
        // Esperar un momento corto para permitir que la carga del CSV comience o termine si es rápida
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("Iniciando inicialización de base de datos...");
        await initializeDatabase(); // Esperar a que la BD esté lista

        app.listen(PORT, () => {
            console.log(`✅ Servidor Be Gestion (Nube + Ajustes - Bloque Final) corriendo en http://localhost:${PORT}`);
        });
    } catch (startError) {
        console.error("FALLO CRÍTICO AL INICIAR EL SERVIDOR:", startError);
        process.exit(1); // Detener el proceso si hay un error crítico al inicio
    }
}

startServer(); // Llamar a la función async para iniciar
// --- Fin Arranque ---
// --- Fin Bloque 6 ---