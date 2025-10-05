document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DE LA PÁGINA ---
    const centersTableBody = document.getElementById('centers-table-body');
    const centersTableHead = document.querySelector('.centers-table thead'); 
    
    // --- ELEMENTOS DEL MODAL ---
    const modal = document.getElementById('edit-center-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const editCenterForm = document.getElementById('edit-center-form');
    const editCenterId = document.getElementById('edit-center-id');
    const editCenterName = document.getElementById('edit-center-name');
    const editCenterAddress = document.getElementById('edit-center-address');
    const editCenterSector = document.getElementById('edit-center-sector');
    const editContactName = document.getElementById('edit-contact-name');
    const editContactNumber = document.getElementById('edit-contact-number');

    // --- ELEMENTOS DE FILTROS ---
    const filterAdvisor = document.getElementById('filter-advisor');
    const filterComment = document.getElementById('filter-comment');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    let allCenters = []; // Caché local de centros

    // --- FUNCIÓN PRINCIPAL PARA CARGAR Y MOSTRAR CENTROS ---
    const fetchAndDisplayCenters = async () => {
        try {
            const params = new URLSearchParams();
            if (filterAdvisor.value) {
                params.append('advisor', filterAdvisor.value);
            }
            if (filterComment.value) {
                params.append('comment', filterComment.value);
            }
            
            const response = await fetch(`/api/centers?${params.toString()}`);
            if (!response.ok) throw new Error('Error al obtener centros.');
            
            allCenters = await response.json();
            
            centersTableHead.innerHTML = `
                <tr>
                    <th>Nombre del Centro</th>
                    <th>Asesor Principal</th>
                    <th>Último Comentario</th>
                    <th>Acciones</th>
                </tr>
            `;

            centersTableBody.innerHTML = '';
            if (allCenters.length === 0) {
                centersTableBody.innerHTML = '<tr><td colspan="4">No se encontraron centros con los filtros aplicados.</td></tr>';
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

        } catch (error) {
            console.error('Error al mostrar centros:', error);
            centersTableBody.innerHTML = '<tr><td colspan="4">Error al cargar los centros.</td></tr>';
        }
    };

    // --- FUNCIÓN PARA CARGAR LAS OPCIONES DE LOS FILTROS ---
    const populateFilters = async () => {
        try {
            const [advisorsRes, commentsRes] = await Promise.all([
                fetch('/api/advisors'),
                fetch('/api/comments')
            ]);

            const advisors = await advisorsRes.json();
            advisors.forEach(advisor => {
                const option = document.createElement('option');
                option.value = advisor.name;
                option.textContent = advisor.name;
                filterAdvisor.appendChild(option);
            });

            const comments = await commentsRes.json();
            comments.forEach(comment => {
                const option = document.createElement('option');
                option.value = comment.text;
                option.textContent = comment.text;
                filterComment.appendChild(option);
            });
        } catch (error) {
            console.error("Error al cargar opciones de filtros:", error);
        }
    };
    
    // --- FUNCIÓN PARA ABRIR EL MODAL DE EDICIÓN ---
    const openEditModal = (center) => {
        editCenterId.value = center.id;
        editCenterName.value = center.name;
        editCenterAddress.value = center.address || '';
        editCenterSector.value = center.sector || '';
        editContactName.value = center.contactname || '';
        editContactNumber.value = center.contactnumber || '';
        modal.style.display = 'block';
    };

    // --- FUNCIÓN PARA MANEJAR LA ELIMINACIÓN DE UN CENTRO ---
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

    // --- MANEJO DE EVENTOS ---
    filterAdvisor.addEventListener('change', fetchAndDisplayCenters);
    filterComment.addEventListener('change', fetchAndDisplayCenters);
    clearFiltersBtn.addEventListener('click', () => {
        filterAdvisor.value = '';
        filterComment.value = '';
        fetchAndDisplayCenters();
    });

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
            modal.style.display = 'none';
            await fetchAndDisplayCenters();
        } catch (error) {
            console.error(error);
            alert('No se pudo actualizar el centro.');
        }
    });

    closeModalButton.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // --- CARGA INICIAL DE LA PÁGINA ---
    populateFilters();
    fetchAndDisplayCenters();
});
