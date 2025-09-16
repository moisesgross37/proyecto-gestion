document.addEventListener('DOMContentLoaded', async () => {
    const visitForm = document.getElementById('visit-form');
    const advisorSelect = document.getElementById('advisor');
    const centerNameInput = document.getElementById('centerName');
    const suggestionsContainer = document.getElementById('autocomplete-suggestions');
    
    // Campos de datos del centro
    const addressInput = document.getElementById('address');
    const zoneInput = document.getElementById('zone');
    const coordinatorNameInput = document.getElementById('coordinatorName');
    const coordinatorContactInput = document.getElementById('coordinatorContact');
    
    const commentsSelect = document.getElementById('comments');
    const visitDateInput = document.getElementById('visitDate');

    let isCenterSelected = false; // Flag para saber si se ha seleccionado un centro existente

    // Función para manejar el estado de los campos de datos del centro
    const setCenterFieldsReadOnly = (isReadOnly) => {
        addressInput.readOnly = isReadOnly;
        zoneInput.readOnly = isReadOnly;
        coordinatorNameInput.readOnly = isReadOnly;
        coordinatorContactInput.readOnly = isReadOnly;
        // Estilo visual para indicar que no son editables
        [addressInput, zoneInput, coordinatorNameInput, coordinatorContactInput].forEach(input => {
            input.style.backgroundColor = isReadOnly ? '#f0f0f0' : '#fff';
        });
    };

    // Función para limpiar los campos de datos del centro
    const clearCenterFields = () => {
        addressInput.value = '';
        zoneInput.value = '';
        coordinatorNameInput.value = '';
        coordinatorContactInput.value = '';
    };

    const setCurrentDate = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        visitDateInput.value = `${yyyy}-${mm}-${dd}`;
    };

    setCurrentDate();

    async function loadInitialData() {
        try {
            // Solo se necesita cargar asesores y comentarios ahora
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('No se pudieron cargar los datos iniciales.');
            const data = await response.json();

            if (data.advisors) {
                data.advisors.forEach(advisor => {
                    advisorSelect.innerHTML += `<option value="${advisor.name}">${advisor.name}</option>`;
                });
            }

            if (data.comments) {
                data.comments.forEach(comment => {
                    commentsSelect.innerHTML += `<option value="${comment.text}">${comment.text}</option>`;
                });
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
            alert('No se pudieron cargar los datos necesarios. Revise la consola.');
        }
    }

    centerNameInput.addEventListener('input', async () => {
        // Si el usuario modifica el nombre, asumimos que quiere crear uno nuevo
        if (isCenterSelected) {
            isCenterSelected = false;
            clearCenterFields();
            setCenterFieldsReadOnly(false);
        }

        const searchTerm = centerNameInput.value;
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
                    // Mostrar nombre y dirección para diferenciar
                    item.textContent = `${center.name} (${center.address})`; 
                    item.addEventListener('click', () => {
                        // Rellenar TODOS los campos con los datos del centro seleccionado
                        centerNameInput.value = center.name;
                        addressInput.value = center.address || '';
                        zoneInput.value = center.zone || '';
                        coordinatorNameInput.value = center.contactname || '';
                        coordinatorContactInput.value = center.contactnumber || '';
                        
                        isCenterSelected = true;
                        setCenterFieldsReadOnly(true); // Bloquear campos
                        suggestionsContainer.style.display = 'none';
                    });
                    suggestionsContainer.appendChild(item);
                });
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching centers:', error);
        }
    });
    
    document.addEventListener('click', (e) => {
        if (e.target !== centerNameInput) {
            suggestionsContainer.style.display = 'none';
        }
    });

    visitForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(visitForm);
        const visitData = Object.fromEntries(formData.entries());

        // Asegurarse de que los campos requeridos no estén vacíos
        if (!visitData.centerName || !visitData.address || !visitData.zone) {
            alert('Por favor, complete todos los campos del centro: Nombre, Dirección y Zona.');
            return;
        }

        try {
            const response = await fetch('/api/visits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(visitData),
            });
            if (!response.ok) {
                 const errorResult = await response.json();
                 throw new Error(errorResult.message || 'Error al guardar la visita.');
            }
            alert('¡Visita registrada con éxito!');
            visitForm.reset();
            setCurrentDate();
            setCenterFieldsReadOnly(false); // Desbloquear campos después de enviar
            isCenterSelected = false;
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    await loadInitialData();
    setCenterFieldsReadOnly(false); // Asegurarse de que los campos estén editables al inicio
});