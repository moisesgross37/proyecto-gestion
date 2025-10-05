document.addEventListener('DOMContentLoaded', () => {
    const centersTableBody = document.getElementById('centers-table-body');
    // Referencia al thead para poder cambiar los encabezados
    const centersTableHead = document.querySelector('.centers-table thead'); 
    const modal = document.getElementById('edit-center-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const editCenterForm = document.getElementById('edit-center-form');

    const editCenterId = document.getElementById('edit-center-id');
    const editCenterName = document.getElementById('edit-center-name');
    const editCenterAddress = document.getElementById('edit-center-address');
    const editCenterSector = document.getElementById('edit-center-sector');
    const editContactName = document.getElementById('edit-contact-name');
    const editContactNumber = document.getElementById('edit-contact-number');

    let allCenters = [];

    const fetchAndDisplayCenters = async () => {
        try {
            const response = await fetch('/api/centers');
            if (!response.ok) throw new Error('Error al obtener centros.');
            
            allCenters = await response.json();
            
            // --- INICIO DE CAMBIOS EN LA TABLA ---
            // 1. Actualizar los encabezados de la tabla
            centersTableHead.innerHTML = `
                <tr>
                    <th>Nombre del Centro</th>
                    <th>Asesor Principal</th>
                    <th>Último Comentario</th>
                    <th>Acciones</th>
                </tr>
            `;

            // 2. Llenar la tabla con la nueva información
            centersTableBody.innerHTML = '';
            if (allCenters.length === 0) {
                centersTableBody.innerHTML = '<tr><td colspan="4">No hay centros registrados.</td></tr>';
                return;
            }

            allCenters.forEach(center => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${center.name}</td>
                    <td>${center.advisorname || 'N/A'}</td>
                    <td>${center.commenttext || 'Sin visitas'}</td>
                    <td class="actions-cell">
                        <button class="btn btn-edit" data-id="${center.id}">Editar</button>
                        <button class="btn btn-delete" data-id="${center.id}">Eliminar</button>
                    </td>
                `;
                centersTableBody.appendChild(row);
            });
            // --- FIN DE CAMBIOS EN LA TABLA ---

        } catch (error) {
            console.error('Error al mostrar centros:', error);
            centersTableBody.innerHTML = '<tr><td colspan="4">Error al cargar los centros.</td></tr>';
        }
    };

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

    const handleDeleteCenter = async (centerId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este centro? Esta acción no se puede deshacer.')) return;
        try {
            const response = await fetch(`/api/centers/${centerId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Error al eliminar el centro.');
            await fetchAndDisplayCenters();
        } catch (error) {
            console.error(error);
            alert('No se pudo eliminar el centro.');
        }
    };

    editCenterForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = parseInt(editCenterId.value, 10);
        
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

    closeModalButton.addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeEditModal();
    });

    fetchAndDisplayCenters();
});
