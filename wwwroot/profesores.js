let profeActual = null;
let listaAlumnos = [];
let asignacionesProfe = [];

function saneText(str) {
    const nodo = document.createElement('span');
    nodo.textContent = String(str ?? '');
    return nodo.innerHTML;
}

function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? match[1] : '';
}

const apiFetch = async (url, options = {}) => {
    return fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
            ...(options.headers || {})
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('loginFormDocente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dni = Number(document.getElementById('loginDni').value);
        const clave = document.getElementById('loginClave').value;
        const btn = document.querySelector('#loginFormDocente button');

        btn.innerText = "Verificando...";

        try {
            const res = await apiFetch('/api/profesores/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dni, clave })
        });
            const data = await res.json();

            if (data.success) {
                profeActual = data.profesor;
                asignacionesProfe = data.asignaciones;
                
                document.getElementById('loginError').style.display = 'none';
                document.getElementById('loginSection').classList.add('hidden');
                
                abrirSelectorAcademico();
            } else {
                document.getElementById('loginError').style.display = 'block';
            }
        } catch (err) {
            mostrarToast("Error de conexión con el servidor.", "danger");
        } finally {
            btn.innerText = "Ingresar";
        }
    });

    document.getElementById('modalNotas').addEventListener('input', (e) => {
    if (!e.target.classList.contains('nota-input')) return;
    
    let val = e.target.value;
    val = val.replace(/[^0-9.]/g, '');
    const partes = val.split('.');
    if (partes.length > 2) val = partes[0] + '.' + partes[1];
    if (partes[1]?.length > 2) val = partes[0] + '.' + partes[1].slice(0, 2);
    if (parseFloat(val) > 10) val = '10';
    e.target.value = val;
});

    document.getElementById('filtroCondicion').addEventListener('change', () => {
        renderizarTabla();
        renderizarHistorial();
    });

    document.getElementById('btnConfirmarBaja').addEventListener('click', async () => {
        if (!alumnoDniParaBaja) return;

        const btn = document.getElementById('btnConfirmarBaja');
        btn.disabled = true;
        btn.innerText = 'Procesando...';

        try {
            const res = await apiFetch(`/api/profesores/baja/${alumnoDniParaBaja}/${profeActual.materia_id}`, {
                method: 'DELETE',
                headers: {}
            });
            const data = await res.json();
            if (data.success) {
                cerrarModalBaja();
                cargarAlumnos();
                mostrarToast("Alumno dado de baja correctamente", "warning");
            } else {
                cerrarModalBaja();
                mostrarToast(data.message || "No se pudo dar de baja al alumno", "danger");
            }
        } catch (err) {
            cerrarModalBaja();
            mostrarToast("Error al intentar dar de baja", "danger");
        } finally {
            btn.disabled = false;
            btn.innerText = 'Dar de baja';
        }
    });


    document.getElementById('btnCancelarBaja').addEventListener('click', cerrarModalBaja);

    document.getElementById('btnCerrarSesion').addEventListener('click', cerrarSesion);
    document.getElementById('btnPlanilla').addEventListener('click', cargarPlanilla);
    document.getElementById('btnNotas').addEventListener('click', abrirPanelNotas);
    document.getElementById('btnGuardarNotas').addEventListener('click', guardarNotas);
    document.getElementById('btnCerrarNotas').addEventListener('click', cerrarPanelNotas);
    document.getElementById('btnCerrarPlanilla').addEventListener('click', cerrarPlanilla);
    document.getElementById('btnExportar').addEventListener('click', exportarPlanillaPDF);
    document.getElementById('btnVerHistorial').addEventListener('click', abrirPanelHistorial)
    document.getElementById('btnCerrarHistorial')?.addEventListener('click', cerrarPanelHistorial);
    document.getElementById('btnCancelarSelector')?.addEventListener('click', cerrarSesion);

let asistenciasHistorialActivo = []; 

document.getElementById('selectFechaHistorial')?.addEventListener('change', async (e) => {
    const fecha = e.target.value;
    
    if (!fecha) {
        document.getElementById('bodyHistorial').innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 1rem; color: var(--text-secondary);">Seleccioná una fecha arriba</td></tr>';
        asistenciasHistorialActivo = [];
        return;
    }

    const tbody = document.getElementById('bodyHistorial');
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 1rem;">Cargando lista...</td></tr>';

    try {
        const res = await apiFetch(`/api/profesores/asistencia/detalle/${profeActual.materia_id}/${fecha}`, {
        });
        const data = await res.json();

        if (data.success) {
            asistenciasHistorialActivo = data.asistencias.map(asis => {
                const infoAlumno = listaAlumnos.find(a => a.dni === asis.dni);
                return {
                    ...asis,
                    modalidad: infoAlumno ? infoAlumno.modalidad : 'desconocida' 
                };
            });
            
            renderizarHistorial(); 
        }
    } catch (err) {
        console.error("Error al cargar lista del día:", err.message);
        mostrarToast("Error al cargar la lista de ese día", "danger");
    }
});

