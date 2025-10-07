// --- FUNCIÓN PARA CARGAR VALORACIÓN DE DESEMPEÑO (VERSIÓN FINAL) ---
async function loadAdvisorPerformance() {
    const performanceContainer = document.getElementById('performance-container');
    if (!performanceContainer) {
        console.error("DIAGNÓSTICO: No se encontró el contenedor #performance-container.");
        return;
    }

    console.log("DIAGNÓSTICO: Iniciando loadAdvisorPerformance...");

    try {
        console.log("DIAGNÓSTICO: 1. Intentando buscar datos de las APIs...");
        const [formalizationRes, visitRes] = await Promise.all([
            fetch('/api/advisor-ranking'),
            fetch('/api/advisor-visit-ranking')
        ]);
        console.log("DIAGNÓSTICO: 2. Peticiones a las APIs completadas.");

        if (!formalizationRes.ok || !visitRes.ok) {
            throw new Error('Una o ambas APIs de datos base fallaron.');
        }

        const formalizationData = await formalizationRes.json();
        const visitData = await visitRes.json();
        console.log("DIAGNÓSTICO: 3. Datos JSON recibidos con éxito.");

        if (visitData.length === 0) {
            performanceContainer.innerHTML = '<h3>Valoración de Desempeño (70/30)</h3><p>No hay visitas registradas para calcular.</p>';
            console.log("DIAGNÓSTICO: Proceso detenido porque no hay datos de visitas.");
            return;
        }

        console.log("DIAGNÓSTICO: 4. Unificando datos de asesores...");
        const advisors = {};
        visitData.forEach(item => {
            advisors[item.advisorname] = { advisorname: item.advisorname, visit_count: parseInt(item.visit_count, 10) || 0, formalization_count: 0 };
        });
        formalizationData.forEach(item => {
            const count = parseInt(item.formalized_count, 10) || 0;
            if (advisors[item.advisorname]) {
                advisors[item.advisorname].formalization_count = count;
            } else {
                advisors[item.advisorname] = { advisorname: item.advisorname, visit_count: count, formalization_count: count };
            }
        });
        const combinedData = Object.values(advisors);
        console.log("DIAGNÓSTICO: 5. Datos combinados listos para el cálculo.", combinedData);

        console.log("DIAGNÓSTICO: 6. Calculando valores máximos...");
        const maxVisits = Math.max(...combinedData.map(a => a.visit_count));
        const maxFormalizations = Math.max(...combinedData.map(a => a.formalization_count));

        console.log("DIAGNÓSTICO: 7. Calculando puntuaciones finales...");
        const performanceData = combinedData.map(advisor => {
            const visitScore = (maxVisits > 0) ? (advisor.visit_count / maxVisits) * 70 : 0;
            const formalizationScore = (maxFormalizations > 0) ? (advisor.formalization_count / maxFormalizations) * 30 : 0;
            return {
                advisorname: advisor.advisorname,
                performance_score: parseFloat((visitScore + formalizationScore).toFixed(1))
            };
        });

        performanceData.sort((a, b) => b.performance_score - a.performance_score);
        console.log("DIAGNÓSTICO: 8. Puntuaciones calculadas y ordenadas.", performanceData);

        console.log("DIAGNÓSTICO: 9. Renderizando HTML...");
        // (El resto del código para crear el HTML y mostrarlo)
        let performanceHTML = `<h3>Valoración de Desempeño (70/30)</h3><p class="performance-note">Calculado con un 70% del rendimiento en Visitas y un 30% en Formalizaciones.</p>`;
        const getScoreClass = (score) => { if (score >= 75) return 'score-high'; if (score >= 40) return 'score-medium'; return 'score-low'; };
        performanceData.forEach((advisor, index) => {
            let medal = '';
            if (index === 0) medal = '🥇'; if (index === 1) medal = '🥈'; if (index === 2) medal = '🥉';
            const scoreClass = getScoreClass(advisor.performance_score);
            performanceHTML += `<div class="performance-item"><span class="performance-advisor">${medal} ${advisor.advisorname}</span><span class="performance-score ${scoreClass}">${advisor.performance_score} / 100</span></div>`;
        });
        performanceContainer.innerHTML = performanceHTML;
        console.log("DIAGNÓSTICO: 10. ¡Proceso completado!");

    } catch (error) {
        console.error("!!! ERROR DEFINITIVO CAPTURADO en loadAdvisorPerformance:", error);
        alert("Se encontró un error. Revisa la consola para más detalles."); // Alerta para que no se nos pase.
        if(performanceContainer) {
            performanceContainer.innerHTML = `<p style="color: red; font-weight: bold;">Se encontró un error al calcular el desempeño. Revisa la consola (F12).</p>`;
        }
    }
}
