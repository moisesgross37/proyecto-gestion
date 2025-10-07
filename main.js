document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA EXCLUSIVA PARA EL FORMULARIO DE INICIO DE SESIÓN ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('error-message');
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    // Guardar los datos del usuario para que el menú los pueda leer
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    // Redirigir al menú principal
                    window.location.href = '/index.html';
                } else {
                    errorMessage.textContent = data.message || 'Error al iniciar sesión.';
                }
            } catch (error) {
                errorMessage.textContent = 'No se pudo conectar con el servidor.';
            }
        });
    }

    // --- LÓGICA PARA EL BOTÓN DE CERRAR SESIÓN ---
    // (Se mueve a menu.js ya que solo aparece en el menú principal)

});
