document.addEventListener('DOMContentLoaded', () => {
    console.log('Script app.js cargado correctamente.'); // Log para verificar la carga
    const advisorSelect = document.getElementById('asesor-select');
    const centersDatalist = document.getElementById('centers-datalist');
    const centerInput = document.getElementById('center-name');
    const zoneSelect = document.getElementById('zone-name');
    const contactNameInput = document.getElementById('contact-name');
    const contactNumberInput = document.getElementById('contact-number');
    const commentsSelect = document.getElementById('comments');
    const form = document.getElementById('visit-form');
    const successMessage = document.getElementById('success-message');

    let centersData = [];

    // Cargar datos iniciales (asesores y centros)
    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            centersData = data.centers;

            // Poblar select de asesores
            data.advisors.forEach(advisor => {
                const option = document.createElement('option');
                option.value = advisor.name;
                option.textContent = advisor.name;
                advisorSelect.appendChild(option);
            });

            // Poblar datalist de centros
            data.centers.forEach(center => {
                const option = document.createElement('option');
                option.value = center.name;
                centersDatalist.appendChild(option);
            });

            // Poblar select de zonas
            data.zones.forEach(zone => {
                const option = document.createElement('option');
                option.value = zone.name;
                option.textContent = zone.name;
                zoneSelect.appendChild(option);
            });

            // Poblar select de comentarios
            data.predefinedComments.forEach(comment => {
                const option = document.createElement('option');
                option.value = comment.name;
                option.textContent = comment.name;
                commentsSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error al cargar datos iniciales:', error));

    // Evento para autocompletar datos del centro
    centerInput.addEventListener('input', () => {
        const selectedCenterName = centerInput.value;
        const selectedCenter = centersData.find(center => center.name.toLowerCase() === selectedCenterName.toLowerCase());

        if (selectedCenter) {
            contactNameInput.value = selectedCenter.contactName || '';
            contactNumberInput.value = selectedCenter.contactNumber || '';
        } else {
            // Si el nombre no coincide con ningún centro existente, limpiar los campos
            contactNameInput.value = '';
            contactNumberInput.value = '';
        }
    });

    // Evento para enviar el formulario
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const visitData = Object.fromEntries(formData.entries()); // Esto es correcto

        // Enviar los datos al servidor para guardarlos
        fetch('/api/visits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(visitData),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Visita registrada:', data);
            successMessage.classList.remove('hidden');
            form.reset();
            setTimeout(() => successMessage.classList.add('hidden'), 5000);
        })
        .catch(error => console.error('Error al registrar la visita:', error));
    });
});