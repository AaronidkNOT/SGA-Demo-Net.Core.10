// seguridad contra XSS

function saneText(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// popup de confirmación reutilizable

function confirmarEliminar({ titulo = '¿Eliminar este elemento?', subtitulo = 'Esta acción no se puede deshacer.' } = {}) {
    return new Promise((resolve) => {
        const modal    = document.getElementById('modalConfirmar');
        const tit      = document.getElementById('modalConfirmarTitulo');
        const sub      = document.getElementById('modalConfirmarSubtitulo');
        const btnOk    = document.getElementById('modalConfirmarOk');
        const btnCanc  = document.getElementById('modalConfirmarCancelar');

        tit.textContent = titulo;
        sub.textContent = subtitulo;
        modal.style.display = 'flex';

        const limpiar = (resultado) => {
            modal.style.display = 'none';
            btnOk.replaceWith(btnOk.cloneNode(true));
            btnCanc.replaceWith(btnCanc.cloneNode(true));
            resolve(resultado);
        };

        document.getElementById('modalConfirmarOk').addEventListener('click', () => limpiar(true), { once: true });
        document.getElementById('modalConfirmarCancelar').addEventListener('click', () => limpiar(false), { once: true });
        modal.addEventListener('click', (e) => { if (e.target === modal) limpiar(false); }, { once: true });
    });
}


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

document.addEventListener('DOMContentLoaded', async () => {

    await cargarPlanesDeEstudio();

    document.getElementById('loginFormAdmin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('loginUser').value;
    const clave = document.getElementById('loginClave').value;
        
        try {
        const res = await apiFetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, clave })
        });
            const data = await res.json();

            if (data.success) {

                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('dashboardSection').classList.remove('hidden');
                cargarDashboard(); 
                mostrarToast("Bienvenido al Panel de Dirección");
            } else {
                mostrarToast("Credenciales incorrectas", "danger");
            }
        } catch (err) {
            mostrarToast("Error de conexión", "danger");
        }
    });

    // crear profesor

document.getElementById('btnAgregarAsignacion').addEventListener('click', () => {
    const contenedor = document.getElementById('contenedorAsignacionesProfe');
    const index = contenedor.children.length;
    
    let opcionesCarrera = '<option value="">Seleccionar Carrera...</option>';
    for (const [id, datos] of Object.entries(planesDeEstudio)) {
        opcionesCarrera += `<option value="${saneText(id)}">${saneText(datos.nombre)}</option>`;
    }

    const filaHTML = `
        <div class="fila-asignacion" style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-color);">
            
            <div style="flex: 1 1 200px;">
                <select class="select-carrera" data-index="${index}" style="width: 100%; padding: 0.6rem; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: white; border-radius: 4px; outline: none;">
                    ${opcionesCarrera}
                </select>
            </div>
            
            <div style="flex: 1 1 100px;">
                <select class="select-ano" id="ano_${index}" style="width: 100%; padding: 0.6rem; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: white; border-radius: 4px; outline: none;">
                    <option>Año...</option>
                </select>
            </div>
            
            <div style="flex: 2 1 200px;">
                <select class="select-materia" id="mat_${index}" style="width: 100%; padding: 0.6rem; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: white; border-radius: 4px; outline: none;">
                    <option>Materia...</option>
                </select>
            </div>

            <div style="flex: 1 1 150px;">
                <select class="select-duracion" style="width: 100%; padding: 0.6rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(167,139,250,0.5); color: #a78bfa; border-radius: 4px; outline: none;" title="Duración de la materia">
                    <option value="anual">Anual</option>
                    <option value="primer_cuatrimestre">1er Cuatrimestre</option>
                    <option value="segundo_cuatrimestre">2do Cuatrimestre</option>
                </select>
            </div>
            
            <button type="button" class="btn btn-danger btn-eliminar-asig" title="Eliminar asignación" style="padding: 0.6rem 1rem; border-radius: 4px; font-weight: bold; cursor: pointer; align-self: stretch;">✕</button>
            
        </div>
    `;
    contenedor.insertAdjacentHTML('beforeend', filaHTML);
});

// delegacion de eventos para la logica encadenada del admin

document.getElementById('contenedorAsignacionesProfe').addEventListener('change', (e) => {
    if (e.target.classList.contains('select-carrera')) {
        const carreraId = e.target.value;
        const index = e.target.getAttribute('data-index');
        const selectAno = document.getElementById(`ano_${index}`);
        
        if (!carreraId) return;
        
        const maxAnos = planesDeEstudio[carreraId].duracion;
        selectAno.innerHTML = '<option value="">Año...</option>';
        for (let i = 1; i <= maxAnos; i++) {
            selectAno.innerHTML += `<option value="${i}">${i}º Año</option>`;
        }
    }
    
    if (e.target.classList.contains('select-ano')) {
        const fila = e.target.closest('.fila-asignacion');
        const carreraId = fila.querySelector('.select-carrera').value;
        const ano = e.target.value;
        const selectMateria = fila.querySelector('.select-materia');
        
        if (!carreraId || !ano) return;
        
        const materias = planesDeEstudio[carreraId].materias[ano];
        const LABELS_DUR = {
            anual: '',
            primer_cuatrimestre: ' [1er Cuatrimestre]',
            segundo_cuatrimestre: ' [2do Cuatrimestre]'
        };
        selectMateria.innerHTML = '<option value="">Materia...</option>';
        materias.forEach(m => {
        const sufijo = LABELS_DUR[m.duracion] || '';

        selectMateria.innerHTML += `
            <option 
                value="${saneText(m.id)}"
                data-duracion="${saneText(m.duracion || 'anual')}"
            >
                ${saneText(m.nombre)}${sufijo}
            </option>
        `;
    });
    }

    // cuando se elige una materia, pre-seleccionar su duración actual en el selector

    if (e.target.classList.contains('select-materia')) {
        const fila = e.target.closest('.fila-asignacion');
        const selectedOption = e.target.selectedOptions[0];
        const duracionActual = selectedOption?.dataset?.duracion || 'anual';
        const selectDuracion = fila.querySelector('.select-duracion');
        if (selectDuracion) {
            selectDuracion.value = duracionActual;
        }
    }
});

// eliminar fila
document.getElementById('contenedorAsignacionesProfe').addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-eliminar-asig')) {
        e.target.closest('.fila-asignacion').remove();
    }
});