function renderizarHistorial() {
    const tbody = document.getElementById('bodyHistorial');
    tbody.innerHTML = ''; 

    const filtro = (document.getElementById('filtroCondicion').value || '').toUpperCase();

    const alumnosFiltrados = asistenciasHistorialActivo.filter(a => {
        if (!filtro || filtro === 'TODOS' || filtro === 'TODAS') return true;
        const modUpper = (a.modalidad || '').toUpperCase();
        
        if (filtro === 'CMC') return modUpper.includes('CMC') || modUpper.includes('PRESENCIAL');
        if (filtro === 'CMI') return modUpper.includes('CMI') || modUpper.includes('VIRTUAL');
        if (filtro === 'LIBRE') return modUpper.includes('LIBRE');
        
        return modUpper.includes(filtro);
    });

    if (alumnosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 1rem; color: var(--text-secondary);">No hay alumnos para esta fecha/filtro.</td></tr>';
        return;
    }
    
    alumnosFiltrados.forEach(a => {
        let badge = a.modalidad || '-';
        const modUpper = badge.toUpperCase();
        
        if (modUpper.includes('CMC') || modUpper.includes('PRESENCIAL')) {
            badge = `<span class="badge badge-presencial" style="font-size: 0.7rem;">CMC</span>`;
        } else if (modUpper.includes('CMI') || modUpper.includes('VIRTUAL')) {
            badge = `<span class="badge badge-virtual" style="font-size: 0.7rem;">CMI</span>`;
        } else if (modUpper.includes('LIBRE')) {
            badge = `<span class="badge badge-virtual" style="border-color:var(--accent-warning);color:var(--accent-warning);font-size: 0.7rem;">Libre</span>`;
        }

        const colorEstado = a.estado === 'Presente' ? 'var(--accent-success)' : 'var(--accent-danger)';
        const letraEstado = a.estado === 'Presente' ? 'P' : 'A';

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 1rem 0.5rem;">
                    <strong>${saneText(a.nombre)}</strong> ${badge}<br>
                    <small style="color: var(--text-secondary)">DNI: ${a.dni}</small>
                </td>
                <td style="padding: 1rem 0.5rem; text-align: center;">
                    <span style="background: ${colorEstado}33; color: ${colorEstado}; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: bold; border: 1px solid ${colorEstado}">
                        ${letraEstado}
                    </span>
                </td>
            </tr>
        `;
    });
}

function abrirSelectorAcademico() {
    document.getElementById('selectorAcademicoSection').classList.remove('hidden');
    
    const carrerasUnicas = [...new Set(asignacionesProfe.map(a => a.carrera_id))];
    const selectCarrera = document.getElementById('selectCarreraProfe');
    
    selectCarrera.innerHTML = '<option value="">Seleccione Carrera...</option>';
    carrerasUnicas.forEach(c => {
        selectCarrera.innerHTML += `<option value="${c}">${c.toUpperCase()}</option>`;
    });

    document.getElementById('selectAnoProfe').innerHTML = '<option value="">Esperando carrera...</option>';
    document.getElementById('selectMateriaProfe').innerHTML = '<option value="">Esperando año...</option>';
}

document.getElementById('selectCarreraProfe')?.addEventListener('change', (e) => {
    const carreraId = e.target.value;
    const asignacionesCarrera = asignacionesProfe.filter(a => a.carrera_id === carreraId);
    
    const anosUnicos = [...new Set(asignacionesCarrera.map(a => a.ano))].sort();
    const selectAno = document.getElementById('selectAnoProfe');
    
    selectAno.innerHTML = '<option value="">Seleccione Año...</option>';
    anosUnicos.forEach(ano => {
        selectAno.innerHTML += `<option value="${ano}">${ano}º Año</option>`;
    });
});

document.getElementById('selectAnoProfe')?.addEventListener('change', (e) => {
    const carreraId = document.getElementById('selectCarreraProfe').value;
    const ano = parseInt(e.target.value);
    
    const materiasDisponibles = asignacionesProfe.filter(a => a.carrera_id === carreraId && a.ano === ano);
    const selectMateria = document.getElementById('selectMateriaProfe');
    
    const LABELS_DURACION = {
        anual: '',
        primer_cuatrimestre: ' [1er Cuatrimestre]',
        segundo_cuatrimestre: ' [2do Cuatrimestre]'
    };

    selectMateria.innerHTML = '<option value="">Seleccione Materia...</option>';
    materiasDisponibles.forEach(m => {
        const sufijoColega = m.tiene_colegas > 0 ? ' 👥' : '';
        selectMateria.innerHTML += `<option value="${m.materia_id}">${m.nombre_materia}${sufijoColega}</option>`;
    });
});

document.getElementById('btnIngresarMateria')?.addEventListener('click', () => {
    const materia_id = document.getElementById('selectMateriaProfe').value;
    if(!materia_id) return mostrarToast("Debes seleccionar una materia", "warning");

    const materiaSelec = asignacionesProfe.find(a => a.materia_id === materia_id);
    
    profeActual.materia_id = materia_id;
    profeActual.nombre_materia = materiaSelec.nombre_materia;
    profeActual.duracion_materia = materiaSelec.duracion || 'anual';
    profeActual.tiene_colegas = materiaSelec.tiene_colegas > 0;

    document.getElementById('selectorAcademicoSection').classList.add('hidden');
    
    mostrarDashboard();
    cargarAlumnos();
});
});

// funciones del dashboard

function mostrarDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('dashNombre').innerText = profeActual.nombre;

    const LABELS_DURACION = {
        anual: 'Anual',
        primer_cuatrimestre: '1er Cuatrimestre',
        segundo_cuatrimestre: '2do Cuatrimestre'
    };
    const labelDuracion = LABELS_DURACION[profeActual.duracion_materia] || '';
    const badgeDuracion = labelDuracion && profeActual.duracion_materia !== 'anual'
        ? ` <span style="font-size:0.72rem; padding: 2px 8px; border-radius: 12px; border: 1px solid var(--accent-warning); color: var(--accent-warning); vertical-align: middle;">${labelDuracion}</span>`
        : '';
    const badgeColegas = profeActual.tiene_colegas
        ? ` <span title="Hay otro/a Profesor asignado/a a esta materia" style="font-size:0.72rem; padding: 2px 8px; border-radius: 12px; border: 1px solid #a78bfa; color: #a78bfa; vertical-align: middle;">Comisión compartida</span>`
        : '';

    const dashMateria = document.getElementById('dashMateria');
    dashMateria.innerHTML = saneText(profeActual.nombre_materia) + badgeDuracion + badgeColegas;
}

async function cargarAlumnos() {
    if (!profeActual) return;
    try {
        const res = await apiFetch(`/api/profesores/alumnos/${profeActual.materia_id}`, {
            headers: {  }
        });
        const data = await res.json();
        if (data.success) {
            listaAlumnos = data.alumnos;
            renderizarTabla();
        }
    } catch (err) {
        console.error("Error cargando alumnos:", err.message);
        mostrarToast("Error al cargar la lista de alumnos", "danger");
    }
}

function renderizarTabla() {
    const tbody = document.getElementById('tablaAlumnos');
    tbody.innerHTML = '';
    if (!tbody) return;
    
    const filtro = (document.getElementById('filtroCondicion').value || '').toUpperCase();

    const alumnosFiltrados = listaAlumnos.filter(a => {
        const modUpper = (a.modalidad || '').toUpperCase();
        if (filtro === 'LIBRE') return modUpper.includes('LIBRE');
        if (modUpper.includes('LIBRE')) return false;

        if (!filtro || filtro === 'TODOS' || filtro === 'TODAS') return true;
        if (filtro === 'CMC') return modUpper.includes('CMC') || modUpper.includes('PRESENCIAL');
        if (filtro === 'CMI') return modUpper.includes('CMI') || modUpper.includes('VIRTUAL');
        
        return modUpper.includes(filtro);
    });

    if (alumnosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1rem;">No hay alumnos para mostrar.</td></tr>';
        return;
    }

    alumnosFiltrados.forEach(alumno => {
        const tr = document.createElement('tr');

        let badgeCondicion = alumno.modalidad || '-';
        const modUpper = badgeCondicion.toUpperCase();
        
        if (modUpper.includes('CMC') || modUpper.includes('PRESENCIAL')) {
            badgeCondicion = `<span class="badge badge-presencial">CMC (Presencial)</span>`;
        } else if (modUpper.includes('CMI') || modUpper.includes('VIRTUAL')) {
            badgeCondicion = `<span class="badge badge-virtual">CMI (Virtual)</span>`;
        } else if (modUpper.includes('LIBRE')) {
            badgeCondicion = `<span class="badge badge-virtual" style="border-color:var(--accent-warning);color:var(--accent-warning);">Libre</span>`;
        }

        tr.innerHTML = `
            <td style="font-weight: bold;">${saneText(alumno.nombre)}</td>
            <td>${alumno.dni}</td>
            <td>${badgeCondicion}</td>
            <td>
                ${modUpper.includes('LIBRE') 
                    ? `<span style="font-size: 0.8rem; color: var(--text-secondary);">Sin asistencia (Libre)</span>` 
                    : `<button class="btn btn-inscripciones btn-presente" data-dni="${alumno.dni}" data-nombre="${saneText(alumno.nombre)}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--accent-success); color: var(--accent-success);">P</button>
                        <button class="btn btn-inscripciones btn-ausente" data-dni="${alumno.dni}" data-nombre="${saneText(alumno.nombre)}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--accent-danger); color: var(--accent-danger);">A</button>`
                }
            </td>
            <td>
                <button class="btn btn-danger btn-baja" data-dni="${alumno.dni}" data-nombre="${saneText(alumno.nombre)}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Dar Baja</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-presente').forEach(btn => {
        btn.addEventListener('click', () => marcarAsistencia(btn.dataset.dni, btn.dataset.nombre, 'Presente'));
    });
    tbody.querySelectorAll('.btn-ausente').forEach(btn => {
        btn.addEventListener('click', () => marcarAsistencia(btn.dataset.dni, btn.dataset.nombre, 'Ausente'));
    });
    tbody.querySelectorAll('.btn-baja').forEach(btn => {
        btn.addEventListener('click', () => prepararBaja(btn.dataset.dni, btn.dataset.nombre));
    });
}

