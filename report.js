document.addEventListener('DOMContentLoaded', () => {
    const reportBody = document.getElementById('report-body');
    const reportTable = document.getElementById('report-table'); // Get the table element

    // Obtener y mostrar el reporte
    const fetchReport = async (params = {}) => {
        const query = new URLSearchParams(params);
        try {
            const response = await fetch(`/api/report?${query.toString()}`);
            const visits = await response.json();
            console.log('Visitas recibidas:', visits); // Added for debugging

            // Limpiar tabla
            reportBody.innerHTML = '';

            if (visits.length === 0) {
                reportBody.innerHTML = '<tr><td colspan="5">No se encontraron visitas con los filtros seleccionados.</td></tr>';
                reportTable.classList.add('hidden');
                return;
            }

            visits.forEach(visit => {
                const row = document.createElement('tr');
                const visitDate = new Date(visit.visitDate);
                const formattedDate = new Date(visitDate.getTime() + visitDate.getTimezoneOffset() * 60000).toLocaleDateString('es-ES');

                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${visit.advisorName}</td>
                    <td>${visit.centerName}</td>
                    <td>${visit.contactName} (${visit.contactNumber || 'N/A'})</td>
                    <td>${visit.comments || ''}</td>
                `;
                reportBody.appendChild(row);
            });

            reportTable.classList.remove('hidden');

        } catch (error) {
            console.error('Error al cargar el reporte:', error);
            reportBody.innerHTML = '<tr><td colspan="5">Error al cargar el reporte.</td></tr>';
            reportTable.classList.remove('hidden');
        }
    };

    // Carga inicial: Leer parámetros de la URL y cargar el reporte si existen
    const urlParams = new URLSearchParams(window.location.search);
    const advisor = urlParams.get('advisor');
    const startDate = urlParams.get('startDate');
    const endDate = urlParams.get('endDate');

    if (window.location.search) { // Check if query string exists at all
        fetchReport({ advisor, startDate, endDate });
    } else {
        reportTable.classList.add('hidden');
    }
});