document.addEventListener('DOMContentLoaded', () => {
    // Referencias a las tablas
    const approvedTableBody = document.getElementById('pending-quotes-table-body');
    const finalizedTableBody = document.getElementById('finalized-quotes-table-body');

    // Referencias a la nueva ventana modal de rechazos
    const rejectedModal = document.getElementById('rejected-quote-modal');
    const closeRejectedModalBtn = document.getElementById('close-rejected-modal-btn');
    const rejectionReasonText = document.getElementById('rejection-reason-text');
    const rejectedQuoteNumber = document.getElementById('rejected-quote-number');
    const rejectedQuoteProducts = document.getElementById('rejected-quote-products');
    const rejectedQuoteSummary = document.getElementById('rejected-quote-summary-details');

    const fetchAllQuotes = async () => {
        try {
            const response = await fetch('/api/quote-requests');
            if (!response.ok) throw new Error('Error al cargar las cotizaciones.');
            const allQuotes = await response.json();
            
            const actionableQuotes = allQuotes.filter(q => q.status === 'aprobada' || q.status === 'rechazada');
            const finalizedQuotes = allQuotes.filter(q => q.status === 'archivada' || q.status === 'formalizada');

            renderActionableQuotesTable(actionableQuotes);
            renderFinalizedQuotesTable(finalizedQuotes);

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
                // El botón ahora tiene una nueva clase 'view-rejection-details-btn'
                actionButtons = `
                    <button class="btn view-rejection-details-btn" data-id="${quote.id}">Ver Detalles del Rechazo</button>
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
    
    // Función para la tabla de historial (sin cambios)
    const renderFinalizedQuotesTable = (quotes) => {
         finalizedTableBody.innerHTML = '';
         if (quotes.length === 0) {
             finalizedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones en el historial.</td></tr>';
             return;
         }
         quotes.forEach(quote => {
             const row = document.createElement('tr');
             let actionsHTML = `<a href="/api/quote-requests/${quote.id}/pdf" class="btn" target="_blank">Ver Cotización</a>`;
             if (quote.status === 'formalizada') {
                 actionsHTML += ` <a href="/api/agreements/${quote.id}/pdf" class="btn btn-primary" target="_blank">Imprimir Acuerdo</a>`;
             } else if (quote.status === 'archivada') {
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

    const handleArchive = async (quoteId) => {
        // ... (sin cambios)
    };
    const handleDelete = async (quoteId) => {
        // ... (sin cambios)
    };

    // --- NUEVA FUNCIÓN PARA ABRIR LA VENTANA MODAL ---
    const showRejectionDetails = async (quoteId) => {
        try {
            const response = await fetch(`/api/quote-requests/${quoteId}/details`);
            if (!response.ok) throw new Error('No se pudieron cargar los detalles.');
            const data = await response.json();

            // Llenar la ventana con los datos
            rejectionReasonText.textContent = data.rejectionReason || 'No se especificó un motivo.';
            rejectedQuoteNumber.textContent = `Resumen de ${data.quoteNumber}:`;
            
            rejectedQuoteProducts.innerHTML = ''; // Limpiar lista anterior
            data.products.forEach(productName => {
                const li = document.createElement('li');
                li.textContent = productName;
                rejectedQuoteProducts.appendChild(li);
            });
            
            rejectedQuoteSummary.innerHTML = `
                <p><strong>Estudiantes:</strong> ${data.studentCount}</p>
                <p><strong>Precio Calculado:</strong> RD$ ${parseFloat(data.pricePerStudent).toFixed(2)} c/u</p>
            `;

            // Mostrar la ventana
            rejectedModal.style.display = 'block';

        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    };

    // --- MANEJO DE EVENTOS ---
    document.body.addEventListener('click', (event) => {
        // ... (código existente para archivar y eliminar)

        // Nuevo evento para el botón "Ver Detalles del Rechazo"
        if (event.target.classList.contains('view-rejection-details-btn')) {
            const quoteId = event.target.dataset.id;
            showRejectionDetails(quoteId);
        }
    });

    // Evento para cerrar la ventana modal
    closeRejectedModalBtn.addEventListener('click', () => {
        rejectedModal.style.display = 'none';
    });
    window.addEventListener('click', (event) => {
        if (event.target == rejectedModal) {
            rejectedModal.style.display = 'none';
        }
    });

    fetchAllQuotes();
});