// asistencia y baja

async function marcarAsistencia(alumno_dni, alumno_nombre, estado) {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const fechaLocal = `${año}-${mes}-${dia}`;

    try {
        await apiFetch('/api/profesores/asistencia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({ 
                materia_id: profeActual.materia_id, 
                fecha: fechaLocal, 
                asistencias: [     
                    { dni: alumno_dni, estado: estado }
                ] 
            })
        });

        
        const tipo = estado === 'Presente' ? 'success' : 'danger';
        mostrarToast(`Marcaste a <b>${saneText(alumno_nombre)}</b> como ${estado}`, tipo);

        const seccionPlanilla = document.getElementById('seccionPlanilla');
        if (seccionPlanilla && !seccionPlanilla.classList.contains('hidden')) {
            cargarPlanilla();
        }

    } catch (err) {
        mostrarToast("Error al guardar la asistencia", "danger");
    }
}

let alumnoDniParaBaja = null;

function prepararBaja(dni, nombre) {
    alumnoDniParaBaja = dni;
    document.getElementById('nombreAlumnoBaja').innerText = nombre;
    document.getElementById('modalBaja').classList.remove('hidden');
    setTimeout(() => document.getElementById('modalBaja').classList.add('active'), 10);
}

function cerrarModalBaja() {
    alumnoDniParaBaja = null;
    document.getElementById('modalBaja').classList.remove('active');
    setTimeout(() => document.getElementById('modalBaja').classList.add('hidden'), 300);
}

