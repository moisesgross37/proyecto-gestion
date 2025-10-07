// --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO (VERSIÓN FINAL) ---
// --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO (VERSIÓN FINAL) ---
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
