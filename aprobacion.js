document.addEventListener('DOMContentLoaded', () => {

    const approvedTableBody = document.getElementById('pending-quotes-table-body');
    const finalizedTableBody = document.getElementById('finalized-quotes-table-body');

    const fetchAllQuotes = async () => {
        try {
            const response = await fetch('/api/quote-requests');
            if (!response.ok) throw new Error('Error al cargar las cotizaciones.');
            const allQuotes = await response.json();
            
            // La tabla superior sigue mostrando las cotizaciones que requieren una acción inmediata
            const actionableQuotes = allQuotes.filter(q => q.status === 'aprobada' || q.status === 'rechazada');
            // La tabla inferior muestra el historial
            const finalizedQuotes = allQuotes.filter(q => q.status === 'archivada' || q.status === 'formalizada');

            renderActionableQuotesTable(actionableQuotes);
            renderFinalizedQuotesTable(finalizedQuotes); // Llamamos a la nueva función actualizada

        } catch (error) {
            console.error(error);
            approvedTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
            finalizedTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
        }
    };

    const renderActionableQuotesTable = (quotes) => {
        approvedTableBody.innerHTML = '';
        if (quotes.length === 0) {
            approvedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones nuevas para gestionar.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            let actionButtons = '';

            if (quote.status === 'aprobada') {
                actionButtons = `
                    <button class="btn archive-btn" data-id="${quote.id}">Descargar y Archivar</button>
                    <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button>
                `;
            } else if (quote.status === 'rechazada') {
                actionButtons = `
                    <button class="btn view-rejection-reason-btn" data-reason="${quote.rejectionReason || 'No se especificó un motivo.'}">Ver Motivo</button>
                    <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button>
                `;
            }

            row.innerHTML = `
                <td>${quote.quoteNumber || 'N/A'}</td>
                <td>${new Date(quote.createdAt).toLocaleDateString()}</td>
                <td>${quote.clientName || 'N/A'}</td>
                <td>${quote.advisorName || 'No especificado'}</td>
                <td class="actions-cell">${actionButtons}</td>
            `;
            approvedTableBody.appendChild(row);
        });
    };

    // ======================================================================
    // ========= INICIO: SECCIÓN MODIFICADA PARA EL BOTÓN DE ACUERDO ========
    // ======================================================================
    const renderFinalizedQuotesTable = (quotes) => {
        finalizedTableBody.innerHTML = '';
        if (quotes.length === 0) {
            finalizedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones en el historial.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            
            let actionsHTML = `<a href="/api/quote-requests/${quote.id}/pdf" class="btn" target="_blank">Ver Cotización</a>`;

            // === LA NUEVA LÓGICA ===
            // Si la cotización está formalizada, mostramos el botón de "Imprimir Acuerdo"
            if (quote.status === 'formalizada') {
                actionsHTML += ` <a href="/api/agreements/${quote.id}/pdf" class="btn btn-primary" target="_blank">Imprimir Acuerdo</a>`;
            } 
            // Si está archivada (y por lo tanto no formalizada), mostramos el botón de eliminar
            else if (quote.status === 'archivada') {
                actionsHTML += ` <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button>`;
            }

            const eventDate = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'N/A';
            const statusClass = quote.status === 'formalizada' ? 'status-formalizada' : 'status-archivada';


            row.innerHTML = `
                <td>${quote.quoteNumber || 'N/A'}</td>
                <td>${quote.clientName || 'N/A'}</td>
                <td>${eventDate}</td>
                <td><strong class="${statusClass}">${quote.status.toUpperCase()}</strong></td>
                <td class="actions-cell">${actionsHTML}</td>
            `;
            finalizedTableBody.appendChild(row);
        });
    };
    // ======================================================================
    // ============= FIN: SECCIÓN MODIFICADA PARA EL BOTÓN DE ACUERDO =======
    // ======================================================================

    const handleArchive = async (quoteId) => {
        try {
            window.open(`/api/quote-requests/${quoteId}/pdf`, '_blank');
            const response = await fetch(`/api/quote-requests/${quoteId}/archive`, {
                method: 'POST',
            });
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

    const handleDelete = async (quoteId) => {
        if (!confirm('¿Estás seguro de que deseas eliminar permanentemente esta cotización? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            const response = await fetch(`/api/quote-requests/${quoteId}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message);
            }
            alert(result.message);
            fetchAllQuotes();
        } catch (error) {
            console.error('Error al eliminar cotización:', error);
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
        } else if (event.target.classList.contains('delete-btn')) {
            const quoteId = parseInt(event.target.dataset.id, 10);
            handleDelete(quoteId);
        }
    });

    fetchAllQuotes();
});
