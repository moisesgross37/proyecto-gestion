document.addEventListener('DOMContentLoaded', () => {

    const approvedTableBody = document.getElementById('pending-quotes-table-body');
    const finalizedTableBody = document.getElementById('finalized-quotes-table-body');

    const fetchAllQuotes = async () => {
        try {
            const response = await fetch('/api/quote-requests');
            if (!response.ok) throw new Error('Error al cargar las cotizaciones.');
            
            const allQuotes = await response.json();
            
            // --- DIAGNOSTIC ---
            console.log("DATOS RECIBIDOS DEL SERVIDOR:", JSON.stringify(allQuotes, null, 2));
            // --- END DIAGNOSTIC ---

            const approvedQuotes = allQuotes.filter(q => q.status === 'aprobada');
            const finalizedQuotes = allQuotes.filter(q => q.status === 'archivada' || q.status === 'rechazada');

            renderApprovedQuotesTable(approvedQuotes);
            renderFinalizedQuotesTable(finalizedQuotes);

        } catch (error) {
            console.error(error);
            if (approvedTableBody) approvedTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
            if (finalizedTableBody) finalizedTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
        }
    };

    const renderApprovedQuotesTable = (quotes) => {
        if (!approvedTableBody) return;
        approvedTableBody.innerHTML = '';
        if (quotes.length === 0) {
            approvedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones pendientes de descarga.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${quote.quotenumber || 'N/A'}</td>
                <td>${new Date(quote.createdat).toLocaleDateString()}</td>
                <td>${quote.clientname || 'N/A'}</td>
                <td>${quote.advisorname || 'No especificado'}</td>
                <td><button class="btn archive-btn" data-id="${quote.id}">Descargar y Archivar</button></td>
            `;
            approvedTableBody.appendChild(row);
        });
    };

    const renderFinalizedQuotesTable = (quotes) => {
        if (!finalizedTableBody) return;
        finalizedTableBody.innerHTML = '';
        if (quotes.length === 0) {
            finalizedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones en el historial.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            let actionsHTML = '';
            if (quote.status === 'archivada') {
                actionsHTML = `<a href="/api/quote-requests/${quote.id}/pdf" class="btn" target="_blank">Descargar PDF</a>`;
            } else { // Rechazada
                actionsHTML = `<button class="btn btn-delete view-rejection-reason-btn" data-reason="${quote.rejectionreason || 'No se especificó un motivo.'}">Ver Motivo</button>`;
            }

            row.innerHTML = `
                <td>${quote.quotenumber || 'N/A'}</td>
                <td>${quote.clientname || 'N/A'}</td>
                <td>${new Date(quote.createdat).toLocaleDateString()}</td>
                <td><strong>${quote.status}</strong></td>
                <td>${actionsHTML}</td>
            `;
            finalizedTableBody.appendChild(row);
        });
    };

    const handleArchive = async (quoteId) => {
        try {
            window.open(`/api/quote-requests/${quoteId}/pdf`, '_blank');
            const response = await fetch(`/api/quote-requests/${quoteId}/archive`, { method: 'POST' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al archivar la cotización.');
            }
            fetchAllQuotes();
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    };

    document.body.addEventListener('click', (event) => {
        if (event.target.classList.contains('archive-btn')) {
            const quoteId = parseInt(event.target.dataset.id, 10);
            handleArchive(quoteId);
        } else if (event.target.classList.contains('view-rejection-reason-btn')) {
            const reason = event.target.dataset.reason;
            alert(`Motivo del rechazo:\n\n${reason}`);
        }
    });

    fetchAllQuotes();
});
