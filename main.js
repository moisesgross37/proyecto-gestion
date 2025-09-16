document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA PARA EL FORMULARIO DE INICIO DE SESIÓN ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // CORREGIDO: Se captura 'username' en lugar de 'email'
            const username = document.getElementById('username').value; 
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('error-message');

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // CORREGIDO: Se envía 'username' al servidor
                    body: JSON.stringify({ username, password }), 
                });
                const data = await response.json();

                if (response.ok) {
                    // MANTENIDO: Usamos 'currentUser' porque el menú y logout dependen de él
                    localStorage.setItem('currentUser', JSON.stringify(data.user)); 
                    // MANTENIDO: Redirige a index.html donde está el menú principal
                    window.location.href = '/index.html'; 
                } else {
                    errorMessage.textContent = data.message || 'Error al iniciar sesión.';
                }
            } catch (error) {
                errorMessage.textContent = 'No se pudo conectar con el servidor.';
            }
        });
    }

    // --- LÓGICA PARA EL BOTÓN DE CERRAR SESIÓN (SIN CAMBIOS) ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                if (response.ok) {
                    localStorage.removeItem('currentUser');

                    alert('Sesión cerrada exitosamente.');
                    window.location.href = '/login.html';
                } else {
                    alert('Error al intentar cerrar sesión.');
                }
            } catch (error) { console.error('Error de red al cerrar sesión:', error); }
        });
    }

    // --- LÓGICA PARA EL MENÚ PRINCIPAL DINÁMICO (SIN CAMBIOS) ---
    const menuContainer = document.getElementById('menu-buttons-container');
    const userNameSpan = document.getElementById('user-name');
    if (menuContainer) {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            userNameSpan.textContent = user.nombre;
            let buttonsHTML = '';
            
            // Construir botones según el rol
            if (user.rol === 'Administrador') {
                buttonsHTML += '<a href="/admin_menu.html" class="nav-button">Panel de Administración</a>';
            }
            if (['Administrador', 'Coordinador', 'Asesor', 'Colaborador / Staff'].includes(user.rol)) {
                 buttonsHTML += '<a href="/asesores-menu.html" class="nav-button">Módulo de Asesores</a>';
            }
            if (['Administrador', 'Coordinador', 'Asesor', 'Diseñador', 'Colaborador / Staff'].includes(user.rol)) {
                // buttonsHTML += '<a href="/logistica-menu.html" class="nav-button">Módulo de Logística</a>';
            }
            
            menuContainer.innerHTML = buttonsHTML;
        } else {
            window.location.href = '/login.html';
        }
    }
});