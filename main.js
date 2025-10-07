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

            // 2. Cargar y mostrar los tres rankings
            loadAdvisorRanking();
            loadAdvisorVisitRanking();
            loadAdvisorPerformance(); 

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

    // --- FUNCIÓN PARA CARGAR RANKING DE VISITAS TOTALES ---
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

   // --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO (CON EXPLICACIÓN) ---
async function loadAdvisorPerformance() {
    const performanceContainer = document.getElementById('performance-container');
    if (!performanceContainer) {
        console.error("No se encontró el contenedor #performance-container. Saliendo.");
        return;
    }

    console.log("1. Iniciando loadAdvisorPerformance...");

    const getScoreClass = (score) => {
        if (score >= 75) return 'score-high';
        if (score >= 40) return 'score-medium';
        return 'score-low';
    };

    try {
        console.log("2. Obteniendo datos de las APIs...");
        const [formalizationRes, visitRes] = await Promise.all([
            fetch('/api/advisor-ranking'),
            fetch('/api/advisor-visit-ranking')
        ]);

        if (!formalizationRes.ok || !visitRes.ok) {
            throw new Error('No se pudieron cargar los datos base para el cálculo.');
        }

        const formalizationData = await formalizationRes.json();
        const visitData = await visitRes.json();
        console.log("3. Datos recibidos:", { formalizationData, visitData });

        if (visitData.length === 0) {
            performanceContainer.innerHTML = '<h3>Valoración de Desempeño (70/30)</h3><p>No hay visitas registradas para calcular.</p>';
            console.log("Proceso detenido: no hay datos de visitas.");
            return;
        }

        console.log("4. Unificando datos...");
        const advisors = {};
        visitData.forEach(item => {
            advisors[item.advisorname] = {
                advisorname: item.advisorname,
                visit_count: parseInt(item.visit_count, 10),
                formalization_count: 0
            };
        });
        formalizationData.forEach(item => {
            if (advisors[item.advisorname]) {
                advisors[item.advisorname].formalization_count = parseInt(item.formalized_count, 10);
            }
        });
        const combinedData = Object.values(advisors);
        console.log("5. Datos combinados:", combinedData);
        
        console.log("6. Calculando puntuaciones...");
        const maxVisits = Math.max(...combinedData.map(a => a.visit_count));
        const maxFormalizations = Math.max(...combinedData.map(a => a.formalization_count));

        const performanceData = combinedData.map(advisor => {
            const visitScore = (maxVisits > 0) ? (advisor.visit_count / maxVisits) * 70 : 0;
            const formalizationScore = (maxFormalizations > 0) ? (advisor.formalization_count / maxFormalizations) * 30 : 0;
            const totalScore = visitScore + formalizationScore;
            return {
                advisorname: advisor.advisorname,
                performance_score: parseFloat(totalScore.toFixed(1))
            };
        });
        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        console.log("7. Datos finales con puntuación:", performanceData);

        console.log("8. Renderizando HTML...");
        let performanceHTML = `...`; // (El HTML se genera aquí)
        performanceContainer.innerHTML = performanceHTML;
        console.log("9. ¡Proceso completado con éxito!");


    } catch (error) {
        console.error("!!! ERROR CAPTURADO en loadAdvisorPerformance:", error);
        performanceContainer.innerHTML = `<p style="color: #e74c3c;">No se pudo cargar la valoración de desempeño: ${error.message}</p>`;
    }
}
        performanceData.sort((a, b) => b.performance_score - a.performance_score);

        // 4. MOSTRAMOS LOS RESULTADOS
        let performanceHTML = `
            <h3>Valoración de Desempeño (70/30)</h3>
            <p class="performance-note">
                Calculado con un 70% del rendimiento en Visitas y un 30% en Formalizaciones.
            </p>
        `;
        
        performanceData.forEach((advisor, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            if (index === 1) medal = '🥈';
            if (index === 2) medal = '🥉';
            const scoreClass = getScoreClass(advisor.performance_score);
            performanceHTML += `
                <div class="performance-item">
                    <span class="performance-advisor">${medal} ${advisor.advisorname}</span>
                    <span class="performance-score ${scoreClass}">${advisor.performance_score} / 100</span>
                </div>
            `;
        });
        performanceContainer.innerHTML = performanceHTML;

    } catch (error) {
        console.error("Error en loadAdvisorPerformance:", error);
        performanceContainer.innerHTML = `<p style="color: #e74c3c;">No se pudo cargar la valoración de desempeño: ${error.message}</p>`;
    }
}});
