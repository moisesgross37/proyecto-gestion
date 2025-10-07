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
            console.log("Usuario no encontrado, redirigiendo al login...");
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

    // --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO (VERSIÓN DE PRUEBA) ---
    async function loadAdvisorPerformance() {
        const performanceContainer = document.getElementById('performance-container');
        
        // Si no encuentra el contenedor, lo notifica en la consola.
        if (!performanceContainer) {
            console.error("ERROR CRÍTICO: No se encontró el div #performance-container en index.html.");
            return;
        }
        
        // Esta prueba simplemente escribe un mensaje directamente en el panel.
        performanceContainer.innerHTML = `
            <h3>Valoración de Desempeño (70/30)</h3>
            <p style="color: blue; font-weight: bold; text-align: center; padding: 20px;">
                PRUEBA: La función se está ejecutando.
            </p>
        `;
    }
});