document.getElementById('formAltaProfe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dni = document.getElementById('profeDni').value;
    const nombre = document.getElementById('profeNombre').value;
    const clave = document.getElementById('profeClave').value;
    const email = document.getElementById('profeEmail') ? document.getElementById('profeEmail').value : '';
    const promediar_recuperatorio = document.getElementById('profePromediarRecup').checked;
    const nodosAsignacion = document.querySelectorAll('.fila-asignacion');
    const asignaciones = [];
    
    nodosAsignacion.forEach(nodo => {
    const carrera_id = nodo.querySelector('.select-carrera').value;
    const ano = nodo.querySelector('.select-ano').value;
    const materia_id = nodo.querySelector('.select-materia').value;

    const selectMateria = nodo.querySelector('.select-materia');

    const selectDuracionRow = nodo.querySelector('.select-duracion');
    let duracion = selectDuracionRow ? selectDuracionRow.value : 'anual';

            if(carrera_id && ano && materia_id) {
                asignaciones.push({ 
                carrera_id, 
                ano: parseInt(ano), 
                materia_id,
                duracion
            });
        }
    });

    if (asignaciones.length === 0) {
        return mostrarToast("Debes configurar al menos una asignación completa.", "warning");
    }

    try {
        const res = await apiFetch('/api/admin/profesores', {
            method: 'POST',
            body: JSON.stringify({ dni, nombre, clave, email: email || undefined, asignaciones, promediar_recuperatorio })
        });
        const data = await res.json();
        
        if (data.success) {
    mostrarToast(`Profesor guardado correctamente.`);

    document.getElementById('profeDni').value = '';
    document.getElementById('profeNombre').value = '';
    document.getElementById('profeClave').value = '';
    if (document.getElementById('profeEmail')) document.getElementById('profeEmail').value = '';
    document.getElementById('contenedorAsignacionesProfe').innerHTML = '';
    await cargarDashboard();
} else {
    mostrarToast(data.message, "danger");
}
    } catch (err) {
        mostrarToast("Error al crear profesor", "danger");
    }
});

    const contenedorMaterias = document.getElementById('contenedorMateriasBulk');
    const btnGuardarHistorial = document.getElementById('btnGuardarHistorial');

    if (document.getElementById('histCarreraBulk')) {
        document.getElementById('histCarreraBulk').addEventListener('change', (e) => {
    const carreraId = e.target.value;
    const plan = planesDeEstudio[carreraId];
    
    contenedorMaterias.innerHTML = ''; 

    for(let ano = 1; ano <= plan.duracion; ano++) {
        const materiasDelAno = plan.materias[ano];
        if(!materiasDelAno || materiasDelAno.length === 0) continue;

        const columnaAno = document.createElement('div');
        columnaAno.style.background = 'rgba(30, 41, 59, 0.5)';
        columnaAno.style.padding = '1rem';
        columnaAno.style.borderRadius = '0.5rem';
        columnaAno.style.border = '1px solid var(--border-color)';

        columnaAno.innerHTML = `<h4 style="color: var(--accent-blue); margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">${ano}º Año</h4>`;
        
        const LABELS_DUR = {
            anual: '',
            primer_cuatrimestre: '<span style="font-size:0.7rem; color: var(--accent-warning);">[1er Cuatrimestre]</span>',
            segundo_cuatrimestre: '<span style="font-size:0.7rem; color: var(--accent-warning);">[2do Cuatrimestre]</span>'
        };

        materiasDelAno.forEach(mat => {
            const badgeDur = LABELS_DUR[mat.duracion] || '';
            columnaAno.innerHTML += `
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; padding: 8px 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.04);">
                    <div style="font-size: 0.85rem; font-weight: 600; line-height: 1.3; color: var(--text-primary);">${saneText(mat.nombre)} ${badgeDur}</div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
                        <select class="estado-materia select-rapido" data-id="${saneText(mat.id)}" style="flex: 1; min-width: 0; padding: 5px 4px; font-size: 0.78rem; background: rgba(15, 23, 42, 0.9); border: 1px solid var(--border-color); color: white; border-radius: 4px; cursor: pointer;">
                            <option value="nada">No cursa</option>
                            <option value="aprobada">Ya Aprobada</option>
                            <option value="CMC">Cursa: CMC</option>
                            <option value="CMI">Cursa: CMI</option>
                            <option value="Libre">Cursa: Libre</option>
                        </select>
                        <input type="text" id="nota_${saneText(mat.id)}" placeholder="Nota" inputmode="decimal" class="input-nota-materia"
                                style="width: 52px; min-width: 52px; padding: 5px 4px; font-size: 0.78rem; background: rgba(0,0,0,0.4); border: 1px solid var(--accent-success); color: white; border-radius: 4px; display: none; text-align: center; flex-shrink: 0;">
                        <select class="select-duracion-materia" data-materia-id="${saneText(mat.id)}"
                                title="${mat.duracion === 'primer_cuatrimestre' ? '1er Cuatrimestre' : mat.duracion === 'segundo_cuatrimestre' ? '2do Cuatrimestre' : 'Anual'}"
                                style="width: 36px; min-width: 36px; flex-shrink: 0; padding: 5px 2px; font-size: 0.72rem; background: rgba(15,23,42,0.9); border: 1px solid rgba(167,139,250,0.4); color: #a78bfa; border-radius: 4px; cursor: pointer; text-align: center; appearance: none; -webkit-appearance: none; text-align-last: center;">
                            <option value="anual" ${(mat.duracion||'anual')==='anual'?'selected':''}>AN</option>
                            <option value="primer_cuatrimestre" ${mat.duracion==='primer_cuatrimestre'?'selected':''}>C1</option>
                            <option value="segundo_cuatrimestre" ${mat.duracion==='segundo_cuatrimestre'?'selected':''}>C2</option>
                        </select>
                    </div>
                </div>
            `;
        });

        contenedorMaterias.appendChild(columnaAno);
    }

    btnGuardarHistorial.classList.remove('hidden');

    document.querySelectorAll('.estado-materia').forEach(select => {
        select.addEventListener('change', (ev) => {
            const inputNota = document.getElementById(`nota_${ev.target.dataset.id}`);
            if (ev.target.value === 'aprobada') {
                inputNota.style.display = 'block';
                inputNota.focus();
            } else {
                inputNota.style.display = 'none';
                inputNota.value = '';
            }
        });
    });

if (contenedorMaterias) {
    contenedorMaterias.addEventListener('change', async (ev) => {
        if (!ev.target.classList.contains('select-duracion-materia')) return;
        
        const materiaId = ev.target.dataset.materiaId;
        const nuevaDuracion = ev.target.value;
        const select = ev.target;
        
        select.disabled = true;
        try {
            const res = await apiFetch(`/api/admin/materias/${materiaId}/duracion`, {
                method: 'PATCH',
                body: JSON.stringify({ duracion: nuevaDuracion })
            });
            const data = await res.json();
            
            if (data.success) {
                const labels = { anual: 'Anual', primer_cuatrimestre: '1er Cuatrimestre', segundo_cuatrimestre: '2do Cuatrimestre' };
                select.title = labels[nuevaDuracion] || nuevaDuracion;
                mostrarToast('Duración actualizada', 'success');
                await cargarPlanesDeEstudio();
            } else {
                throw new Error(data.message || 'Error al guardar');
            }
        } catch (err) {
            mostrarToast(err.message, 'danger');
            select.value = select.querySelector('[selected]')?.value || 'anual';
        } finally {
            select.disabled = false;
        }
    });
}

    document.querySelectorAll('.input-nota-materia').forEach(input => {
        input.addEventListener('keydown', (e) => {
            const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
            if (allowed.includes(e.key)) return;
            if (!/[0-9.,]/.test(e.key)) { e.preventDefault(); return; }
            const current = e.target.value;
            if ((e.key === '.' || e.key === ',') && (current.includes('.') || current.includes(','))) {
                e.preventDefault(); return;
            }
            const dotIndex = current.includes('.') ? current.indexOf('.') : current.includes(',') ? current.indexOf(',') : -1;
            if (dotIndex !== -1 && /[0-9]/.test(e.key) && e.target.selectionStart > dotIndex && (current.length - dotIndex - 1) >= 2) {
                e.preventDefault(); return;
            }
            const pos = e.target.selectionStart;
            const next = current.slice(0, pos) + e.key + current.slice(e.target.selectionEnd);
            const num = parseFloat(next.replace(',', '.'));
            if (!isNaN(num) && num > 10) { e.preventDefault(); return; }
        });
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(',', '.');
            v = v.replace(/[^0-9.]/g, '');
            const partes = v.split('.');
            if (partes.length > 2) v = partes[0] + '.' + partes.slice(1).join('');
            if (partes.length === 2 && partes[1].length > 2) v = partes[0] + '.' + partes[1].slice(0, 2);
            if (v !== '' && v !== '.' && parseFloat(v) > 10) v = '10';
            e.target.value = v;
        });
    });
});
    }

    if (btnGuardarHistorial) {
        btnGuardarHistorial.addEventListener('click', async () => {
            const dni = document.getElementById('histDniBulk').value;
            const nombre = document.getElementById('histNombreBulk').value;
            const carreraId = document.getElementById('histCarreraBulk').value;
            const carrera = carreraId;
            const sigueCursando = document.getElementById('histSigueCursando').checked;
            const email = document.getElementById('histEmailBulk').value;
            const telefono = document.getElementById('histTelefonoBulk').value;
            
            if(!dni || !nombre || !carreraId) {
                return mostrarToast("Faltan datos básicos (DNI, Nombre o Carrera).", "warning");
            }
            
            if(sigueCursando && !email) {
                return mostrarToast("Si sigue cursando, el Email es obligatorio para enviarle su clave.", "warning");
            }

            const materiasSeleccionadas = [];

document.querySelectorAll('.estado-materia').forEach(select => {
    const estado = select.value;
    const idMateria = select.getAttribute('data-id');

    if (estado === 'aprobada') {
        const notaRaw = document.getElementById(`nota_${idMateria}`).value.replace(',', '.');
        const notaNum = notaRaw !== '' ? parseFloat(notaRaw) : '';
        if (notaRaw !== '' && (isNaN(notaNum) || notaNum < 0 || notaNum > 10)) {
            mostrarToast(`\u26a0\ufe0f Nota inv\u00e1lida. Debe ser un valor entre 0 y 10.`, "danger");
            return;
        }
        materiasSeleccionadas.push({ id: idMateria, tipo: 'historial', nota: notaRaw !== '' ? notaNum : '' }); 
    } else if (estado !== 'nada') {
        materiasSeleccionadas.push({ id: idMateria, tipo: 'cursando', modalidad: estado });
    }
});

if(materiasSeleccionadas.length === 0) return mostrarToast("No asignaste ninguna materia al alumno.", "warning");
            btnGuardarHistorial.innerText = "Guardando...";

            try {
                const res = await apiFetch('/api/admin/historial/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        alumno_dni: dni, 
                        nombre: nombre, 
                        carrera: carrera, 
                        email: email, 
                        telefono: telefono,
                        sigue_cursando: sigueCursando, 
                        materias: materiasSeleccionadas 
                    })
                });
                
                const data = await res.json();
                
                if(data.success) {
                    mostrarToast(`${materiasSeleccionadas.length} materias. ${data.message}`);
                    document.getElementById('histDniBulk').value = '';
                    document.getElementById('histNombreBulk').value = '';
                    document.getElementById('histEmailBulk').value = '';
                    document.getElementById('histTelefonoBulk').value = '';
                    document.getElementById('histCarreraBulk').value = '';
                    contenedorMaterias.innerHTML = '<div style="color: var(--text-secondary); text-align: center; grid-column: 1 / -1; padding: 2rem;">Esperando selección de carrera...</div>';
                    btnGuardarHistorial.classList.add('hidden');
                    await cargarDashboard();
                } else {
                    mostrarToast(data.message, "danger");
                }
            } catch (err) {
                mostrarToast("Error de conexión al guardar el historial.", "danger");
            } finally {
                btnGuardarHistorial.innerHTML = "Guardar Historial Seleccionado";
            }
        });
    }
});

let listaCompletaAlumnos = [];

const NOMBRES_CARRERA = {
    sistemas:  'Tec. Sup. en Análisis Funcional de Sistemas Informáticos',
    seguridad: 'Tec. Sup. en Seguridad e Higiene',
    historia:  'Profesorado de Historia',
    geografia: 'Profesorado en Geografía'
};

async function cargarDashboard() {
    try {
        const resStats = await apiFetch('/api/admin/stats', {
            headers: {
                
            }
        });
        const dataStats = await resStats.json();
        if(dataStats.success) {
            document.getElementById('statAlumnos').innerText = dataStats.totalAlumnos;
            document.getElementById('statProfes').innerText = dataStats.totalProfes;
            
            const btnIns = document.getElementById('btnToggleInscripcion');
            if(dataStats.inscripcionesAbiertas === 'true') {
                btnIns.innerText = "🟢 ABIERTAS (Click para Cerrar)";
                btnIns.style.borderColor = "var(--accent-success)";
                btnIns.style.color = "var(--accent-success)";
            } else {
                btnIns.innerText = "🔴 CERRADAS (Click para Abrir)";
                btnIns.style.borderColor = "var(--accent-danger)";
                btnIns.style.color = "var(--accent-danger)";
            }
        }
    } catch (error) {
        console.error("Error al cargar dashboard", error);
    }
}

async function toggleInscripciones() {
    try {
        const res = await apiFetch('/api/admin/toggle-inscripciones', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            cargarDashboard();
            mostrarToast("Estado del sistema actualizado", "warning");
        }
    } catch (error) {
        mostrarToast("Error al cambiar estado", "danger");
    }
}

async function verPadron() {
    try {
        const res = await apiFetch('/api/admin/alumnos');

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
            listaCompletaAlumnos = data.alumnos;
            renderizarPadron(listaCompletaAlumnos);
            const modal = document.getElementById('modalPadron');
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('active'), 10);
        } else {
            throw new Error("No se pudo obtener el padrón");
        }

    } catch (err) {
        console.error("Fallo al abrir el padrón:", err);
        mostrarToast("Error: " + err.message, "danger");
    }
}