async function cerrarSesion() {
    await apiFetch('/api/logout', { method: 'POST' });
    profeActual = null;
    listaAlumnos = [];

    document.getElementById('loginFormDocente').reset();
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('selectorAcademicoSection').classList.add('hidden');

    mostrarToast("Sesión cerrada correctamente");
}

// toast

function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toastContainer');
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

// planilla de asistencia

async function cargarPlanilla() {
    try {
        const res = await apiFetch(`/api/profesores/planilla/${profeActual.materia_id}`, {
        });
        const data = await res.json();
        if (!profeActual) return;

        if (data.success) {
            renderizarPlanilla(data.registros);
            document.getElementById('seccionPlanilla').classList.remove('hidden');
            document.getElementById('btnExportar').classList.remove('hidden');
        }
    } catch (err) {
        console.error("Error al cargar la planilla:", err.message);
        mostrarToast("Error al cargar la planilla", "danger");
    }
}

function renderizarPlanilla(registros) {
    const thead = document.getElementById('headPlanilla');
    const tbody = document.getElementById('bodyPlanilla');
    tbody.innerHTML = '';
    const fechasRaw = registros.map(r => r.fecha_corta).filter(f => f !== null);
    const fechasUnicas = [...new Set(fechasRaw)].sort((a, b) => {
        const [dA, mA] = a.split('/').map(Number);
        const [dB, mB] = b.split('/').map(Number);
        if (mA !== mB) return mA - mB;
        return dA - dB;
    });

    const alumnosMap = {};
    registros.forEach(r => {
        if (!alumnosMap[r.dni]) {
            alumnosMap[r.dni] = { nombre: r.nombre, modalidad: r.modalidad, asistencias: {} };
        }
        if (r.fecha_corta) {
            alumnosMap[r.dni].asistencias[r.fecha_corta] = r.estado;
        }
    });

    let trHead = `<tr>
        <th style="text-align: center; background: rgba(0,0,0,0.2); padding: 1rem;">Alumno</th>
        <th style="text-align: center; background: rgba(0,0,0,0.2); padding: 1rem;">Modalidad</th>
        <th style="text-align: center; background: rgba(0,0,0,0.2); padding: 1rem; color: var(--accent-blue);">% Asist.</th>`;
    fechasUnicas.forEach(fecha => {
        trHead += `<th style="background: rgba(0,0,0,0.2); padding: 1rem; text-align: center;">${fecha}</th>`;
    });
    trHead += `</tr>`;
    thead.innerHTML = trHead;

    Object.values(alumnosMap)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
    .forEach(alumno => {
        
        const tr = document.createElement('tr');

        let badge = alumno.modalidad || '-';
        const modUpper = badge.toUpperCase();
        
        if (modUpper.includes('CMC') || modUpper.includes('PRESENCIAL')) {
            badge = `<span class="badge badge-presencial">CMC</span>`;
        } else if (modUpper.includes('CMI') || modUpper.includes('VIRTUAL')) {
            badge = `<span class="badge badge-virtual">CMI</span>`;
        } else if (modUpper.includes('LIBRE')) {
            badge = `<span class="badge badge-virtual" style="border-color:var(--accent-warning);color:var(--accent-warning);">Libre</span>`;
        }

        let rowHtml = `
            <td style="text-align: center; font-weight: 600; padding: 0.8rem;">${saneText(alumno.nombre)}</td>
            <td style="text-align: center; padding: 0.8rem;">${badge}</td>
        `;

        // Calcular % de asistencia
        const totalClases = fechasUnicas.length;
        const presentes = fechasUnicas.filter(f => alumno.asistencias[f] === 'Presente').length;
        let pctCell = '<td style="text-align:center; padding:0.8rem; color:var(--text-secondary);">—</td>';
        if (totalClases > 0) {
            const pct = (presentes / totalClases) * 100;
            const pctStr = pct.toFixed(1) + '%';
            let colorPct = pct >= 75 ? 'var(--accent-success)' : pct >= 60 ? '#f59e0b' : 'var(--accent-danger)';
            const badgePct = pct < 75
                ? `<span style="font-size:0.65rem; margin-left:3px; color:var(--accent-danger);">⚠ &lt;75%</span>`
                : '';
            pctCell = `<td style="text-align:center; padding:0.8rem;">
                <span style="font-weight:bold; color:${colorPct};">${pctStr}</span>${badgePct}
            </td>`;
        }
        rowHtml += pctCell;

        fechasUnicas.forEach(fecha => {
            const estado = alumno.asistencias[fecha];
            let cellContent = '-';
            if (estado === 'Presente') cellContent = `<span style="color: var(--accent-success); font-weight: bold; font-size: 1.1rem;">P</span>`;
            else if (estado === 'Ausente') cellContent = `<span style="color: var(--accent-danger); font-weight: bold; font-size: 1.1rem;">A</span>`;
            rowHtml += `<td style="text-align: center; padding: 0.8rem; background: rgba(255,255,255,0.02); border-left: 1px solid rgba(255,255,255,0.05);">${cellContent}</td>`;
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    if (Object.keys(alumnosMap).length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding: 1rem;">No hay alumnos inscriptos.</td></tr>';
    }
}

function cerrarPlanilla() {
    document.getElementById('seccionPlanilla')?.classList.add('hidden');
    document.getElementById('btnExportar')?.classList.add('hidden');
    mostrarToast("Planilla cerrada", "warning");
}

// calificaciones

async function abrirPanelNotas() {
    if (!profeActual || !profeActual.materia_id) return;

    const modal = document.getElementById('modalNotas');
    
    const esCuatrimestral = profeActual.duracion_materia && profeActual.duracion_materia !== 'anual';
    const colSpan = esCuatrimestral ? '6' : '8';

    document.getElementById('bodyNotas').innerHTML = 
        `<tr><td colspan="${colSpan}" style="text-align:center; padding: 2rem; color: var(--text-secondary);">Cargando notas...</td></tr>`;
    
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('active'));

    try {
        const res = await apiFetch(`/api/profesores/notas/${profeActual.materia_id}`, {});
        const data = await res.json();
        
        if (data.success) {
            renderizarPanelNotas(data.alumnos, profeActual.duracion_materia);
            document.getElementById('seccionPlanilla')?.classList.add('hidden');
        } else {
            mostrarToast(data.message || "Error al cargar notas", "danger");
        }
    } catch (err) {
        mostrarToast("Error de conexión al servidor", "danger");
    }
}

function renderizarPanelNotas(alumnos, duracion_materia) {

    const tbody = document.getElementById('bodyNotas');
    const tabla = tbody.closest('table');
    let thead = tabla.querySelector('thead');
    
    if (!thead) {
        thead = document.createElement('thead');
        tabla.insertBefore(thead, tbody);
    }
    
    let duracionReal = duracion_materia || 'anual';
    const esMedioCuatri = duracionReal !== 'anual';
    
    if (esMedioCuatri) {
        thead.innerHTML = `
            <tr style="text-align: center; border-bottom: 2px solid var(--border-color); font-size: 0.85rem; color: var(--text-secondary);">
                <th style="text-align: left; padding: 1rem 0.5rem;">Alumno</th>
                <th style="padding: 1rem 0.5rem;">P1</th>
                <th style="padding: 1rem 0.5rem;">R1</th>
                <th style="padding: 1rem 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2); color: var(--accent-warning);">Final (≥6)</th>
                <th style="padding: 1rem 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2); color: #a78bfa;">Coloquio</th>
                <th style="padding: 1rem 0.5rem;">Estado</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr style="text-align: center; border-bottom: 2px solid var(--border-color); font-size: 0.85rem; color: var(--text-secondary);">
                <th style="text-align: left; padding: 1rem 0.5rem;">Alumno</th>
                <th style="padding: 1rem 0.5rem;">P1</th>
                <th style="padding: 1rem 0.5rem;">R1</th>
                <th style="padding: 1rem 0.5rem;">P2</th>
                <th style="padding: 1rem 0.5rem;">R2</th>
                <th style="padding: 1rem 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2); color: var(--accent-warning);">Final (≥6)</th>
                <th style="padding: 1rem 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2); color: #a78bfa;">Coloquio</th>
                <th style="padding: 1rem 0.5rem;">Estado</th>
            </tr>
        `;
    }

    tbody.innerHTML = '';

    alumnos.forEach(a => {
        const esLibre = (
            a.estado_academico === 'Libre' ||
            (a.modalidad || '').toUpperCase() === 'LIBRE'
        );

        let colorEstado = 'white';
        if (a.estado_academico === 'Promocionado' || a.estado_academico === 'Aprobado (Final)') {
            colorEstado = 'var(--accent-success)';
        } else if (a.estado_academico === 'Regular') {
            colorEstado = 'var(--accent-blue)';
        } else if (a.estado_academico === 'Libre') {
            colorEstado = 'var(--accent-danger)';
        } else if (a.estado_academico === 'Coloquio Pendiente') {
            colorEstado = '#a78bfa';
        }

        const crearInput = (idPrefijo, valor) => {
            const disabled = esLibre ? 'disabled title="Alumno libre, no rinde parciales"' : '';
            const opacity = esLibre ? '0.3' : '1';
            const cursor = esLibre ? 'not-allowed' : 'text';
            return `
                <input type="number" id="${idPrefijo}_${a.dni}" class="nota-input" min="0" max="10" step="0.01" placeholder="-" value="${valor || ''}" ${disabled} style="width: 55px; text-align: center; padding: 0.4rem; background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); color: white; border-radius: 6px; opacity: ${opacity}; cursor: ${cursor};">
            `;
        };

        const crearInputColoquio = (valor) => {
            const disabled = esLibre ? 'disabled' : '';
            const opacity = esLibre ? '0.3' : '1';
            return `
                <input type="number" id="coloquio_${a.dni}" class="nota-input" min="0" max="10" step="0.01" placeholder="-" value="${valor || ''}" ${disabled} style="width: 55px; text-align: center; padding: 0.4rem; background: rgba(167, 139, 250, 0.1); border: 1px solid #a78bfa; color: white; border-radius: 6px; opacity: ${opacity}; cursor: ${esLibre ? 'not-allowed' : 'text'};">
            `;
        };

        const estaHabilitadoParaFinal = (
            a.estado_academico === 'Regular' ||
            (a.estado_academico || '').includes('Aprobado')
        );

        const habFinalMedioCuatri = esMedioCuatri && (
            estaHabilitadoParaFinal ||
            (a.estado_academico === 'Cursando' && (parseFloat(a.nota_p1) > 0 || parseFloat(a.recup_p1) > 0))
        );

        const habilitarFinalReal = (esMedioCuatri ? habFinalMedioCuatri : estaHabilitadoParaFinal) || esLibre;
        const disableAttr = habilitarFinalReal ? '' : 'disabled title="El alumno debe tener nota cargada para rendir final"';
        const opacityStyle = habilitarFinalReal ? '1' : '0.3';
        const cursorFinal = habilitarFinalReal ? 'text' : 'not-allowed';

        const crearInputFinal = (idPrefijo, valor) => `
            <input type="number" id="${idPrefijo}_${a.dni}" class="nota-input" min="0" max="10" step="0.01" placeholder="-" value="${valor || ''}" ${disableAttr} style="width: 55px; text-align: center; padding: 0.4rem; background: rgba(245, 158, 11, 0.1); border: 1px solid var(--accent-warning); color: white; border-radius: 6px; opacity: ${opacityStyle}; cursor: ${cursorFinal};">
        `;

        let infoEditor = '';
        if (a.nombre_ultimo_editor && a.ultima_edicion) {
            const fechaEdicion = new Date(String(a.ultima_edicion).replace(' ', 'T')).toLocaleDateString('es-AR');
            infoEditor = `<div style="font-size:0.65rem; color: #a78bfa; margin-top: 2px;">✏️ ${saneText(a.nombre_ultimo_editor)} · ${fechaEdicion}</div>`;
        }

        let filaHTML;
        
        if (esMedioCuatri) {
            filaHTML = `
                <tr class="fila-nota" data-dni="${a.dni}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="text-align: left; padding: 1.2rem 0.5rem; font-weight: 600; font-size: 0.9rem;">
                        ${saneText(a.nombre)}
                        ${infoEditor}
                    </td>
                    <td style="padding: 0.5rem;">${crearInput('p1', a.nota_p1)}</td>
                    <td style="padding: 0.5rem;">${crearInput('r1', a.recup_p1)}</td>
                    <td style="padding: 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2);">${crearInputFinal('fin', a.nota_final)}</td>
                    <td style="padding: 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2);">${crearInputColoquio(a.nota_coloquio)}</td>
                    <td style="padding: 1rem 0.5rem;">
                        <span style="font-weight: 800; color: ${colorEstado}; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">
                            ${a.estado_academico || 'Cursando'}
                        </span>
                    </td>
                </tr>
            `;
        } else {
            filaHTML = `
                <tr class="fila-nota" data-dni="${a.dni}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="text-align: left; padding: 1.2rem 0.5rem; font-weight: 600; font-size: 0.9rem;">
                        ${saneText(a.nombre)}
                        ${infoEditor}
                    </td>
                    <td style="padding: 0.5rem;">${crearInput('p1', a.nota_p1)}</td>
                    <td style="padding: 0.5rem;">${crearInput('r1', a.recup_p1)}</td>
                    <td style="padding: 0.5rem;">${crearInput('p2', a.nota_p2)}</td>
                    <td style="padding: 0.5rem;">${crearInput('r2', a.recup_p2)}</td>
                    <td style="padding: 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2);">${crearInputFinal('fin', a.nota_final)}</td>
                    <td style="padding: 0.5rem; border-left: 2px dashed rgba(255,255,255,0.2);">${crearInputColoquio(a.nota_coloquio)}</td>
                    <td style="padding: 1rem 0.5rem;">
                        <span style="font-weight: 800; color: ${colorEstado}; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">
                            ${a.estado_academico || 'Cursando'}
                        </span>
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML += filaHTML;
    });
}

async function guardarNotas() {
    const filas = document.querySelectorAll('.fila-nota');
    const notasParaGuardar = [];

    const inputs = document.querySelectorAll('#modalNotas .nota-input');
    for (const input of inputs) {
        if (input.value === '' || input.disabled) continue;
        const val = parseFloat(input.value);
        if (isNaN(val) || val < 0 || val > 10) {
            mostrarToast('Las notas deben estar entre 0 y 10', 'warning');
            input.focus();
            return;
        }
        input.value = Math.round(val * 100) / 100;
    }
    const btn = document.getElementById('btnGuardarNotas');
    const textoOriginal = btn.innerText;
    btn.innerText = "Guardando...";

    const esMedioCuatri = profeActual.duracion_materia && profeActual.duracion_materia !== 'anual';

    filas.forEach(fila => {
        const dni = fila.getAttribute('data-dni');
        if (esMedioCuatri) {
            notasParaGuardar.push({
                dni,
                p1:       document.getElementById(`p1_${dni}`)?.value || null,
                p2:       null,
                r1:       document.getElementById(`r1_${dni}`)?.value || null,
                r2:       null,
                final:    document.getElementById(`fin_${dni}`)?.value || null,
                r_final:  null,  // sin recuperatorio de final
                coloquio: document.getElementById(`coloquio_${dni}`)?.value || null,
            });
        } else {
            notasParaGuardar.push({
                dni,
                p1:       document.getElementById(`p1_${dni}`)?.value || null,
                p2:       document.getElementById(`p2_${dni}`)?.value || null,
                r1:       document.getElementById(`r1_${dni}`)?.value || null,
                r2:       document.getElementById(`r2_${dni}`)?.value || null,
                final:    document.getElementById(`fin_${dni}`)?.value || null,
                r_final:  null,  // sin recuperatorio de final
                coloquio: document.getElementById(`coloquio_${dni}`)?.value || null,
            });
        }
    });

    try {
        const res = await apiFetch('/api/profesores/notas/guardar', {
            method: 'POST',
            body: JSON.stringify({
                materia_id: profeActual.materia_id,
                notas: notasParaGuardar,
                promediar_recuperatorio: profeActual.promediar_recuperatorio
            })
        });

        const data = await res.json();
        if (data.success) {
            mostrarToast("Calificaciones y estados actualizados");
            abrirPanelNotas();
        }
    } catch (err) {
        mostrarToast("Error de conexión al guardar", "danger");
    } finally {
        btn.innerText = textoOriginal;
    }
}

function cerrarPanelNotas() {
    const modal = document.getElementById('modalNotas');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}
function abrirPanelAsistencia() {
    if (!profeActual || listaAlumnos.length === 0) {
        mostrarToast("No hay alumnos inscritos en esta materia", "danger");
        return;
    }

    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    document.getElementById('fechaAsistencia').value = `${año}-${mes}-${dia}`;

    const tbody = document.getElementById('bodyTomaAsistencia');
    tbody.innerHTML = '';

    listaAlumnos.forEach(alumno => {
    if ((alumno.modalidad || '').toUpperCase().includes('LIBRE')) return;

    tbody.innerHTML += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);" class="fila-asistencia" data-dni="${alumno.dni}">
            <td style="padding: 0.8rem 0.5rem;">${saneText(alumno.nombre)}</td>
            <td style="text-align: center;">
                <input type="radio" name="asist_${alumno.dni}" value="Presente" checked style="transform: scale(1.5); accent-color: var(--accent-success);">
            </td>
            <td style="text-align: center;">
                <input type="radio" name="asist_${alumno.dni}" value="Ausente" style="transform: scale(1.5); accent-color: var(--accent-danger);">
            </td>
        </tr>
    `;
});

    document.getElementById('modalAsistencia').classList.remove('hidden');
}

function cerrarPanelAsistencia() {
    document.getElementById('modalAsistencia').classList.add('hidden');
}

async function guardarAsistenciaDiaria() {
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!fecha) {
        mostrarToast("Selecciona una fecha válida", "danger");
        return;
    }

    const filas = document.querySelectorAll('.fila-asistencia');
    const asistencias = [];

    filas.forEach(fila => {
        const dni = fila.getAttribute('data-dni');
        const input = document.querySelector(`input[name="asist_${dni}"]:checked`);
        if (!input) return;
        const estado = input.value;
        asistencias.push({ dni, estado });
    });

    try {
        const res = await apiFetch('/api/profesores/asistencia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({ 
                materia_id: profeActual.materia_id, 
                fecha: fecha, 
                asistencias: asistencias 
            })
        });

        const data = await res.json();
        if (data.success) {
            mostrarToast("Asistencia guardada correctamente", "success");
            cerrarPanelAsistencia();
        } else {
            mostrarToast("Error al guardar", "danger");
        }
    } catch (err) {
        mostrarToast("Error de conexión", "danger");
    }
}

