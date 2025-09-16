document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('set-password-form');
    const errorMessage = document.getElementById('error-message');

    // 1. Obtener el token de la URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        errorMessage.textContent = 'Error: No se encontró un token de invitación. Por favor, use el enlace de su correo.';
        form.style.display = 'none'; // Ocultar el formulario si no hay token
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = '';

        // 2. Obtener los valores del formulario
        const nombre = document.getElementById('nombre').value;
        const password = document.getElementById('password').value;
        const confirm_password = document.getElementById('confirm_password').value;

        // 3. Validar que las contraseñas coincidan
        if (password !== confirm_password) {
            errorMessage.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        if (password.length < 8) {
            errorMessage.textContent = 'La contraseña debe tener al menos 8 caracteres.';
            return;
        }

        try {
            // 4. Enviar los datos al servidor
            const response = await fetch('/api/set-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, nombre, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ocurrió un error en el servidor.');
            }

            // 5. Manejar la respuesta exitosa
            alert('¡Cuenta creada exitosamente! Ahora serás redirigido para iniciar sesión.');
            window.location.href = '/login.html'; // Redirigir a la página de login

        } catch (error) {
            errorMessage.textContent = error.message;
        }
    });
});
