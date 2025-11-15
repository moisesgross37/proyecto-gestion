document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE ROLES (¡NUEVO!) ---
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
        // Si no hay usuario, no deberíamos estar aquí.
        window.location.href = '/login.html';
        return;
    }
    const userRole = user.rol;

    // --- ELEMENTOS DE LA PÁGINA ---
    const centersTableBody = document.getElementById('centers-table-body');
    const centersTableHead = document.querySelector('.centers-table thead');
    const backLink = document.getElementById('back-link'); // <-- NUEVO
    const advisorFilterGroup = document.getElementById('advisor-filter-group'); // <-- NUEVO

    // --- ELEMENTOS DEL MODAL (Sin cambios, solo limpiados) ---
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

    let allCenters = []; // Caché para guardar los centros

    // --- LÓGICA INICIAL DE ROLES (¡NUEVO!) ---
    
    // 1. Ocultar filtro si no es Admin
    if (userRole !== 'Administrador') {
        if(advisorFilterGroup) advisorFilterGroup.style.display = 'none';
    }

    // 2. Corregir enlace "Volver"
    if (userRole === 'Administrador') {
        if(backLink) backLink.href = '/admin_menu.html';
    } else {
        if(backLink) backLink.href = '/asesores-menu.html';
    }
    
    // --- FUNCIÓN PARA CARGAR Y MOSTRAR CENTROS (ACTUALIZADA CON ROLES) ---
    const fetchAndDisplayCenters = async () => {
        try {
            const params = new URLSearchParams();
            
            // --- INICIO: LÓGICA DE ROLES EN FILTRO ---
            // Solo añadimos el filtro de asesor si el usuario es Admin Y ha seleccionado uno.
            if (userRole === 'Administrador' && filterAdvisor.value) {
                params.append('advisor', filterAdvisor.value);
            }
            // (Si no es Admin, no se envía 'advisor', y el server_v12.js filtrará por sesión)
            // --- FIN: LÓGICA DE ROLES EN FILTRO ---

            if (filterComment.value) params.append('comment', filterComment.value);
            
            const response = await fetch(`/api/centers?${params.toString()}`);
            if (!response.ok) throw new Error('Error al obtener centros.');
            
            allCenters = await response.json();
            
            // --- Lógica de ordenamiento (sin cambios) ---
            const exceptions = ['Formalizar Acuerdo', 'No Logrado'];
            allCenters.sort((a, b) => {
                const dateA = a.visitdate ? new Date(a.visitdate) : null;
                const daysA = dateA ? Math.ceil(Math.abs(new Date() - dateA) / (1000 * 60 * 60 * 24)) : -1;
                const dateB = b.visitdate ? new Date(b.visitdate) : null;
                const daysB = dateB ? Math.ceil(Math.abs(new Date() - dateB) / (1000 * 60 * 60 * 24)) : -1;
                const isAbandonedA = daysA >= 15 && !exceptions.includes(a.commenttext);
                const isAbandonedB = daysB >= 15 && !exceptions.includes(b.commenttext);
                if (isAbandonedA && !isAbandonedB) return -1;
                if (!isAbandonedA && isAbandonedB) return 1;
                return daysB - daysA;
            });
            // --- Fin lógica de ordenamiento ---

            // Encabezados (ya corregidos en el HTML)
            
            centersTableBody.innerHTML = '';
            if (allCenters.length === 0) {
                centersTableBody.innerHTML = '<tr><td colspan="6">No se encontraron centros.</td></tr>';
                return;
            }

            allCenters.forEach(center => {
                const row = document.createElement('tr');
                const lastVisitDate = center.visitdate ? new Date(center.visitdate) : null;
                let daysSinceLastVisit = 'N/A';
                if (lastVisitDate) {
                    daysSinceLastVisit = Math.ceil(Math.abs(new Date() - lastVisitDate) / (1000 * 60 * 60 * 24));
                }
                if (daysSinceLastVisit !== 'N/A' && daysSinceLastVisit >= 15 && !exceptions.includes(center.commenttext)) {
                    row.classList.add('abandoned-row');
                }

                // --- INICIO: LÓGICA DE ROLES PARA BOTONES ---
                // Asesores y Coordinadores SÍ ven "Editar"
                let actionsCellHTML = `<button class="btn btn-edit" data-id="${center.id}">Editar</button>`;
                
                // Solo "Administrador" ve "Eliminar"
                if (userRole === 'Administrador') {
                    actionsCellHTML += ` <button class="btn btn-delete" data-id="${center.id}">Eliminar</button>`;
                }
                // --- FIN: LÓGICA DE ROLES PARA BOTONES ---

                row.innerHTML = `
                    <td>${center.name}</td>
                    <td>${center.advisorname || 'N/A'}</td>
                    <td>${center.commenttext || 'Sin visitas'}</td>
                    <td>${lastVisitDate ? lastVisitDate.toLocaleDateString('es-DO') : 'N/A'}</td>
                    <td style="font-weight: bold; text-align: center;">${daysSinceLastVisit}</td>
                    <td class="actions-cell">
                        ${actionsCellHTML} 
                    </td>
                `;
                centersTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error al mostrar centros:', error);
            centersTableBody.innerHTML = '<tr><td colspan="6">Error al cargar los centros.</td></tr>';
        }
    };

    // --- FUNCIÓN PARA CARGAR LAS OPCIONES DE LOS FILTROS (Sin cambios) ---
    const populateFilters = async () => {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('No se pudieron cargar los datos para los filtros.');
            const data = await response.json();
            
            const advisors = data.advisors || [];
            advisors.forEach(advisor => {
                const option = document.createElement('option');
                option.value = advisor.name;
                option.textContent = advisor.name;
                filterAdvisor.appendChild(option);
            });
            
            const comments = data.comments || [];
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
    
    // --- FUNCIONES DEL MODAL DE EDICIÓN (Limpiada) ---
    const openEditModal = (center) => {
        // Los elementos ya están definidos arriba, solo los usamos
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

    // --- FUNCIÓN PARA MANEJAR LA ELIMINACIÓN (Sin cambios) ---
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
    
    // --- MANEJO DE EVENTOS (Sin cambios) ---
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
            // Esta lógica solo se activará si el botón existe (es decir, si es Admin)
            handleDeleteCenter(centerId);
        }
    });
    
    editCenterForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = parseInt(editCenterId.value, 10); // Usar la variable ya definida
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
            alert('No se pudo actualizar el centro.');
        }
    });

    closeModalButton.addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeEditModal();
    });

    // --- CARGA INICIAL DE LA PÁGINA (Sin cambios) ---
    populateFilters();
    fetchAndDisplayCenters();
});