// historial de asistencias

async function abrirPanelHistorial() {
    if (!profeActual) return;
    
    const modal = document.getElementById('modalHistorial');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10); 
    
    const selectFecha = document.getElementById('selectFechaHistorial');
    selectFecha.innerHTML = '<option value="">Cargando fechas...</option>';
    document.getElementById('bodyHistorial').innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 1rem; color: var(--text-secondary);">Seleccioná una fecha arriba</td></tr>';

    try {
        const res = await apiFetch(`/api/profesores/asistencia/fechas/${profeActual.materia_id}`, {
        });
        
        const data = await res.json();

        if (data.success && data.fechas.length > 0) {
            selectFecha.innerHTML = '<option value="">Elegí una clase...</option>';
            data.fechas.forEach(f => {
                const dateObj = new Date(f.fecha);
                const fechaLocal = dateObj.toLocaleDateString('es-AR', { timeZone: 'UTC' }); 
                selectFecha.innerHTML += `<option value="${f.fecha.split('T')[0]}">${fechaLocal}</option>`;
            });
        } else {
            selectFecha.innerHTML = '<option value="">No hay asistencias registradas</option>';
        }
    } catch (err) {
        mostrarToast("Error al cargar las fechas", "danger");
    }
}

function cerrarPanelHistorial() {
    const modal = document.getElementById('modalHistorial');
    
    modal.classList.remove('active'); 
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('selectFechaHistorial').value = ""; 
        document.getElementById('bodyHistorial').innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 1rem; color: var(--text-secondary);">Seleccioná una fecha arriba</td></tr>';
        asistenciasHistorialActivo = [];
    }, 300);
}

