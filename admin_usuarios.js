document.addEventListener('DOMContentLoaded', () => {
    const tableContainer = document.getElementById('users-table-container');
    const createForm = document.getElementById('create-user-form'); // ACTUALIZADO: Apunta al nuevo formulario

    // --- Elementos del Modal de Edición ---
    const editModal = document.getElementById('edit-role-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const editForm = document.getElementById('edit-role-form');
    const modalUserName = document.getElementById('modal-user-name');
    const modalUserIdInput = document.getElementById('modal-user-id');
    const modalUserRoleSelect = document.getElementById('modal-user-role');

    // --- Lógica para enviar el formulario de CREACIÓN de usuario ---
    // REEMPLAZADO: Toda la lógica de invitación fue sustituida por esta nueva lógica de creación.
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('new-user-nombre').value;
            const username = document.getElementById('new-user-username').value;
            const password = document.getElementById('new-user-password').value;
            const rol = document.getElementById('new-user-role').value;

            if (!nombre || !username || !password || !rol) {
                alert('Por favor, complete todos los campos.');
                return;
            }

            try {
                const response = await fetch('/api/users', { // Llama a la nueva ruta para crear usuarios
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, username, password, rol })
                });
                
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Error del servidor.');
                }
                
                alert('¡Usuario creado exitosamente!');
                createForm.reset();
                cargarUsuarios(); // Recarga la tabla para mostrar el nuevo usuario

            } catch (error) {
                alert(`Error al crear el usuario: ${error.message}`);
            }
        });
    }

    // --- Lógica para abrir y cerrar el Modal de Edición ---
    if (closeModalBtn) {
        closeModalBtn.onclick = () => { editModal.style.display = 'none'; };
    }
    window.onclick = (event) => {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
    };

    // --- Lógica para los botones de la tabla (Cambiar Estado y Editar Rol) ---
    if (tableContainer) {
        tableContainer.addEventListener('click', async (e) => {
            const target = e.target;

            // Botón de Cambiar Estado
            if (target.classList.contains('status-btn')) {
                const userId = target.dataset.id;
                const userName = target.closest('tr').querySelector('td').textContent;

                if (confirm(`¿Estás seguro de que quieres cambiar el estado del usuario "${userName}"?`)) {
                    try {
                        const response = await fetch(`/api/users/${userId}/toggle-status`, {
                            method: 'POST'
                        });
                        const result = await response.json();
                        if (!response.ok) {
                            throw new Error(result.message || 'Error en el servidor.');
                        }
                        cargarUsuarios();
                    } catch (error) {
                        alert(`Error: ${error.message}`);
                    }
                }
            }

            // Botón de Editar Rol
            if (target.classList.contains('edit-btn')) {
                const userRow = target.closest('tr');
                const userId = target.dataset.id;
                const userName = userRow.cells[0].textContent;
                const userRole = userRow.cells[2].textContent;

                // Llenar y mostrar el modal
                modalUserIdInput.value = userId;
                modalUserName.textContent = userName;
                modalUserRoleSelect.value = userRole;
                editModal.style.display = 'block';
            }
        });
    }

    // --- Lógica para guardar el cambio de Rol desde el Modal ---
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
                if (!response.ok) {
                    throw new Error(result.message || 'Error en el servidor.');
                }

                // Si tiene éxito, cerrar modal y recargar tabla
                editModal.style.display = 'none';
                cargarUsuarios();

            } catch (error) {
                alert(`Error al cambiar el rol: ${error.message}`);
            }
        });
    }

    // --- Lógica para cargar y mostrar la tabla de usuarios ---
    async function cargarUsuarios() {
        try {
            const response = await fetch('/api/users');
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const users = await response.json();
            mostrarUsuariosEnTabla(users);
        } catch (error) {
            tableContainer.innerHTML = `<p style="color: red;">Error al cargar los usuarios: ${error.message}</p>`;
        }
    }

    function mostrarUsuariosEnTabla(users) {
        if (!users || users.length === 0) {
            tableContainer.innerHTML = '<p>No hay usuarios registrados.</p>';
            return;
        }

        let tablaHTML = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
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
                    <td>
                        <button class="edit-btn" data-id="${user.id}">Editar</button>
                        <button class="status-btn" data-id="${user.id}">Cambiar Estado</button>
                    </td>
                </tr>
            `;
        });

        tablaHTML += `
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tablaHTML;
    }

    // Iniciar la carga de usuarios solo si estamos en la página correcta
    if (tableContainer) {
        cargarUsuarios();
    }
});