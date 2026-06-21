function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? match[1] : '';
}

async function apiFetch(url, opciones = {}) {
    return fetch(url, {
        ...opciones,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
            ...(opciones.headers || {})
        }
    });
}

function saneText(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// planes de estudio — cargados desde la API

let planesDeEstudio = {};

async function cargarPlanesDeEstudio() {
    try {
        const res = await apiFetch('/api/planes');
        const data = await res.json();
        if (data.success) {
            planesDeEstudio = data.planes;
        } else {
            console.error('No se pudieron cargar los planes de estudio.');
        }
    } catch (err) {
        console.error('Error de red al cargar planes:', err.message);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const carreraSelect = document.getElementById('carrera');
    const anoSelect = document.getElementById('anoSelect');
    const subjectList = document.getElementById('subjectList');
    const materiasAviso = document.getElementById('materiasAviso');

    await cargarPlanesDeEstudio();

    carreraSelect.addEventListener('change', (e) => {
        const carreraSeleccionada = e.target.value;
        const plan = planesDeEstudio[carreraSeleccionada];

        anoSelect.disabled = false;
        anoSelect.innerHTML = '<option value="" disabled selected>Seleccione el año...</option>';
        
        for(let i = 1; i <= plan.duracion; i++) {
            anoSelect.innerHTML += `<option value="${i}">${i}º Año</option>`;
        }

        subjectList.innerHTML = '';
        materiasAviso.innerText = "Ahora seleccione el año que desea cursar.";
    });

    anoSelect.addEventListener('change', (e) => {
        const carreraId = carreraSelect.value;
        const ano = e.target.value;
        
        renderizarMaterias(carreraId, ano);
    });

    function renderizarMaterias(carreraId, ano) {
        subjectList.innerHTML = '';
        const materias = planesDeEstudio[carreraId].materias[ano];

        if (!materias || materias.length === 0) {
            subjectList.innerHTML = '<p style="color: var(--accent-warning);">Plan de estudios en construcción para este año.</p>';
            return;
        }

        materiasAviso.innerText = `Materias correspondientes a ${ano}º Año:`;

        materias.forEach(mat => {
            const item = document.createElement('div');
            item.className = 'subject-item fade-in';
            item.innerHTML = `
                <div class="subject-info">
                    <input type="checkbox" class="custom-checkbox subject-checkbox" id="chk_${saneText(mat.id)}" value="${saneText(mat.id)}" data-nombre="${saneText(mat.nombre)}">
                    <div>
                        <h4>${saneText(mat.nombre)}</h4>
                    </div>
                </div>
                <div class="subject-controls">
                    <select id="mod_${saneText(mat.id)}" class="modality-select" disabled>
                        <option value="CMC">Presencial (CMC)</option>
                        <option value="CMI">Semipresencial (CMI)</option>
                        <option value="LIBRE">Libre</option>
                    </select>
                </div>
            `;
            subjectList.appendChild(item);

            const checkbox = item.querySelector('.subject-checkbox');
            const select = item.querySelector('.modality-select');

            checkbox.addEventListener('change', (ev) => {
                select.disabled = !ev.target.checked;
                if (ev.target.checked) item.classList.add('selected');
                else item.classList.remove('selected');
            });
        });
    }

    document.getElementById('inscriptionForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const dni = Number(document.getElementById('dni').value);
        const nombre = document.getElementById('nombre').value;
        const email = document.getElementById('email').value;
        const telefono = document.getElementById('telefono').value;
        
        const carreraId = document.getElementById('carrera').value;
        const anoSeleccionado = parseInt(anoSelect.value);

        if (!anoSeleccionado) {
            mostrarAlerta("Debe seleccionar el año antes de enviar.", 'error');
            return;
        }

        const materiasSeleccionadas = [];
        document.querySelectorAll('.subject-checkbox:checked').forEach(chk => {
            materiasSeleccionadas.push({
                id: chk.value,
                modalidad: document.getElementById(`mod_${chk.value}`).value
            });
        });

        if(materiasSeleccionadas.length === 0) {
            mostrarAlerta("Debe seleccionar al menos una materia.", 'error');
            return;
        }

        const btnSubmit = document.querySelector('#inscriptionForm button[type="submit"]');
        const textoOriginal = btnSubmit.innerText;

        btnSubmit.innerText = "Procesando inscripción...";
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = "0.7";

        try {
            const res = await apiFetch('/api/registrar', {
                method: 'POST',
                body: JSON.stringify({
                    nombre,
                    dni,
                    email,
                    telefono,
                    carrera: carreraId,
                    ano: anoSeleccionado,
                    materias: materiasSeleccionadas
                })
            });

            const data = await res.json();

            if (data.success) {
                const modal = document.getElementById('successModal');
                const claveSpan = document.getElementById('claveGenerada');
                const btnIrPerfil = document.getElementById('btnIrPerfil');

                // La clave ya no viene en la respuesta HTTP — se entrega solo por email.
                // Reemplazamos el span por un aviso claro para que el alumno revise su correo.
                claveSpan.innerHTML = 'Revisá el correo electrónico';
                
                modal.classList.add('active');

                btnIrPerfil.addEventListener('click', () => {
                    window.location.href = "perfil.html";
                });
            } else {
                mostrarAlerta(data.message, 'error');
            }
        } catch (err) {
            console.error(err);
            mostrarAlerta("Error al conectar con el servidor. Por favor, intentá nuevamente.", 'error');
        } finally {
            btnSubmit.innerText = textoOriginal;
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = "1";
        }
    });
});

function mostrarAlerta(mensaje, tipo = 'error') {
    const icono = document.getElementById('iconoAlerta');
    const titulo = document.getElementById('tituloAlerta');
    
    document.getElementById('mensajeAlerta').innerText = mensaje;

    if (tipo === 'error') {
        titulo.innerText = 'Inscripción Rechazada';
        titulo.style.color = 'var(--accent-danger)';
    } else if (tipo === 'success') {
        titulo.innerText = '¡Inscripción Exitosa!';
        titulo.style.color = 'var(--accent-success)';
    }

    document.getElementById('modalAlerta').classList.add('active');
}

function cerrarAlerta() {
    document.getElementById('modalAlerta').classList.remove('active');
}
document.getElementById('btnCerrarAlerta')?.addEventListener('click', cerrarAlerta);