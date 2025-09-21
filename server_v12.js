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

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

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

            CREATE TABLE IF NOT EXISTS quotes ( id SERIAL PRIMARY KEY, quotenumber VARCHAR(50), clientname VARCHAR(255), advisorname VARCHAR(255), studentcount INTEGER, productids INTEGER[], preciofinalporestudiante NUMERIC, estudiantesparafacturar INTEGER, facilidadesaplicadas TEXT[], aporte_institucion NUMERIC DEFAULT 0, status VARCHAR(50) DEFAULT 'pendiente', rejectionreason TEXT, createdat TIMESTAMPTZ DEFAULT NOW(), items JSONB, totals JSONB );
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

app.set('trust proxy', 1);
app.use(session({
    store: new pgSession({
        pool: pool,
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

const requireLogin = (req, res, next) => { if (!req.session.user) { return res.status(401).json({ message: 'No autenticado.' }); } next(); };
const requireAdmin = checkRole(['Administrador']);

// --- RUTAS DE API ---

app.get('/api/formalized-centers', apiKeyAuth, async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT c.id, c.name 
            FROM centers c
            JOIN visits v ON c.name = v.centername
            WHERE UPPER(TRIM(v.commenttext)) = 'FORMALIZAR ACUERDO'
            ORDER BY c.name ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener centros formalizados:', err);
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

app.get('/api/centers', requireLogin, async (req, res) => { try { const result = await pool.query('SELECT * FROM centers ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });

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

app.put('/api/centers/:id', requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
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
app.delete('/api/centers/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM centers WHERE id = $1', [req.params.id]);
        res.status(200).json({ message: 'Centro de estudio eliminado con éxito' });
    } catch (err) {
        console.error('Error eliminando centro:', err);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});
app.get('/api/zones', requireLogin, requireAdmin, async (req, res) => { try { const result = await pool.query('SELECT * FROM zones ORDER BY name ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/zones', requireLogin, requireAdmin, async (req, res) => { const { name } = req.body; try { const newZone = await pool.query('INSERT INTO zones (name) VALUES ($1) RETURNING *', [name]); res.status(201).json(newZone.rows[0]); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.delete('/api/zones/:id', requireLogin, requireAdmin, async (req, res) => { try { await pool.query('DELETE FROM zones WHERE id = $1', [req.params.id]); res.status(200).json({ message: 'Zona eliminada' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.get('/api/comments', requireLogin, requireAdmin, async (req, res) => { try { const result = await pool.query('SELECT * FROM comments ORDER BY text ASC'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.post('/api/comments', requireLogin, requireAdmin, async (req, res) => { const { name } = req.body; try { const newComment = await pool.query('INSERT INTO comments (text) VALUES ($1) RETURNING *', [name]); res.status(201).json(newComment.rows[0]); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.delete('/api/comments/:id', requireLogin, requireAdmin, async (req, res) => { try { await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]); res.status(200).json({ message: 'Comentario eliminado' }); } catch (err) { console.error(err); res.status(500).json({ message: 'Error en el servidor' }); } });
app.get('/api/next-quote-number', requireLogin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT quotenumber FROM quotes WHERE quotenumber LIKE 'COT-%' ORDER BY CAST(SUBSTRING(quotenumber FROM 5) AS INTEGER) DESC LIMIT 1`);
        const lastNumber = result.rows.length > 0 ? parseInt(result.rows[0].quotenumber.split('-')[1]) : 240000;
        const nextNumber = lastNumber + 1;
        res.json({ quoteNumber: `COT-${nextNumber}` });
    } catch (err) { console.error("Error getting next quote number:", err); res.status(500).json({ message: 'Error en el servidor' }); }
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
        await pool.query( `INSERT INTO quotes (clientname, advisorname, studentcount, productids, preciofinalporestudiante, estudiantesparafacturar, facilidadesaplicadas, items, totals, status, quotenumber, aporte_institucion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente', $10, $11)`, [clientName, advisorName, studentCount, productIds, precioFinalPorEstudiante, estudiantesParaFacturar, facilidadesAplicadas, JSON.stringify(items), JSON.stringify(totals), quoteNumber, aporteInstitucion || 0] ); 
        res.status(201).json({ message: 'Cotización guardada con éxito' }); 
    } catch (err) { 
        console.error('Error al guardar cotización:', err); 
        res.status(500).json({ message: 'Error interno del servidor.' }); 
    } 
});

app.get('/api/quote-requests', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
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

// ==================================================================
// ============== INICIO DE LA NUEVA RUTA (COTIZACIONES) ==============
// ==================================================================
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
// ==================================================================
// ============== FIN DE LA NUEVA RUTA (COTIZACIONES) ==============
// ==================================================================

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

// ==================================================================
// ============== INICIO DE LA SECCIÓN MODIFICADA (PERMISOS) ==============
// ==================================================================
app.post('/api/quote-requests/:id/archive', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
    try {
        await pool.query("UPDATE quotes SET status = 'archivada' WHERE id = $1", [req.params.id]);
        res.status(200).json({ message: 'Cotización archivada con éxito' });
    } catch (err) {
        console.error('Error archivando cotización:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.get('/api/quote-requests/:id/pdf', requireLogin, checkRole(['Administrador', 'Asesor']), async (req, res) => {
// ==================================================================
// ============== FIN DE LA SECCIÓN MODIFICADA (PERMISOS) ==============
// ==================================================================
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

        // ==================================================================
        // ============== INICIO DE LA MODIFICACIÓN (RUTA MEMBRETE) ==============
        // ==================================================================
        const backgroundImagePath = path.join(__dirname, 'plantillas', 'membrete.jpg');
        // ==================================================================
        // ============== FIN DE LA MODIFICACIÓN (RUTA MEMBRETE) ==============
        // ==================================================================
        
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
        const conditions = [
            `Cálculo basado en ${quote.studentcount || 0} estudiantes y evaluable a un mínimo de ${quote.estudiantesparafacturar || 0} estudiantes.`,
            'Condiciones de Pago a debatir.'
        ];
        if (quote.aporte_institucion && parseFloat(quote.aporte_institucion) > 0) {
            conditions.push(`Codigoapi(${parseFloat(quote.aporte_institucion)})sql`);
        }
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

// --- RUTAS HTML Y ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/*.html', requireLogin, (req, res) => { const requestedPath = path.join(__dirname, req.path); if (fs.existsSync(requestedPath)) { res.sendFile(requestedPath); } else { res.status(404).send('Página no encontrada'); } });

app.listen(PORT, async () => {
    loadProducts();
    await initializeDatabase();
    console.log(`✅ Servidor de Asesores (v17.1 - CORS Habilitado) corriendo en el puerto ${PORT}`);
});
