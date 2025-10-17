document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA PARA EL FORMULARIO DE INICIO DE SESIÓN ---
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
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
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

    // --- LÓGICA PARA EL MENÚ PRINCIPAL DINÁMICO ---
    const menuContainer = document.getElementById('menu-buttons-container');
    const userNameSpan = document.getElementById('user-name');
    
    if (menuContainer) { // Si estamos en el menú principal
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            userNameSpan.textContent = user.nombre;
            
            let buttonsHTML = '';
            if (user.rol === 'Administrador') {
                buttonsHTML += '<a href="/admin_menu.html" class="nav-button">Panel de Administración</a>';
            }
            if (['Administrador', 'Coordinador', 'Asesor'].includes(user.rol)) {
                buttonsHTML += '<a href="/asesores-menu.html" class="nav-button">Módulo de Asesores</a>';
            }
            menuContainer.innerHTML = buttonsHTML;

            // Llamamos a las nuevas funciones para cargar los rankings
            loadPipelineRanking();
            loadReachRanking();
            loadConversionRanking();
            loadFollowUpRanking(); // Este se mantiene

        } else {
            window.location.href = '/login.html';
        }
    }

    // --- FUNCIÓN PARA EL PIPELINE DE VENTAS ---
    async function loadPipelineRanking() {
        const container = document.getElementById('pipeline-container');
        if (!container) return;
        try {
            const response = await fetch('/api/pipeline-ranking');
            const data = await response.json();
            let content = '<h3>📈 Pipeline de Ventas</h3>';
            content += '<div class="pipeline">';
            data.forEach(stage => {
                content += `<div class="pipeline-stage"><span>${stage.etapa_venta}</span><span class="pipeline-count">${stage.count}</span></div>`;
            });
            content += '</div>';
            container.innerHTML = content;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<h3>📈 Pipeline de Ventas</h3><p>Error al cargar datos.</p>';
        }
    }

    // --- FUNCIÓN PARA EL RANKING DE ALCANCE ---
    async function loadReachRanking() {
        const container = document.getElementById('reach-ranking-container');
        if (!container) return;
        try {
            const response = await fetch('/api/reach-ranking');
            const data = await response.json();
            let content = '<h3>🗺️ Ranking de Alcance (Centros Únicos)</h3>';
            content += '<ol>';
            data.forEach(item => {
                content += `<li>${item.advisorname}: <strong>${item.unique_centers_count} centros</strong></li>`;
            });
            content += '</ol>';
            container.innerHTML = content;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<h3>🗺️ Ranking de Alcance</h3><p>Error al cargar datos.</p>';
        }
    }

    // --- FUNCIÓN PARA EL RANKING DE TASA DE CONVERSIÓN ---
    async function loadConversionRanking() {
        const container = document.getElementById('conversion-ranking-container');
        if (!container) return;
        try {
            const response = await fetch('/api/conversion-ranking');
            const data = await response.json();
            let content = '<h3>🚀 Ranking de Eficiencia (Tasa de Conversión)</h3>';
            content += '<ol>';
            data.forEach(item => {
                content += `<li>${item.advisorname}: <strong>${parseFloat(item.conversion_rate).toFixed(1)}%</strong></li>`;
            });
            content += '</ol>';
            container.innerHTML = content;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<h3>🚀 Ranking de Eficiencia</h3><p>Error al cargar datos.</p>';
        }
    }

    // --- FUNCIÓN PARA RANKING DE SEGUIMIENTO (SE MANTIENE IGUAL) ---
    async function loadFollowUpRanking() {
        const container = document.getElementById('follow-up-ranking-container');
        if (!container) return;
        try {
            const response = await fetch('/api/advisor-follow-up-ranking');
            const rankingData = await response.json();
            if (rankingData.length === 0) {
                container.innerHTML = '<h3>⏱️ Ranking de Seguimiento (Días Promedio)</h3><p>No hay datos.</p>';
                return;
            }
            let rankingHTML = '<h3>⏱️ Ranking de Seguimiento (Días Promedio)</h3>';
            rankingData.forEach((advisor, index) => {
                let medal = '';
                if (index === 0) medal = '🥇';
                if (index === 1) medal = '🥈';
                if (index === 2) medal = '🥉';
                const days = parseFloat(advisor.average_follow_up_days).toFixed(1);
                rankingHTML += `<div class="performance-item"><span class="performance-advisor">${medal} ${advisor.advisorname}</span><span class="performance-score score-low">${days} días</span></div>`;
            });
            container.innerHTML = rankingHTML;
        } catch (error) {
            console.error("Error en Ranking de Seguimiento:", error);
            container.innerHTML = `<p style="color: #e74c3c;">No se pudo cargar el panel de seguimiento.</p>`;
        }
    }
});
