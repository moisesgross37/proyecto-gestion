document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded Panel Aprobación');
    const tbody = document.getElementById('pending-quotes-tbody');

    // --- Elementos del Modal ---
    const decisionModal = document.getElementById('decision-modal');
    const closeModalBtn = document.getElementById('close-decision-modal');
    const modalTitle = document.getElementById('modal-title');
    const currentQuoteIdInput = document.getElementById('current-quote-id');
    const modalPdfLink = document.getElementById('modal-pdf-link');

    // Panel de Solicitud (para mostrar)
    const requestDisplayPanel = document.getElementById('adjustment-request-display');
    const requestedAmountDisplay = document.getElementById('requested-amount-display');
    const requestedCommentDisplay = document.getElementById('requested-comment-display');

    // Formulario de Decisión (para enviar)
    const approvedAmountInput = document.getElementById('approved-adjustment-amount');
    const adminCommentInput = document.getElementById('admin-decision-comment');

    // Botones de Acción del Modal
    const approveAdjBtn = document.getElementById('approve-adj-btn');
    const approveStdBtn = document.getElementById('approve-std-btn');
    const rejectBtn = document.getElementById('reject-btn'); // Botón Rechazar DENTRO del modal

    // Barra de Notificación
    const notificationBar = document.getElementById('notification-bar');

    // --- Función de Notificación ---
    function showNotification(message, type = 'success') {
        console.log(`[Notification ${type}]: ${message}`); // Log para debug
        if (!notificationBar) { console.error("Elemento notification-bar no encontrado"); return; }
        notificationBar.textContent = message;
        // CORRECCIÓN: className debe ser solo 'success' o 'error' para coincidir con CSS
        notificationBar.className = type;
        notificationBar.style.display = 'block';
        // Ocultar notificación después de 5 segundos
        setTimeout(() => {
            if (notificationBar) notificationBar.style.display = 'none';
        }, 5000);
    }

    // --- Cargar Cotizaciones Pendientes ---
    async function loadPendingQuotes() {
        console.log('[DEBUG] Cargando cotizaciones pendientes...');
        if (!tbody) { console.error("Elemento tbody no encontrado"); return; }
        tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>'; // Mensaje mientras carga
        try {
            const response = await fetch('/api/quotes/pending-approval');
            console.log('[DEBUG] Respuesta fetch pending-approval:', response.status);

            if (response.status === 401 || response.status === 403) {
                showNotification('Acceso no autorizado. Debes ser administrador.', 'error');
                setTimeout(() => window.location.href = '/index.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status} al cargar cotizaciones: ${errorText}`);
            }

            const quotes = await response.json();
            console.log(`[DEBUG] ${quotes.length} cotizaciones recibidas.`);
            renderQuotes(quotes);

        } catch (error) {
            console.error('Error en loadPendingQuotes:', error);
            tbody.innerHTML = `<tr><td colspan="5">Error al cargar: ${error.message}</td></tr>`;
            showNotification(`Error al cargar cotizaciones: ${error.message}`, 'error');
        }
    }

    // --- Renderizar Fila de Cotización ---
    function renderQuotes(quotes) {
        if (!tbody) return;
        tbody.innerHTML = ''; // Limpiar

        if (quotes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No hay cotizaciones pendientes de aprobación.</td></tr>';
            return;
        }

        quotes.forEach(quote => {
            const row = document.createElement('tr');
            row.dataset.quoteId = quote.id; // Guardar ID en la fila

            const formattedDate = new Date(quote.createdat).toLocaleDateString('es-DO', {
                year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' // Formato más corto
            });

            const requestedAmount = quote.ajusteSolicitadoMonto;
            const requestedComment = quote.ajusteSolicitadoComentario || '';

            const hasAdjustmentRequest = requestedAmount !== null && requestedAmount !== undefined;
            const decisionButtonText = hasAdjustmentRequest ? "Revisar Ajuste" : "Decidir";
            const decisionButtonClass = hasAdjustmentRequest ? "decision-btn" : "approve-std-btn";

            // --- MODIFICADO: Se elimina el botón "Ver PDF" de la fila ---
            row.innerHTML = `
                <td>${quote.quotenumber || 'N/A'}</td>
                <td>${quote.clientname || 'N/A'}</td>
                <td>${quote.advisorname || 'N/A'}</td>
                <td>${formattedDate}</td>
                <td class="actions">
                    <!-- Botón Ver PDF ELIMINADO de aquí -->
                    <button class="${decisionButtonClass}"
                            data-id="${quote.id}"
                            data-quotenumber="${quote.quotenumber || 'N/A'}"
                            data-requested-amount="${requestedAmount === null || requestedAmount === undefined ? '' : requestedAmount}"
                            data-requested-comment="${requestedComment}">
                        ${decisionButtonText}
                    </button>
                    <button class="delete-btn-table" data-id="${quote.id}" title="Eliminar Cotización Permanentemente">Eliminar</button>
                </td>
            `;

            tbody.appendChild(row);
        });
        console.log('[DEBUG] Tabla renderizada.');
    }

    // --- Abrir Modal de Decisión ---
    function openDecisionModal(button) {
        console.log('[DEBUG] Abriendo modal de decisión para ID:', button.dataset.id);
        if (!decisionModal || !modalTitle || !currentQuoteIdInput || !modalPdfLink ||
            !requestDisplayPanel || !requestedAmountDisplay || !requestedCommentDisplay ||
            !approvedAmountInput || !adminCommentInput || !approveAdjBtn || !approveStdBtn || !rejectBtn) {
            console.error("Error crítico: Faltan elementos del modal en el HTML.");
            showNotification("Error interno: No se pudo abrir el panel de decisión.", "error");
            return;
        }

        const quoteId = button.dataset.id;
        const quoteNumber = button.dataset.quotenumber;
        const requestedAmountStr = button.dataset.requestedAmount;
        const requestedComment = button.dataset.requestedComment || "(Sin justificación)";
        const requestedAmount = parseFloat(requestedAmountStr);

        modalTitle.textContent = `Decisión de Cotización: ${quoteNumber}`;
        currentQuoteIdInput.value = quoteId;
        // --- MODIFICADO: Asegurarse que el link PDF del modal SÍ se actualice ---
        modalPdfLink.href = `/api/quote-requests/${quoteId}/pdf`;


        if (!isNaN(requestedAmount)) {
            console.log('[DEBUG] Solicitud de ajuste encontrada:', { requestedAmount, requestedComment });
            requestedAmountDisplay.textContent = `RD$ ${requestedAmount.toFixed(2)}`;
            requestedCommentDisplay.textContent = requestedComment;
            requestDisplayPanel.style.display = 'block';
            approvedAmountInput.value = requestedAmount.toFixed(2);
            approveAdjBtn.style.display = 'inline-block';
            approveStdBtn.style.display = 'inline-block';
            rejectBtn.style.display = 'inline-block';
        } else {
            console.log('[DEBUG] No hay solicitud de ajuste válida.');
            requestDisplayPanel.style.display = 'none';
            approvedAmountInput.value = '0';
            approveAdjBtn.style.display = 'none';
            approveStdBtn.style.display = 'inline-block';
            rejectBtn.style.display = 'inline-block';
        }

        adminCommentInput.value = '';
        decisionModal.style.display = 'block';
    }

    // --- Cerrar Modal ---
    function closeModal() {
        if (decisionModal) decisionModal.style.display = 'none';
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == decisionModal) {
            closeModal();
        }
    });

    // --- Manejadores de Decisión (Funciones handle... sin cambios) ---

    // Acción 1: Aprobar CON Ajuste
    async function handleApproveWithAdjustment() {
        console.log('[DEBUG] Click en Aprobar con Ajuste');
        const quoteId = currentQuoteIdInput.value;
        const approvedAmountStr = approvedAmountInput.value;
        const adminComment = adminCommentInput.value.trim();

        if (approvedAmountStr === '') { // Permitir 0, pero no vacío
            showNotification('El monto de ajuste aprobado es obligatorio. Escriba 0 si no aplica ajuste.', 'error');
            return;
        }
        const approvedAmount = parseFloat(approvedAmountStr);
        if (isNaN(approvedAmount)) {
            showNotification('El monto de ajuste aprobado debe ser un número.', 'error');
            return;
        }

        const decisionData = { monto: approvedAmount, comentario: adminComment };
        console.log('[DEBUG] Enviando a /approve-with-adjustment:', decisionData);

        try {
            const response = await fetch(`/api/quote-requests/${quoteId}/approve-with-adjustment`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decisionData),
            });
            console.log('[DEBUG] Respuesta /approve-with-adjustment:', response.status);
            if (!response.ok) {
                 const errorData = await response.json(); throw new Error(errorData.message || 'Falló la aprobación con ajuste.');
            }
            showNotification('Cotización aprobada con ajuste.', 'success');
            removeRowAndReload(quoteId);
        } catch (error) {
            console.error('Error en handleApproveWithAdjustment:', error); showNotification(`Error: ${error.message}`, 'error');
        }
     }

    // Acción 2: Aprobar PRECIO ESTÁNDAR
    async function handleApproveStandard() {
        console.log('[DEBUG] Click en Aprobar Precio Estándar');
        const quoteId = currentQuoteIdInput.value;
        const adminComment = adminCommentInput.value.trim();

        const decisionData = { comentario: adminComment || "Aprobada con precio estándar." };
        console.log('[DEBUG] Enviando a /approve:', decisionData);

        try {
            const response = await fetch(`/api/quote-requests/${quoteId}/approve`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decisionData),
            });
            console.log('[DEBUG] Respuesta /approve:', response.status);
             if (!response.ok) {
                 const errorData = await response.json(); throw new Error(errorData.message || 'Falló la aprobación estándar.');
            }
            showNotification('Cotización aprobada con precio estándar.', 'success');
            removeRowAndReload(quoteId);
        } catch (error) {
            console.error('Error en handleApproveStandard:', error); showNotification(`Error: ${error.message}`, 'error');
        }
     }

    // Acción 3: Rechazar Cotización (DENTRO DEL MODAL)
    async function handleReject() {
        console.log('[DEBUG] Click en Rechazar Cotización');
        const quoteId = currentQuoteIdInput.value;
        const reason = adminCommentInput.value.trim();

        if (!reason) { showNotification('Debe proporcionar un motivo para el rechazo.', 'error'); return; }

        const decisionData = { reason: reason };
        console.log('[DEBUG] Enviando a /reject:', decisionData);

        try {
            const response = await fetch(`/api/quote-requests/${quoteId}/reject`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decisionData),
            });
            console.log('[DEBUG] Respuesta /reject:', response.status);
             if (!response.ok) {
                 const errorData = await response.json(); throw new Error(errorData.message || 'Falló el rechazo de la cotización.');
            }
            showNotification('Cotización rechazada.', 'success');
            removeRowAndReload(quoteId);
        } catch (error) {
            console.error('Error en handleReject:', error); showNotification(`Error: ${error.message}`, 'error');
        }
     }


    // --- Manejador para ELIMINAR desde la tabla ---
    async function handleDeleteQuote(quoteId, quoteNumber) {
        // Usar confirmación nativa (se reemplazó prompt/alert, pero confirm es aceptable aquí)
        if (!confirm(`¿Está SEGURO de que desea ELIMINAR permanentemente la cotización ${quoteNumber} (ID: ${quoteId})? Esta acción no se puede deshacer.`)) {
            return; // Cancelado por el usuario
        }

        console.log(`[DEBUG] Iniciando eliminación de quoteId ${quoteId}`);
        try {
            const response = await fetch(`/api/quote-requests/${quoteId}`, {
                method: 'DELETE',
            });
            console.log(`[DEBUG] Respuesta DELETE /api/quote-requests/${quoteId}:`, response.status);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch(e) {
                    errorData = { message: await response.text() || `Error ${response.status}` };
                }
                throw new Error(errorData.message || 'Falló la eliminación de la cotización.');
            }

            // Si la eliminación fue exitosa (status 200 o 204)
            showNotification(`Cotización ${quoteNumber} eliminada con éxito.`, 'success');
            // Eliminar la fila de la tabla sin recargar toda la página
            removeRowOnly(quoteId);

        } catch (error) {
            console.error('Error en handleDeleteQuote:', error);
            showNotification(`Error al eliminar: ${error.message}`, 'error');
        }
    }

    // --- Función Auxiliar para quitar fila DESPUÉS de aprobar/rechazar/eliminar ---
    function removeRowAndReload(quoteId) { // Usada por Aprob/Rechazar modal
        console.log(`[DEBUG] Eliminando fila ${quoteId} y cerrando modal.`);
        removeRowOnly(quoteId); // Llama a la función que solo quita la fila
        closeModal();
    }

    // --- NUEVO: Función Auxiliar que SOLO quita la fila ---
    function removeRowOnly(quoteId) {
        const rowToRemove = tbody ? tbody.querySelector(`tr[data-quote-id='${quoteId}']`) : null;
        if (rowToRemove) {
            rowToRemove.remove();
            console.log(`[DEBUG] Fila ${quoteId} eliminada de la tabla.`);
            // Revisar si la tabla quedó vacía
            if (tbody && tbody.children.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="5">No hay más cotizaciones pendientes.</td></tr>';
            }
        } else {
            console.warn(`[DEBUG] No se encontró la fila para quoteId ${quoteId} para eliminarla.`);
            // Si no se encontró (raro), recargar todo por si acaso
            loadPendingQuotes();
        }
    }


    // --- Delegación de Eventos en la Tabla ---
    if (tbody) {
        tbody.addEventListener('click', (event) => {
            const target = event.target;
            const quoteRow = target.closest('tr[data-quote-id]'); // Fila padre
            if (!quoteRow) return; // Clic fuera de una fila válida

            const quoteId = quoteRow.dataset.quoteId;
            // Intenta obtener el número de cotización desde el botón de decisión, si existe
            const decisionButtonElement = quoteRow.querySelector('.decision-btn, .approve-std-btn');
            const quoteNumber = decisionButtonElement ? decisionButtonElement.dataset.quotenumber : `ID ${quoteId}`;

            // 1. Clic en botón de decisión (Abre Modal)
            const decisionButton = target.closest('.decision-btn, .approve-std-btn');
            if (decisionButton && decisionButton.dataset.id === quoteId) {
                 console.log('[DEBUG] Clic detectado en botón de decisión:', quoteId);
                openDecisionModal(decisionButton);
                return; // Importante: salir para no procesar también el botón eliminar si está cerca
            }

            // 2. Clic en botón Eliminar (NUEVO)
            const deleteButton = target.closest('.delete-btn-table');
            if (deleteButton && deleteButton.dataset.id === quoteId) {
                 console.log('[DEBUG] Clic detectado en botón Eliminar:', quoteId);
                handleDeleteQuote(quoteId, quoteNumber); // Llama a la nueva función
                return;
            }
        });
    } else {
        console.error("CRÍTICO: Elemento tbody no encontrado al añadir listener.");
    }

    // --- Listeners de los Botones del Modal ---
    if (approveAdjBtn) approveAdjBtn.addEventListener('click', handleApproveWithAdjustment); else console.error("Botón approve-adj-btn no encontrado");
    if (approveStdBtn) approveStdBtn.addEventListener('click', handleApproveStandard); else console.error("Botón approve-std-btn no encontrado");
    if (rejectBtn) rejectBtn.addEventListener('click', handleReject); else console.error("Botón reject-btn (modal) no encontrado");


    // --- Carga Inicial ---
    loadPendingQuotes();
});

