document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculateBtn');
    const productIdInput = document.getElementById('productIdInput');
    const studentCountInput = document.getElementById('studentCountInput');
    const resultsDiv = document.getElementById('resultados');

    calculateBtn.addEventListener('click', () => {
        const productId = productIdInput.value;
        const studentCount = parseInt(studentCountInput.value, 10);

        if (!productId || isNaN(studentCount)) {
            resultsDiv.innerHTML = '<p>Por favor, ingrese un ID de producto y una cantidad de alumnos válida.</p>';
            return;
        }

        const data = {
            productId: productId,
            studentCount: studentCount
        };

        fetch('/api/quotes/calculate-estimate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en la solicitud: ${response.statusText}`);
            }
            return response.json();
        })
        .then(result => {
            resultsDiv.innerHTML = `
                <h3>Detalles del Cálculo:</h3>
                <pre>${JSON.stringify(result, null, 2)}</pre>
            `;
        })
        .catch(error => {
            console.error('Error al calcular:', error);
            resultsDiv.innerHTML = `<p>Ocurrió un error al realizar el cálculo: ${error.message}</p>`;
        });
    });
});
