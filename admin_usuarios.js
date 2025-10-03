document.addEventListener('DOMContentLoaded', () => {
    const tableContainer = document.getElementById('users-table-container');
    const createForm = document.getElementById('create-user-form');

    const editModal = document.getElementById('edit-role-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const editForm = document.getElementById('edit-role-form');
    const modalUserName = document.getElementById('modal-user-name');
    const modalUserIdInput = document.getElementById('modal-user-id');
    const modalUserRoleSelect = document.getElementById('modal-user-role');

    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Lógica de creación de usuario (la corregiremos después)
        });
    }

    if (closeModalBtn) {
        closeModalBtn.onclick = () => { editModal.style.display = 'none'; };
    }
    window.onclick = (event) => {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
    };

    if (tableContainer) {
        tableContainer.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.classList.contains('edit-btn')) {
                const userRow = target.closest('tr');
                const userId = target.dataset.id;
                // Ajustado para tomar el nombre y rol correctos de la nueva tabla
                const userName = userRow.cells[1].textContent; 
                const userRole = userRow.cells[2].textContent;

                modalUserIdInput.value = userId;
                modalUserName.textContent = userName;
                modalUserRoleSelect.value = userRole;
                editModal.style.display = 'block';
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = modalUserIdInput.value;
            const newRole = modalUserRoleSelect.value;
            try {
                const response = await fetch(`/api/users/${userId}/edit-role`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newRole })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Error en el servidor.');
                editModal.style.display = 'none';
                cargarUsuarios();
            } catch (error) {
                alert(`Error al cambiar el rol: ${error.message}`);
            }
        });
    }

    async function cargarUsuarios() {
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
            const users = await response.json();
            mostrarUsuariosEnTabla(users);
        } catch (error) {
            tableContainer.innerHTML = `<p style="color: red;">Error al cargar los usuarios: ${error.message}</p>`;
        }
    }

    function mostrarUsuariosEnTabla(users) {
        if (!users || users.length === 0) {
            tableContainer.innerHTML = '<h3>Usuarios Actuales</h3><p>No hay usuarios registrados.</p>';
            return;
        }

        // Tabla con todas las columnas correctas
        let tablaHTML = `
            <h3>Usuarios Actuales</h3>
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Nombre Completo</th>
                        <th>Nombre de Usuario</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;
        users.forEach(user => {
            tablaHTML += `
                <tr>
                    <td>${user.nombre}</td>
                    <td>${user.username}</td>
                    <td>${user.rol}</td>
                    <td><span class="status-${user.estado}">${user.estado}</span></td>
                    <td class="actions-cell">
                        <button class="btn btn-edit edit-btn" data-id="${user.id}">Editar Rol</button>
                        <button class="btn btn-toggle-status" data-id="${user.id}">Cambiar Estado</button>
                    </td>
                </tr>
            `;
        });
        tablaHTML += '</tbody></table>';
        tableContainer.innerHTML = tablaHTML;
    }

    // Llamada inicial para cargar los usuarios cuando la página esté lista
    cargarUsuarios();
}); // <-- LA LLAVE DE CIERRE QUE PROBABLEMENTE FALTABA
