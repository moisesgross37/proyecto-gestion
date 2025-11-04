document.addEventListener('DOMContentLoaded', () => {
    // Referencias a las tablas (Original)
    const approvedTableBody = document.getElementById('pending-quotes-table-body'); // Renombrado en HTML, era la tabla superior
    const finalizedTableBody = document.getElementById('finalized-quotes-table-body');

    // Referencias al modal de rechazos (Original)
    const rejectedModal = document.getElementById('rejected-quote-modal');
    const closeRejectedModalBtn = document.getElementById('close-rejected-modal-btn');
    const rejectionReasonText = document.getElementById('rejection-reason-text');
    const rejectedQuoteNumber = document.getElementById('rejected-quote-number');
    const rejectedQuoteProducts = document.getElementById('rejected-quote-products');
    const rejectedQuoteSummary = document.getElementById('rejected-quote-summary-details');

    // --- INICIO: CÓDIGO AÑADIDO PARA AJUSTES ---
    // Referencias al modal de ajuste (Nuevo)
    const adjustmentModal = document.getElementById('request-adjustment-modal');
    const closeAdjustmentModalBtn = document.getElementById('close-adjustment-modal');
    const adjustmentForm = document.getElementById('adjustment-form');
    let currentUser = null; // Necesitamos saber el rol del usuario actual
    // --- FIN: CÓDIGO AÑADIDO ---

    // Función fetchAllQuotes (Correcta y Completa)
    const fetchAllQuotes = async () => {
        try {
            // --- INICIO: OBTENER USUARIO ACTUAL ---
            const userResponse = await fetch('/api/user-session');
            if (!userResponse.ok) {
                 console.error('Usuario no autenticado, redirigiendo...');
                 window.location.href = '/login.html';
                 return; 
            }
            currentUser = await userResponse.json();
            // --- FIN: OBTENER USUARIO ACTUAL ---

            const response = await fetch('/api/quote-requests');
            if (!response.ok) throw new Error('Error al cargar las cotizaciones.');
            const allQuotes = await response.json();

            // --- LÓGICA DE FILTRADO CORRECTA ---
            const actionableQuotes = allQuotes.filter(q => ['pendiente', 'pendiente_ajuste', 'aprobada', 'rechazada'].includes(q.status));
            const finalizedQuotes = allQuotes.filter(q => ['archivada', 'formalizada'].includes(q.status));
            // --- FIN: LÓGICA DE FILTRADO ---

            renderActionableQuotesTable(actionableQuotes);
            renderFinalizedQuotesTable(finalizedQuotes);

        } catch (error) {
            console.error('Error en fetchAllQuotes:', error);
            if(approvedTableBody) approvedTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
            if(finalizedTableBody) finalizedTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
        }
    };

    // Función renderActionableQuotesTable (CORREGIDA CON EL BOTÓN ELIMINAR)
    const renderActionableQuotesTable = (quotes) => {
        if (!approvedTableBody) return;
        approvedTableBody.innerHTML = '';
        if (quotes.length === 0) {
            approvedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones nuevas para gestionar.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            row.dataset.quoteId = quote.id; 
            let actionButtons = '';

            // --- LÓGICA DE BOTONES COMPLETA Y FINAL ---
            if (currentUser.rol === 'Administrador') {
                 if (quote.status === 'pendiente_ajuste') { 
                    actionButtons = `<button class="review-adjustment-btn btn" data-id="${quote.id}">Revisar Ajuste</button>`; 
                 } else if (quote.status === 'pendiente') { 
                    actionButtons = `<a href="/api/quote-requests/${quote.id}/pdf" target="_blank" class="admin-button view-btn btn">Ver PDF</a> <button class="approve-btn btn btn-success" data-id="${quote.id}">Aprobar</button> <button class="reject-btn btn btn-danger" data-id="${quote.id}">Rechazar</button>`;
                 } else if (quote.status === 'aprobada') { 
                    actionButtons = `<button class="btn archive-btn" data-id="${quote.id}">Descargar y Archivar</button> <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button>`;
                 } else if (quote.status === 'rechazada') { 
                    actionButtons = `<button class="btn view-rejection-details-btn" data-id="${quote.id}">Ver Detalles del Rechazo</button> <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button>`;
                 }
            } else if (currentUser.rol === 'Asesor') {
                 if (quote.status === 'pendiente_ajuste') { 
                    actionButtons = `<span>En revisión por Admin</span>`; 
                 } else if (quote.status === 'pendiente') { 
                    actionButtons = `<button class="request-adjustment-btn btn" data-id="${quote.id}" data-number="${quote.quoteNumber}">Solicitar Ajuste</button>`;
                 } 
                 // --- INICIO: CORRECCIÓN PARA ASESOR ---
                 else if (quote.status === 'aprobada') { // Si está aprobada
                    actionButtons = `
                        <button class="btn archive-btn" data-id="${quote.id}">Descargar y Archivar</button>
                        <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button> 
                    `; // <-- SE AÑADIÓ EL BOTÓN ELIMINAR AQUÍ
                 } 
                 // --- FIN: CORRECCIÓN PARA ASESOR ---
                 else if (quote.status === 'rechazada') { // ESTADO ORIGINAL PARA ASESOR (YA ESTABA BIEN)
                    actionButtons = `
                        <button class="btn view-rejection-details-btn" data-id="${quote.id}">Ver Detalles del Rechazo</button> 
                        <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button>
                    `;
                 }
            }
            // --- FIN: LÓGICA DE BOTONES ---

            const formattedDate = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('es-DO', { timeZone: 'UTC'}) : 'N/A';

            row.innerHTML = `
                <td>${quote.quoteNumber || 'N/A'}</td>
                <td>${formattedDate}</td>
                <td>${quote.clientName || 'N/A'}</td>
                <td>${quote.advisorName || 'No especificado'}</td>
                <td class="actions-cell">${actionButtons}</td>
            `;
            approvedTableBody.appendChild(row);
        });
    }; // <-- Cierre de la función renderActionableQuotesTable

    // Función renderFinalizedQuotesTable (Original, MODIFICADA para usar currentUser)
    const renderFinalizedQuotesTable = (quotes) => {
         if (!finalizedTableBody) return;
         finalizedTableBody.innerHTML = '';
         if (quotes.length === 0) {
             finalizedTableBody.innerHTML = '<tr><td colspan="5">No hay cotizaciones en el historial.</td></tr>';
             return;
         }
         quotes.forEach(quote => {
             const row = document.createElement('tr');
             row.dataset.quoteId = quote.id;
             let actionsHTML = `<a href="/api/quote-requests/${quote.id}/pdf" class="btn" target="_blank">Ver Cotización</a>`;
             if (quote.status === 'formalizada') {
                 actionsHTML += ` <a href="/api/agreements/${quote.id}/pdf" class="btn btn-primary" target="_blank">Imprimir Acuerdo</a>`;
             } else if (quote.status === 'archivada') {
                 // Permitir eliminar archivadas solo si es Admin o el Asesor dueño
                 if (currentUser && (currentUser.rol === 'Administrador' || currentUser.nombre === quote.advisorName)) {
                     actionsHTML += ` <button class="btn btn-delete delete-btn" data-id="${quote.id}">Eliminar</button>`;
                 }
             }
             const eventDate = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('es-DO', { timeZone: 'UTC'}) : 'N/A';
             const statusClass = `status-${quote.status}`;
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

    // --- FUNCIONES ORIGINALES (handleArchive, handleDelete, showRejectionDetails) ---
    // (Incluidas completas y sin cambios, pero movidas dentro del DOMContentLoaded)
    const handleArchive = async (quoteId) => {
        try {
            window.open(`/api/quote-requests/${quoteId}/pdf`, '_blank');
            const response = await fetch(`/api/quote-requests/${quoteId}/archive`, { method: 'POST' });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Error al archivar.'); }
            fetchAllQuotes(); // Usamos fetchAllQuotes en lugar de loadQuotes
        } catch (error) { console.error(error); alert(error.message); }
    };
    const handleDelete = async (quoteId) => {
        if (!confirm('¿Estás seguro de que deseas eliminar permanentemente esta cotización?')) return;
        try {
            const response = await fetch(`/api/quote-requests/${quoteId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            alert(result.message);
            fetchAllQuotes(); // Usamos fetchAllQuotes
        } catch (error) { console.error('Error al eliminar:', error); alert(error.message); }
    };
    const showRejectionDetails = async (quoteId) => {
        if (!rejectedModal) { console.error("Modal de rechazo no encontrado."); return; }
        try {
            const response = await fetch(`/api/quote-requests/${quoteId}/details`);
            if (!response.ok) throw new Error('No se pudieron cargar los detalles.');
            const data = await response.json();
            rejectionReasonText.textContent = data.rejectionReason || 'No se especificó un motivo.';
            rejectedQuoteNumber.textContent = `Resumen de ${data.quoteNumber}:`;
            rejectedQuoteProducts.innerHTML = '';
            (data.products || []).forEach(productName => { const li = document.createElement('li'); li.textContent = productName; rejectedQuoteProducts.appendChild(li); });
            rejectedQuoteSummary.innerHTML = `<p><strong>Estudiantes:</strong> ${data.studentCount || 'N/A'}</p><p><strong>Precio Calculado:</strong> RD$ ${parseFloat(data.pricePerStudent || 0).toFixed(2)} c/u</p>`;
            rejectedModal.style.display = 'block';
        } catch (error) { console.error(error); alert(error.message); }
    };

    // --- INICIO: CÓDIGO AÑADIDO PARA AJUSTES ---
    // --- NUEVAS FUNCIONES PARA MANEJAR AJUSTES ---
    function openAdjustmentModal(quoteId, quoteNumber) {
        if (adjustmentModal) {
            document.getElementById('adjustment-quote-id').value = quoteId;
            document.getElementById('adjustment-quote-number').textContent = quoteNumber;
            adjustmentModal.style.display = 'block';
        } else {
            console.error("Modal de ajuste no encontrado.");
        }
    }
    async function handleReviewAdjustment(quoteId) {
        // En el futuro, podemos hacer un modal más elegante. Por ahora, prompts son seguros.
        const newAmount = prompt(`Revisión de Ajuste para Cotización #${quoteId}\nIngrese el MONTO FINAL a aprobar (ej: -15 para descuento):`);
        if (newAmount === null) return; // Si el usuario presiona cancelar

        const newComment = prompt("Ingrese un comentario interno para el asesor sobre esta aprobación:");
        if (newComment === null) return; // Si el usuario presiona cancelar

        try {
             // Validar que el monto sea un número
             const montoFloat = parseFloat(newAmount);
             if (isNaN(montoFloat)) {
                 alert("El monto ingresado no es un número válido.");
                 return;
             }
            const response = await fetch(`/api/quote-requests/${quoteId}/approve-adjustment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto: montoFloat, comentario: newComment }) // Usar monto validado
            });
            if (!response.ok) throw new Error('No se pudo aprobar el ajuste.');
            fetchAllQuotes(); // Recargar la lista para que la cotización vuelva a "pendiente"
        } catch (error) {
             console.error("Error en handleReviewAdjustment:", error); // Añadir log de error
            alert(`Error: ${error.message}`);
        }
    }
    // --- FIN: CÓDIGO AÑADIDO ---

    // --- Event listener para el formulario de ajuste (NUEVO) ---
    if (adjustmentForm) {
        adjustmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const quoteId = document.getElementById('adjustment-quote-id').value;
            const monto = parseFloat(document.getElementById('adjustment-amount').value);
            const comentario = document.getElementById('adjustment-comment').value;
            if (isNaN(monto) || !comentario.trim()) { alert('Por favor, complete todos los campos correctamente.'); return; }
            try {
                const response = await fetch(`/api/quote-requests/${quoteId}/request-adjustment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto, comentario }) });
                if (!response.ok) throw new Error('No se pudo enviar la solicitud.');
                if(adjustmentModal) adjustmentModal.style.display = 'none';
                adjustmentForm.reset();
                fetchAllQuotes(); // Usar fetchAllQuotes
            } catch (error) { alert(`Error: ${error.message}`); }
        });
    }

    // --- MANEJO DE EVENTOS CORREGIDO Y FUSIONADO ---
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        // Busca el ID subiendo por el DOM (más robusto)
        const quoteId = target.closest('[data-id]') ? target.closest('[data-id]').dataset.id : null;

        // Manejo de botones de cierre de modales (Original + Nuevo)
        if (target === closeRejectedModalBtn && rejectedModal) { rejectedModal.style.display = 'none'; return; }
        if (target === closeAdjustmentModalBtn && adjustmentModal) { adjustmentModal.style.display = 'none'; return; }

        // Si no hay ID o no es un botón/enlace relevante, salir
        // Simplificado para mayor claridad
        if (!quoteId || !target.classList.contains('btn') && !target.classList.contains('view-btn') && !target.classList.contains('admin-button') && !target.classList.contains('request-adjustment-btn') && !target.classList.contains('review-adjustment-btn') && !target.classList.contains('approve-btn') && !target.classList.contains('reject-btn')) {
             return;
        }

        // Lógica para cada botón (original + nuevo)
        if (target.classList.contains('approve-btn')) { // Botón Admin (pendiente)
            handleApprove(quoteId);
        } else if (target.classList.contains('reject-btn')) { // Botón Admin (pendiente)
            handleReject(quoteId);
        } else if (target.classList.contains('archive-btn')) { // Botón Asesor/Admin (aprobada)
            handleArchive(quoteId);
        } else if (target.classList.contains('delete-btn')) { // Botón Asesor/Admin (aprobada/rechazada/archivada)
            handleDelete(quoteId);
        } else if (target.classList.contains('view-rejection-details-btn')) { // Botón Asesor/Admin (rechazada)
            showRejectionDetails(quoteId);
        } else if (target.classList.contains('request-adjustment-btn')) { // Botón Nuevo Asesor (pendiente)
            const quoteNumber = target.dataset.number || target.closest('tr')?.querySelector('td:first-child')?.textContent || 'N/A';
            openAdjustmentModal(quoteId, quoteNumber);
        } else if (target.classList.contains('review-adjustment-btn')) { // Botón Nuevo Admin (pendiente_ajuste)
            handleReviewAdjustment(quoteId);
        }
    });

    // Lógica para cerrar modales haciendo clic fuera (Original + Nuevo)
    window.onclick = (event) => {
        if (event.target == adjustmentModal && adjustmentModal) adjustmentModal.style.display = 'none';
        if (event.target == rejectedModal && rejectedModal) rejectedModal.style.display = 'none';
    };

    // Carga inicial de toda la página
    fetchAllQuotes(); // Llamar a la función original de la nube
});