document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del HTML que vamos a manipular
    const tableBody = document.getElementById('visits-table-body');
    const filterAdvisor = document.getElementById('filterAdvisor');
    const filterCenter = document.getElementById('filterCenter');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');

    let allVisits = [];
    let allAdvisors = [];
    let allCenters = [];

    async function loadInitialData() {
        try {
            const [visitsResponse, advisorsResponse, centersResponse] = await Promise.all([
                fetch('/api/visits'),
                fetch('/api/advisors'),
                fetch('/api/centers')
            ]);
            
            if (!visitsResponse.ok || !advisorsResponse.ok || !centersResponse.ok) {
                throw new Error('No se pudieron cargar los datos del reporte.');
            }
            
            allVisits = await visitsResponse.json();
            allAdvisors = await advisorsResponse.json();
            allCenters = await centersResponse.json();
            
            populateAdvisorFilter();
            populateCenterFilter();
            renderVisits(allVisits);
        } catch (error) {
            console.error("Error cargando datos:", error);
            tableBody.innerHTML = `<tr><td colspan="5">Error al cargar los datos. Por favor, revise la consola.</td></tr>`;
        }
    }

    function populateAdvisorFilter() {
        // Limpiar opciones existentes, excepto la primera
        filterAdvisor.innerHTML = '<option value="">Todos los Asesores</option>';
        allAdvisors.forEach(advisor => {
            const option = document.createElement('option');
            option.value = advisor.name;
            option.textContent = advisor.name;
            filterAdvisor.appendChild(option);
        });
    }

    function populateCenterFilter() {
        // Limpiar opciones existentes, excepto la primera
        filterCenter.innerHTML = '<option value="">Todos los Centros</option>';
        allCenters.forEach(center => {
            const option = document.createElement('option');
            option.value = center.name;
            option.textContent = center.name;
            filterCenter.appendChild(option);
        });
    }

    function renderVisits(visits) {
        tableBody.innerHTML = '';
        
        if (visits.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No se encontraron visitas que coincidan con los filtros.</td></tr>`;
            return;
        }

        // CORRECCIÓN: Se ordena usando la propiedad correcta en minúsculas
        visits.sort((a, b) => new Date(b.visitdate) - new Date(a.visitdate));

        visits.forEach(visit => {
            const row = document.createElement('tr');
            
            // CORRECCIÓN: Se usa la propiedad correcta en minúsculas
            const visitDate = new Date(visit.visitdate).toLocaleDateString('es-DO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC' // Importante para evitar desfases de un día
            });
            
            // CORRECCIÓN: Se usan las propiedades correctas en minúsculas que vienen de la base de datos
            row.innerHTML = `
                <td>${visitDate}</td>
                <td>${visit.advisorname || 'N/A'}</td>
                <td>${visit.centername || 'N/A'}</td>
                <td>${visit.coordinatorname || 'N/A'}</td>
                <td>${visit.commenttext || ''}</td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    function applyFilters() {
        let filteredVisits = [...allVisits];

        const advisor = filterAdvisor.value;
        const center = filterCenter.value;
        const startDate = filterStartDate.value;
        const endDate = filterEndDate.value;

        if (advisor) {
            // CORRECCIÓN: Se filtra usando la propiedad correcta
            filteredVisits = filteredVisits.filter(v => v.advisorname === advisor);
        }

        if (center) {
            // CORRECCIÓN: Se filtra usando la propiedad correcta
            filteredVisits = filteredVisits.filter(v => v.centername === center);
        }

        if (startDate) {
            // CORRECCIÓN: Se filtra usando la propiedad correcta
            filteredVisits = filteredVisits.filter(v => new Date(v.visitdate) >= new Date(startDate + 'T00:00:00'));
        }
        if (endDate) {
            // CORRECCIÓN: Se filtra usando la propiedad correcta
            filteredVisits = filteredVisits.filter(v => new Date(v.visitdate) <= new Date(endDate + 'T00:00:00'));
        }
        
        renderVisits(filteredVisits);
    }
    
    filterAdvisor.addEventListener('change', applyFilters);
    filterCenter.addEventListener('change', applyFilters);
    filterStartDate.addEventListener('change', applyFilters);
    filterEndDate.addEventListener('change', applyFilters);

    loadInitialData();
});