function renderizarPadron(alumnos) {
    const tbody = document.getElementById('tablaPadron');
    
    if (!alumnos || alumnos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1.5rem;">No hay alumnos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = alumnos.map(a => {
        let datos = a;
        if (typeof a === 'string') {
            try {
                const jsonLimpio = a.includes('{') ? a.substring(a.indexOf('{')) : a;
                datos = JSON.parse(jsonLimpio);
            } catch (e) {
                console.error("Error al procesar un alumno:", e);
                return '';
            }
        }

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 1rem; font-weight: bold;">${saneText(datos.nombre) || 'Sin nombre'}</td>
                <td style="padding: 1rem;">${saneText(datos.dni) || 'S/D'}</td>
                <td style="padding: 1rem;">
                    <span class="badge badge-virtual">${saneText(NOMBRES_CARRERA[datos.carrera] || datos.carrera) || 'S/I'}</span><br>
                    <small style="color: var(--text-secondary); margin-top: 4px; display: inline-block;">
                        ${saneText(datos.ano_cursado ?? '?')}º Año
                    </small>
                </td>
                <td style="padding: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                    ${saneText(datos.email) || ''}<br>${saneText(datos.telefono) || ''}
                </td>
                <td style="padding: 1rem;">
                    <button
                        class="btn-reset-clave btn btn-danger"
                        style="padding: 0.25rem 0.6rem; font-size: 0.75rem;"
                        data-dni="${saneText(datos.dni)}"
                        data-nombre="${saneText(datos.nombre)}">
                        Resetear Clave
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarPadron() {
    const term = document.getElementById('busquedaAlumno').value.toLowerCase();
    const carreraElegida = document.getElementById('filtroCarreraPadron').value.toLowerCase();
    const anoElegido = document.getElementById('filtroAnoPadron').value;

    const filtrados = listaCompletaAlumnos.filter(a => {
        const nombreAlumno = (a.nombre || '').toLowerCase();
        const dniAlumno = (a.dni || '').toString();
        const carreraAlumno = (a.carrera || '').toLowerCase();
        
        const anoAlumno = (a.ano_cursado || 1).toString(); 

        const cumpleTexto = nombreAlumno.includes(term) || dniAlumno.includes(term);
        const cumpleCarrera = (carreraElegida === "todas") || carreraAlumno.includes(carreraElegida);
        
        const cumpleAno = (anoElegido === "todos") || (anoAlumno === anoElegido);

        return cumpleTexto && cumpleCarrera && cumpleAno;
    });

    renderizarPadron(filtrados);
}

function cerrarPadron() {
    document.getElementById('modalPadron').classList.remove('active');
    setTimeout(() => document.getElementById('modalPadron').classList.add('hidden'), 300);
}

function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

async function cerrarSesion() {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.replace('/');
}

document.getElementById('btnToggleInscripcion')?.addEventListener('click', toggleInscripciones);
document.getElementById('btnVerPadron')?.addEventListener('click', verPadron);
document.getElementById('btnCerrarSesion')?.addEventListener('click', cerrarSesion);

// backup manual
document.getElementById('btnBackupManual')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnBackupManual');
    btn.disabled = true;
    btn.innerText = 'Generando backup...';
    try {
        const res  = await apiFetch('/api/admin/backup', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Backup iniciado correctamente. Se guardará en la carpeta /backups.', 'success');
        } else {
            mostrarToast(data.message || 'Error al iniciar el backup.', 'danger');
        }
    } catch (err) {
        mostrarToast('Error de conexión al intentar el backup.', 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Generar Backup Ahora';
    }
});
document.getElementById('btnCerrarPadron')?.addEventListener('click', cerrarPadron);
document.getElementById('busquedaAlumno')?.addEventListener('keyup', filtrarPadron);
document.getElementById('filtroAnoPadron')?.addEventListener('change', filtrarPadron);
document.getElementById('filtroCarreraPadron')?.addEventListener('change', (e) => {
    const carreraElegida = e.target.value.toLowerCase();
    const selectAno = document.getElementById('filtroAnoPadron');
    const valorAnterior = selectAno.value;

    let maxAnos = 4;

    const claveCarrera = Object.keys(planesDeEstudio).find(k => k.toLowerCase() === carreraElegida || carreraElegida.includes(k));
    
    if (carreraElegida !== "todas" && claveCarrera && planesDeEstudio[claveCarrera]) {
        maxAnos = planesDeEstudio[claveCarrera].duracion;
    }

    let opcionesAno = '<option value="todos">Todos los Años</option>';
    for (let i = 1; i <= maxAnos; i++) {
        opcionesAno += `<option value="${i}">${i}º Año</option>`;
    }
    selectAno.innerHTML = opcionesAno;

    if (valorAnterior === "todos" || valorAnterior <= maxAnos) {
        selectAno.value = valorAnterior;
    } else {
        selectAno.value = "todos"; 
    }
    
    filtrarPadron();
});

// logica de gestion de notas

const modalGestor = document.getElementById('modalGestorNotas');
const inputBuscador = document.getElementById('buscadorNotasAlumno');
const tablaResultados = document.getElementById('tablaResultadosNotas');
const panelEdicion = document.getElementById('panelEdicionNotas');
const contenedorMateriasNotas = document.getElementById('contenedorMateriasNotas');
let timerBusqueda;

// abrir y cerrar modal
document.getElementById('btnAbrirGestorNotas')?.addEventListener('click', () => {
    modalGestor.classList.remove('hidden');
    setTimeout(() => modalGestor.classList.add('active'), 10);
});

document.getElementById('btnAbrirGestorHomologaciones')?.addEventListener('click', () => {
    modalGestor.classList.remove('hidden');
    setTimeout(() => {
        modalGestor.classList.add('active');
        if (inputBuscador) {
            inputBuscador.placeholder = 'Buscá el alumno para ver/editar sus homologaciones...';
            inputBuscador.focus();
            inputBuscador.style.borderColor = '#a78bfa';
            inputBuscador.style.boxShadow = '0 0 0 2px rgba(167,139,250,0.3)';
        }
    }, 10);
});

document.getElementById('btnCerrarGestorNotas')?.addEventListener('click', () => {
    modalGestor.classList.remove('active');
    setTimeout(() => {
        modalGestor.classList.add('hidden');
        inputBuscador.value = '';
        inputBuscador.placeholder = 'Buscar por DNI o Nombre...';
        inputBuscador.style.borderColor = '';
        inputBuscador.style.boxShadow = '';
        panelEdicion.classList.add('hidden');
        tablaResultados.innerHTML = '<tr><td colspan="3" style="text-align:center;">Comenzá a escribir para buscar...</td></tr>';
    }, 300);
});

// busqueda tipo "Search as you type" con Debounce
inputBuscador?.addEventListener('input', (e) => {
    clearTimeout(timerBusqueda);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        tablaResultados.innerHTML = '<tr><td colspan="3" style="text-align:center;">Comenzá a escribir para buscar...</td></tr>';
        return;
    }

    timerBusqueda = setTimeout(async () => {
        try {
            const res = await apiFetch(`/api/admin/buscar-alumnos?q=${query}`, {
                headers: {}
            });
            const data = await res.json();

            if (data.success && data.alumnos.length > 0) {
                tablaResultados.innerHTML = data.alumnos.map(a => `
                    <tr style="border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.02);">
                        <td style="padding: 0.8rem; font-weight:bold;">
                            ${saneText(a.nombre)}<br>
                            <small style="color: var(--text-secondary); font-weight: normal;">${saneText(NOMBRES_CARRERA[a.carrera] || a.carrera || '')} · ${saneText(a.ano_cursado ?? '?')}° Año</small>
                        </td>
                        <td style="padding: 0.8rem;">${saneText(a.dni)}</td>
                        <td style="padding: 1rem;">
                            <button class="btn btn-inscripciones btn-editar-notas-alumno"
                                    data-dni="${saneText(a.dni)}"
                                    data-nombre="${saneText(a.nombre)}"
                                    style="padding: 0.4rem 0.8rem; border-color: var(--accent-success); color: var(--accent-success);">
                                Editar Notas
                            </button>
                        </td>
                    </tr>
                `).join('');
            } else {
                tablaResultados.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--accent-danger);">No se encontraron alumnos.</td></tr>';
            }
        } catch (error) {
            mostrarToast("Error buscando alumnos", "danger");
        }
    }, 400);
});

