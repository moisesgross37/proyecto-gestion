document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchCenter');
    const suggestionsContainer = document.getElementById('suggestions');
    const fichaContainer = document.getElementById('fichaContainer');
    const fichaForm = document.getElementById('fichaForm');
    const nombreCentroHidden = document.getElementById('nombreCentroHidden');
let datosActuales = {}; // Aquí guardaremos la memoria de la ficha
    // Lógica visual del Logo
    const esCentroNuevoSelect = document.getElementById('esCentroNuevo');
    const logoGroup = document.getElementById('logoGroup');

    esCentroNuevoSelect.addEventListener('change', (e) => {
        logoGroup.style.display = e.target.value === 'true' ? 'block' : 'none';
    });

    // 1. BUSCADOR DE CENTROS (Reutilizamos la ruta que ya tienes)
    searchInput.addEventListener('input', async () => {
        const searchTerm = searchInput.value;
        if (searchTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`/api/centers/search?q=${encodeURIComponent(searchTerm)}`);
            const centers = await response.json();
            
            suggestionsContainer.innerHTML = '';
            if (centers.length > 0) {
                centers.forEach(center => {
                    const item = document.createElement('div');
                    item.innerHTML = `<strong>${center.name}</strong>`;
                    item.addEventListener('click', () => {
                        searchInput.value = center.name;
                        suggestionsContainer.style.display = 'none';
                        cargarDatosDelCentro(center.name); // Dispara la búsqueda de la ficha
                    });
                    suggestionsContainer.appendChild(item);
                });
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error buscando centros:', error);
        }
    });

    // Ocultar sugerencias si hacen clic fuera
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // 2. CARGAR LOS DATOS (Automáticos y Manuales)
    const cargarDatosDelCentro = async (nombreCentro) => {
        fichaContainer.style.display = 'none'; // Ocultamos mientras carga
        try {
            // Esta ruta la vamos a crear en el servidor en el próximo paso
            const response = await fetch(`/api/ficha-tecnica/${encodeURIComponent(nombreCentro)}`);
            
            if (!response.ok) {
                alert('Este centro aún no tiene un presupuesto formalizado para crearle una ficha.');
                return;
            }
            
            const data = await response.json();
            datosActuales = data; // Guardamos lo que vino de la base de datos en nuestra memoria

            // Llenar Datos Automáticos (Solo Lectura)
            document.getElementById('autoAsesor').value = data.asesor || 'N/A';
            document.getElementById('autoExtras').value = data.requerimientos_especiales || 'Ninguno';
            document.getElementById('autoCantidad').value = data.cantidad_estudiantes || '0';
            document.getElementById('autoPrecio').value = data.precio_estudiante ? `$${data.precio_estudiante}` : 'N/A';
            document.getElementById('autoContactoNombre').value = data.contacto_nombre || 'N/A';
            document.getElementById('autoContactoTel').value = data.contacto_tel || 'N/A';

            // Llenar Datos Manuales (Si ya alguien los había guardado antes)
            // --- MOSTRAR LOS ARCHIVOS GUARDADOS ---
const cajaArchivos = document.getElementById('cajaArchivosGuardados');
const listaArchivos = document.getElementById('listaArchivos');

// Limpiamos la caja por si buscamos otro colegio
listaArchivos.innerHTML = ''; 

// Verificamos si la base de datos nos trajo enlaces guardados
// (Ajusta 'enlaces_archivos' si tu columna en la base de datos se llama diferente)
console.log("Datos recibidos de la base de datos:", data);
if (data.enlaces_archivos && data.enlaces_archivos.length > 0) {
    cajaArchivos.style.display = 'block'; // Mostramos la caja
    
    // Por cada link, creamos un botón de descarga
    data.enlaces_archivos.forEach((link, index) => {
        const enlace = document.createElement('a');
        enlace.href = link;
        enlace.target = '_blank'; // Para que abra en otra pestaña
        enlace.textContent = `📄 Descargar Archivo Adjunto ${index + 1}`;
        enlace.style.color = '#0056b3';
        enlace.style.textDecoration = 'none';
        
        listaArchivos.appendChild(enlace);
    });
} else {
    cajaArchivos.style.display = 'none'; // Ocultamos la caja si no hay archivos
}
            nombreCentroHidden.value = nombreCentro;
            esCentroNuevoSelect.value = data.es_centro_nuevo ? 'true' : 'false';
            logoGroup.style.display = data.es_centro_nuevo ? 'block' : 'none';
            
            // document.getElementById('logoUrl').value = data.logo_url || ''; // Bloqueado por seguridad del navegador

// Lógica para mostrar la mini vitrina del logo
const cajaLogo = document.getElementById('cajaLogoGuardado');
const linkLogo = document.getElementById('linkLogoGuardado');

// Verificamos que haya un link real y no un objeto vacío
if (data.logo_url && data.logo_url.trim() !== '' && data.logo_url !== '{}') {
    cajaLogo.style.display = 'block';
    linkLogo.href = data.logo_url;
} else {
    cajaLogo.style.display = 'none';
}

// --- Lógica para Formulario ---
const cajaFormulario = document.getElementById('cajaFormulario');
const linkFormulario = document.getElementById('linkFormulario');
if (data.formulario_url && data.formulario_url.trim() !== '' && data.formulario_url !== '{}') {
    cajaFormulario.style.display = 'block';
    linkFormulario.href = data.formulario_url;
} else {
    cajaFormulario.style.display = 'none';
}

// --- Lógica para Listado ---
const cajaListado = document.getElementById('cajaListado');
const linkListado = document.getElementById('linkListado');
if (data.listado_estudiantes_url && data.listado_estudiantes_url.trim() !== '' && data.listado_estudiantes_url !== '{}') {
    cajaListado.style.display = 'block';
    linkListado.href = data.listado_estudiantes_url;
} else {
    cajaListado.style.display = 'none';
}

// --- Lógica para Pistas ---
const cajaPistas = document.getElementById('cajaPistas');
const linkPistas = document.getElementById('linkPistas');
if (data.pistas_himnos_url && data.pistas_himnos_url.trim() !== '' && data.pistas_himnos_url !== '{}' && data.pistas_himnos_url !== 'null') {
    cajaPistas.style.display = 'block';
    
    // Como las pistas pueden ser varias, limpiamos el formato JSON si es necesario
    let enlacePista = data.pistas_himnos_url;
    if (enlacePista.startsWith('[')) {
        const arrayPistas = JSON.parse(enlacePista);
        enlacePista = arrayPistas[0]; // Mostramos la primera pista por ahora
    }
    linkPistas.href = enlacePista;
} else {
    cajaPistas.style.display = 'none';
}
            document.getElementById('colorToga').value = data.color_toga || '';
            document.getElementById('colorEsclavina').value = data.color_esclavina || '';
            document.getElementById('ubicacionUrl').value = data.ubicacion_url || '';
            document.getElementById('estudianteNombre').value = data.estudiante_nombre || '';
            document.getElementById('estudianteContacto').value = data.estudiante_contacto || '';
            // document.getElementById('formularioUrl').value = data.formulario_url || '';
            // document.getElementById('listadoUrl').value = data.listado_estudiantes_url || '';
            // document.getElementById('pistasUrl').value = data.pistas_himnos_url || '';
            document.getElementById('comentarios').value = data.comentarios_destacados || '';

            // Mostrar todo el bloque
            fichaContainer.style.display = 'block';

        } catch (error) {
            console.error('Error al cargar la ficha:', error);
            alert('Error al intentar obtener los datos del servidor.');
        }
    };



    // 3. GUARDAR O ACTUALIZAR LA FICHA
    fichaForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Avisamos al usuario que estamos subiendo archivos pesados
        const botonGuardar = fichaForm.querySelector('button[type="submit"]');
        const textoOriginal = botonGuardar.innerHTML;
        botonGuardar.innerHTML = '⏳ Subiendo archivos y guardando...';
        botonGuardar.disabled = true;

        try {
            // 1. PREPARAMOS EL PAQUETE CON LOS ARCHIVOS FÍSICOS
            const formData = new FormData(fichaForm);
            
            // 2. ENVIAMOS PRIMERO LOS ARCHIVOS AL PORTERO (MULTER)
            // Usamos FormData directamente, sin convertir a JSON, para que pueda llevar archivos
            const uploadResponse = await fetch('/api/fichas-tecnicas/upload', {
                method: 'POST',
                // IMPORTANTE: NO ponemos 'Content-Type', el navegador lo pone solo al ver archivos
                body: formData 
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Error al subir los archivos');
            }

            const uploadResult = await uploadResponse.json();
            console.log("Lo que recibí del servidor:", uploadResult);
            
            // 3. ARMAMOS LA DATA FINAL CON LOS LINKS CLASIFICADOS
            const dataText = Object.fromEntries(formData.entries());
            dataText.es_centro_nuevo = dataText.es_centro_nuevo === 'true';

            // Limpiamos los datos "basura" que generan los botones de archivo vacíos
            // para que no sobrescriban la base de datos con "{}"
            delete dataText.archivo_logo;
            delete dataText.formulario_url; // Asegúrate de que el 'name' en tu HTML sea formulario_url
            delete dataText.listado_estudiantes_url;
            delete dataText.pistas_himnos_url;

            // Tomamos el archivo nuevo; si no subieron uno nuevo, mantenemos el que está en la memoria
            dataText.logo_url = (uploadResult.archivos && uploadResult.archivos.archivo_logo) 
                ? uploadResult.archivos.archivo_logo[0] 
                : (datosActuales.logo_url || '');

            dataText.formulario_url = (uploadResult.archivos && uploadResult.archivos.formulario_url) 
                ? uploadResult.archivos.formulario_url[0] 
                : (datosActuales.formulario_url || '');

            dataText.listado_estudiantes_url = (uploadResult.archivos && uploadResult.archivos.listado_estudiantes_url) 
                ? uploadResult.archivos.listado_estudiantes_url[0] 
                : (datosActuales.listado_estudiantes_url || '');

            dataText.pistas_himnos_url = (uploadResult.archivos && uploadResult.archivos.pistas_himnos_url) 
                ? JSON.stringify(uploadResult.archivos.pistas_himnos_url) 
                : (datosActuales.pistas_himnos_url || '');

            // 4. GUARDAMOS LA FICHA TÉCNICA COMO SIEMPRE
            console.log("Lo que voy a enviar a la base de datos:", dataText);
            const response = await fetch('/api/ficha-tecnica', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataText)
            });

            if (response.ok) {
                alert('✅ ¡Ficha Técnica guardada/actualizada con éxito!');
            } else {
                const err = await response.json();
                alert(`❌ Error al guardar: ${err.message}`);
            }
        } catch (error) {
            console.error('Error al procesar:', error);
            alert(`Ocurrió un error: ${error.message}`);
        } finally {
            // Restauramos el botón
            botonGuardar.innerHTML = textoOriginal;
            botonGuardar.disabled = false;
        }
    });
});