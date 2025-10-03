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
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Corregido: Se elimina la variable 'nombre' que no se usa.
            const username = document.getElementById('new-user-username').value;
            const password = document.getElementById('new-user-password').value;
            const rol = document.getElementById('new-user-role').value;

            // Corregido: Se elimina la validación para 'nombre'.
            if (!username || !password || !rol) {
                alert('Por favor, complete todos los campos.');
                return;
            }

            try {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Corregido: Se envía solo username, password y rol, que es lo que el servidor espera.
                    body: JSON.stringify({ username, password, rol })
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

  // --- Lógica para los botones de la tabla (Corregida y Limpiada) ---
if (tableContainer) {
    tableContainer.addEventListener('click', async (e) => {
        const target = e.target;

        // Botón de Editar Rol
        if (target.classList.contains('edit-btn')) {
            const userRow = target.closest('tr');
            const userId = target.dataset.id;
            const userName = userRow.cells[0].textContent;
            // CORRECCIÓN: El rol ahora está en la segunda columna (índice 1)
            const userRole = userRow.cells[1].textContent;

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

   // Reemplaza tu función completa con esta
function mostrarUsuariosEnTabla(users) {
    if (!users || users.length === 0) {
        tableContainer.innerHTML = '<h3>Usuarios Actuales</h3><p>No hay usuarios registrados.</p>';
        return;
    }

    // Corregido: La tabla ahora solo tiene las columnas que sí existen
    let tablaHTML = `
        <h3>Usuarios Actuales</h3>
        <table class="users-table">
            <thead>
                <tr>
                    <th>Nombre de Usuario</th>
                    <th>Rol</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(user => {
        // Corregido: Se eliminan las columnas y datos que no existen ('nombre', 'estado')
        tablaHTML += `
            <tr>
                <td>${user.username}</td>
                <td>${user.rol}</td>
                <td>
                    <button class="edit-btn" data-id="${user.id}">Editar Rol</button>
                </td>
            </tr>
        `;
    });
// Llamada inicial para cargar los usuarios cuando la página esté lista
cargarUsuarios();
