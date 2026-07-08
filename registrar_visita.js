document.addEventListener('DOMContentLoaded', async () => {
    // --- Selección de Elementos del DOM ---
    const visitForm = document.getElementById('visit-form');
    const advisorSelect = document.getElementById('advisor');
    const centerNameInput = document.getElementById('centerName');
    const suggestionsContainer = document.getElementById('autocomplete-suggestions');
    const coordinatorNameInput = document.getElementById('coordinatorName');
    const coordinatorContactInput = document.getElementById('coordinatorContact');
    const commentsSelect = document.getElementById('comments');
    const visitDateInput = document.getElementById('visitDate');
    const zoneSelect = document.getElementById('zone');
    const centerAddressInput = document.getElementById('centerAddress');
    const centerSectorInput = document.getElementById('centerSector');
    const formalizeQuoteSection = document.getElementById('formalize-quote-section');
    const quoteListContainer = document.getElementById('quote-list-container');
    
    let isExistingCenterSelected = false;

    // --- BLOQUEO INICIAL DEL BUSCADOR ---
    centerNameInput.disabled = true;
    centerNameInput.placeholder = "Selecciona tu nombre arriba primero...";

    // --- DESBLOQUEO AL SELECCIONAR ASESOR ---
    advisorSelect.addEventListener('change', () => {
        if (advisorSelect.value && advisorSelect.value.trim() !== '') {
            centerNameInput.disabled = false;
            centerNameInput.placeholder = "Escribe para buscar...";
        } else {
            centerNameInput.disabled = true;
            centerNameInput.placeholder = "Selecciona tu nombre arriba primero...";
            centerNameInput.value = '';
            resetCenterFields();
        }
    });

    // --- Funciones Auxiliares ---
    const setCurrentDate = () => {
        const today = new Date();
        visitDateInput.value = today.toISOString().split('T')[0];
    };

    const setAddressFieldsReadOnly = (isReadOnly) => {
        const lockedColor = '#e9ecef';
        if (centerAddressInput) {
            centerAddressInput.readOnly = isReadOnly;
            centerAddressInput.style.backgroundColor = isReadOnly ? lockedColor : '';
        }
        if (centerSectorInput) {
            centerSectorInput.readOnly = isReadOnly;
            centerSectorInput.style.backgroundColor = isReadOnly ? lockedColor : '';
        }
    };
    
    const resetCenterFields = () => {
        if (coordinatorNameInput) coordinatorNameInput.value = '';
        if (coordinatorContactInput) coordinatorContactInput.value = '';
        if (centerAddressInput) centerAddressInput.value = '';
        if (centerSectorInput) centerSectorInput.value = '';
        setAddressFieldsReadOnly(false);
        isExistingCenterSelected = false;
    };

    const loadInitialData = async () => {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('No se pudieron cargar los datos iniciales.');
            const data = await response.json();

            // Carga dinámica de Asesores y Zonas
            data.advisors?.forEach(advisor => advisorSelect.add(new Option(advisor.name, advisor.name)));
            data.zones?.forEach(zone => zoneSelect.add(new Option(zone.name, zone.name)));

        } catch (error) {
            console.error(error);
            alert('No se pudieron cargar los datos necesarios. Revise la consola.');
        }
    };

    // --- Lógica de Autocompletado (CON FILTRO DE ASESOR) ---
    centerNameInput.addEventListener('input', async () => {
        const searchTerm = centerNameInput.value;
        const asesorSeleccionado = advisorSelect.value; // Capturamos el asesor

        if (isExistingCenterSelected) {
            resetCenterFields();
        }
        if (searchTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        try {
            // ENVIAMOS EL ASESOR AL SERVIDOR EN LA RUTA
            const response = await fetch(`/api/centers/search?q=${encodeURIComponent(searchTerm)}&asesor=${encodeURIComponent(asesorSeleccionado)}`);
            const centers = await response.json();
            suggestionsContainer.innerHTML = '';
            
            if (centers.length > 0) {
                centers.forEach(center => {
                    const item = document.createElement('div');
                    item.innerHTML = `<strong>${center.name}</strong><div class="suggestion-address">${center.address || 'Sin dirección registrada'}</div>`;
                    item.addEventListener('click', () => {
                        centerNameInput.value = center.name;
                        if (centerAddressInput) centerAddressInput.value = center.address || '';
                        if (centerSectorInput) centerSectorInput.value = center.sector || '';
                        if (coordinatorNameInput) coordinatorNameInput.value = center.contactname || '';
                        if (coordinatorContactInput) coordinatorContactInput.value = center.contactnumber || '';
                        
                        setAddressFieldsReadOnly(true);
                        isExistingCenterSelected = true;
                        suggestionsContainer.style.display = 'none';
                    });
                    suggestionsContainer.appendChild(item);
                });
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error buscando centros:', error);
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!centerNameInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // --- LÓGICA DE FORMALIZACIÓN ---
    const loadApprovedQuotes = async (clientName) => {
        quoteListContainer.innerHTML = '<p>Buscando cotizaciones aprobadas...</p>';
        try {
            const response = await fetch(`/api/quotes/approved?clientName=${encodeURIComponent(clientName)}`);
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor.' }));
                 throw new Error(errorData.message);
            }
            const quotes = await response.json();

            if (quotes.length === 0) {
                quoteListContainer.innerHTML = '<p style="color: red; font-weight: bold;">No se encontraron cotizaciones aprobadas para este centro. No se puede formalizar el acuerdo.</p>';
                return;
            }

            quoteListContainer.innerHTML = ''; 
            quotes.forEach(quote => {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.marginBottom = '10px';
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'formalizedQuoteId';
                radio.value = quote.id;
                
                label.appendChild(radio);
                label.appendChild(document.createTextNode(` #${quote.quotenumber} (${quote.studentcount} est.) - $${parseFloat(quote.preciofinalporestudiante).toFixed(2)}`));
                quoteListContainer.appendChild(label);
            });

        } catch (error) {
            console.error('Error al cargar cotizaciones:', error);
            quoteListContainer.innerHTML = `<p style="color: red;">Error al cargar las cotizaciones: ${error.message}</p>`;
        }
    };

    const handleCommentChange = () => {
        const selectedComment = commentsSelect.value;
        const clientName = centerNameInput.value;

        if (selectedComment === 'Formalizar Acuerdo') {
            if (!clientName.trim()) {
                alert('Por favor, primero ingrese o seleccione el nombre del centro educativo.');
                commentsSelect.value = ''; 
                formalizeQuoteSection.style.display = 'none';
                return;
            }
            formalizeQuoteSection.style.display = 'block';
            loadApprovedQuotes(clientName);
        } else {
            formalizeQuoteSection.style.display = 'none';
            quoteListContainer.innerHTML = '';
        }
    };

    commentsSelect.addEventListener('change', handleCommentChange);

    // --- Lógica de Envío del Formulario ---
    visitForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (commentsSelect.value === 'Formalizar Acuerdo') {
            const selectedQuote = document.querySelector('input[name="formalizedQuoteId"]:checked');
            if (!selectedQuote) {
                alert('Debe seleccionar una cotización para formalizar el acuerdo.');
                return;
            }
        }

        const formData = new FormData(visitForm);
        const visitData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/visits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(visitData),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Error al guardar la visita.');
            }
            
            alert('¡Visita registrada con éxito!');
            visitForm.reset();
            setCurrentDate();
            setAddressFieldsReadOnly(false);
            isExistingCenterSelected = false;
            formalizeQuoteSection.style.display = 'none';
            quoteListContainer.innerHTML = '';
            
            // Volvemos a bloquear el campo de centro tras enviar el formulario
            centerNameInput.disabled = true;
            centerNameInput.placeholder = "Selecciona tu nombre arriba primero...";

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // --- Inicialización ---
    setCurrentDate();
    await loadInitialData();
});