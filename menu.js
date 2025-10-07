document.addEventListener('DOMContentLoaded', () => {

    const menuContainer = document.getElementById('menu-buttons-container');
    const userNameSpan = document.getElementById('user-name');
    
    // Si estamos en el menú principal
    if (menuContainer) {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        
        // Si hay un usuario logueado, construimos el menú
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

    // --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO ---
    async function loadAdvisorPerformance() {
        const performanceContainer = document.getElementById('performance-container');
        if (!performanceContainer) return;

        const getScoreClass = (score) => {
            if (score >= 75) return 'score-high';
            if (score >= 40) return 'score-medium';
            return 'score-low';
        };

        try {
            const [formalizationRes, visitRes] = await Promise.all([
                fetch('/api/advisor-ranking'),
                fetch('/api/advisor-visit-ranking')
            ]);

            if (!formalizationRes.ok || !visitRes.ok) throw new Error('Datos base no disponibles.');

            const formalizationData = await formalizationRes.json();
            const visitData = await visitRes.json();

            if (visitData.length === 0) {
                performanceContainer.innerHTML = '<h3>Valoración de Desempeño (70/30)</h3><p>No hay datos para calcular.</p>';
                return;
            }

            const advisors = {};
            visitData.forEach(item => {
                advisors[item.advisorname] = { advisorname: item.advisorname, visit_count: parseInt(item.visit_count, 10), formalization_count: 0 };
            });
            formalizationData.forEach(item => {
                if (advisors[item.advisorname]) {
                    advisors[item.advisorname].formalization_count = parseInt(item.formalized_count, 10);
                } else {
                    advisors[item.advisorname] = { advisorname: item.advisorname, visit_count: parseInt(item.formalized_count, 10), formalization_count: parseInt(item.formalized_count, 10) };
                }
            });

            const combinedData = Object.values(advisors);
            const maxVisits = Math.max(...combinedData.map(a => a.visit_count));
            const maxFormalizations = Math.max(...combinedData.map(a => a.formalization_count));

            const performanceData = combinedData.map(advisor => {
                const visitScore = (maxVisits > 0) ? (advisor.visit_count / maxVisits) * 70 : 0;
                const formalizationScore = (maxFormalizations > 0) ? (advisor.formalization_count / maxFormalizations) * 30 : 0;
                return {
                    advisorname: advisor.advisorname,
                    performance_score: parseFloat((visitScore + formalizationScore).toFixed(1))
                };
            });

            performanceData.sort((a, b) => b.performance_score - a.performance_score);

            let performanceHTML = `
                <h3>Valoración de Desempeño (70/30)</h3>
                <p class="performance-note">Calculado con un 70% del rendimiento en Visitas y un 30% en Formalizaciones.</p>`;
            
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
            console.error("Error en loadAdvisorPerformance:", error);
            performanceContainer.innerHTML = `<p style="color: #e74c3c;">No se pudo cargar la valoración: ${error.message}</p>`;
        }
    }
});
