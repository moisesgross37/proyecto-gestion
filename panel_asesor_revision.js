document.addEventListener('DOMContentLoaded', () => {
    const projectList = document.getElementById('project-list');

    const loadProjects = async () => {
        try {
            const response = await fetch('/api/proyectos/pendientes-aprobacion-cliente');
            if (!response.ok) {
                throw new Error('Error al cargar los proyectos');
            }
            const projects = await response.json();
            renderProjects(projects);
        } catch (error) {
            console.error('Error:', error);
            projectList.innerHTML = '<li>Error al cargar los datos.</li>';
        }
    };

    const renderProjects = (projects) => {
        projectList.innerHTML = '';
        if (projects.length === 0) {
            projectList.innerHTML = '<li>No hay proyectos pendientes de aprobación del cliente.</li>';
            return;
        }

        projects.forEach(project => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div>
                    <span>Código: ${project.codigo_proyecto}</span>
                    <span>Cliente: ${project.cliente}</span>
                </div>
                <img src="/${project.propuesta_diseno}" alt="Propuesta de diseño" width="200">
                <div>
                    <textarea class="mejora-text" placeholder="Solicitud de Mejora"></textarea>
                    <button class="btn-send-improvement" data-project-id="${project.id}">Enviar Mejora</button>
                    <button class="btn-approve-client" data-project-id="${project.id}">Diseño Aprobado por Cliente</button>
                </div>
            `;
            projectList.appendChild(listItem);
        });
    };

    const sendImprovement = async (projectId, mejora) => {
        try {
            const response = await fetch(`/api/proyectos/${projectId}/solicitar-mejora`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mejora })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al enviar la solicitud de mejora');
            }

            loadProjects();

        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const approveClient = async (projectId) => {
        try {
            const response = await fetch(`/api/proyectos/${projectId}/aprobar-cliente`, {
                method: 'PUT'
            });

            if (!response.ok) {
                throw new Error('Error al aprobar el proyecto');
            }

            loadProjects();

        } catch (error) {
            console.error('Error:', error);
            alert('Error al aprobar el proyecto');
        }
    };

    projectList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-send-improvement')) {
            const projectId = e.target.dataset.projectId;
            const mejora = e.target.closest('li').querySelector('.mejora-text').value;
            if (mejora) {
                sendImprovement(projectId, mejora);
            }
        }

        if (e.target.classList.contains('btn-approve-client')) {
            const projectId = e.target.dataset.projectId;
            approveClient(projectId);
        }
    });

    loadProjects();
});