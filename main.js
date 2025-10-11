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
            if (['Administrador', 'Coordinador', 'Asesor'].includes(user.rol)) {
                buttonsHTML += '<a href="/asesores-menu.html" class="nav-button">Módulo de Asesores</a>';
            }
            menuContainer.innerHTML = buttonsHTML;

            // 2. Cargar los tres paneles de rankings
            loadAdvisorRanking();
            loadAdvisorVisitRanking();
            loadAdvisorPerformance();
            loadFollowUpRanking();

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
                rankingContainer.innerHTML = '<h3>Líderes de Formalización</h3><p>Aún no hay datos.</p>';
                return;
            }
            let rankingHTML = '<h3>Líderes de Formalización</h3>';
            const maxCount = rankingData[0].formalized_count;
            rankingData.forEach(advisor => {
                const percentage = maxCount > 0 ? (advisor.formalized_count / maxCount) * 100 : 0;
                rankingHTML += `<div class="advisor-ranking-item"><div class="advisor-info"><span class="advisor-name">${advisor.advisorname}</span><span class="advisor-count">${advisor.formalized_count}</span></div><div class="progress-bar-container"><div class="progress-bar" style="width: ${percentage}%;"></div></div></div>`;
            });
            rankingContainer.innerHTML = rankingHTML;
        } catch (error) {
            console.error(error);
            rankingContainer.innerHTML = `<p style="color: #e74c3c;">Error al cargar panel de formalizaciones.</p>`;
        }
    }

    // --- FUNCIÓN PARA CARGAR RANKING DE VISITAS TOTALES ---
    async function loadAdvisorVisitRanking() {
        const visitRankingContainer = document.getElementById('visit-ranking-container');
        if (!visitRankingContainer) return;
        try {
            const response = await fetch('/api/advisor-visit-ranking');
            if (!response.ok) throw new Error('No se pudo cargar el ranking.');
            const rankingData = await response.json();
            if (rankingData.length === 0) {
                visitRankingContainer.innerHTML = '<h3>Líderes de Visitas</h3><p>Aún no hay visitas.</p>';
                return;
            }
            let rankingHTML = '<h3>Líderes de Visitas</h3>';
            const maxCount = rankingData[0].visit_count;
            rankingData.forEach(advisor => {
                const percentage = maxCount > 0 ? (advisor.visit_count / maxCount) * 100 : 0;
                rankingHTML += `<div class="advisor-ranking-item"><div class="advisor-info"><span class="advisor-name">${advisor.advisorname}</span><span class="advisor-count">${advisor.visit_count}</span></div><div class="progress-bar-container"><div class="progress-bar" style="width: ${percentage}%;"></div></div></div>`;
            });
            visitRankingContainer.innerHTML = rankingHTML;
        } catch (error) {
            console.error(error);
            visitRankingContainer.innerHTML = `<p style="color: #e74c3c;">Error al cargar panel de visitas.</p>`;
        }
    }

    // --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO (LÓGICA EN CLIENTE) ---
    // --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO (FÓRMULA 40/20/40) ---
async function loadAdvisorPerformance() {
    const performanceContainer = document.getElementById('performance-container');
    if (!performanceContainer) return;

    const getScoreClass = (score) => {
        if (score >= 75) return 'score-high';
        if (score >= 40) return 'score-medium';
        return 'score-low';
    };

    try {
        // 1. Pedimos los datos a las TRES fuentes
        const [formalizationRes, visitRes, followUpRes] = await Promise.all([
            fetch('/api/advisor-ranking'),
            fetch('/api/advisor-visit-ranking'),
            fetch('/api/advisor-follow-up-ranking')
        ]);

        if (!formalizationRes.ok || !visitRes.ok || !followUpRes.ok) throw new Error('Datos base no disponibles.');

        const formalizationData = await formalizationRes.json();
        const visitData = await visitRes.json();
        const followUpData = await followUpRes.json();

        if (visitData.length === 0) {
            performanceContainer.innerHTML = '<h3>Valoración de Desempeño</h3><p>No hay datos para calcular.</p>';
            return;
        }

        // 2. Unificamos todos los datos
        const advisors = {};
        visitData.forEach(item => {
            advisors[item.advisorname] = {
                advisorname: item.advisorname,
                visit_count: parseInt(item.visit_count, 10),
                formalization_count: 0,
                average_follow_up_days: null // Valor inicial
            };
        });
        formalizationData.forEach(item => {
            if (advisors[item.advisorname]) {
                advisors[item.advisorname].formalization_count = parseInt(item.formalized_count, 10);
            }
        });
        followUpData.forEach(item => {
            if (advisors[item.advisorname]) {
                advisors[item.advisorname].average_follow_up_days = parseFloat(item.average_follow_up_days);
            }
        });

        const combinedData = Object.values(advisors);

        // 3. Calculamos la nueva fórmula 40/20/40
        const maxVisits = Math.max(...combinedData.map(a => a.visit_count));
        const maxFormalizations = Math.max(...combinedData.map(a => a.formalization_count));
        
        // Para el seguimiento, necesitamos el mejor (min) y el peor (max) para invertir la escala
        const followUpDays = combinedData.filter(a => a.average_follow_up_days !== null).map(a => a.average_follow_up_days);
        const minFollowUpDays = Math.min(...followUpDays);
        const maxFollowUpDays = Math.max(...followUpDays);

        const performanceData = combinedData.map(advisor => {
            // Puntuación de Visitas (40%)
            const visitScore = (maxVisits > 0) ? (advisor.visit_count / maxVisits) * 40 : 0;
            
            // Puntuación de Formalizaciones (20%)
            const formalizationScore = (maxFormalizations > 0) ? (advisor.formalization_count / maxFormalizations) * 20 : 0;

            // Puntuación de Seguimiento (40%) - El que tiene menos días (mejor) saca más puntos.
            let followUpScore = 0;
            if (advisor.average_follow_up_days !== null) {
                if (maxFollowUpDays === minFollowUpDays) { // Si solo hay un asesor o todos tienen el mismo tiempo
                    followUpScore = 40;
                } else {
                    // Invertimos la escala: (peor - actual) / (peor - mejor)
                    followUpScore = ((maxFollowUpDays - advisor.average_follow_up_days) / (maxFollowUpDays - minFollowUpDays)) * 40;
                }
            }

            const totalScore = visitScore + formalizationScore + followUpScore;
            return {
                advisorname: advisor.advisorname,
                performance_score: parseFloat(totalScore.toFixed(1))
            };
        });

        performanceData.sort((a, b) => b.performance_score - a.performance_score);

        // 4. Mostramos los resultados
        let performanceHTML = `
            <h3>Valoración de Desempeño</h3>
            <p class="performance-note">Relacion entre Visitas, Formalizaciones  y Seguimiento</p>`;
        
        performanceData.forEach((advisor, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            if (index === 1) medal = '🥈';
            if (index === 2) medal = '🥉';
            const scoreClass = getScoreClass(advisor.performance_score);
            performanceHTML += `
                <div class="performance-item"><span class="performance-advisor">${medal} ${advisor.advisorname}</span><span class="performance-score ${scoreClass}">${advisor.performance_score} / 100</span></div>`;
        });
        performanceContainer.innerHTML = performanceHTML;

    } catch (error) {
        console.error("Error en Valoración de Desempeño:", error);
        performanceContainer.innerHTML = `<p style="color: #e74c3c;">No se pudo cargar la valoración: ${error.message}</p>`;
    }
}
    
});
