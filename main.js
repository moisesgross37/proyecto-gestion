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
            
            // 1. Cargar botones del menú
            let buttonsHTML = '';
            if (user.rol === 'Administrador') {
                buttonsHTML += '<a href="/admin_menu.html" class="nav-button">Panel de Administración</a>';
            }
            if (['Administrador', 'Coordinador', 'Asesor', 'Colaborador / Staff'].includes(user.rol)) {
                buttonsHTML += '<a href="/asesores-menu.html" class="nav-button">Módulo de Asesores</a>';
            }
            menuContainer.innerHTML = buttonsHTML;

            // 2. Cargar y mostrar los rankings
            loadAdvisorRanking();
            loadAdvisorVisitRanking(); // Llamada a la nueva función

        } else {
            // Si no hay usuario, redirigir al login
            window.location.href = '/login.html';
        }
    }

    // --- FUNCIÓN PARA CARGAR RANKING DE FORMALIZACIONES ---
    async function loadAdvisorRanking() {
        const rankingContainer = document.getElementById('ranking-container');
        if (!rankingContainer) return;

        try {
            const response = await fetch('/api/advisor-ranking');
            if (!response.ok) throw new Error('No se pudo cargar el ranking.');
            
            const rankingData = await response.json();

            if (rankingData.length === 0) {
                rankingContainer.innerHTML = '<h3>Líderes de Formalización</h3><p>Aún no hay datos de formalización registrados.</p>';
                return;
            }

            let rankingHTML = '<h3>Líderes de Formalización</h3>';
            const maxCount = rankingData[0].formalized_count;

            rankingData.forEach(advisor => {
                const percentage = maxCount > 0 ? (advisor.formalized_count / maxCount) * 100 : 0;
                rankingHTML += `
                    <div class="advisor-ranking-item">
                        <div class="advisor-info">
                            <span class="advisor-name">${advisor.advisorname}</span>
                            <span class="advisor-count">${advisor.formalized_count}</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${percentage}%;"></div>
                        </div>
                    </div>
                `;
            });
            rankingContainer.innerHTML = rankingHTML;

        } catch (error) {
            console.error(error);
            rankingContainer.innerHTML = '<p style="color: #e74c3c;">No se pudo cargar el panel de rendimiento.</p>';
        }
    }

    // --- NUEVA FUNCIÓN PARA CARGAR RANKING DE VISITAS TOTALES ---
    async function loadAdvisorVisitRanking() {
        const visitRankingContainer = document.getElementById('visit-ranking-container');
        if (!visitRankingContainer) return;

        try {
            const response = await fetch('/api/advisor-visit-ranking');
            if (!response.ok) throw new Error('No se pudo cargar el ranking de visitas.');
            
            const rankingData = await response.json();

            if (rankingData.length === 0) {
                visitRankingContainer.innerHTML = '<h3>Líderes de Visitas</h3><p>Aún no hay visitas registradas.</p>';
                return;
            }

            let rankingHTML = '<h3>Líderes de Visitas</h3>';
            const maxCount = rankingData[0].visit_count;

            rankingData.forEach(advisor => {
                const percentage = maxCount > 0 ? (advisor.visit_count / maxCount) * 100 : 0;
                rankingHTML += `
                    <div class="advisor-ranking-item">
                        <div class="advisor-info">
                            <span class="advisor-name">${advisor.advisorname}</span>
                            <span class="advisor-count">${advisor.visit_count}</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${percentage}%;"></div>
                        </div>
                    </div>
                `;
            });
            visitRankingContainer.innerHTML = rankingHTML;

        } catch (error) {
            console.error(error);
            visitRankingContainer.innerHTML = '<p style="color: #e74c3c;">No se pudo cargar el panel de visitas.</p>';
        }
    }
});
