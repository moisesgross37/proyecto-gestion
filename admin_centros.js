document.addEventListener('DOMContentLoaded', () => {
    const centersTableBody = document.getElementById('centers-table-body');
    const modal = document.getElementById('edit-center-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const editCenterForm = document.getElementById('edit-center-form');

    // --- Inputs del Formulario ---
    const editCenterId = document.getElementById('edit-center-id');
    const editCenterName = document.getElementById('edit-center-name');
    const editCenterAddress = document.getElementById('edit-center-address'); // Campo que faltaba
    const editCenterSector = document.getElementById('edit-center-sector');   // Campo que faltaba
    const editContactName = document.getElementById('edit-contact-name');
    const editContactNumber = document.getElementById('edit-contact-number');

    let allCenters = []; // Caché para guardar los centros y no pedirlos cada vez

    // --- Función Principal para Cargar y Mostrar Centros ---
    const fetchAndDisplayCenters = async () => {
        try {
            const response = await fetch('/api/centers');
            if (!response.ok) throw new Error('Error al obtener centros.');
            
            allCenters = await response.json(); // Guardar en caché
            
            centersTableBody.innerHTML = '';
            if (allCenters.length === 0) {
                centersTableBody.innerHTML = '<tr><td colspan="4">No hay centros registrados.</td></tr>';
                return;
            }

            allCenters.forEach(center => {
                const row = document.createElement('tr');
                // Columnas ajustadas para ser más limpias
                row.innerHTML = `
                    <td>${center.name}</td>
                    <td>${center.contactname || ''}</td>
                    <td>${center.contactnumber || ''}</td>
                    <td class="actions-cell">
                        <button class="btn btn-edit" data-id="${center.id}">Editar</button>
                        <button class="btn btn-delete" data-id="${center.id}">Eliminar</button>
                    </td>
                `;
                centersTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error al mostrar centros:', error);
            centersTableBody.innerHTML = '<tr><td colspan="4">Error al cargar los centros.</td></tr>';
        }
    };

    // --- Lógica del Modal ---
    const openEditModal = (center) => {
        editCenterId.value = center.id;
        editCenterName.value = center.name;
        editCenterAddress.value = center.address || '';
        editCenterSector.value = center.sector || '';
        editContactName.value = center.contactname || '';
        editContactNumber.value = center.contactnumber || '';
        modal.style.display = 'block';
    };

    const closeEditModal = () => {
        modal.style.display = 'none';
    };

    // --- Manejo de Eventos de la Tabla ---
    centersTableBody.addEventListener('click', (event) => {
        const target = event.target;
        const centerId = parseInt(target.dataset.id, 10);

        if (target.classList.contains('btn-edit')) {
            const centerToEdit = allCenters.find(c => c.id === centerId);
            if (centerToEdit) openEditModal(centerToEdit);
        } else if (target.classList.contains('btn-delete')) {
            handleDeleteCenter(centerId);
        }
    });

    // --- Manejo de la Eliminación ---
    const handleDeleteCenter = async (centerId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este centro? Esta acción no se puede deshacer.')) return;
        try {
            const response = await fetch(`/api/centers/${centerId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Error al eliminar el centro.');
            await fetchAndDisplayCenters(); // Recargar la tabla
        } catch (error) {
            console.error(error);
            alert('No se pudo eliminar el centro.');
        }
    };

    // --- Manejo de la Actualización (CORREGIDO) ---
    editCenterForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = parseInt(editCenterId.value, 10);
        
        // CORRECCIÓN: Se incluyen todos los campos que el servidor espera
        const updatedData = {
            name: editCenterName.value,
            address: editCenterAddress.value,
            sector: editCenterSector.value,
            contactname: editContactName.value,
            contactnumber: editContactNumber.value
        };

        try {
            const response = await fetch(`/api/centers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            if (!response.ok) throw new Error('La respuesta del servidor no fue OK.');
            
            closeEditModal();
            await fetchAndDisplayCenters();

        } catch (error) {
            console.error(error);
            alert('No se pudo actualizar el centro. Revisa la consola para más detalles.');
        }
    });

    // --- Eventos para cerrar el modal ---
    closeModalButton.addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeEditModal();
    });

    // --- Carga Inicial ---
    fetchAndDisplayCenters();
});
