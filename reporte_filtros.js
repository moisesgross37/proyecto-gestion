document.addEventListener('DOMContentLoaded', () => {
    const filterForm = document.getElementById('filter-form');
    const advisorFilter = document.getElementById('advisor-filter');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const clearFiltersButton = document.getElementById('clear-filters');

    // Poblar el filtro de asesores
    const populateAdvisorFilter = async () => {
        try {
            const response = await fetch('/api/advisors');
            const advisors = await response.json();
            advisors.forEach(advisor => {
                const option = document.createElement('option');
                option.value = advisor.name;
                option.textContent = advisor.name;
                advisorFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar asesores:', error);
        }
    };

    // Event Listeners
    filterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const advisor = advisorFilter.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        // Construir la URL con los parámetros de consulta
        const query = new URLSearchParams();
        if (advisor) query.append('advisor', advisor);
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);

        // Redirigir a la página de reporte con los filtros
        window.location.href = `/reporte.html?${query.toString()}`;
    });

    clearFiltersButton.addEventListener('click', () => {
        filterForm.reset();
        // Opcional: redirigir a la página de reporte sin filtros
        window.location.href = `/reporte.html`;
    });

    // Carga inicial
    populateAdvisorFilter();
});