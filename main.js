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

    // --- LÓGICA DEL MENÚ PRINCIPAL (OPTIMIZADA: VISIBILIDAD POR ROL) ---
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

        // Panel de Pulso (Solo jefes)
        if (user.rol === 'Administrador' || user.rol === 'Coordinador') {
            document.getElementById('team-pulse-panel').style.display = 'block';
            loadTeamPulsePanel();
        }

        // --- GESTIÓN DE RANKINGS ---
        
        // 1. EL ICE LO VEN TODOS (Es la meta principal del mes)
        loadIceRanking();

        // 2. LOS DEMÁS RANKINGS: VISIBILIDAD CONDICIONAL
        loadConversionRanking();
        if (['Administrador', 'Coordinador'].includes(user.rol)) {
            // Si es Jefe: Cargar toda la data para análisis
            loadStrategicPerformanceIndex(); // Histórico
            loadPipelineRanking();
            loadReachRanking();
            
            loadFollowUpRanking();
        } else {
            // Si es Asesor: OCULTAR los contenedores vacíos para que no estorben
            const idsToHide = [
                'strategic-performance-container',
                'pipeline-container',
                'reach-ranking-container',
                
                'follow-up-ranking-container'
            ];
            idsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
    }

    // --- NUEVAS FUNCIONES DE RANKING ---

    async function loadTeamPulsePanel() {
    // Apuntamos al 'div' principal del panel complejo
    const container = document.getElementById('team-pulse-panel'); 
    
    try {
        // --- INICIO DE LA CORRECCIÓN ---
        // Cambiamos la ruta incorrecta ('/api/team-pulse')
        // por la ruta CORRECTA que SÍ tiene los datos para este panel.
        const response = await fetch('/api/coordinator/team-performance');
        // --- FIN DE LA CORRECCIÓN ---

        const data = await response.json();

        // Ahora llenamos los IDs correctos que están en tu index.html
        document.getElementById('team-closing-rate').textContent = `${data.teamClosingRate}%`;
        document.getElementById('team-follow-up-average').textContent = `${data.teamAverageFollowUpDays} días`;
        
        document.getElementById('top-performer-name').textContent = data.topPerformer.name;
        document.getElementById('top-performer-days').textContent = `${data.topPerformer.days} días`;
        
        document.getElementById('improvement-opportunity-name').textContent = data.improvementOpportunity.name;
        document.getElementById('improvement-opportunity-days').textContent = `${data.improvementOpportunity.days} días`;
        
    } catch (error) { 
        console.error('Error al cargar Panel de Desempeño:', error);
        container.innerHTML = '<p>Error al cargar el Panel de Desempeño.</p>'; 
    }
}

   // === INICIO: NUEVA FUNCIÓN ICE (REEMPLAZA A BONO QUINCENAL) ===
    async function loadIceRanking() {
        const container = document.getElementById('bono-quincenal-container'); // Mantenemos el mismo ID del HTML
        if (!container) return;

        try {
            // 1. CONECTAMOS A LA NUEVA RUTA MENSUAL
            const response = await fetch('/api/ide-mensual-eficiente'); 
            const ranking = await response.json();
            
            // 2. NUEVO TÍTULO PROFESIONAL
            let content = `
                <h3 style="margin-bottom: 5px;">🧬 Índice de Compromiso Empresarial (ICE)</h3>
                <p style="font-size: 0.8em; color: #666; margin-bottom: 15px;">Eficiencia y Resultados del Mes</p>
            `;

            if (ranking.length === 0) {
                content += '<p style="text-align:center; color: #999;">Iniciando mes... Aún no hay datos.</p>';
            } else {
                ranking.forEach((advisor, index) => {
                    // 1. Iconos de medalla
                    let rankIcon = `#${index + 1}`;
                    if (index === 0) rankIcon = '🥇';
                    if (index === 1) rankIcon = '🥈';
                    if (index === 2) rankIcon = '🥉';

                    // 2. Colores según porcentaje de meta
                    const percent = parseFloat(advisor.percentage_bar);
                    let barColor = '#e74c3c'; // Rojo
                    if (percent >= 40) barColor = '#f1c40f'; // Amarillo
                    if (percent >= 70) barColor = '#2ecc71'; // Verde Bueno
                    if (percent >= 100) barColor = '#27ae60'; // Verde Éxito

                    // --- CÁLCULO VISUAL ---
                    const castigoAbandono = advisor.details.abandonados * 10; 

                    // --- CONSTRUCCIÓN DE LA FILA (FINAL: CON VISITAS FALLIDAS) ---
                    content += `
                        <div style="margin-bottom: 15px; background: #fff; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span style="font-weight: bold; font-size: 1rem; color: #333;">${rankIcon} ${advisor.advisorname}</span>
                                <span style="background: #333; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; font-weight: bold;">${advisor.performance_score} Pts</span>
                            </div>
                            
                            <div style="width: 100%; background-color: #eee; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                                <div style="width: ${percent}%; background-color: ${barColor}; height: 100%;"></div>
                            </div>
                            
                            <div style="font-size: 0.8em; color: #555;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                                    <span>🛒 Ventas: <strong style="color: #27ae60;">${advisor.details.ventas}</strong></span>
                                    <span>📄 Coti: <strong>${advisor.details.descargas}</strong></span>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between;">
                                    <span>
                                        🤝 Efec: <strong>${advisor.details.visitas}</strong>
                                        ${advisor.details.fallidas > 0 ? `<span style="color: #c0392b; font-weight: bold; margin-left: 3px;">(❌ ${advisor.details.fallidas})</span>` : ''}
                                    </span>
                                    
                                    <span style="color: ${advisor.details.abandonados > 0 ? '#e74c3c' : '#aaa'}; font-weight: ${advisor.details.abandonados > 0 ? 'bold' : 'normal'};">
                                        ${advisor.details.abandonados > 0 ? '⚠️' : '✓'} Aband: ${advisor.details.abandonados} 
                                        ${advisor.details.abandonados > 0 ? `(-${castigoAbandono})` : ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            container.innerHTML = content;
            
        } catch (error) { 
            console.error('Error al cargar ICE:', error);
            container.innerHTML = '<h3>🧬 ICE Mensual</h3><p>Error de conexión.</p>'; 
        }
    }
    // === FIN: NUEVA FUNCIÓN ICE ===
    async function loadStrategicPerformanceIndex() {
    const container = document.getElementById('strategic-performance-container'); 
    
    const getScoreClass = (score) => {
        if (score >= 75) return 'score-high';
        if (score >= 50) return 'score-medium';
        return 'score-low';
    };
    
    try {
        const response = await fetch('/api/ide-historico'); // <-- Corregido
        const data = await response.json();
        let content = '<h3>🏆 IDE Histórico</h3>'; // <-- Corregido
        data.forEach((item, index) => {
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            const score = parseFloat(item.performance_score).toFixed(1);
            content += `<div class="performance-item"><span class="performance-advisor">${medal} ${item.advisorname}</span><span class="performance-score ${getScoreClass(score)}">${score} / 100</span></div>`;
        });
        container.innerHTML = content;
        
    } catch (error) { 
        container.innerHTML = '<h3>🏆 IDE Histórico</h3><p>Error al cargar.</p>'; // <-- Corregido
        console.error('Error al cargar IDE Histórico:', error);
    }
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