window.cargarNotasAlumno = async function(dni, nombre) {
    const contenedor = document.getElementById('contenedorMateriasNotas');
    document.getElementById('panelEdicionNotas').classList.remove('hidden');
    document.getElementById('tituloEdicionAlumno').innerText = `Editando a: ${nombre}`;
    contenedor.innerHTML = '<p style="text-align:center; padding:1rem;">Cargando...</p>';

    try {
        const res = await apiFetch(`/api/admin/alumnos/${dni}/notas-completas`, {
            headers: {}
        });
        const data = await res.json();

        if (data.success && data.notas.length > 0) {

            const anosDisponibles = [...new Set(
                data.notas.map(n => {
                    const partes = n.materia_id.split('_');
                    return partes.length >= 2 ? partes[1] : null;
                }).filter(Boolean)
            )].sort();

            const filtroHTML = `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 1rem; flex-wrap: wrap;">
                    <label style="font-size: 0.85rem; color: var(--text-secondary);">Filtrar por año:</label>
                    <select id="filtroAnoNotas" style="padding: 0.4rem 0.8rem; background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); color: white; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">
                        <option value="todos">Todos los años</option>
                        ${anosDisponibles.map(a => `<option value="${a}">${a}° Año</option>`).join('')}
                    </select>
                    <span id="contadorMaterias" style="font-size: 0.8rem; color: var(--text-secondary);"></span>
                </div>
                <div id="listaMaterias"></div>
            `;
            contenedor.innerHTML = `
            <div style="display:flex; justify-content:flex-end; margin-bottom: 0.5rem;">
                <button id="btnGenerarBoletin" class="btn btn-inscripciones"
                    data-dni="${saneText(dni)}" data-nombre="${saneText(nombre)}"
                    style="border-color: var(--accent-success); color: var(--accent-success); padding: 0.4rem 1rem; font-size: 0.82rem;">
                    Exportar Boletín PDF
                </button>
                    </div>
            ${filtroHTML}
            `;

document.getElementById('btnGenerarBoletin')?.addEventListener('click', (e) => {
    generarBoletinPDF(e.target.dataset.dni, e.target.dataset.nombre);
});

            function renderizarMaterias(filtroAno) {
                const lista = document.getElementById('listaMaterias');
                const contador = document.getElementById('contadorMaterias');

                const notasFiltradas = filtroAno === 'todos'
                    ? data.notas
                    : data.notas.filter(n => {
                        const partes = n.materia_id.split('_');
                        return partes.length >= 2 && partes[1] === filtroAno;
                    });

                contador.innerText = `${notasFiltradas.length} materias`;

                lista.innerHTML = notasFiltradas.map(n => {
                    const estadoColor = n.condicion_actual.includes('Aprobado') ? 'var(--accent-success)'
                        : n.condicion_actual === 'Libre' ? 'var(--accent-danger)'
                        : 'var(--accent-blue)';

                    const LABELS_DUR = { primer_cuatrimestre: '1er C.', segundo_cuatrimestre: '2do C.' };
                    const badgeDur = n.duracion && n.duracion !== 'anual'
                        ? `<span style="font-size:0.65rem; padding: 1px 5px; border-radius: 8px; border: 1px solid var(--accent-warning); color: var(--accent-warning); margin-left: 4px;">${LABELS_DUR[n.duracion] || n.duracion}</span>`
                        : '';

                    return `
                    <div class="fila-nota-edit" style="display: grid; grid-template-columns: 1fr 130px 60px auto; gap: 8px; align-items: center; background: rgba(0,0,0,0.3); padding: 0.7rem 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 6px;">
                        <div style="min-width: 0;">
                            <div style="font-size: 0.82rem; font-weight: bold; color: var(--accent-blue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${saneText(n.materia_nombre)}">${saneText(n.materia_nombre)}${badgeDur}</div>
                            <div style="font-size: 0.72rem; color: ${estadoColor}; font-weight: bold;">${saneText(n.condicion_actual)}</div>
                            ${n.nota_final ? `<div style="font-size: 0.68rem; color: var(--text-secondary);">Nota: ${saneText(n.nota_final)}</div>` : ''}
                        </div>

                        <select id="estado_${saneText(n.materia_id)}" class="filtro-elegante" style="width: 100%; padding: 0.35rem 0.4rem; font-size: 0.78rem;">
                            <option value="Pendiente" ${n.condicion_actual === 'Pendiente' ? 'selected' : ''}>No cursa</option>
                            <option value="Cursando"  ${n.condicion_actual === 'Cursando'  ? 'selected' : ''}>Cursando</option>
                            <option value="Regular"   ${n.condicion_actual === 'Regular'   ? 'selected' : ''}>Regular</option>
                            <option value="Libre"     ${n.condicion_actual === 'Libre'     ? 'selected' : ''}>Libre</option>
                            <option value="Aprobado"  ${n.condicion_actual.includes('Aprobado') ? 'selected' : ''}>Aprobado</option>
                        </select>

                        <input type="text" inputmode="decimal" id="nota_${saneText(n.materia_id)}" class="filtro-elegante nota-input-gestion" placeholder="0-10"
                                value="${saneText(n.nota_final || '')}"
                                style="width: 100%; padding: 0.35rem; text-align: center; font-size: 0.78rem;">

                        <button class="btn btn-primary btn-guardar-edicion-nota"
                                data-dni="${saneText(dni)}"
                                data-materia="${saneText(n.materia_id)}"
                                data-nombre="${saneText(nombre)}"
                                style="padding: 0.35rem 0.7rem; font-size: 0.75rem; background: var(--accent-success); white-space: nowrap;">
                            Guardar
                        </button>
                    </div>
                `}).join('');
            }

            renderizarMaterias('todos');

            document.getElementById('filtroAnoNotas').addEventListener('change', (e) => {
                renderizarMaterias(e.target.value);
            });

        } else if (data.success && data.notas.length === 0) {
            contenedor.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 1rem;">Este alumno no tiene materias registradas.</p>';
        }

        await cargarAuditoriaAlumno(dni);
        await cargarHomologacionesAlumno(dni, nombre);

    } catch (error) {
        mostrarToast("Error al cargar notas", "danger");
        contenedor.innerHTML = '<p style="text-align:center; color: var(--accent-danger); padding: 1rem;">Error al cargar. Intentá de nuevo.</p>';
    }
};
// =====================================================
// HOMOLOGACIONES — gestión desde admin
// =====================================================
async function cargarHomologacionesAlumno(dni, nombreAlumno) {
    const panelEdicion = document.getElementById('panelEdicionNotas');
    const prevPanel = document.getElementById('seccionHomologaciones');
    if (prevPanel) prevPanel.remove();

    // Cargar materias del alumno para el selector
    let materiasOpciones = [];
    try {
        const resMaterias = await apiFetch(`/api/admin/alumnos/${dni}/notas-completas`, { headers: {} });
        const dataMaterias = await resMaterias.json();
        if (dataMaterias.success) {
            materiasOpciones = dataMaterias.notas.map(n => ({ id: n.materia_id, nombre: n.materia_nombre }));
        }
    } catch (_) {}

    // Cargar homologaciones existentes
    let homologaciones = [];
    try {
        const resH = await apiFetch(`/api/admin/homologaciones/${dni}`, { headers: {} });
        const dataH = await resH.json();
        if (dataH.success) homologaciones = dataH.homologaciones;
    } catch (_) {}

    const opcionesHTML = materiasOpciones
        .map(m => `<option value="${saneText(m.id)}">${saneText(m.nombre)}</option>`)
        .join('');

    const renderFilaHomolog = (h) => {
        const notaStr = h.nota !== null && h.nota !== undefined ? h.nota : '—';
        const fechaStr = new Date(h.fecha).toLocaleDateString('es-AR');
        return `
            <div class="fila-homolog" data-id="${h.id}" style="background:rgba(0,0,0,0.25); border:1px solid var(--border-color); border-radius:6px; padding:0.7rem 0.9rem; margin-bottom:6px; display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
                <div style="flex:1; min-width:160px;">
                    <div style="font-size:0.82rem; font-weight:bold; color:#a78bfa;">${saneText(h.materia_nombre || h.materia_id)}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">Instituto: ${saneText(h.instituto_origen)}</div>
                    ${h.observaciones ? `<div style="font-size:0.7rem; color:var(--text-secondary); font-style:italic;">${saneText(h.observaciones)}</div>` : ''}
                </div>
                <div style="text-align:center; min-width:50px;">
                    <span style="font-size:1rem; font-weight:bold; color:${h.nota >= 6 ? 'var(--accent-success)' : 'var(--accent-warning)'};">${notaStr}</span>
                    <div style="font-size:0.65rem; color:var(--text-secondary);">${fechaStr}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-edit-homolog btn btn-inscripciones" data-id="${h.id}"
                        style="padding:0.3rem 0.7rem; font-size:0.75rem; border-color:var(--accent-blue); color:var(--accent-blue);">
                        Editar
                    </button>
                    <button class="btn-del-homolog btn btn-danger" data-id="${h.id}"
                        style="padding:0.3rem 0.7rem; font-size:0.75rem;">
                        ✕
                    </button>
                </div>
            </div>
        `;
    };

    const seccion = document.createElement('div');
    seccion.id = 'seccionHomologaciones';
    seccion.style.cssText = 'margin-top:1.2rem; border-top:1px solid var(--border-color); padding-top:1rem;';
    seccion.innerHTML = `
        <h4 style="font-size:0.85rem; color:#a78bfa; margin-bottom:0.8rem; text-transform:uppercase; letter-spacing:0.05em; display:flex; align-items:center; gap:8px;">
            Homologaciones (otro instituto)
            <span style="font-size:0.7rem; background:rgba(167,139,250,0.15); border:1px solid #a78bfa; border-radius:10px; padding:1px 8px;">${homologaciones.length}</span>
        </h4>

        <div id="listaHomologaciones" style="margin-bottom:0.8rem;">
            ${homologaciones.length === 0
                ? '<p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:0.5rem;">Sin homologaciones registradas.</p>'
                : homologaciones.map(renderFilaHomolog).join('')}
        </div>

        <!-- Formulario nueva homologación -->
        <details style="border:1px dashed rgba(167,139,250,0.4); border-radius:8px; padding:0.7rem; cursor:pointer;">
            <summary style="font-size:0.82rem; font-weight:bold; color:#a78bfa; list-style:none; display:flex; align-items:center; gap:6px;">
                <span style="font-size:1rem;">＋</span> Agregar Homologación
            </summary>
            <div id="formHomolog" style="margin-top:0.8rem; display:flex; flex-direction:column; gap:0.6rem;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:0.75rem; color:var(--text-secondary);">Materia</label>
                    <select id="homolMateria" class="filtro-elegante" style="padding:0.4rem 0.6rem; font-size:0.82rem;">
                        <option value="">Seleccioná la materia...</option>
                        ${opcionesHTML}
                    </select>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <label style="font-size:0.75rem; color:var(--text-secondary);">Instituto de origen</label>
                        <input id="homolInstituto" type="text" placeholder="Ej: Instituto Rivadavia"
                            class="filtro-elegante" style="padding:0.4rem 0.6rem; font-size:0.82rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <label style="font-size:0.75rem; color:var(--text-secondary);">Nota (0–10, opcional)</label>
                        <input id="homolNota" type="text" inputmode="decimal" placeholder="—"
                            class="filtro-elegante" style="padding:0.4rem 0.6rem; font-size:0.82rem; text-align:center;">
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:0.75rem; color:var(--text-secondary);">Observaciones (opcional)</label>
                    <input id="homolObs" type="text" placeholder="Notas adicionales..."
                        class="filtro-elegante" style="padding:0.4rem 0.6rem; font-size:0.82rem;">
                </div>
                <button id="btnGuardarHomolog" class="btn btn-primary"
                    style="background:rgba(167,139,250,0.2); border-color:#a78bfa; color:#a78bfa; align-self:flex-end; padding:0.4rem 1.2rem; font-size:0.82rem;">
                    Guardar Homologación
                </button>
            </div>
        </details>
    `;

    panelEdicion.appendChild(seccion);

    // Validación decimal para el input de nota de homologación (igual que el resto del sistema)
    const homolNotaInput = seccion.querySelector('#homolNota');
    if (homolNotaInput) {
        homolNotaInput.addEventListener('keydown', (e) => {
            const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
            if (allowed.includes(e.key)) return;
            if (!/[0-9.,]/.test(e.key)) { e.preventDefault(); return; }
            const current = e.target.value;
            if ((e.key === '.' || e.key === ',') && (current.includes('.') || current.includes(','))) {
                e.preventDefault(); return;
            }
            const pos = e.target.selectionStart;
            const next = current.slice(0, pos) + e.key + current.slice(e.target.selectionEnd);
            const num = parseFloat(next.replace(',', '.'));
            if (!isNaN(num) && num > 10) { e.preventDefault(); return; }
        });
        homolNotaInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(',', '.');
            v = v.replace(/[^0-9.]/g, '');
            const partes = v.split('.');
            if (partes.length > 2) v = partes[0] + '.' + partes.slice(1).join('');
            if (partes.length === 2 && partes[1].length > 2) v = partes[0] + '.' + partes[1].slice(0, 2);
            if (v !== '' && v !== '.' && parseFloat(v) > 10) v = '10';
            e.target.value = v;
        });
    }

    // === GUARDAR nueva homologación ===
    seccion.querySelector('#btnGuardarHomolog').addEventListener('click', async () => {
        const materiaId = seccion.querySelector('#homolMateria').value;
        const instituto = seccion.querySelector('#homolInstituto').value.trim();
        const notaVal = seccion.querySelector('#homolNota').value;
        const obs = seccion.querySelector('#homolObs').value.trim();

        if (!materiaId) return mostrarToast('Seleccioná la materia.', 'warning');
        if (!instituto) return mostrarToast('Ingresá el nombre del instituto.', 'warning');

        const btn = seccion.querySelector('#btnGuardarHomolog');
        btn.disabled = true; btn.innerText = 'Guardando...';

        try {
            const res = await apiFetch('/api/admin/homologaciones', {
                method: 'POST',
                body: JSON.stringify({
                    alumno_dni: parseInt(dni),
                    materia_id: materiaId,
                    instituto_origen: instituto,
                    nota: notaVal !== '' ? parseFloat(notaVal) : null,
                    observaciones: obs || null
                })
            });
            const data = await res.json();
            if (data.success) {
                mostrarToast('Homologación guardada correctamente.', 'success');
                await cargarHomologacionesAlumno(dni, nombreAlumno);
            } else {
                mostrarToast(data.message || 'Error al guardar.', 'danger');
            }
        } catch (_) {
            mostrarToast('Error de conexión.', 'danger');
        } finally {
            btn.disabled = false; btn.innerText = 'Guardar Homologación';
        }
    });

    // === ELIMINAR homologación ===
    seccion.querySelectorAll('.btn-del-homolog').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!await confirmarEliminar({ titulo: '¿Eliminar esta homologación?', subtitulo: 'También se quitará la materia de aprobadas.' })) return;
            const id = btn.dataset.id;
            try {
                const res = await apiFetch(`/api/admin/homologaciones/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    mostrarToast('Homologación eliminada.', 'warning');
                    await cargarHomologacionesAlumno(dni, nombreAlumno);
                } else {
                    mostrarToast(data.message || 'Error al eliminar.', 'danger');
                }
            } catch (_) {
                mostrarToast('Error de conexión.', 'danger');
            }
        });
    });

    // === EDITAR homologación ===
    seccion.querySelectorAll('.btn-edit-homolog').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const h = homologaciones.find(x => String(x.id) === String(id));
            if (!h) return;

            const fila = btn.closest('.fila-homolog');
            if (fila.querySelector('.form-edit-homolog')) return; // ya abierto

            const editHTML = `
                <div class="form-edit-homolog" style="width:100%; margin-top:0.6rem; display:flex; flex-direction:column; gap:0.5rem; border-top:1px solid var(--border-color); padding-top:0.5rem;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                        <input type="text" class="edit-instituto filtro-elegante" value="${saneText(h.instituto_origen)}" placeholder="Instituto" style="padding:0.35rem; font-size:0.78rem;">
                        <input type="text" inputmode="decimal" class="edit-nota filtro-elegante nota-input-gestion" value="${h.nota ?? ''}" placeholder="Nota" style="padding:0.35rem; font-size:0.78rem; text-align:center;">
                    </div>
                    <input type="text" class="edit-obs filtro-elegante" value="${saneText(h.observaciones || '')}" placeholder="Observaciones..." style="padding:0.35rem; font-size:0.78rem;">
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="btn-confirmar-edit btn btn-primary" style="padding:0.3rem 0.8rem; font-size:0.75rem; background:rgba(167,139,250,0.2); border-color:#a78bfa; color:#a78bfa;">Confirmar</button>
                        <button class="btn-cancelar-edit btn btn-inscripciones" style="padding:0.3rem 0.8rem; font-size:0.75rem;">Cancelar</button>
                    </div>
                </div>
            `;
            fila.insertAdjacentHTML('beforeend', editHTML);

            fila.querySelector('.btn-cancelar-edit').addEventListener('click', () => {
                fila.querySelector('.form-edit-homolog')?.remove();
            });

            fila.querySelector('.btn-confirmar-edit').addEventListener('click', async () => {
                const nuevoInstituto = fila.querySelector('.edit-instituto').value.trim();
                const nuevaNota = fila.querySelector('.edit-nota').value;
                const nuevaObs = fila.querySelector('.edit-obs').value.trim();

                if (!nuevoInstituto) return mostrarToast('El instituto no puede estar vacío.', 'warning');

                try {
                    const res = await apiFetch(`/api/admin/homologaciones/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            instituto_origen: nuevoInstituto,
                            nota: nuevaNota !== '' ? parseFloat(nuevaNota) : null,
                            observaciones: nuevaObs || null
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        mostrarToast('Homologación actualizada.', 'success');
                        await cargarHomologacionesAlumno(dni, nombreAlumno);
                    } else {
                        mostrarToast(data.message || 'Error al editar.', 'danger');
                    }
                } catch (_) {
                    mostrarToast('Error de conexión.', 'danger');
                }
            });
        });
    });
}

