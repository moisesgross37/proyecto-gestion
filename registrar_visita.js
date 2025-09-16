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
    // --- NUEVOS ELEMENTOS ---
    const centerAddressInput = document.getElementById('centerAddress');
    const centerSectorInput = document.getElementById('centerSector');

    // Variable para saber si se ha seleccionado un centro de la lista
    let isExistingCenterSelected = false;

    // --- Funciones Auxiliares ---

    // Establece la fecha actual en el input de fecha
    const setCurrentDate = () => {
        const today = new Date();
        visitDateInput.value = today.toISOString().split('T')[0];
    };

    // Habilita o deshabilita los campos de dirección
    const setAddressFieldsReadOnly = (isReadOnly) => {
        centerAddressInput.readOnly = isReadOnly;
        centerSectorInput.readOnly = isReadOnly;
        // Estilo visual para indicar que un campo está bloqueado
        const lockedColor = '#e9ecef'; // Un gris claro
        centerAddressInput.style.backgroundColor = isReadOnly ? lockedColor : '';
        centerSectorInput.style.backgroundColor = isReadOnly ? lockedColor : '';
    };
    
    // Resetea los campos del centro de estudios
    const resetCenterFields = () => {
        coordinatorNameInput.value = '';
        coordinatorContactInput.value = '';
        centerAddressInput.value = '';
        centerSectorInput.value = '';
        setAddressFieldsReadOnly(false);
        isExistingCenterSelected = false;
    };

    // Carga los datos iniciales (asesores, zonas, comentarios)
    const loadInitialData = async () => {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('No se pudieron cargar los datos iniciales.');
            const data = await response.json();

            // Cargar Asesores, Comentarios y Zonas
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

    // --- Lógica de Autocompletado ---

    centerNameInput.addEventListener('input', async () => {
        const searchTerm = centerNameInput.value;
        
        // Si el usuario borra o cambia el nombre, se resetean los campos
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
                    // MODIFICACIÓN: Mostrar nombre y dirección para diferenciar
                    item.innerHTML = `<strong>${center.name}</strong><div class="suggestion-address">${center.address}</div>`;
                    
                    item.addEventListener('click', () => {
                        // --- ¡LA MAGIA DEL AUTOCOMPLETADO! ---
                        // Se rellena TODO con la info del centro seleccionado
                        centerNameInput.value = center.name;
                        centerAddressInput.value = center.address || '';
                        centerSectorInput.value = center.sector || '';
                        coordinatorNameInput.value = center.contactname || '';
                        coordinatorContactInput.value = center.contactnumber || '';
                        
                        // Se marcan los campos de dirección como solo lectura
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
    
    // Ocultar sugerencias si se hace clic fuera
    document.addEventListener('click', (e) => {
        if (!centerNameInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // --- Lógica de Envío del Formulario ---

    visitForm.addEventListener('submit', async (event) => {
        event.preventDefault();
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
            setAddressFieldsReadOnly(false); // Desbloquear campos al resetear
            isExistingCenterSelected = false;

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // --- Inicialización ---
    setCurrentDate();
    await loadInitialData();
});