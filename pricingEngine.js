// VERSIÓN 14.0 - Lógica de Costos Progresivos para Lanzamientos

function redondeoComercial(precio) {
    const residuo = precio % 100;
    if (residuo > 0 && residuo <= 15) {
        return Math.floor(precio / 100) * 100;
    }
    return Math.ceil(precio / 50) * 50;
}

// --- TABLAS DE COSTOS POR TRAMOS ---

const eventCostTiers = [
    { min: 10, max: 25, cost: 1481 },
    { min: 26, max: 50, cost: 1481 },
    { min: 51, max: 75, cost: 1381 },
    { min: 76, max: 100, cost: 1281 },
    { min: 101, max: 125, cost: 1181 },
    { min: 126, max: 150, cost: 1100 },
    { min: 151, max: 175, cost: 1050 },
    { min: 176, max: 250, cost: 1000 },
    { min: 251, max: Infinity, cost: 1000 }
];

const launchTiers = [
    { min: 51, max: 75, cost: 450 },
    { min: 76, max: 100, cost: 600 },
    { min: 101, max: 125, cost: 750 },
    { min: 126, max: 150, cost: 900 },
    { min: 151, max: 175, cost: 900 },
    { min: 176, max: 250, cost: 1050 },
    { min: 251, max: Infinity, cost: 1200 }
];

// --- FUNCIONES AUXILIARES DE CÁLCULO ---

function getEventCost(studentCount) {
    const tier = eventCostTiers.find(t => studentCount >= t.min && studentCount <= t.max);
    return tier ? tier.cost : 0;
}

function calculateLaunchExtraCost(studentCount) {
    const startTier = 50; // El costo base cubre hasta 50 estudiantes
    if (studentCount <= startTier) {
        return 0;
    }

    let extraCost = 0;
    let lastTierMax = startTier;

    for (const tier of launchTiers) {
        if (studentCount > lastTierMax) {
            const studentsInTier = Math.min(studentCount, tier.max) - lastTierMax;
            extraCost += studentsInTier * tier.cost;
            lastTierMax = tier.max;
        } else {
            break; // Se detiene cuando el conteo de estudiantes ya no supera el tramo anterior
        }
    }
    return extraCost;
}

// --- FUNCIÓN PRINCIPAL DEL MOTOR DE PRECIOS ---

function assembleQuote(quoteInput, db) {
    const {
        studentCount = 0,
        productIds = [],
        aporteInstitucion = 0,
        estudiantesCortesia = 0,
        tasaDesercion = 0.10
    } = quoteInput;

    const allProducts = db.products || [];
    const selectedProducts = productIds.map(id => allProducts.find(p => p.id === id)).filter(p => p);

    if (studentCount <= 0 || selectedProducts.length === 0) {
        return { error: 'Datos insuficientes para calcular.' };
    }

    let costoTotalProyecto = 0;
    let isPerStudentQuote = false;

    selectedProducts.forEach(product => {
        const costoBaseText = product['COSTO BASE'] || '0';
        const costoBase = parseFloat(costoBaseText.replace(/[^0-9.]/g, '')) || 0;
        const tipoPrecio = (product['TIPO DE PRECIO'] || '').trim();
        const productName = (product['PRODUCTO / SERVICIO'] || '').trim();

        const isLaunchProduct = productName === 'LANZAMIENTOS' || productName === 'LANZAMIENTO TEMATICO';

        if (isLaunchProduct) {
            const extraCost = calculateLaunchExtraCost(studentCount);
            costoTotalProyecto += costoBase + extraCost;
            isPerStudentQuote = true; // El precio ahora varía por estudiante
        }
        // FIX: Usar startsWith para hacer la coincidencia de nombres más robusta contra caracteres invisibles/typos.
        else if (productName.startsWith('Sesion de fotos en Estudio') || productName.startsWith('Sesion de fotos de Pre Graduacion')) {
            costoTotalProyecto += costoBase * studentCount;
            isPerStudentQuote = true;
        }
        else if (tipoPrecio === 'costo_por_rango') {
            const eventCostPerStudent = getEventCost(studentCount);
            costoTotalProyecto += eventCostPerStudent * studentCount;
            isPerStudentQuote = true;
        }
        else if (tipoPrecio === 'por_estudiante') {
            costoTotalProyecto += costoBase * studentCount;
            isPerStudentQuote = true;
        } else {
            costoTotalProyecto += costoBase;
        }
    });

    const perStudentMarginRules = [
        { min: 10, max: 25, margin: 0.38 },
        { min: 26, max: 50, margin: 0.35 },
        { min: 51, max: 75, margin: 0.32 },
        { min: 76, max: 100, margin: 0.30 },
        { min: 101, max: 125, margin: 0.29 },
        { min: 126, max: 150, margin: 0.28 },
        { min: 151, max: 175, margin: 0.27 },
        { min: 176, max: 250, margin: 0.26 },
        { min: 251, max: Infinity, margin: 0.25 }
    ];

    const fixedCostMarginRules = [
        { min: 10, max: 25, margin: 0.38 },
        { min: 26, max: 50, margin: 0.35 },
        { min: 51, max: 75, margin: 0.32 },
        { min: 76, max: 100, margin: 0.30 },
        { min: 101, max: 125, margin: 0.29 },
        { min: 126, max: 150, margin: 0.28 },
        { min: 151, max: 175, margin: 0.27 },
        { min: 176, max: 250, margin: 0.26 },
        { min: 251, max: Infinity, margin: 0.25 }
    ];

    const marginRules = isPerStudentQuote ? perStudentMarginRules : fixedCostMarginRules;
    const applicableMarginRule = marginRules.find(r => studentCount >= r.min && studentCount <= r.max);
    const beneficioNetoEmpresa = applicableMarginRule ? applicableMarginRule.margin : 0.30;
    const comisionAsesorPercentageOfSale = 0.10;

    let precioVentaTotalProyecto = costoTotalProyecto / (1 - beneficioNetoEmpresa - comisionAsesorPercentageOfSale);
    if (aporteInstitucion > 0) {
        precioVentaTotalProyecto += aporteInstitucion * studentCount;
    }

    const estudiantesParaFacturar = Math.floor(Math.max(0, (studentCount * (1 - tasaDesercion)) - estudiantesCortesia));
    const precioFinalPorEstudiante = estudiantesParaFacturar > 0 ? precioVentaTotalProyecto / estudiantesParaFacturar : 0;
    const precioRedondeado = redondeoComercial(precioFinalPorEstudiante);

    const facilidades = [];
    const hasPolo = selectedProducts.some(p => (p['PRODUCTO / SERVICIO'] || '').trim().startsWith('Polo'));
    if (hasPolo && studentCount > 0) {
        const freePolos = Math.floor(studentCount / 10);
        if (freePolos > 0) {
            facilidades.push(`${freePolos} polo(s) extra(s) de cortesía.`);
        }
    }

    const result = {
        calculatedPrices: [{
            montoTotalProyecto: precioVentaTotalProyecto.toFixed(2),
            precioFinalPorEstudiante: precioRedondeado.toFixed(2),
            estudiantesFacturables: estudiantesParaFacturar
        }],
        facilidadesAplicadas: facilidades
    };

    return result;
}

module.exports = { assembleQuote };