async function cargarAuditoriaAlumno(dni) {    const panelEdicion = document.getElementById('panelEdicionNotas');
    
    const prevAudit = document.getElementById('seccionAuditoria');
    if (prevAudit) prevAudit.remove();

    try {
        const res = await apiFetch(`/api/admin/auditoria/${dni}`, {
            headers: {}
        });
        const data = await res.json();

        if (data.success && data.logs.length > 0) {
            const auditHTML = `
                <div id="seccionAuditoria" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">
                        Historial de Cambios
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 180px; overflow-y: auto;">
                        ${data.logs.map(log => `
                            <div style="background: rgba(0,0,0,0.2); padding: 0.6rem; border-radius: 4px; border-left: 3px solid var(--accent-blue); font-size: 0.75rem;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
                                    <strong style="color: var(--accent-blue);">${saneText(log.materia_nombre || log.materia_id)}</strong>
                                    <span style="color: var(--text-secondary);">${log.fecha ? new Date(String(log.fecha).replace(' ', 'T')).toLocaleString('es-AR') : '—'}</span>
                                </div>
                                <div style="color: var(--text-secondary);">
                                    Admin: <strong style="color: white;">${saneText(log.admin_usuario)}</strong> · 
                                    ${log.nota_anterior ? `Nota: <span style="color:var(--accent-danger)">${saneText(log.nota_anterior)}</span> → <span style="color:var(--accent-success)">${saneText(log.nota_nueva || '—')}</span>` : ''}
                                    ${log.estado_anterior ? `Estado: <span style="color:var(--accent-danger)">${saneText(log.estado_anterior)}</span> → <span style="color:var(--accent-success)">${saneText(log.estado_nuevo || '—')}</span>` : ''}
                                </div>
                                <div style="color: var(--text-secondary); font-style: italic; margin-top: 0.2rem;">Motivo: ${saneText(log.accion)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            panelEdicion.insertAdjacentHTML('beforeend', auditHTML);
        }
    } catch (e) {
    }
}

document.getElementById('tablaResultadosNotas')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-editar-notas-alumno');
    if (btn) {
        const { dni, nombre } = btn.dataset;
        window.cargarNotasAlumno(dni, nombre);
    }
});

// logica de guardado de notas con modal

let infoEdicionPendiente = null;

document.getElementById('contenedorMateriasNotas')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-guardar-edicion-nota')) {
        const { dni, materia, nombre } = e.target.dataset;
        const nuevoEstado = document.getElementById(`estado_${materia}`).value;
        const nuevaNota = document.getElementById(`nota_${materia}`).value;

        const filaPadre = e.target.closest('.fila-nota-edit');
        const nombreMateria = filaPadre
            ? filaPadre.querySelector('[style*="accent-blue"]')?.innerText?.trim() || materia
            : materia;

        infoEdicionPendiente = { dni, materia, nombre, nuevoEstado, nuevaNota };
        
        document.getElementById('textoMotivoAuditoria').innerHTML = `Materia: <strong style="color:white;">${saneText(nombreMateria)}</strong><br>Alumno: <strong style="color:white;">${saneText(nombre)}</strong>`;
        document.getElementById('inputMotivoAuditoria').value = '';
        
        const modal = document.getElementById('modalMotivoAuditoria');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('active');
            document.getElementById('inputMotivoAuditoria').focus();
        }, 10);
    }
});

document.getElementById('btnCancelarMotivo')?.addEventListener('click', () => {
    const modal = document.getElementById('modalMotivoAuditoria');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
    infoEdicionPendiente = null;
});

document.getElementById('btnConfirmarMotivo')?.addEventListener('click', async () => {
    const accion = document.getElementById('inputMotivoAuditoria').value.trim();
    
    if (!accion) {
        return mostrarToast("Debes especificar un motivo para el cambio.", "warning");
    }

    if (!infoEdicionPendiente) return;
    
    const { dni, materia, nombre, nuevoEstado, nuevaNota } = infoEdicionPendiente;

    const modal = document.getElementById('modalMotivoAuditoria');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);

    try {
        const res = await apiFetch('/api/admin/actualizar-nota', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                dni,
                materia_id: materia,
                nuevo_estado: nuevoEstado,
                nueva_nota_final: nuevaNota ? parseFloat(nuevaNota) : null,
                accion
            })
        });

        const data = await res.json();
        if (data.success) {
            mostrarToast("Guardado correctamente.");
            window.cargarNotasAlumno(dni, nombre);
        } else {
            mostrarToast( data.message, "danger");
        }
    } catch (error) {
        mostrarToast("Error al guardar en el servidor.", "danger");
    }
});

// boletin pdf generador

