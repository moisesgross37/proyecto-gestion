document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE LOGIN Y LOGOUT (SIN CAMBIOS) ---
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
            } catch (error) { errorMessage.textContent = 'No se pudo conectar con el servidor.'; }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    // --- LÓGICA DEL MENÚ PRINCIPAL ---
    const menuContainer = document.getElementById('menu-buttons-container');
    if (menuContainer) {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        
        document.getElementById('user-name').textContent = user.nombre;
        
        let buttonsHTML = '';
        if (user.rol === 'Administrador') buttonsHTML += '<a href="/admin_menu.html" class="nav-button">Panel de Administración</a>';
        if (['Administrador', 'Coordinador', 'Asesor'].includes(user.rol)) buttonsHTML += '<a href="/asesores-menu.html" class="nav-button">Módulo de Asesores</a>';
        menuContainer.innerHTML = buttonsHTML;

        // Decidir qué paneles mostrar
        if (user.rol === 'Administrador' || user.rol === 'Coordinador') {
            document.getElementById('team-pulse-panel').style.display = 'block';
            loadTeamPulsePanel();
        }

        // Cargar todos los rankings
        loadStrategicPerformanceIndex();
        loadPipelineRanking();
        loadReachRanking();
        loadConversionRanking();
        loadFollowUpRanking();
    }

    // --- NUEVAS FUNCIONES DE RANKING ---

    async function loadTeamPulsePanel() {
        const container = document.getElementById('team-pulse-panel');
        try {
            const response = await fetch('/api/team-pulse');
            const data = await response.json();
            container.innerHTML = `
                <h3>❤️ Pulso del Equipo</h3>
                <div class="team-pulse-grid">
                    <div><strong>Prospectos Activos:</strong> <span>${data.activeProspects}</span></div>
                    <div><strong>Tasa de Conversión:</strong> <span>${data.overallConversionRate}%</span></div>
                    <div><strong>Ciclo de Venta Promedio:</strong> <span>${data.averageSalesCycle} días</span></div>
                    <div><strong>Principal Cuello de Botella:</strong> <span>${data.mainBottleneck}</span></div>
                </div>
            `;
        } catch (error) { container.innerHTML = '<h3>❤️ Pulso del Equipo</h3><p>Error al cargar.</p>'; }
    }

    async function loadStrategicPerformanceIndex() {
        const container = document.getElementById('strategic-performance-container');
        const getScoreClass = (score) => {
            if (score >= 75) return 'score-high';
            if (score >= 50) return 'score-medium';
            return 'score-low';
        };
        try {
            const response = await fetch('/api/strategic-performance-index');
            const data = await response.json();
            let content = '<h3>🏆 Índice de Desempeño Estratégico (IDE)</h3>';
            data.forEach((item, index) => {
                let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                const score = parseFloat(item.performance_score).toFixed(1);
                content += `<div class="performance-item"><span class="performance-advisor">${medal} ${item.advisorname}</span><span class="performance-score ${getScoreClass(score)}">${score} / 100</span></div>`;
            });
            container.innerHTML = content;
        } catch (error) { container.innerHTML = '<h3>🏆 IDE</h3><p>Error al cargar.</p>'; }
    }
    
    // --- FUNCIONES DE RANKING ANTERIORES (CON MEJORAS VISUALES) ---

    async function loadPipelineRanking() {
        const container = document.getElementById('pipeline-container');
        try {
            const response = await fetch('/api/pipeline-ranking');
            const data = await response.json();
            let content = '<h3>📈 Pipeline de Ventas</h3>';
            data.forEach(stage => {
                content += `<div class="performance-item"><span>${stage.etapa_venta}</span><span>${stage.count}</span></div>`;
            });
            container.innerHTML = content;
        } catch (error) { container.innerHTML = '<h3>📈 Pipeline</h3><p>Error.</p>'; }
    }

    async function loadReachRanking() {
        const container = document.getElementById('reach-ranking-container');
        try {
            const response = await fetch('/api/reach-ranking');
            const data = await response.json();
            let content = '<h3>🗺️ Ranking de Alcance (Centros Únicos)</h3>';
            data.forEach((item, index) => {
                content += `<div class="performance-item"><span>${index + 1}. ${item.advisorname}</span><span>${item.unique_centers_count}</span></div>`;
            });
            container.innerHTML = content;
        } catch (error) { container.innerHTML = '<h3>🗺️ Alcance</h3><p>Error.</p>'; }
    }

    async function loadConversionRanking() {
        const container = document.getElementById('conversion-ranking-container');
        try {
            const response = await fetch('/api/conversion-ranking');
            const data = await response.json();
            let content = '<h3>🚀 Tasa de Conversión</h3>';
            data.forEach((item, index) => {
                const rate = parseFloat(item.conversion_rate).toFixed(1);
                content += `<div class="performance-item"><span>${index + 1}. ${item.advisorname}</span><span>${rate}%</span></div>`;
            });
            container.innerHTML = content;
        } catch (error) { container.innerHTML = '<h3>🚀 Conversión</h3><p>Error.</p>'; }
    }

    async function loadFollowUpRanking() {
        const container = document.getElementById('follow-up-ranking-container');
        try {
            const response = await fetch('/api/advisor-follow-up-ranking');
            const data = await response.json();
            let content = '<h3>⏱️ Ranking de Seguimiento (Días Promedio)</h3>';
            data.forEach((item, index) => {
                let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                const days = parseFloat(item.average_follow_up_days).toFixed(1);
                content += `<div class="performance-item"><span class="performance-advisor">${medal} ${item.advisorname}</span><span class="performance-score score-low">${days} días</span></div>`;
            });
            container.innerHTML = content;
        } catch (error) { container.innerHTML = '<h3>⏱️ Seguimiento</h3><p>Error.</p>'; }
    }
});