// exportar planilla a PDF

function exportarPlanillaPDF() {
    const thead = document.getElementById('headPlanilla');
    const tbody = document.getElementById('bodyPlanilla');

    if (!thead || !tbody || tbody.children.length === 0) {
        mostrarToast("Abrí la planilla antes de exportar", "danger");
        return;
    }

    const materia = profeActual.nombre_materia || 'Materia';
    const profe   = profeActual.nombre || '';
    const hoy     = new Date().toLocaleDateString('es-AR');

    const allHeaders = Array.from(thead.querySelectorAll('th')).map(th => th.innerText.trim());
    const fixedHeaders = allHeaders.slice(0, 3);  // Alumno, Modalidad, % Asist.
    const dateHeaders = allHeaders.slice(3);

    const rows = [];
    tbody.querySelectorAll('tr').forEach(tr => {
        const cols = tr.querySelectorAll('td');
        if (cols.length === 0) return;
        rows.push(Array.from(cols).map(td => td.innerText.trim() || '-'));
    });

    // Dividir en partes si hay muchas fechas

    const COLUMNAS_POR_PAGINA = 15; 
    let tablasHTML = '';

    const loopCount = Math.max(1, dateHeaders.length);

    for (let i = 0; i < loopCount; i += COLUMNAS_POR_PAGINA) {
        const chunkDates = dateHeaders.slice(i, i + COLUMNAS_POR_PAGINA);
        
        const headCeldas = [...fixedHeaders, ...chunkDates].map(h => `<th>${h}</th>`).join('');

        const filasHTML = rows.map((row, index) => {
            const bg = index % 2 === 0 ? '#f8fafc' : '#ffffff';
            
            const fixedCells = row.slice(0, 3).map((cell, ci) => {
                    // Columna 2 (índice 2) es el % de asistencia: aplicar color
                    if (ci === 2) {
                        const val = parseFloat(cell);
                        const color = !isNaN(val)
                            ? (val >= 75 ? '#16a34a' : val >= 60 ? '#d97706' : '#dc2626')
                            : '#94a3b8';
                        return `<td style="text-align:center; color:${color}; font-weight:bold;">${cell}</td>`;
                    }
                    return `<td>${cell}</td>`;
                }).join('');
            
            const dateCells = row.slice(3).slice(i, i + COLUMNAS_POR_PAGINA).map(cell => {
                const color = cell === 'P' ? '#16a34a' : cell === 'A' ? '#dc2626' : '#94a3b8';
                return `<td style="text-align:center; color:${color} !important; font-weight:bold;">${cell}</td>`;
            }).join('');

            return `<tr style="background:${bg} !important;">${fixedCells}${dateCells}</tr>`;
        }).join('');

        const parteTitulo = dateHeaders.length > COLUMNAS_POR_PAGINA 
                            ? `(Parte ${Math.floor(i / COLUMNAS_POR_PAGINA) + 1})` 
                            : '';

        const pageBreak = (i + COLUMNAS_POR_PAGINA < dateHeaders.length) ? 'page-break-after: always;' : '';

        tablasHTML += `
        <div style="${pageBreak} margin-bottom: 20px;">
            <div class="encabezado">
                <div>
                <h1>Planilla de Asistencias ${parteTitulo}</h1>
                <p>Materia: <strong style="color:white !important">${materia}</strong> &nbsp;|&nbsp; Profesor: <strong style="color:white !important">${profe}</strong></p>
                </div>
                <div class="fecha">Exportado: ${hoy}</div>
            </div>
            <table>
                <thead><tr>${headCeldas}</tr></thead>
                <tbody>${filasHTML}</tbody>
            </table>
        </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Asistencias - ${materia}</title>
<style>
    /* FORZAR COLORES EN TODOS LOS NAVEGADORES */
    * { 
        box-sizing: border-box; margin: 0; padding: 0; 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }

    body { font-family: Arial, sans-serif; font-size: 10px; color: #1e293b; padding: 20px; }

    .encabezado { 
        background: #1e293b !important; 
        color: white !important; 
        padding: 14px 18px; 
        border-radius: 6px; 
        margin-bottom: 16px; 
        display: flex; justify-content: space-between; align-items: center; 
    }
    .encabezado h1 { font-size: 15px; margin-bottom: 4px; color: white !important; }
    .encabezado p  { font-size: 10px; color: #cbd5e1 !important; }
    .encabezado .fecha { text-align: right; font-size: 10px; color: #cbd5e1 !important; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #334155 !important; color: white !important; }
    th { padding: 8px 6px; text-align: left; font-size: 9px; text-transform: uppercase; border: 1px solid #475569; color: white !important; }
    td { padding: 7px 6px; border: 1px solid #e2e8f0; }
    
    @media print {
        body { padding: 0; margin: 0; }
        @page { size: A4 landscape; margin: 10mm; }
    }
</style>
</head>
<body>
    ${tablasHTML}
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=1000,height=700');
    if (!ventana) {
        mostrarToast("El navegador bloqueó la ventana emergente.", "danger");
        return;
    }
    ventana.document.write(html);
    ventana.document.close();
    
    setTimeout(() => ventana.print(), 400);
}