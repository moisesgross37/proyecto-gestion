document.addEventListener('DOMContentLoaded', () => {
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
    const successMessage = document.getElementById('success-message');

    let allProducts = [];
    let selectedProductIds = new Set();
    let selectedClientId = null;
    let debounceTimer;

    // --- Carga de Datos Iniciales (Integrada) ---
    const loadInitialData = async () => {
        try {
            const [quoteResponse, dataResponse] = await Promise.all([
                fetch('/api/next-quote-number'),
                fetch('/api/data')
            ]);

            if (!quoteResponse.ok) throw new Error('Error al obtener el número de cotización.');
            if (!dataResponse.ok) throw new Error('Error al obtener datos iniciales.');

            const quoteData = await quoteResponse.json();
            const initialData = await dataResponse.json();

            quoteNumberInput.value = quoteData.quoteNumber;

            if (advisorNameSelect) {
                advisorNameSelect.innerHTML = '<option value="">Seleccione un asesor...</option>';
                initialData.advisors.forEach(advisor => {
                    const option = document.createElement('option');
                    option.value = advisor.name;
                    option.textContent = advisor.name;
                    advisorNameSelect.appendChild(option);
                });
            } else {
                console.error('Elemento <select> con id "asesor-a-cargo-select" no encontrado.');
            }

            allProducts = initialData.products || [];
            renderProductAccordion();

        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
        }
    };

    // --- Autocompletado para Nombre del Cliente ---
    const searchClients = async (query) => {
        if (query.length < 2) {
            clientAutocompleteResults.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/centers/search?q=${query}`);
            if (!response.ok) throw new Error('Error al buscar clientes.');
            const centers = await response.json();
            
            clientAutocompleteResults.innerHTML = '';
            if (centers.length === 0) {
                clientAutocompleteResults.innerHTML = '<div>No se encontraron resultados</div>';
                return;
            }

            centers.forEach(center => {
                const div = document.createElement('div');
                
                // --- INICIO DEL CAMBIO ---
                // Ahora usamos innerHTML para añadir el nombre y la dirección (address) como subtítulo.
                div.innerHTML = `
                    ${center.name}
                    <small>${center.address}</small>
                `;
                // --- FIN DEL CAMBIO ---

                div.dataset.id = center.id; 
                div.addEventListener('click', () => {
                    clientNameInput.value = center.name;
                    clientIdInput.value = center.id;
                    selectedClientId = center.id;
                    clientAutocompleteResults.innerHTML = '';
                });
                clientAutocompleteResults.appendChild(div);
            });
        } catch (error) {
            console.error('Error en la búsqueda de clientes:', error);
            clientAutocompleteResults.innerHTML = '<div>Error en la búsqueda</div>';
        }
    };

    clientNameInput.addEventListener('input', (e) => {
        selectedClientId = null;
        clientIdInput.value = '';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => searchClients(e.target.value), 300); // Añadido debounce para no saturar
    });

    document.addEventListener('click', (e) => {
        if (!clientNameInput.contains(e.target) && !clientAutocompleteResults.contains(e.target)) {
            clientAutocompleteResults.innerHTML = '';
        }
    });

    // --- Cargar y Mostrar Productos en Acordeón ---
    const renderProductAccordion = () => {
        productAccordionContainer.innerHTML = '';
        const productsByReglon = allProducts.reduce((acc, product) => {
            const reglon = product['RENGLON'] || 'Otros';
            if (!acc[reglon]) acc[reglon] = [];
            acc[reglon].push(product);
            return acc;
        }, {});

        Object.keys(productsByReglon).forEach((reglon, index) => {
            const details = document.createElement('details');
            if (index === 0) details.open = true;
            const summary = document.createElement('summary');
            summary.textContent = reglon;
            details.appendChild(summary);
            const accordionContent = document.createElement('div');
            accordionContent.classList.add('accordion-content');
            const productsInReglon = productsByReglon[reglon];
            const productsBySubReglon = productsInReglon.reduce((acc, product) => {
                const subReglon = product['SUB RENGLON'] || 'General';
                if (!acc[subReglon]) acc[subReglon] = [];
                acc[subReglon].push(product);
                return acc;
            }, {});

            for (const subReglon in productsBySubReglon) {
                const subReglonGroup = document.createElement('div');
                subReglonGroup.classList.add('sub-reglon-group');
                subReglonGroup.innerHTML = `<h4>${subReglon}</h4>`;
                productsBySubReglon[subReglon].forEach(product => {
                    const label = document.createElement('label');
                    label.classList.add('product-item');
                    label.innerHTML = `
                        <input type="checkbox" name="selectedProducts" value="${product.id}">
                        ${product['PRODUCTO / SERVICIO'] || 'Producto sin nombre'}
                    `;
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    checkbox.addEventListener('change', (e) => {
                        const productId = parseInt(e.target.value, 10);
                        if (e.target.checked) {
                            selectedProductIds.add(productId);
                        } else {
                            selectedProductIds.delete(productId);
                        }
                        triggerSummaryUpdate();
                    });
                    subReglonGroup.appendChild(label);
                });
                accordionContent.appendChild(subReglonGroup);
            }
            details.appendChild(accordionContent);
            productAccordionContainer.appendChild(details);
        });
    };

    // --- Lógica de Resumen en Tiempo Real ---
    const actualizarResumen = async () => {
        const studentCount = parseInt(studentCountInput.value, 10) || 0;
        const aporteInstitucion = parseFloat(aporteInstitucionInput.value) || 0;
        const estudiantesCortesia = parseInt(estudiantesCortesiaInput.value, 10) || 0;
        const productIds = Array.from(selectedProductIds);
        const quoteEstimateInput = { studentCount, productIds, aporteInstitucion, estudiantesCortesia, tasaDesercion: 0.10 };

        if (studentCount === 0 || productIds.length === 0) {
            summaryBillableStudents.textContent = '0';
            summaryTotalAmount.textContent = '$0.00';
            summaryPricePerStudent.textContent = '$0.00';
            calculatedGratuitiesDiv.innerHTML = '';
            return;
        }

        try {
            const response = await fetch('/api/quotes/calculate-estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteEstimateInput),
            });
            if (!response.ok) throw new Error('La respuesta del servidor no fue exitosa.');
            const estimate = await response.json();

            if (estimate.calculatedPrices && estimate.calculatedPrices.length > 0) {
                const prices = estimate.calculatedPrices[0];
                summaryBillableStudents.textContent = prices.estudiantesFacturables;
                summaryTotalAmount.textContent = `${parseFloat(prices.montoTotalProyecto).toFixed(2)}`;
                summaryPricePerStudent.textContent = `${parseFloat(prices.precioFinalPorEstudiante).toFixed(2)}`;
            } else {
                summaryBillableStudents.textContent = '0';
                summaryTotalAmount.textContent = '0.00';
                summaryPricePerStudent.textContent = '0.00';
            }

            calculatedGratuitiesDiv.innerHTML = '';
            if (estimate.facilidadesAplicadas && estimate.facilidadesAplicadas.length > 0) {
                const ul = document.createElement('ul');
                ul.style.margin = '0';
                ul.style.paddingLeft = '20px';
                estimate.facilidadesAplicadas.forEach(facility => {
                    const li = document.createElement('li');
                    li.textContent = facility;
                    ul.appendChild(li);
                });
                calculatedGratuitiesDiv.appendChild(ul);
            } else {
                calculatedGratuitiesDiv.textContent = 'Ninguna cortesía calculada automáticamente.';
            }
        } catch (error) {
            console.error('Error al obtener la estimación:', error);
        }
    };

    const triggerSummaryUpdate = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(actualizarResumen, 500);
    };

    studentCountInput.addEventListener('input', triggerSummaryUpdate);
    aporteInstitucionInput.addEventListener('input', triggerSummaryUpdate);
    estudiantesCortesiaInput.addEventListener('input', triggerSummaryUpdate);

    // --- Manejar Envío del Formulario ---
    quoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        successMessage.classList.add('hidden'); 
        if (advisorNameSelect.value === '') {
            alert('Por favor, seleccione un asesor.');
            return;
        }
        if (selectedProductIds.size === 0) {
            alert('Por favor, seleccione al menos un producto o salón.');
            return;
        }
        if (!clientNameInput.value.trim()) { // Cambiado para verificar el nombre en lugar del ID
            alert('Error: Debe escribir el nombre de un centro educativo.');
            return;
        }

        const formData = new FormData(quoteForm);
        const quoteData = {
            quoteNumber: quoteNumberInput.value,
            clientName: formData.get('clientName'),
            clientId: selectedClientId,
            eventName: formData.get('eventName'),
            advisorName: advisorNameSelect.value,
            studentCount: parseInt(formData.get('studentCount'), 10),
            productIds: Array.from(selectedProductIds),
            aporteInstitucion: parseFloat(formData.get('aporteInstitucion')) || 0,
            estudiantesCortesia: parseInt(formData.get('estudiantesCortesia'), 10) || 0
        };

        try {
            const response = await fetch('/api/quote-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al generar la cotización.');
            }

            const result = await response.json();
            quoteForm.reset();
            selectedProductIds.clear();
            selectedClientId = null;
            loadInitialData();
            actualizarResumen();
            successMessage.classList.remove('hidden');
            window.scrollTo(0, 0);
        } catch (error) {
            console.error('Error al generar cotización:', error);
            alert(`Error: ${error.message}`);
        }
    });

    loadInitialData();
});
