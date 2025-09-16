document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('quotes-tbody');

    async function loadUserQuotes() {
        try {
            const response = await fetch('/api/quote-requests');

            if (response.status === 401) {
                alert('Sesión expirada. Por favor, inicie sesión de nuevo.');
                window.location.href = '/';
                return;
            }

            if (!response.ok) {
                throw new Error('Error al cargar tus cotizaciones.');
            }

            const quotes = await response.json();
            renderQuotes(quotes);

        } catch (error) {
            console.error('Error:', error);
            tbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
        }
    }

    function renderQuotes(quotes) {
        tbody.innerHTML = '';

        if (quotes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No tienes cotizaciones creadas.</td></tr>';
            return;
        }

        // Ordenar las cotizaciones por fecha de creación, de más reciente a más antigua
        quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        quotes.forEach(quote => {
            const row = document.createElement('tr');
            
            const formattedDate = new Date(quote.createdAt).toLocaleDateString('es-DO', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            // Celda de Estado
            let statusCell = '<td class="status-cell">Cargando...</td>';
            const status = quote.status || 'Pendiente de Aprobación'; // Asumir pendiente si no hay estado
            let statusClass = '';
            switch (status) {
                case 'Aprobada':
                    statusClass = 'status-approved';
                    break;
                case 'Rechazada':
                    statusClass = 'status-rejected';
                    break;
                case 'Pendiente de Aprobación':
                    statusClass = 'status-pending';
                    break;
                default:
                    statusClass = 'status-pending';
            }
            statusCell = `<td><span class="status ${statusClass}">${status}</span></td>`;

            // Celda de Acciones
            let actionsCell = '<td>-' + '</td>';
            if (status === 'Aprobada') {
                actionsCell = `
                    <td class="actions">
                        <a href="/api/quote-requests/${quote.id}/pdf" target="_blank">Ver PDF</a>
                    </td>`;
            } else if (status === 'Rechazada') {
                actionsCell = `
                    <td>
                        <span class="rejection-reason">Motivo: ${quote.rejectionReason || 'No especificado'}</span>
                    </td>`;
            }

            row.innerHTML = `
                <td>${quote.quoteNumber}</td>
                <td>${quote.clientName}</td>
                <td>${formattedDate}</td>
                ${statusCell}
                ${actionsCell}
            `;

            tbody.appendChild(row);
        });
    }

    loadUserQuotes();
});