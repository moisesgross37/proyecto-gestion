document.addEventListener('DOMContentLoaded', () => {
    const projectList = document.getElementById('project-list');

    const loadProjects = async () => {
        try {
            const response = await fetch('/api/proyectos/proforma-lista-revision');
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
            projectList.innerHTML = '<li>No hay proyectos pendientes de autorización.</li>';
            return;
        }

        projects.forEach(project => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div>
                    <span>Código: ${project.codigo_proyecto}</span>
                    <a href="/${project.proforma}" target="_blank">Ver Proforma</a>
                </div>
                <div>
                    <label for="final-list-upload-${project.id}">Cargar Listado Final:</label>
                    <input type="file" id="final-list-upload-${project.id}" class="final-list-upload">
                </div>
                <button class="btn-authorize" data-project-id="${project.id}">Autorizar e Iniciar Producción</button>
            `;
            projectList.appendChild(listItem);
        });
    };

    const authorizeProduction = async (projectId, final_list) => {
        const formData = new FormData();
        formData.append('final_list', final_list);

        try {
            const response = await fetch(`/api/proyectos/${projectId}/autorizar-produccion`, {
                method: 'PUT',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al autorizar la producción');
            }

            loadProjects();

        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
        }
    };

    projectList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-authorize')) {
            const projectId = e.target.dataset.projectId;
            const final_list = e.target.closest('li').querySelector('.final-list-upload').files[0];
            if (final_list) {
                authorizeProduction(projectId, final_list);
            } else {
                alert('Por favor, carga el listado final.');
            }
        }
    });

    loadProjects();
});