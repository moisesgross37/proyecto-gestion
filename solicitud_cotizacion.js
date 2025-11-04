// --- Bloque Principal (Fusionado Nube + Ajuste + Debug Logs) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded disparado.'); // Log inicial

    // --- ELEMENTOS DEL FORMULARIO (DE LA NUBE + BOTÓN GUARDAR) ---
    const quoteForm = document.getElementById('quote-form');
    const quoteNumberInput = document.getElementById('quoteNumber');
    const clientNameInput = document.getElementById('clientName');
    const clientIdInput = document.getElementById('clientId');
    const advisorNameSelect = document.getElementById('asesor-a-cargo-select');
    const clientAutocompleteResults = document.getElementById('client-autocomplete-results');
    const productAccordionContainer = document.getElementById('contenedor-productos');
    const aporteInstitucionInput = document.getElementById('aporteInstitucion');
    const estudiantesCortesiaInput = document.getElementById('estudiantesCortesia');
    const calculatedGratuitiesDiv = document.getElementById('calculated-gratuities');
    const studentCountInput = document.getElementById('studentCount');
    const summaryBillableStudents = document.getElementById('summary-billable-students');
    const summaryTotalAmount = document.getElementById('summary-total-amount');
    const summaryPricePerStudent = document.getElementById('summary-price-per-student');
    const successMessage = document.getElementById('success-message'); // Para notificaciones
    const submitQuoteBtn = document.getElementById('submit-quote-btn'); // ID AÑADIDO AL BOTÓN

    // --- ELEMENTOS DEL MODAL DE AJUSTE (DEL HTML LOCAL) ---
    const openAdjustmentModalBtn = document.getElementById('open-adjustment-request-btn');
    const adjustmentModal = document.getElementById('adjustment-request-modal');
    const closeAdjustmentModalBtn = document.getElementById('close-adjustment-request-modal');
    const saveAdjustmentModalBtn = document.getElementById('save-adjustment-request-btn');
    const adjustmentAmountInput = document.getElementById('requested-adjustment-amount');
    const adjustmentCommentInput = document.getElementById('requested-adjustment-comment');
    const adjustmentSavedIndicator = document.getElementById('adjustment-saved-indicator');
    const adjustmentQuoteNumberSpan = document.getElementById('adjustment-quote-number'); // Span para mostrar número

    // --- INICIO: NUEVOS ELEMENTOS MODAL DE BORRADOR ---
    const verBorradorBtn = document.getElementById('ver-borrador-btn');
    const borradorModal = document.getElementById('borrador-modal');
    const closeBorradorModalBtn = document.getElementById('close-borrador-modal-btn');
    // Contenido dinámico del borrador
    const borradorCliente = document.getElementById('borrador-cliente');
    const borradorEstudiantes = document.getElementById('borrador-estudiantes');
    const borradorProductosLista = document.getElementById('borrador-productos-lista');
    const borradorPrecioEstudiante = document.getElementById('borrador-precio-estudiante');
    const borradorTotal = document.getElementById('borrador-total');
    // --- FIN: NUEVOS ELEMENTOS MODAL DE BORRADOR ---

    // --- ESTADO DE LA APP ---
    let allProducts = [];
    let selectedProductIds = new Set();
    let selectedClientId = null;
    let debounceTimer;

    // --- FUNCIÓN DE NOTIFICACIÓN (REEMPLAZA ALERT) ---
    const mostrarNotificacion = (mensaje, tipo = 'success') => {
        console.log(`[Notificación ${tipo}]: ${mensaje}`); // Log notificación
        if (!successMessage) { console.error("Elemento 'success-message' no encontrado."); return; }
        successMessage.textContent = mensaje;
        successMessage.className = `notification ${tipo}`; // Usar clases CSS
        successMessage.style.display = 'block'; // Mostrar
        setTimeout(() => { successMessage.style.display = 'none'; }, 5000); // Ocultar
    };

    // --- Carga de Datos Iniciales ---
    const loadInitialData = async () => {
        console.log('[DEBUG] Iniciando loadInitialData...');
        try {
            const [quoteResponse, dataResponse] = await Promise.all([
                fetch('/api/next-quote-number').catch(e => { console.error('Fetch next-quote-number falló:', e); throw e; }),
                fetch('/api/data').catch(e => { console.error('Fetch data falló:', e); throw e; })
            ]);

             if (!quoteResponse.ok) throw new Error(`Error ${quoteResponse.status} al obtener número cotización.`);
             if (!dataResponse.ok) throw new Error(`Error ${dataResponse.status} al obtener datos iniciales.`);


            const quoteData = await quoteResponse.json();
            const initialData = await dataResponse.json();
             console.log('[DEBUG] Datos iniciales recibidos:', { quoteNumber: quoteData.quoteNumber, advisorsCount: initialData.advisors?.length, productsCount: initialData.products?.length });


            if (quoteNumberInput) quoteNumberInput.value = quoteData.quoteNumber; else console.error('quoteNumberInput no encontrado');

            if (advisorNameSelect) {
                advisorNameSelect.innerHTML = '<option value="">Seleccione un asesor...</option>';
                (initialData.advisors || []).forEach(advisor => {
                    const option = document.createElement('option');
                    option.value = advisor.name;
                    option.textContent = advisor.name;
                    advisorNameSelect.appendChild(option);
                });
            } else {
                console.error('advisorNameSelect no encontrado.');
            }

            allProducts = initialData.products || [];
             if(allProducts.length > 0) {
                 renderProductAccordion();
             } else {
                 console.warn("WARN: No se cargaron productos desde /api/data.");
                 if(productAccordionContainer) productAccordionContainer.innerHTML = '<p>Error: No se pudieron cargar los productos.</p>';
             }
             console.log('[DEBUG] loadInitialData completado.');

        } catch (error) {
            console.error('Error CRÍTICO cargando datos iniciales:', error);
            mostrarNotificacion(`Error cargando datos: ${error.message}`, 'error');
            // Intentar mostrar error en la UI
             if(quoteNumberInput) quoteNumberInput.value = "Error";
             if(productAccordionContainer) productAccordionContainer.innerHTML = `<p style="color:red;">Error cargando datos: ${error.message}</p>`;

        }
    };

    // --- Autocompletado Cliente ---
    const searchClients = async (query) => {
        if (query.length < 2) {
            if (clientAutocompleteResults) clientAutocompleteResults.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/centers/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Error al buscar clientes.');
            const centers = await response.json();
            
            if (!clientAutocompleteResults) return;
            clientAutocompleteResults.innerHTML = '';
            
            if (centers.length === 0) {
                clientAutocompleteResults.innerHTML = '<div>No se encontraron resultados</div>';
                return;
            }

            centers.forEach(center => {
                const div = document.createElement('div');
                div.innerHTML = `${center.name} <small>${center.address}</small>`;
                div.dataset.id = center.id;
                div.addEventListener('click', () => {
                    if (clientNameInput) clientNameInput.value = center.name;
                    if (clientIdInput) clientIdInput.value = center.id;
                    selectedClientId = center.id;
                    clientAutocompleteResults.innerHTML = '';
                });
                clientAutocompleteResults.appendChild(div);
            });
        } catch (error) {
            console.error('Error en la búsqueda de clientes:', error);
            if (clientAutocompleteResults) clientAutocompleteResults.innerHTML = '<div>Error en la búsqueda</div>';
        }
    };
    if (clientNameInput) {
        clientNameInput.addEventListener('input', (e) => {
            selectedClientId = null;
            if(clientIdInput) clientIdInput.value = ''; else console.error('clientIdInput no encontrado');
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => searchClients(e.target.value), 300);
        });
    } else console.error('clientNameInput no encontrado');
    document.addEventListener('click', (e) => {
        if (clientAutocompleteResults && clientNameInput && !clientNameInput.contains(e.target) && !clientAutocompleteResults.contains(e.target)) {
            clientAutocompleteResults.innerHTML = '';
        }
    });

    // --- Renderizar Acordeón Productos ---
    const renderProductAccordion = () => {
         console.log('[DEBUG] Iniciando renderProductAccordion...');
        if (!productAccordionContainer) { console.error('productAccordionContainer no encontrado'); return; }
        productAccordionContainer.innerHTML = ''; // Limpiar
        
        // Agrupar por renglón
        const productsByReglon = allProducts.reduce((acc, product) => {
            if (!product) return acc; // Añadida seguridad por si un producto es nulo
            const reglon = product['RENGLON'] || 'Otros';
            if (!acc[reglon]) acc[reglon] = [];
            acc[reglon].push(product);
            return acc;
        }, {});

        // Crear acordeón por renglón
        Object.keys(productsByReglon).sort().forEach((reglon, index) => { // Ordenar renglones
            const details = document.createElement('details');
            if (index === 0) details.open = true;
            const summary = document.createElement('summary');
            summary.textContent = reglon;
            details.appendChild(summary);

            const accordionContent = document.createElement('div');
            accordionContent.classList.add('accordion-content');

            // Agrupar por subrenglón dentro del renglón
            const productsInReglon = productsByReglon[reglon];
            
            const productsBySubReglon = productsInReglon.reduce((acc, product) => {
                if (!product) return acc; // Seguridad
                const subReglon = product['SUB RENGLON'] || 'General';
                if (!acc[subReglon]) acc[subReglon] = [];
                acc[subReglon].push(product);
                return acc;
            }, {});


            // Crear grupos por subrenglón
            for (const subReglon of Object.keys(productsBySubReglon).sort()) { // Ordenar subrenglones
                const subReglonGroup = document.createElement('div');
                subReglonGroup.classList.add('sub-reglon-group');
                subReglonGroup.innerHTML = `<h4>${subReglon}</h4>`; // Título del subrenglón

                // Añadir checkboxes de productos
                productsBySubReglon[subReglon].forEach(product => {
                    const label = document.createElement('label');
                    label.classList.add('product-item');
                    label.innerHTML = `
                        <input type="checkbox" name="selectedProducts" value="${product.id}">
                        ${product['PRODUCTO / SERVICIO'] || `ID ${product.id} sin nombre`}
                    `;
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    if(checkbox) {
                        checkbox.addEventListener('change', (e) => {
                            const productId = parseInt(e.target.value, 10);
                            if (e.target.checked) {
                                selectedProductIds.add(productId);
                            } else {
                                selectedProductIds.delete(productId);
                            }
                             console.log('[DEBUG] selectedProductIds cambiado:', Array.from(selectedProductIds));
                            triggerSummaryUpdate(); // Actualizar resumen al cambiar selección
                        });
                    }
                    subReglonGroup.appendChild(label);
                });
                accordionContent.appendChild(subReglonGroup);
            } // Fin for subReglon
            details.appendChild(accordionContent);
            productAccordionContainer.appendChild(details);
        }); // Fin forEach reglon
        console.log('[DEBUG] renderProductAccordion completado.');
    };

    // --- Lógica de Resumen en Tiempo Real ---
    const actualizarResumen = async () => {
         console.log('[DEBUG] Iniciando actualizarResumen...');
        // Validar que los elementos existen antes de leerlos
         const studentCountValue = studentCountInput ? studentCountInput.value : '0';
         const aporteInstitucionValue = aporteInstitucionInput ? aporteInstitucionInput.value : '0';
         const estudiantesCortesiaValue = estudiantesCortesiaInput ? estudiantesCortesiaInput.value : '0';

        const studentCount = parseInt(studentCountValue, 10) || 0;
        const aporteInstitucion = parseFloat(aporteInstitucionValue) || 0;
        const estudiantesCortesia = parseInt(estudiantesCortesiaValue, 10) || 0;
        const productIds = Array.from(selectedProductIds);

         console.log('[DEBUG] Datos para estimación:', { studentCount, productIds, aporteInstitucion, estudiantesCortesia });


        // Si no hay estudiantes o productos, limpiar resumen y salir
        if (studentCount === 0 || productIds.length === 0) {
            console.log('[DEBUG] No hay estudiantes o productos, limpiando resumen.');
            if(summaryBillableStudents) summaryBillableStudents.textContent = '0';
            if(summaryTotalAmount) summaryTotalAmount.textContent = '$0.00';
            if(summaryPricePerStudent) summaryPricePerStudent.textContent = '$0.00';
            if(calculatedGratuitiesDiv) calculatedGratuitiesDiv.innerHTML = '<p>Ingrese cantidad de estudiantes y seleccione productos.</p>';
            return;
        }

        const quoteEstimateInput = { studentCount, productIds, aporteInstitucion, estudiantesCortesia, tasaDesercion: 0.10 }; // Tasa fija por ahora

        try {
            console.log('[DEBUG] Enviando petición a /api/quotes/calculate-estimate...');
            const response = await fetch('/api/quotes/calculate-estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteEstimateInput),
            });
             console.log('[DEBUG] Respuesta de calculate-estimate recibida, status:', response.status);
            if (!response.ok) {
                 const errorText = await response.text();
                 console.error('[DEBUG] Error en calculate-estimate:', errorText);
                 throw new Error(`Error ${response.status}: ${errorText || 'Falló cálculo de estimación.'}`);
            }
            const estimate = await response.json();
             console.log('[DEBUG] Estimación recibida:', estimate);


            // Actualizar UI del resumen (con validaciones)
            if (estimate.calculatedPrices && estimate.calculatedPrices.length > 0) {
                const prices = estimate.calculatedPrices[0];
                const billable = prices.estudiantesFacturables ?? 'N/A';
                const total = parseFloat(prices.montoTotalProyecto ?? 0).toFixed(2);
                const perStudent = parseFloat(prices.precioFinalPorEstudiante ?? 0).toFixed(2);

                if(summaryBillableStudents) summaryBillableStudents.textContent = billable;
                if(summaryTotalAmount) summaryTotalAmount.textContent = `$${total}`;
                if(summaryPricePerStudent) summaryPricePerStudent.textContent = `$${perStudent}`;
            } else {
                 console.warn('[DEBUG] La estimación no contiene calculatedPrices válidos.');
                if(summaryBillableStudents) summaryBillableStudents.textContent = 'Error';
                if(summaryTotalAmount) summaryTotalAmount.textContent = '$--.--';
                if(summaryPricePerStudent) summaryPricePerStudent.textContent = '$--.--';
            }

            // Actualizar UI de facilidades (con validaciones)
            if (calculatedGratuitiesDiv) {
                calculatedGratuitiesDiv.innerHTML = ''; // Limpiar
                if (estimate.facilidadesAplicadas && estimate.facilidadesAplicadas.length > 0) {
                    const ul = document.createElement('ul');
                    ul.style.margin = '0'; ul.style.paddingLeft = '20px'; // Estilos básicos
                    estimate.facilidadesAplicadas.forEach(facility => {
                        const li = document.createElement('li');
                        li.textContent = facility;
                        ul.appendChild(li);
                    });
                    calculatedGratuitiesDiv.appendChild(ul);
                } else {
                    calculatedGratuitiesDiv.textContent = 'Ninguna cortesía calculada automáticamente.';
                }
            } else console.error('calculatedGratuitiesDiv no encontrado');

        } catch (error) {
            console.error('Error CRÍTICO en actualizarResumen:', error);
            mostrarNotificacion(`Error al calcular resumen: ${error.message}`, 'error');
             // Indicar error en la UI del resumen
             if(summaryBillableStudents) summaryBillableStudents.textContent = 'Error';
             if(summaryTotalAmount) summaryTotalAmount.textContent = '$--.--';
             if(summaryPricePerStudent) summaryPricePerStudent.textContent = '$--.--';
             if(calculatedGratuitiesDiv) calculatedGratuitiesDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;

        }
         console.log('[DEBUG] actualizarResumen completado.');
    };

    // Función para disparar actualización con debounce
    const triggerSummaryUpdate = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(actualizarResumen, 500); // Esperar 500ms
    };

    // Añadir listeners a los inputs que afectan el resumen (con validaciones)
    if (studentCountInput) studentCountInput.addEventListener('input', triggerSummaryUpdate); else console.error('studentCountInput no encontrado');
    if (aporteInstitucionInput) aporteInstitucionInput.addEventListener('input', triggerSummaryUpdate); else console.error('aporteInstitucionInput no encontrado');
    if (estudiantesCortesiaInput) estudiantesCortesiaInput.addEventListener('input', triggerSummaryUpdate); else console.error('estudiantesCortesiaInput no encontrado');

    // --- Manejadores del Modal de Ajuste ---
    if (openAdjustmentModalBtn && adjustmentModal && adjustmentQuoteNumberSpan) {
        openAdjustmentModalBtn.addEventListener('click', () => {
             console.log('[DEBUG] Abriendo modal de ajuste.');
             const currentQuoteNumber = quoteNumberInput ? quoteNumberInput.value : 'N/A';
             adjustmentQuoteNumberSpan.textContent = currentQuoteNumber; // Mostrar número actual
            adjustmentModal.style.display = 'block';
            if(adjustmentSavedIndicator) adjustmentSavedIndicator.style.display = 'none';
        });
    } else console.error('Faltan elementos para el botón/modal de ajuste');

    if (closeAdjustmentModalBtn && adjustmentModal) {
        closeAdjustmentModalBtn.addEventListener('click', () => {
            console.log('[DEBUG] Cerrando modal de ajuste (botón X).');
            adjustmentModal.style.display = 'none';
        });
    } else console.error('Faltan elementos para cerrar modal de ajuste (X)');

    if (saveAdjustmentModalBtn && adjustmentModal && adjustmentSavedIndicator) {
        saveAdjustmentModalBtn.addEventListener('click', () => {
            console.log('[DEBUG] Botón "Guardar Solicitud" (modal) clickeado.');
            // Solo muestra confirmación visual, no guarda datos aquí
            adjustmentSavedIndicator.style.display = 'inline';
            setTimeout(() => {
                 if (adjustmentModal) adjustmentModal.style.display = 'none';
            }, 1000); // Cerrar después de 1 segundo
        });
    } else console.error('Faltan elementos para guardar/indicar en modal de ajuste');

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (event) => {
        if (event.target === adjustmentModal && adjustmentModal) {
             console.log('[DEBUG] Cerrando modal de ajuste (clic fuera).');
            adjustmentModal.style.display = 'none';
        }
        else if (event.target === borradorModal && borradorModal) {
            console.log('[DEBUG] Cerrando modal de borrador (clic fuera).');
            borradorModal.style.display = 'none';
        }
    });

    // --- Manejar Envío del Formulario Principal (Botón "Generar y Guardar") ---
    if (submitQuoteBtn) {
        submitQuoteBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // Prevenir envío tradicional del formulario
            console.log('[DEBUG] Submit button CLICKED, handler fired.'); 

            if (successMessage) successMessage.style.display = 'none'; // Ocultar notificaciones previas

            // --- Validaciones (con logs) ---
            console.log('[DEBUG] Iniciando validaciones...');
            console.log('[DEBUG] Validación Asesor: OMITIDA (se toma de la sesión).');

            if (selectedProductIds.size === 0) {
                 console.log('[DEBUG] Validación fallida: Productos no seleccionados.');
                mostrarNotificacion('Por favor, seleccione al menos un producto o salón.', 'error'); return;
            }
             console.log('[DEBUG] Validación Productos: OK');


            if (!clientNameInput || !clientNameInput.value.trim()) {
                 console.log('[DEBUG] Validación fallida: Nombre de cliente vacío.');
                mostrarNotificacion('Error: Debe escribir el nombre de un centro educativo.', 'error'); return;
            }
             console.log('[DEBUG] Validación Cliente: OK');


             // Validar Membrete
             const membreteRadio = document.querySelector('input[name="membrete"]:checked');
             if (!membreteRadio) {
                 console.log('[DEBUG] Validación fallida: Membrete no seleccionado.');
                 mostrarNotificacion('Por favor, seleccione un tipo de membrete.', 'error'); return;
             }
             const membreteSeleccionado = membreteRadio.value;
             console.log('[DEBUG] Validación Membrete: OK');

             // Validar Cantidad Estudiantes (asegurarse que sea número positivo)
             const studentCountValue = studentCountInput ? parseInt(studentCountInput.value, 10) : NaN;
             if (isNaN(studentCountValue) || studentCountValue <= 0) {
                 console.log('[DEBUG] Validación fallida: Cantidad de estudiantes inválida.');
                 mostrarNotificacion('Por favor, ingrese una cantidad válida de estudiantes (número positivo).', 'error'); return;
             }
             console.log('[DEBUG] Validación Estudiantes: OK');

            console.log('[DEBUG] Todas las validaciones pasaron.');

            // --- Recolección de Datos (con logs y validaciones) ---
            console.log('[DEBUG] Recolectando datos del formulario...');
             let formData;
             try {
                 if (!quoteForm) throw new Error("quoteForm no encontrado");
                 formData = new FormData(quoteForm); // Puede fallar si quoteForm no existe
             } catch(formError){
                  console.error("Error CRÍTICO al crear FormData:", formError);
                  mostrarNotificacion('Error interno al leer el formulario.', 'error');
                  return;
             }


            // Leer datos de ajuste (con validaciones)
            let ajusteMonto = 0;
            let ajusteComentario = '';
            if (adjustmentAmountInput && adjustmentCommentInput) {
                 ajusteMonto = parseFloat(adjustmentAmountInput.value) || 0;
                 ajusteComentario = adjustmentCommentInput.value.trim();
                 console.log('[DEBUG] Datos de ajuste leídos:', { ajusteMonto, ajusteComentario });
            } else {
                 console.warn("WARN: Campos de input de ajuste no encontrados, usando valores por defecto (0, '').");
            }


            // Construcción del objeto quoteData (con logs)
             console.log('[DEBUG] Construyendo objeto quoteData...');
            const quoteData = {
                quoteNumber: quoteNumberInput ? quoteNumberInput.value : 'ERROR',
                clientName: clientNameInput ? clientNameInput.value.trim() : 'ERROR', // Usar valor directo
                clientId: selectedClientId, // ID seleccionado del autocompletar
                eventName: formData.get('eventName') || 'No especificado', // Campo oculto, puede ser null
                // 'advisorName' se elimina. El backend lo obtiene de la sesión.
                studentCount: studentCountValue, // Usar valor validado
                productIds: Array.from(selectedProductIds),
                aporteInstitucion: aporteInstitucionInput ? (parseFloat(aporteInstitucionInput.value) || 0) : 0,
                estudiantesCortesia: estudiantesCortesiaInput ? (parseInt(estudiantesCortesiaInput.value, 10) || 0) : 0,
                membrete_tipo: membreteSeleccionado,
                // --- Datos de Ajuste ---
                ajuste_solicitado_monto: ajusteMonto,
                ajuste_solicitado_comentario: ajusteComentario,
            };
             console.log('[DEBUG] quoteData construido:', quoteData);


            // --- Envío al Servidor (con logs) ---
            try {
                console.log('[DEBUG] Enviando datos a /api/quote-requests...');
                const response = await fetch('/api/quote-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(quoteData),
                });
                console.log('[DEBUG] Respuesta recibida del servidor, status:', response.status);

                if (!response.ok) {
                    let errorData;
                    try {
                        errorData = await response.json(); // Intentar leer JSON
                    } catch (jsonError) {
                        errorData = { message: await response.text() }; // Si no es JSON, leer texto
                    }
                    console.error('[DEBUG] Error del servidor:', errorData);
                    throw new Error(errorData.message || `Error ${response.status} del servidor.`);
                }

                const result = await response.json();
                 console.log('[DEBUG] Respuesta exitosa del servidor:', result);

                // --- Limpieza y Recarga Post-Éxito (con logs) ---
                console.log('[DEBUG] Limpiando formulario y recargando datos...');
                if(quoteForm) quoteForm.reset(); else console.error('quoteForm no encontrado para reset');
                selectedProductIds.clear();
                selectedClientId = null;
                if(clientIdInput) clientIdInput.value = '';

                // Limpiar campos de ajuste
                if(adjustmentAmountInput) adjustmentAmountInput.value = '';
                if(adjustmentCommentInput) adjustmentCommentInput.value = '';
                if(adjustmentSavedIndicator) adjustmentSavedIndicator.style.display = 'none';

                loadInitialData(); // Recarga número, productos, etc.
                actualizarResumen(); // Limpia el resumen

                mostrarNotificacion('¡Cotización creada con éxito!', 'success');
                window.scrollTo(0, 0); // Scroll al inicio

            } catch (error) {
                console.error('Error CRÍTICO al generar cotización:', error);
                mostrarNotificacion(`Error: ${error.message}`, 'error');
            }
        }); // Fin addEventListener 'click'
    } else {
        console.error("CRÍTICO: Botón 'submit-quote-btn' no encontrado. El formulario no se podrá enviar.");
    } // Fin if(submitQuoteBtn)

    
    // --- INICIO: LÓGICA FINAL PARA EL MODAL DE BORRADOR (CON INCLUSIONES) ---

    // Función principal para poblar y mostrar el borrador
    const mostrarBorradorInterno = () => {
        console.log('[DEBUG] Mostrando borrador interno...');
        
        if (!borradorModal || !borradorCliente || !borradorEstudiantes || !borradorProductosLista || !borradorPrecioEstudiante || !borradorTotal) {
            console.error('CRÍTICO: Faltan elementos del modal de borrador en el DOM.');
            mostrarNotificacion('Error al generar el borrador: elementos no encontrados.', 'error');
            return;
        }
        
        const cliente = clientNameInput ? clientNameInput.value.trim() : 'No especificado';
        const estudiantes = studentCountInput ? (parseInt(studentCountInput.value, 10) || 0) : 0;
        const precioEst = summaryPricePerStudent ? summaryPricePerStudent.textContent : '$0.00';
        const totalEst = summaryTotalAmount ? summaryTotalAmount.textContent : '$0.00';

        const selectedProducts = allProducts
            .filter(p => p && p.id && selectedProductIds.has(p.id));

        borradorCliente.textContent = cliente || 'No especificado';
        borradorEstudiantes.textContent = estudiantes;
        borradorPrecioEstudiante.textContent = precioEst;
        borradorTotal.textContent = totalEst;

        // --- INICIO DE LA LÓGICA CORREGIDA ---
        if (selectedProducts.length > 0) {
            let productsHtml = ''; 

            selectedProducts.forEach(product => {
                const productName = product['PRODUCTO / SERVICIO'] || `ID ${product.id} sin nombre`;
                
                // --- CORRECCIÓN 1: Usar el nombre de columna correcto ---
                const includesField = product['DETALLE / INCLUYE'] || ''; 
                let includesHtml = '';
                
                if (includesField.trim()) {
                    // --- CORRECCIÓN 2: Usar el separador correcto (,) ---
                    // También quitamos la palabra "Incluye:" si es que viene al inicio
                    const cleanField = includesField.replace(/^Incluye:/i, '').trim(); 
                    const includesArray = cleanField.split(',').filter(item => item.trim());
                    
                    if (includesArray.length > 0) {
                        includesHtml = `<ul style="font-size: 0.9em; color: #555; margin-top: 5px; margin-bottom: 10px; font-weight: normal;">`;
                        includesHtml += includesArray.map(item => `<li>${item.trim()}</li>`).join('');
                        includesHtml += `</ul>`;
                    }
                }

                productsHtml += `<li style="margin-bottom: 10px;">`; 
                productsHtml += `<strong style="font-size: 1.05em; color: #333;">${productName}</strong>`;
                productsHtml += includesHtml; // Añadir la sub-lista
                productsHtml += `</li>`;
            });

            borradorProductosLista.innerHTML = productsHtml;
        } else {
            borradorProductosLista.innerHTML = '<li>No hay productos seleccionados.</li>';
        }
        // --- FIN DE LA LÓGICA CORREGIDA ---
        
        borradorModal.style.display = 'block';
    };

    // 6. Añadir listeners para abrir y cerrar el modal de borrador
    if (verBorradorBtn) {
        verBorradorBtn.addEventListener('click', mostrarBorradorInterno);
    } else {
        console.error('Botón "ver-borrador-btn" no encontrado.');
    }
    
    if (closeBorradorModalBtn) {
        closeBorradorModalBtn.addEventListener('click', () => {
            console.log('[DEBUG] Cerrando modal de borrador (botón X).');
            if(borradorModal) borradorModal.style.display = 'none';
        });
    } else {
        console.error('Botón "close-borrador-modal-btn" no encontrado.');
    }
    // --- FIN: NUEVA LÓGICA PARA EL MODAL DE BORRADOR ---


    // --- Carga inicial ---
    console.log('[DEBUG] Llamando a loadInitialData por primera vez.');
    loadInitialData();

}); // Fin DOMContentLoaded
// --- Fin Bloque Principal ---