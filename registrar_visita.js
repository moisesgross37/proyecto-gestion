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
    
    // --- NUEVOS ELEMENTOS PARA FORMALIZACIÓN ---
    const formalizeQuoteSection = document.getElementById('formalize-quote-section');
    const quoteListContainer = document.getElementById('quote-list-container');

    let isExistingCenterSelected = false;

    // --- Funciones Auxiliares ---
    const setCurrentDate = () => {
        const today = new Date();
        visitDateInput.value = today.toISOString().split('T')[0];
    };

    const setAddressFieldsReadOnly = (isReadOnly) => {
        centerAddressInput.readOnly = isReadOnly;
        centerSectorInput.readOnly = isReadOnly;
        const lockedColor = '#e9ecef';
        centerAddressInput.style.backgroundColor = isReadOnly ? lockedColor : '';
        centerSectorInput.style.backgroundColor = isReadOnly ? lockedColor : '';
    };
    
    const resetCenterFields = () => {
        coordinatorNameInput.value = '';
        coordinatorContactInput.value = '';
        centerAddressInput.value = '';
        centerSectorInput.value = '';
        setAddressFieldsReadOnly(false);
        isExistingCenterSelected = false;
    };

    const loadInitialData = async () => {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('No se pudieron cargar los datos iniciales.');
            const data = await response.json();

            data.advisors?.forEach(advisor => {
                advisorSelect.add(new Option(advisor.name, advisor.name));
            });
            data.comments?.forEach(comment => {
                commentsSelect.add(new Option(comment.text, comment.text));
            });
            data.zones?.forEach(zone => {
                zoneSelect.add(new Option(zone.name, zone.name));
            });
        } catch (error) {
            console.error(error);
            alert('No se pudieron cargar los datos necesarios. Revise la consola.');
        }
    };

    // --- Lógica de Autocompletado (sin cambios) ---
    centerNameInput.addEventListener('input', async () => {
        const searchTerm = centerNameInput.value;
        if (isExistingCenterSelected) {
            resetCenterFields();
        }
        if (searchTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`/api/centers/search?q=${encodeURIComponent(searchTerm)}`);
            const centers = await response.json();
            suggestionsContainer.innerHTML = '';
            if (centers.length > 0) {
                centers.forEach(center => {
                    const item = document.createElement('div');
                    item.innerHTML = `<strong>${center.name}</strong><div class="suggestion-address">${center.address}</div>`;
                    item.addEventListener('click', () => {
                        centerNameInput.value = center.name;
                        centerAddressInput.value = center.address || '';
                        centerSectorInput.value = center.sector || '';
                        coordinatorNameInput.value = center.contactname || '';
                        coordinatorContactInput.value = center.contactnumber || '';
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

    // =======================================================
    // ============== INICIO DE LA NUEVA LÓGICA DE FORMALIZACIÓN ==============
    // =======================================================
    const loadApprovedQuotes = async (clientName) => {
        quoteListContainer.innerHTML = '<p>Buscando cotizaciones aprobadas...</p>';
        try {
            const response = await fetch(`/api/quotes/approved?clientName=${encodeURIComponent(clientName)}`);
            const quotes = await response.json();

            if (quotes.length === 0) {
                quoteListContainer.innerHTML = '<p style="color: red;"><strong>No se encontraron cotizaciones aprobadas para este centro.</strong> No se puede formalizar el acuerdo.</p>';
                return;
            }

            quoteListContainer.innerHTML = ''; // Limpiar el contenedor
            quotes.forEach(quote => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'radio'; // Usamos radio button para que solo se pueda elegir una
                checkbox.name = 'formalizedQuoteId';
                checkbox.value = quote.id;
                
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` #${quote.quotenumber} - ${quote.studentcount} estudiantes - $${quote.preciofinalporestudiante} p/est`));
                quoteListContainer.appendChild(label);
            });

        } catch (error) {
            console.error('Error al cargar cotizaciones:', error);
            quoteListContainer.innerHTML = '<p style="color: red;">Error al cargar las cotizaciones.</p>';
        }
    };

    commentsSelect.addEventListener('change', () => {
        const selectedComment = commentsSelect.value;
        const clientName = centerNameInput.value;

        if (selectedComment === 'Formalizar Acuerdo') {
            if (!clientName.trim()) {
                alert('Por favor, primero ingrese o seleccione el nombre del centro educativo.');
                commentsSelect.value = ''; // Resetear la selección
                return;
            }
            formalizeQuoteSection.style.display = 'block';
            loadApprovedQuotes(clientName);
        } else {
            formalizeQuoteSection.style.display = 'none';
            quoteListContainer.innerHTML = '';
        }
    });
    // =======================================================
    // ============== FIN DE LA NUEVA LÓGICA DE FORMALIZACIÓN ==============
    // =======================================================

    // --- Lógica de Envío del Formulario (ACTUALIZADA) ---
    visitForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // --- NUEVA VALIDACIÓN ---
        if (commentsSelect.value === 'Formalizar Acuerdo') {
            const selectedQuote = document.querySelector('input[name="formalizedQuoteId"]:checked');
            if (!selectedQuote) {
                alert('Debe seleccionar una cotización para formalizar el acuerdo.');
                return; // Detiene el envío del formulario
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
            formalizeQuoteSection.style.display = 'none'; // Ocultar sección al resetear
            quoteListContainer.innerHTML = '';

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // --- Inicialización ---
    setCurrentDate();
    await loadInitialData();
});