async function generarBoletinPDF(dni, nombre) {
    try {
        const res = await apiFetch(`/api/admin/alumnos/${dni}/boletin`, {
            headers: {}
        });
        const data = await res.json();
        if (!data.success) return mostrarToast("Error al obtener datos", "danger");

        const { alumno, notas } = data;

        const porAno = {};
        for (const n of notas) {
            const partes = n.materia_id.split('_');
            const ano = partes.length >= 2 ? partes[1] : '?';
            if (!porAno[ano]) porAno[ano] = [];
            porAno[ano].push(n);
        }

        const colorEstado = (estado) => {
            if (!estado) return '#6b7280';
            if (estado.includes('Aprobado') || estado === 'Promocionado') return '#16a34a';
            if (estado === 'Regular') return '#2563eb';
            if (estado === 'Libre') return '#dc2626';
            if (estado === 'Cursando') return '#d97706';
            return '#6b7280';
        };

        const nota = (v) => (v !== null && v !== undefined && v !== '') ? parseFloat(v).toFixed(2) : '—';

        const filasHTML = Object.keys(porAno).sort().map(ano => {
            const materias = porAno[ano];
        const filasMaterias = materias.map(n => {
                const esMedioCuatri = n.duracion && n.duracion !== 'anual';
                const LABELS_DUR = { primer_cuatrimestre: '1er C.', segundo_cuatrimestre: '2do C.' };
                const sufijoDur = esMedioCuatri ? ` <span style="font-size:9px; color:#d97706;">[${LABELS_DUR[n.duracion]}]</span>` : '';
                return `
                <tr>
                    <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb;">${saneText(n.materia_nombre)}${sufijoDur}</td>
                    <td style="padding:6px; text-align:center; border-bottom:1px solid #e5e7eb;">${nota(n.nota_p1)}</td>
                    <td style="padding:6px; text-align:center; border-bottom:1px solid #e5e7eb;">${nota(n.recup_p1)}</td>
                    <td style="padding:6px; text-align:center; border-bottom:1px solid #e5e7eb;">${esMedioCuatri ? '—' : nota(n.nota_p2)}</td>
                    <td style="padding:6px; text-align:center; border-bottom:1px solid #e5e7eb;">${esMedioCuatri ? '—' : nota(n.recup_p2)}</td>
                    <td style="padding:6px; text-align:center; border-bottom:1px solid #e5e7eb;">${nota(n.nota_coloquio)}</td>
                    <td style="padding:6px; text-align:center; border-bottom:1px solid #e5e7eb;">${nota(n.nota_final ?? n.nota_historial)}</td>
                    <td style="padding:6px; text-align:center; border-bottom:1px solid #e5e7eb; font-weight:bold; color:${colorEstado(n.condicion_actual)};">${saneText(n.condicion_actual) || 'Pendiente'}</td>
                </tr>
            `}).join('');

            return `
                <tr>
                    <td colspan="8" style="background:#1e3a5f; color:white; font-weight:bold; padding:8px 10px; font-size:0.9rem;">
                        ${ano}° Año
                    </td>
                </tr>
                ${filasMaterias}
            `;
        }).join('');

        const fechaHoy = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });

        const htmlBoletin = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Boletín - ${saneText(alumno.nombre)}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Arial', sans-serif; color: #1f2937; background: white; padding: 32px; font-size: 13px; }
                    .encabezado { border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .institucion { font-size: 11px; color: #6b7280; margin-top: 2px; }
                    .titulo { font-size: 22px; font-weight: bold; color: #1e3a5f; letter-spacing: 0.5px; }
                    .datos-alumno { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
                    .dato { display: flex; flex-direction: column; }
                    .dato-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
                    .dato-valor { font-weight: bold; font-size: 13px; color: #111827; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; }
                    thead th { background: #1e3a5f; color: white; padding: 8px 6px; text-align: center; font-size: 11px; letter-spacing: 0.3px; }
                    thead th:first-child { text-align: left; padding-left: 10px; }
                    .pie { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 14px; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
                    .firma { margin-top: 50px; display: flex; justify-content: flex-end; }
                    .linea-firma { border-top: 1px solid #374151; width: 200px; text-align: center; padding-top: 6px; font-size: 11px; color: #374151; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="encabezado">
                    <div>
                        <div class="titulo">Boletín Académico Oficial</div>
                        <div class="institucion">Sistema de Gestión Académica</div>
                    </div>
                    <div style="text-align:right; font-size:11px; color:#6b7280;">
                        Emitido: ${fechaHoy}<br>
                        DNI: ${saneText(alumno.dni)}
                    </div>
                </div>

                <div class="datos-alumno">
                    <div class="dato">
                        <span class="dato-label">Apellido y Nombre</span>
                        <span class="dato-valor">${saneText(alumno.nombre)}</span>
                    </div>
                    <div class="dato">
                        <span class="dato-label">Carrera</span>
                        <span class="dato-valor">${saneText(alumno.carrera)}</span>
                    </div>
                    <div class="dato">
                        <span class="dato-label">Año en curso</span>
                        <span class="dato-valor">${saneText(alumno.ano_cursado)}° Año</span>
                    </div>
                    <div class="dato">
                        <span class="dato-label">DNI</span>
                        <span class="dato-valor">${saneText(alumno.dni)}</span>
                    </div>
                    <div class="dato">
                        <span class="dato-label">Email</span>
                        <span class="dato-valor">${saneText(alumno.email) || '—'}</span>
                    </div>
                    <div class="dato">
                        <span class="dato-label">Teléfono</span>
                        <span class="dato-valor">${saneText(alumno.telefono) || '—'}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="text-align:left; padding-left:10px; width:28%;">Materia</th>
                            <th>P1</th>
                            <th>Recup P1</th>
                            <th>P2</th>
                            <th>Recup P2</th>
                            <th>Coloquio</th>
                            <th>Final</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>${filasHTML}</tbody>
                </table>

                <div class="firma">
                    <div class="linea-firma">Firma y sello institucional</div>
                </div>

                <div class="pie">
                    <span>Documento generado automáticamente por administración</span>
                    <span>${fechaHoy}</span>
                </div>
            </body>
            </html>
        `;

        const ventana = window.open('', '_blank');
        ventana.document.write(htmlBoletin);
        ventana.document.close();
        ventana.onload = () => ventana.print();

    } catch (err) {
        mostrarToast("Error al generar el boletín", "danger");
        console.error("Error al generar el boletín:", err.message);
    }
}

let dniResetActual = null;

document.getElementById('tablaPadron').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reset-clave');
    if (!btn) return;

    dniResetActual = btn.dataset.dni;
    const nombre   = btn.dataset.nombre;

    document.getElementById('textoResetClave').innerText =
        `Se generará una nueva clave aleatoria para ${nombre} (DNI: ${dniResetActual}). La clave anterior quedará inválida al instante.`;
    document.getElementById('resultadoResetClave').classList.add('hidden');
    document.getElementById('botonesResetConfirm').style.display = 'flex';
    document.getElementById('btnCerrarReset').classList.add('hidden');
    document.getElementById('btnConfirmarReset').disabled = false;
    document.getElementById('btnConfirmarReset').innerText = 'Generar Clave';

    const modal = document.getElementById('modalResetClave');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
});

document.getElementById('btnCancelarReset').addEventListener('click', cerrarModalReset);
document.getElementById('btnCerrarReset').addEventListener('click', cerrarModalReset);

document.getElementById('btnConfirmarReset').addEventListener('click', async () => {
    if (!dniResetActual) return;

    const btn = document.getElementById('btnConfirmarReset');
    btn.disabled = true;
    btn.innerText = 'Generando...';

    try {
        const res  = await apiFetch(`/api/admin/alumnos/${dniResetActual}/resetear-clave`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            document.getElementById('nuevaClaveGenerada').innerText = data.clave;
            document.getElementById('resultadoResetClave').classList.remove('hidden');
            document.getElementById('botonesResetConfirm').style.display = 'none';
            document.getElementById('btnCerrarReset').classList.remove('hidden');
            mostrarToast(`Clave reseteada para DNI ${dniResetActual}`, 'success');
        } else {
            mostrarToast(data.message, 'danger');
            cerrarModalReset();
        }
    } catch (err) {
        mostrarToast('Error al conectar con el servidor.', 'danger');
        cerrarModalReset();
    }
});

function cerrarModalReset() {
    const modal = document.getElementById('modalResetClave');
    modal.classList.remove('active');
    setTimeout(() => { modal.classList.add('hidden'); dniResetActual = null; }, 300);
}



// ── Planilla de Inscripciones por Materia ────────────────────────────────────

// Abrir modal selector al hacer clic en el botón
document.getElementById('btnExportarPlanillaInscripciones')?.addEventListener('click', () => {
    // Poblar el select de carreras con planesDeEstudio
    const selCarrera = document.getElementById('planillaSelectCarrera');
    selCarrera.innerHTML = '<option value="">Seleccioná una carrera...</option>';
    for (const [id, datos] of Object.entries(planesDeEstudio)) {
        selCarrera.innerHTML += `<option value="${saneText(id)}">${saneText(datos.nombre)}</option>`;
    }
    document.getElementById('planillaSelectAno').innerHTML = '<option value="">Primero elegí una carrera...</option>';

    const modal = document.getElementById('modalSelectorPlanilla');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
});

// Al cambiar carrera, cargar años disponibles
document.getElementById('planillaSelectCarrera')?.addEventListener('change', (e) => {
    const carreraId = e.target.value;
    const selAno = document.getElementById('planillaSelectAno');
    if (!carreraId || !planesDeEstudio[carreraId]) {
        selAno.innerHTML = '<option value="">Primero elegí una carrera...</option>';
        return;
    }
    const maxAnos = planesDeEstudio[carreraId].duracion;
    selAno.innerHTML = '<option value="">Seleccioná un año...</option>';
    for (let i = 1; i <= maxAnos; i++) {
        selAno.innerHTML += `<option value="${i}">${i}° Año</option>`;
    }
});

// Cancelar modal
document.getElementById('btnCancelarSelectorPlanilla')?.addEventListener('click', () => {
    cerrarModalSelectorPlanilla();
});

function cerrarModalSelectorPlanilla() {
    const modal = document.getElementById('modalSelectorPlanilla');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// Generar PDF al confirmar
document.getElementById('btnGenerarPlanillaPDF')?.addEventListener('click', async () => {
    const carrera = document.getElementById('planillaSelectCarrera').value;
    const ano     = document.getElementById('planillaSelectAno').value;

    if (!carrera || !ano) {
        mostrarToast('Seleccioná carrera y año antes de continuar.', 'warning');
        return;
    }

    cerrarModalSelectorPlanilla();
    await exportarPlanillaInscripciones(carrera, ano);
});

async function exportarPlanillaInscripciones(carrera, ano) {
    const btn = document.getElementById('btnExportarPlanillaInscripciones');
    btn.disabled = true;
    btn.innerText = 'Generando...';

    try {
        const res  = await apiFetch(`/api/admin/planilla-inscripciones?carrera=${encodeURIComponent(carrera)}&ano=${encodeURIComponent(ano)}`);
        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Error al obtener inscripciones');

        const inscripciones = data.inscripciones;

        if (inscripciones.length === 0) {
            mostrarToast('No hay inscripciones para esa carrera y año.', 'warning');
            return;
        }

        // Nombre completo de la carrera
        const nombreCarrera = planesDeEstudio[carrera]?.nombre || carrera.toUpperCase();

        // Agrupar por materia
        const materiaMap = {};
        inscripciones.forEach(row => {
            if (!materiaMap[row.materia_id]) {
                materiaMap[row.materia_id] = { nombre: row.materia_nombre, alumnos: [] };
            }
            materiaMap[row.materia_id].alumnos.push({
                nombre:    row.alumno_nombre,
                dni:       row.alumno_dni,
                modalidad: row.modalidad
            });
        });

        // Helpers de color
        function colorMod(m) {
            if (!m) return null;
            const u = m.toUpperCase();
            if (u === 'CMC')  return { bg: '#e0f2fe', fg: '#0369a1', label: 'CMC' };
            if (u === 'CMI')  return { bg: '#ccfbf1', fg: '#0f766e', label: 'CMI' };
            if (u === 'LIBRE') return { bg: '#fef3c7', fg: '#b45309', label: 'Libre' };
            return null;
        }

        const fechaHoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

        // Construir secciones por materia
        let seccionesHTML = '';
        let totalInscripciones = 0;

        Object.values(materiaMap).forEach(mat => {
            const alumnos = mat.alumnos;
            totalInscripciones += alumnos.length;

            let cmc = 0, cmi = 0, libre = 0;
            const filas = alumnos.map((a, idx) => {
                const c = colorMod(a.modalidad);
                if (c?.label === 'CMC')   cmc++;
                else if (c?.label === 'CMI')   cmi++;
                else if (c?.label === 'Libre') libre++;

                const badgeMod = c
                    ? `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:bold;background:${c.bg};color:${c.fg};">${c.label}</span>`
                    : `<span style="color:#9ca3af;font-size:10px;">—</span>`;

                const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                return `
                    <tr style="background:${bg};">
                        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;width:28px;">${idx + 1}</td>
                        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;">${saneText(a.nombre)}</td>
                        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${saneText(a.dni)}</td>
                        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${badgeMod}</td>
                    </tr>`;
            }).join('');

            const resumen = `
                <span style="background:#e0f2fe;color:#0369a1;padding:1px 7px;border-radius:10px;font-size:10px;margin-right:3px;">CMC: ${cmc}</span>
                <span style="background:#ccfbf1;color:#0f766e;padding:1px 7px;border-radius:10px;font-size:10px;margin-right:3px;">CMI: ${cmi}</span>
                <span style="background:#fef3c7;color:#b45309;padding:1px 7px;border-radius:10px;font-size:10px;margin-right:3px;">Libre: ${libre}</span>
                <span style="background:#f3f4f6;color:#374151;padding:1px 7px;border-radius:10px;font-size:10px;">Total: ${alumnos.length}</span>`;

            seccionesHTML += `
                <div style="margin-bottom:22px;break-inside:avoid;">
                    <div style="background:#1e3a5f;color:white;padding:7px 12px;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:bold;font-size:12px;">${saneText(mat.nombre)}</span>
                        <span>${resumen}</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead>
                            <tr style="background:#334155;color:white;">
                                <th style="padding:5px 10px;text-align:left;width:28px;">#</th>
                                <th style="padding:5px 10px;text-align:left;">Apellido y Nombre</th>
                                <th style="padding:5px 10px;text-align:left;">DNI</th>
                                <th style="padding:5px 10px;text-align:center;">Modalidad</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>`;
        });

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Planilla de Inscripciones — ${saneText(nombreCarrera)} ${ano}° Año</title>
<style>
    * { margin:0;padding:0;box-sizing:border-box;
        -webkit-print-color-adjust:exact !important;
        print-color-adjust:exact !important; }
    body { font-family:Arial,sans-serif;color:#1f2937;background:white;padding:24px;font-size:12px; }
    .encabezado { border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:20px;
                    display:flex;justify-content:space-between;align-items:flex-end; }
    .titulo    { font-size:18px;font-weight:bold;color:#0f172a; }
    .subtitulo { font-size:11px;color:#6b7280;margin-top:3px; }
    .pie { margin-top:24px;border-top:1px solid #e5e7eb;padding-top:10px;
            display:flex;justify-content:space-between;font-size:10px;color:#9ca3af; }
    @media print { body{padding:0;} @page{size:A4 portrait;margin:10mm;} }
</style>
</head>
<body>
    <div class="encabezado">
        <div>
            <div class="titulo">Planilla de Inscripciones por Materia</div>
            <div class="subtitulo">${saneText(nombreCarrera)} &nbsp;·&nbsp; ${ano}° Año</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#6b7280;">
            Emitido: ${fechaHoy}<br>
            Total inscripciones: <strong style="color:#0f172a;">${totalInscripciones}</strong>
        </div>
    </div>

    ${seccionesHTML}

    <div class="pie">
        <span>Documento generado automáticamente por administración</span>
        <span>${fechaHoy}</span>
    </div>
</body>
</html>`;

        const ventana = window.open('', '_blank', 'width=900,height=700');
        if (!ventana) { mostrarToast('El navegador bloqueó la ventana emergente.', 'danger'); return; }
        ventana.document.write(html);
        ventana.document.close();
        setTimeout(() => ventana.print(), 400);

    } catch (err) {
        mostrarToast('Error al generar la planilla', 'danger');
        console.error('exportarPlanillaInscripciones:', err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Exportar Planilla de Inscripciones PDF';
    }
}
// ─── TOGGLE VISUAL "Promediar parcial con recuperatorio" (profePromediarRecup) ──
(function () {
    const chk   = document.getElementById('profePromediarRecup');
    const track = document.getElementById('togglePromediarVisual');
    if (!chk || !track) return;
    const knob  = track.querySelector('span');

    function actualizar() {
        if (chk.checked) {
            track.style.background   = 'var(--accent-success)';
            track.style.borderColor  = 'var(--accent-success)';
            knob.style.transform     = 'translateX(20px)';
        } else {
            track.style.background   = 'rgba(100,100,100,0.4)';
            track.style.borderColor  = 'var(--border-color)';
            knob.style.transform     = 'translateX(0px)';
        }
    }

    track.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        chk.checked = !chk.checked;
        actualizar();
    });

    actualizar();
})();

// ─── TOGGLE VISUAL "Activo" (histSigueCursando) ───────────────────────────────
// El checkbox nativo está oculto; el track visual maneja el estado.
// El <label> tiene for="histSigueCursando" lo que hace que un click en cualquier
// hijo del label también dispare el checkbox — por eso el track usa e.preventDefault()
// para evitar el doble-toggle (click en track → toggle checkbox → label propaga → toggle de vuelta).
(function () {
    const chk = document.getElementById('histSigueCursando');
    const knob = document.querySelector('#toggleActivoVisual span');
    const track = document.getElementById('toggleActivoVisual');
    const label = document.getElementById('labelActivoTexto');
    if (!chk || !knob || !track || !label) return;

    function actualizarToggle() {
        if (chk.checked) {
            track.style.background = 'var(--accent-success)';
            track.style.borderColor = 'var(--accent-success)';
            knob.style.transform = 'translateX(20px)';
            label.style.color = 'var(--accent-success)';
            label.textContent = 'Activo';
        } else {
            track.style.background = 'rgba(100,100,100,0.4)';
            track.style.borderColor = 'var(--border-color)';
            knob.style.transform = 'translateX(0px)';
            label.style.color = 'var(--text-secondary)';
            label.textContent = 'Inactivo';
        }
    }

    track.addEventListener('click', (e) => {
        // Cancelar la propagación al <label> para evitar el doble-toggle.
        e.preventDefault();
        e.stopPropagation();
        chk.checked = !chk.checked;
        actualizarToggle();
    });

    actualizarToggle();
})();

// ─── VALIDACIÓN DECIMAL para inputs de Gestión de Calificaciones ──────────────
// Mismo comportamiento que los inputs .input-nota-materia del historial.
document.addEventListener('click', () => {
    document.querySelectorAll('.nota-input-gestion').forEach(input => {
        if (input.dataset.decimalListenerAttached) return;
        input.dataset.decimalListenerAttached = 'true';

        input.addEventListener('keydown', (e) => {
            const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
            if (allowed.includes(e.key)) return;
            if (!/[0-9.,]/.test(e.key)) { e.preventDefault(); return; }
            const current = e.target.value;
            if ((e.key === '.' || e.key === ',') && (current.includes('.') || current.includes(','))) {
                e.preventDefault(); return;
            }
            const pos = e.target.selectionStart;
            const next = current.slice(0, pos) + e.key + current.slice(e.target.selectionEnd);
            const num = parseFloat(next.replace(',', '.'));
            if (!isNaN(num) && num > 10) { e.preventDefault(); return; }
        });

        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(',', '.');
            v = v.replace(/[^0-9.]/g, '');
            const partes = v.split('.');
            if (partes.length > 2) v = partes[0] + '.' + partes.slice(1).join('');
            if (partes.length === 2 && partes[1].length > 2) v = partes[0] + '.' + partes[1].slice(0, 2);
            if (v !== '' && v !== '.' && parseFloat(v) > 10) v = '10';
            e.target.value = v;
        });
    });
});

(function () {
    const overlays = document.querySelectorAll('.modal-overlay');
    if (!overlays.length) return;

    function sincronizarScrollBody() {
        const hayModalActivo = [...overlays].some(el => el.classList.contains('active'));
        document.body.style.overflow = hayModalActivo ? 'hidden' : '';
    }

    const observer = new MutationObserver(sincronizarScrollBody);
    overlays.forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['class'] }));
})();
// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO: HORARIOS Y FERIADOS
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
    const DIAS = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
    const CARRERAS_NOMBRE = { sistemas: 'Sistemas', seguridad: 'Higiene/Seg.', historia: 'Historia', geografia: 'Geografía' };

    let horariosCargados = [];
    let materiasPorCarreraAno = {}; // cache { 'sistemas_1': [{id, nombre}] }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function mostrarMensaje(msg, tipo = 'success') {
        // Reutiliza la función global si existe, sino console
        if (typeof mostrarToast === 'function') { mostrarToast(msg, tipo); return; }
        if (typeof mostrarNotificacion === 'function') { mostrarNotificacion(msg, tipo); return; }
        console.log(`[${tipo}] ${msg}`);
    }

    function cargarMateriasPorCarreraAno(carrera, ano) {
        // Usa planesDeEstudio que ya está cargado en memoria al hacer login
        if (!planesDeEstudio || !planesDeEstudio[carrera]) return [];
        const materias = (planesDeEstudio[carrera].materias || {})[ano] || [];
        return materias.map(m => ({
            id: m.id || m.materia_id,
            nombre: m.nombre
        }));
    }

    function poblarSelectMaterias(materias) {
        const sel = document.getElementById('hMateria');
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccionar materia...</option>';
        materias.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.nombre;
            sel.appendChild(opt);
        });
    }

    // ── Render tabla horarios ─────────────────────────────────────────────────

    function renderTablaHorarios(lista) {
        const tbody = document.getElementById('tablaHorarios');
        if (!tbody) return;
        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-secondary);">No hay horarios cargados aún.</td></tr>';
            return;
        }
        tbody.innerHTML = lista.map(h => {
            const horaIni = String(h.hora_inicio).slice(0, 5);
            const horaFin = String(h.hora_fin).slice(0, 5);
            return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding:0.6rem 0.8rem;">${saneText(CARRERAS_NOMBRE[h.carrera_id] || h.carrera_id)}</td>
                <td style="padding:0.6rem 0.8rem; text-align:center;">${h.ano}°</td>
                <td style="padding:0.6rem 0.8rem;">${saneText(h.materia_nombre || h.materia_id)}</td>
                <td style="padding:0.6rem 0.8rem;">${DIAS[h.dia_semana] || h.dia_semana}</td>
                <td style="padding:0.6rem 0.8rem; font-variant-numeric: tabular-nums;">${horaIni} – ${horaFin} hs</td>
                <td style="padding:0.6rem 0.8rem; text-align:center;">
                    <button class="btn btn-danger btn-sm btn-eliminar-horario" data-id="${h.id}" style="padding:0.3rem 0.7rem; font-size:0.8rem;">✕</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-eliminar-horario').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await confirmarEliminar({ titulo: '¿Eliminar este horario?', subtitulo: 'Se quitará del calendario de clases.' });
                if (!ok) return;
                const id = btn.dataset.id;
                try {
                    const r = await apiFetch('/api/admin/horarios/' + id, { method: 'DELETE' });
                    const data = await r.json();
                    if (data.success) {
                        mostrarMensaje('Horario eliminado.');
                        await cargarHorarios();
                    } else {
                        mostrarMensaje(data.message || 'Error al eliminar.', 'error');
                    }
                } catch (e) { mostrarMensaje('Error de red.', 'error'); }
            });
        });
    }

    // ── Cargar horarios desde API ─────────────────────────────────────────────

    function filtrarHorarios() {
        const q = (document.getElementById('buscadorHorarios')?.value || '').toLowerCase().trim();
        const DIAS_TEXTO = { 1:'lunes', 2:'martes', 3:'miércoles', 4:'jueves', 5:'viernes' };
        const lista = q
            ? horariosCargados.filter(h => {
                const campos = [
                    CARRERAS_NOMBRE[h.carrera_id] || h.carrera_id,
                    h.materia_nombre || h.materia_id,
                    DIAS_TEXTO[h.dia_semana] || '',
                    String(h.ano) + '°',
                    String(h.hora_inicio).slice(0, 5),
                    String(h.hora_fin).slice(0, 5)
                ].join(' ').toLowerCase();
                return campos.includes(q);
            })
            : horariosCargados;

        renderTablaHorarios(lista);
        const contador = document.getElementById('contadorHorarios');
        if (contador) {
            contador.textContent = q
                ? `${lista.length} de ${horariosCargados.length} resultado${lista.length !== 1 ? 's' : ''}`
                : `${horariosCargados.length} horario${horariosCargados.length !== 1 ? 's' : ''}`;
        }
    }

    async function cargarHorarios() {
        try {
            const r = await apiFetch('/api/admin/horarios');
            const data = await r.json();
            horariosCargados = data.horarios || [];

            // Conectar buscador la primera vez
            const buscador = document.getElementById('buscadorHorarios');
            if (buscador && !buscador.dataset.wired) {
                buscador.addEventListener('input', filtrarHorarios);
                buscador.dataset.wired = '1';
            }

            filtrarHorarios();
        } catch (e) {
            const tbody = document.getElementById('tablaHorarios');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#f87171;">Error al cargar horarios.</td></tr>';
        }
    }

    // ── Render tabla feriados ─────────────────────────────────────────────────

    function renderTablaFeriados(lista) {
        const tbody = document.getElementById('tablaFeriados');
        if (!tbody) return;
        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-secondary);">Sin feriados cargados para este año.</td></tr>';
            return;
        }
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const tipoColor = { inamovible: '#34d399', trasladable: '#fbbf24', puente: '#60a5fa', manual: '#c084fc' };

        tbody.innerHTML = lista.map(f => {
            const fecha = new Date(f.fecha + 'T12:00:00');
            const diaTexto = diasSemana[fecha.getDay()];
            const fechaLeg = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const color = tipoColor[f.tipo] || '#9ca3af';
            return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding:0.6rem 0.8rem; font-variant-numeric: tabular-nums;">${fechaLeg}</td>
                <td style="padding:0.6rem 0.8rem; color:var(--text-secondary);">${diaTexto}</td>
                <td style="padding:0.6rem 0.8rem;">${saneText(f.motivo)}</td>
                <td style="padding:0.6rem 0.8rem;"><span style="background:${color}22; color:${color}; border:1px solid ${color}55; border-radius:4px; padding:2px 8px; font-size:0.78rem;">${f.tipo}</span></td>
                <td style="padding:0.6rem 0.8rem; text-align:center;">
                    <button class="btn btn-danger btn-sm btn-eliminar-feriado" data-id="${f.id}" style="padding:0.3rem 0.7rem; font-size:0.8rem;">✕</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-eliminar-feriado').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await confirmarEliminar({ titulo: '¿Eliminar este feriado?', subtitulo: 'Se quitará del calendario y dejará de afectar la asistencia.' });
                if (!ok) return;
                try {
                    const r = await apiFetch('/api/admin/feriados/' + btn.dataset.id, { method: 'DELETE' });
                    const data = await r.json();
                    if (data.success) {
                        mostrarMensaje('Feriado eliminado.');
                        await cargarFeriados();
                    } else {
                        mostrarMensaje(data.message || 'Error al eliminar.', 'error');
                    }
                } catch (e) { mostrarMensaje('Error de red.', 'error'); }
            });
        });
    }

    // ── Cargar feriados desde API ─────────────────────────────────────────────

    async function cargarFeriados() {
        const anio = document.getElementById('filtroAnioFeriados')?.value || new Date().getFullYear();
        try {
            const r = await apiFetch('/api/admin/feriados?anio=' + anio);
            const data = await r.json();
            renderTablaFeriados(data.feriados || []);
        } catch (e) {
            const tbody = document.getElementById('tablaFeriados');
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#f87171;">Error al cargar feriados.</td></tr>';
        }
    }

    // ── Inicializar select de año en filtro feriados ──────────────────────────

    function inicializarFiltroAnio() {
        const sel = document.getElementById('filtroAnioFeriados');
        const importar = document.getElementById('fAnioImportar');
        if (!sel) return;
        const anioActual = new Date().getFullYear();
        sel.innerHTML = '';
        for (let a = anioActual - 1; a <= anioActual + 2; a++) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            if (a === anioActual) opt.selected = true;
            sel.appendChild(opt);
        }
        if (importar) importar.value = anioActual;
        sel.addEventListener('change', cargarFeriados);
    }

    // ── Tabs del modal ────────────────────────────────────────────────────────

    function inicializarTabs() {
        document.querySelectorAll('.tab-horario').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-horario').forEach(b => {
                    b.style.borderBottomColor = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                btn.style.borderBottomColor = '#34d399';
                btn.style.color = '#34d399';
                document.getElementById('panelHorarios').classList.toggle('hidden', tab !== 'horarios');
                document.getElementById('panelFeriados').classList.toggle('hidden', tab !== 'feriados');
            });
        });
    }

    // ── Eventos del modal ─────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const modal    = document.getElementById('modalHorarios');
        const btnAbrir = document.getElementById('btnAbrirHorarios');
        const btnCerrar= document.getElementById('btnCerrarHorarios');

        if (!modal || !btnAbrir) return;

        // Abrir modal
        btnAbrir.addEventListener('click', async () => {
            modal.classList.remove('hidden');
            modal.classList.add('active');
            inicializarTabs();
            inicializarFiltroAnio();
            await Promise.all([cargarHorarios(), cargarFeriados()]);
        });

        // Cerrar modal
        btnCerrar?.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('active');
        });
        modal.addEventListener('click', e => {
            if (e.target === modal) { modal.classList.add('hidden'); modal.classList.remove('active'); }
        });

        // Cargar/año del selector de materia al cambiar carrera o año
        const selCarrera = document.getElementById('hCarrera');
        const selAno     = document.getElementById('hAno');

        function actualizarAnios() {
            const carrera = selCarrera?.value;
            selAno.innerHTML = '<option value="">Año...</option>';
            if (!carrera || !planesDeEstudio[carrera]) return;
            const maxAnos = planesDeEstudio[carrera].duracion;
            for (let i = 1; i <= maxAnos; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i + '°';
                selAno.appendChild(opt);
            }
            poblarSelectMaterias([]);
        }

        function actualizarMaterias() {
            const carrera = selCarrera?.value;
            const ano = selAno?.value;
            if (!carrera || !ano) {
                poblarSelectMaterias([]);
                return;
            }
            const lista = cargarMateriasPorCarreraAno(carrera, ano);
            poblarSelectMaterias(lista);
        }

        selCarrera?.addEventListener('change', () => { actualizarAnios(); });
        selAno?.addEventListener('change', actualizarMaterias);

        // Guardar nuevo horario
        document.getElementById('btnGuardarHorario')?.addEventListener('click', async () => {
            const materia_id  = document.getElementById('hMateria')?.value;
            const carrera_id  = document.getElementById('hCarrera')?.value;
            const ano         = document.getElementById('hAno')?.value;
            const dia_semana  = document.getElementById('hDia')?.value;
            const hora_inicio = document.getElementById('hHoraInicio')?.value;
            const hora_fin    = document.getElementById('hHoraFin')?.value;

            if (!materia_id || !carrera_id || !ano || !dia_semana || !hora_inicio || !hora_fin) {
                mostrarMensaje('Completá todos los campos del horario.', 'error');
                return;
            }
            if (hora_inicio >= hora_fin) {
                mostrarMensaje('La hora de fin debe ser posterior al inicio.', 'error');
                return;
            }

            try {
                const r = await apiFetch('/api/admin/horarios', {
                    method: 'POST',
                    body: JSON.stringify({ materia_id, carrera_id, ano: parseInt(ano), dia_semana: parseInt(dia_semana), hora_inicio, hora_fin })
                });
                const data = await r.json();
                if (data.success) {
                    mostrarMensaje('Horario guardado.');
                    // Limpiar form
                    ['hCarrera','hAno','hDia','hHoraInicio','hHoraFin'].forEach(id => {
                        const el = document.getElementById(id); if (el) el.value = '';
                    });
                    poblarSelectMaterias([]);
                    materiasPorCarreraAno = {};
                    await cargarHorarios();
                } else {
                    mostrarMensaje(data.message || 'Error al guardar.', 'error');
                }
            } catch (e) { mostrarMensaje('Error de red.', 'error'); }
        });

        // Importar feriados
        document.getElementById('btnImportarFeriados')?.addEventListener('click', async () => {
            const anio = document.getElementById('fAnioImportar')?.value;
            if (!anio) { mostrarMensaje('Ingresá el año a importar.', 'error'); return; }
            const btn = document.getElementById('btnImportarFeriados');
            btn.disabled = true; btn.textContent = 'Importando...';
            try {
                const r = await apiFetch('/api/admin/feriados/importar', {
                    method: 'POST',
                    body: JSON.stringify({ anio: parseInt(anio) })
                });
                const data = await r.json();
                if (data.success) {
                    mostrarMensaje('Importados ' + data.total + ' feriados para ' + anio + '.');
                    // Sync el filtro al año importado
                    const filtro = document.getElementById('filtroAnioFeriados');
                    if (filtro) filtro.value = anio;
                    await cargarFeriados();
                } else {
                    mostrarMensaje(data.message || 'Error al importar.', 'error');
                }
            } catch (e) { mostrarMensaje('Error de red al importar feriados.', 'error'); }
            finally { btn.disabled = false; btn.textContent = 'Importar Feriados'; }
        });

        // Agregar feriado manual
        document.getElementById('btnAgregarFeriado')?.addEventListener('click', async () => {
            const fecha  = document.getElementById('fFecha')?.value;
            const motivo = document.getElementById('fMotivo')?.value?.trim();
            if (!fecha || !motivo) { mostrarMensaje('Completá fecha y motivo.', 'error'); return; }
            try {
                const r = await apiFetch('/api/admin/feriados', {
                    method: 'POST',
                    body: JSON.stringify({ fecha, motivo })
                });
                const data = await r.json();
                if (data.success) {
                    mostrarMensaje('Feriado agregado.');
                    document.getElementById('fFecha').value = '';
                    document.getElementById('fMotivo').value = '';
                    // Cambiar filtro al año del feriado agregado
                    const anioFeriado = fecha.slice(0, 4);
                    const filtro = document.getElementById('filtroAnioFeriados');
                    if (filtro) filtro.value = anioFeriado;
                    await cargarFeriados();
                } else {
                    mostrarMensaje(data.message || 'Error al agregar.', 'error');
                }
            } catch (e) { mostrarMensaje('Error de red.', 'error'); }
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // MÓDULO ESTADÍSTICAS
    // ═══════════════════════════════════════════════════════════════

    const CARRERAS_LABEL = { sistemas: 'Sistemas', seguridad: 'Higiene/Seg.', historia: 'Historia', geografia: 'Geografía' };
    const CHART_COLORS   = ['#38bdf8','#34d399','#a78bfa','#fbbf24','#f87171','#f472b6'];
    let _chartCarreras = null, _chartEstados = null, _chartMaterias = null;

    function destruirCharts() {
        [_chartCarreras, _chartEstados, _chartMaterias].forEach(c => { if (c) c.destroy(); });
        _chartCarreras = _chartEstados = _chartMaterias = null;
    }

    function buildBarOptions(extra = {}) {
        return {
            responsive: true,
            plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
            scales: {
                x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true }
            },
            ...extra
        };
    }

    function renderCharts(d) {
        destruirCharts();

        // — Alumnos por carrera agrupado por año —
        const carreras   = [...new Set(d.alumnosPorCarreraAno.map(r => r.carrera))];
        const anos       = [...new Set(d.alumnosPorCarreraAno.map(r => r.ano_cursado))].sort();
        const dsCarreras = anos.map((ano, i) => ({
            label: ano + '° Año',
            data: carreras.map(c => {
                const row = d.alumnosPorCarreraAno.find(r => r.carrera === c && r.ano_cursado === ano);
                return row ? row.total : 0;
            }),
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + 'cc',
            borderColor:     CHART_COLORS[i % CHART_COLORS.length],
            borderWidth: 1, borderRadius: 4
        }));
        _chartCarreras = new Chart(document.getElementById('chartCarreras'), {
            type: 'bar',
            data: { labels: carreras.map(c => CARRERAS_LABEL[c] || c), datasets: dsCarreras },
            options: buildBarOptions()
        });

        // — Estado académico (doughnut) —
        const ESTADO_COLORES = {
            'Cursando': '#38bdf8', 'Aprobado (Cursada)': '#34d399', 'Aprobado (Final)': '#4ade80',
            'Libre': '#f87171', 'Regular': '#fbbf24'
        };
        _chartEstados = new Chart(document.getElementById('chartEstados'), {
            type: 'doughnut',
            data: {
                labels: d.estadoAcademico.map(r => r.estado_academico),
                datasets: [{ data: d.estadoAcademico.map(r => r.total),
                    backgroundColor: d.estadoAcademico.map(r => ESTADO_COLORES[r.estado_academico] || '#94a3b8'),
                    borderWidth: 2, borderColor: '#13131f', hoverOffset: 8 }]
            },
            options: { responsive: true, cutout: '62%', plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } } }
        });

        // — Aprobación por materia (stacked horizontal) —
        const top = d.aprobacionPorMateria.slice(0, 15);
        _chartMaterias = new Chart(document.getElementById('chartMaterias'), {
            type: 'bar',
            data: {
                labels: top.map(r => r.materia.length > 28 ? r.materia.slice(0, 26) + '…' : r.materia),
                datasets: [
                    { label: 'Aprobados', data: top.map(r => Number(r.aprobados)), backgroundColor: '#34d399cc', borderRadius: 3 },
                    { label: 'Cursando',  data: top.map(r => Number(r.cursando)),  backgroundColor: '#38bdf8cc', borderRadius: 3 },
                    { label: 'Libres',    data: top.map(r => Number(r.libres)),    backgroundColor: '#f87171cc', borderRadius: 3 }
                ]
            },
            options: {
                ...buildBarOptions(),
                indexAxis: 'y',
                scales: {
                    x: { stacked: true, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { stacked: true, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } }
                }
            }
        });
    }

    function renderTablaRiesgo(lista) {
        const tbody = document.getElementById('tablaRiesgo');
        if (!tbody) return;
        if (!lista.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748b;">✅ Ningún alumno en riesgo actualmente.</td></tr>';
            return;
        }
        tbody.innerHTML = lista.map(r => {
            const pct   = Math.round((r.faltas_actuales / r.max_faltas) * 100);
            const color = pct >= 100 ? '#ef4444' : pct >= 85 ? '#f87171' : '#fbbf24';
            const barW  = Math.min(pct, 100);
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:0.5rem 0.75rem; font-weight:500;">${saneText(r.nombre)}</td>
                <td style="padding:0.5rem 0.75rem; color:#94a3b8;">${CARRERAS_LABEL[r.carrera] || r.carrera} — ${r.ano_cursado}°</td>
                <td style="padding:0.5rem 0.75rem;">${saneText(r.materia_nombre)}</td>
                <td style="padding:0.5rem 0.75rem; text-align:center; font-weight:700; color:${color};">${r.faltas_actuales}</td>
                <td style="padding:0.5rem 0.75rem; text-align:center; color:#64748b;">${r.max_faltas}</td>
                <td style="padding:0.5rem 0.75rem; min-width:100px;">
                    <div style="background:rgba(255,255,255,0.06); border-radius:99px; height:8px; overflow:hidden;">
                        <div style="width:${barW}%; height:100%; background:${color}; border-radius:99px;"></div>
                    </div>
                    <div style="font-size:0.7rem; color:${color}; text-align:right; margin-top:2px;">${pct}%</div>
                </td>
            </tr>`;
        }).join('');
    }

    async function abrirEstadisticas() {
        const modal     = document.getElementById('modalEstadisticas');
        const loading   = document.getElementById('estLoading');
        const contenido = document.getElementById('estContenido');
        const ts        = document.getElementById('estTimestamp');

        modal.style.display = 'flex';
        loading.style.display   = 'block';
        contenido.style.display = 'none';
        destruirCharts();

        try {
            const r    = await apiFetch('/api/admin/estadisticas');
            const data = await r.json();
            if (!data.success) throw new Error(data.message || 'Error');

            document.getElementById('kpiAlumnos').textContent        = data.resumen.totalAlumnos;
            document.getElementById('kpiProfes').textContent         = data.resumen.totalProfes;
            document.getElementById('kpiInscripciones').textContent  = data.resumen.totalInscripciones;
            document.getElementById('kpiAprobados').textContent      = data.resumen.totalAprobados;
            document.getElementById('kpiLibres').textContent         = data.resumen.totalLibres;
            document.getElementById('kpiHomologaciones').textContent = data.resumen.totalHomologaciones;

            ts.textContent = 'Actualizado ' + new Date().toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

            loading.style.display   = 'none';
            contenido.style.display = 'block';

            renderCharts(data);
            renderTablaRiesgo(data.enRiesgo);
        } catch(e) {
            loading.innerHTML = '<p style="color:#f87171; padding: 2rem;">Error al cargar estadísticas: ' + e.message + '</p>';
        }
    }

    document.getElementById('btnAbrirEstadisticas')?.addEventListener('click', abrirEstadisticas);
    document.getElementById('btnCerrarEstadisticas')?.addEventListener('click', () => {
        document.getElementById('modalEstadisticas').style.display = 'none';
        destruirCharts();
    });
    document.getElementById('modalEstadisticas')?.addEventListener('click', e => {
        if (e.target === document.getElementById('modalEstadisticas')) {
            document.getElementById('modalEstadisticas').style.display = 'none';
            destruirCharts();
        }
    });

})();