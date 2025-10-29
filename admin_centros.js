document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DE LA PÁGINA ---
    const centersTableBody = document.getElementById('centers-table-body');
    const centersTableHead = document.querySelector('.centers-table thead');
    
    // --- ELEMENTOS DEL MODAL ---
    const modal = document.getElementById('edit-center-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const editCenterForm = document.getElementById('edit-center-form');
    // (No es necesario listar todos los elementos del formulario aquí si ya están en el HTML)

    // --- ELEMENTOS DE FILTROS ---
    const filterAdvisor = document.getElementById('filter-advisor');
    const filterComment = document.getElementById('filter-comment');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    let allCenters = []; // Caché para guardar los centros

    // --- NUEVO: VARIABLE GLOBAL PARA GUARDAR EL USUARIO ---
    let currentUser;

    // --- FUNCIÓN PARA CARGAR Y MOSTRAR CENTROS (ACTUALIZADA CON ROLES) ---
    const fetchAndDisplayCenters = async () => {
        try {
            const params = new URLSearchParams();
            if (filterAdvisor.value) params.append('advisor', filterAdvisor.value);
            if (filterComment.value) params.append('comment', filterComment.value);
            
            const response = await fetch(`/api/centers?${params.toString()}`);
            if (!response.ok) throw new Error('Error al obtener centros.');
            
            allCenters = await response.json();
            
            // --- LÓGICA DE ORDENAMIENTO (SIN CAMBIOS) ---
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
            // --- FIN DE LA LÓGICA DE ORDENAMIENTO ---

            // --- NUEVO: Lógica de Rol para Acciones ---
            const isAdmin = currentUser && currentUser.rol === 'Administrador';

            // --- NUEVO: Cabecera de acciones condicional ---
            const actionsHeader = isAdmin ? '<th>Acciones</th>' : '';
            centersTableHead.innerHTML = `
                <tr>
                    <th>Nombre del Centro</th>
                    <th>Asesor Principal</th>
                    <th>Último Comentario</th>
                    <th>Fecha Últ. Visita</th>
                    <th>Días Transcurridos</th>
                    ${actionsHeader}
                </tr>
            `;

            // --- NUEVO: Colspan condicional ---
            const colCount = isAdmin ? 6 : 5;
            centersTableBody.innerHTML = '';
            if (allCenters.length === 0) {
                centersTableBody.innerHTML = `<tr><td colspan="${colCount}">No se encontraron centros.</td></tr>`;
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
                
                // --- NUEVO: Celda de acciones condicional ---
                let actionsCell = '';
                if (isAdmin) {
                    actionsCell = `
                        <td class="actions-cell">
                            <button class="btn btn-edit" data-id="${center.id}">Editar</button>
                            <button class="btn btn-delete" data-id="${center.id}">Eliminar</button>
                        </td>
                    `;
                }

                row.innerHTML = `
                    <td>${center.name}</td>
                    <td>${center.advisorname || 'N/A'}</td>
                    <td>${center.commenttext || 'Sin visitas'}</td>
                    <td>${lastVisitDate ? lastVisitDate.toLocaleDateString('es-DO') : 'N/A'}</td>
                    <td style="font-weight: bold; text-align: center;">${daysSinceLastVisit}</td>
                    ${actionsCell}
                `;
                centersTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error al mostrar centros:', error);
            // --- NUEVO: Colspan condicional en error ---
            const isAdmin = currentUser && currentUser.rol === 'Administrador';
            const colCount = isAdmin ? 6 : 5;
            centersTableBody.innerHTML = `<tr><td colspan="${colCount}">Error al cargar los centros.</td></tr>`;
        }
    };

    // --- FUNCIÓN PARA CARGAR LAS OPCIONES DE LOS FILTROS (ACTUALIZADA CON ROLES) ---
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

            // --- NUEVO: Ocultar filtro si es Asesor ---
            if (currentUser && currentUser.rol === 'Asesor') {
                const advisorLabel = document.querySelector('label[for="filter-advisor"]');
                if(advisorLabel) advisorLabel.style.display = 'none';
                filterAdvisor.style.display = 'none';
            }
            // --- FIN NUEVO ---
            
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
    
    // --- FUNCIONES DEL MODAL DE EDICIÓN ---
    const openEditModal = (center) => {
        // (Tu código original aquí... solo asegúrate de que los IDs coincidan)
        document.getElementById('edit-center-id').value = center.id;
        document.getElementById('edit-center-name').value = center.name;
        document.getElementById('edit-center-address').value = center.address || '';
        document.getElementById('edit-center-sector').value = center.sector || '';
        document.getElementById('edit-contact-name').value = center.contactname || '';
        document.getElementById('edit-contact-number').value = center.contactnumber || '';
        modal.style.display = 'block';
    };

    const closeEditModal = () => {
        modal.style.display = 'none';
    };

    // --- FUNCIÓN PARA MANEJAR LA ELIMINACIÓN ---
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
    
    // --- MANEJO DE EVENTOS ---
    filterAdvisor.addEventListener('change', fetchAndDisplayCenters);
    filterComment.addEventListener('change', fetchAndDisplayCenters);
    clearFiltersBtn.addEventListener('click', () => {
        // Si es asesor, su filtro no se puede limpiar (está oculto)
        if (currentUser.rol !== 'Asesor') {
            filterAdvisor.value = '';
        }
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
        const id = parseInt(document.getElementById('edit-center-id').value, 10);
        const updatedData = {
            name: document.getElementById('edit-center-name').value,
            address: document.getElementById('edit-center-address').value,
            sector: document.getElementById('edit-center-sector').value,
            contactname: document.getElementById('edit-contact-name').value,
            contactnumber: document.getElementById('edit-contact-number').value
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

    // --- CARGA INICIAL DE LA PÁGINA (ACTUALIZADA) ---
    // --- NUEVO: Función principal para inicializar la página ---
    const initializePage = async () => {
        try {
            // 1. Obtener los datos del usuario primero
            const response = await fetch('/api/user-session');
            if (!response.ok) {
                // Si falla (sesión expirada), redirigir al login
                window.location.href = '/login.html';
                return;
            }
            currentUser = await response.json();
            
            // 2. Ahora que tenemos el usuario, poblamos los filtros
            await populateFilters();
            
            // 3. Y después cargamos los centros (que dependen de los filtros y el rol)
            await fetchAndDisplayCenters();
            
        } catch (error) {
            console.error('Error al inicializar la página:', error);
            centersTableBody.innerHTML = `<tr><td colspan="6">Error fatal al cargar datos de usuario.</td></tr>`;
        }
    };

    // Ejecutar la función de inicialización
    initializePage();
});
