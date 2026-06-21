let estudianteActual = null;

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

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const dni = Number(document.getElementById('loginDni').value);
        const clave = document.getElementById('loginClave').value;

        if (!dni || !clave) {
            mostrarError("Completa ambos campos.");
            return;
        }

        try {
            const res = await apiFetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni, clave })
            });

            if (res.ok) {
                const data = await res.json();

                if (data.success) {
                    estudianteActual = {
                        nombre: data.alumno.nombre,
                        dni: dni,
                        carrera: data.alumno.carrera || '',
                        ano: data.alumno.anoCursado || '',
                        materias: data.materias.map(m => ({
                            id: m.materia_id,
                            nombre: m.nombre_materia,
                            modalidad: m.modalidad || '',
                            faltas: m.faltas || 0,
                            max_faltas: m.maxFaltas || m.max_faltas || 3
                        }))
                    };

                    mostrarDashboard();
                    return;
                }
            }
            mostrarError("Credenciales incorrectas.");
        } catch (e) {
            mostrarError("Error de conexión. Intentá de nuevo.");
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);

    document.getElementById('btnCerrarAlerta')?.addEventListener('click', cerrarAlerta);

    document.getElementById('btnCambiarClave').addEventListener('click', () => {
    document.getElementById('inputClaveActual').value = '';
    document.getElementById('inputClaveNueva').value = '';
    document.getElementById('inputClaveNuevaConfirm').value = '';

    const modal = document.getElementById('modalCambiarClave');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
});

document.getElementById('btnCerrarCambiarClave').addEventListener('click', () => {
    const modal = document.getElementById('modalCambiarClave');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
});

document.getElementById('btnConfirmarCambiarClave').addEventListener('click', async () => {
    const clave_actual       = document.getElementById('inputClaveActual').value;
    const clave_nueva        = document.getElementById('inputClaveNueva').value;
    const clave_confirmacion = document.getElementById('inputClaveNuevaConfirm').value;

    if (!clave_actual || !clave_nueva || !clave_confirmacion) {
        mostrarAlerta('Completá todos los campos.', 'error');
        return;
    }
    
    if (clave_nueva !== clave_confirmacion) {
        mostrarAlerta('Las claves nuevas no coinciden.', 'error');
        return;
    }
    const btn = document.getElementById('btnConfirmarCambiarClave');
    btn.disabled = true;
    btn.innerText = 'Guardando...';

    try {
        const res = await apiFetch('/api/alumno/cambiar-clave', {
            method: 'PUT',
            body: JSON.stringify({ clave_actual, clave_nueva, clave_confirmacion })
        });
        const data = await res.json();

        const modal = document.getElementById('modalCambiarClave');
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden');
            if (data.success) {
                mostrarAlerta('Contraseña actualizada correctamente.', 'success');
            } else {
                mostrarAlerta(data.message || 'Error al cambiar la contraseña.', 'error');
            }
        }, 300);
    } catch (err) {
        mostrarAlerta('Error al conectar con el servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Confirmar';
    }
});
});

// UI
function mostrarDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('dashNombre').innerText = estudianteActual.nombre;
    document.getElementById('dashDni').innerText = estudianteActual.dni;
    document.getElementById('dashCarrera').innerText = estudianteActual.carrera;
    document.getElementById('dashAno').innerText = estudianteActual.ano;
    renderizarTabla();
    iniciarPollingFaltas();
}

function mostrarError(msg) {
    const error = document.getElementById('loginError');
    error.innerText = msg;
    error.style.display = 'block';
}

function renderizarTabla() {
    const tbody = document.getElementById('tablaMaterias');
    tbody.innerHTML = '';

    if (!estudianteActual || estudianteActual.materias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1rem;">No estás inscripto en ninguna materia.</td></tr>';
        return;
    }

    estudianteActual.materias.forEach((materia, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        const tdNombre = document.createElement('td');
        tdNombre.style.cssText = 'padding: 1rem; font-weight: bold; text-align: center;'; 
        tdNombre.innerText = materia.nombre;

        const tdModalidad = document.createElement('td');
        tdModalidad.style.cssText = 'padding: 1rem; text-align: center;'; 
        
        const select = document.createElement('select');

        const estaLibre = (materia.modalidad || '').toUpperCase() === 'LIBRE';

        if (estaLibre) {
            select.style.cssText = 'background: rgba(239, 68, 68, 0.2); color: var(--accent-danger); border: 1px solid var(--accent-danger); padding: 0.4rem; border-radius: 4px; outline: none; cursor: not-allowed; font-weight: bold;';
            select.disabled = true;
            select.title = "No podés cambiar la modalidad porque quedaste LIBRE por inasistencias.";
        } else {
            select.style.cssText = 'background: rgba(0,0,0,0.3); color: white; border: 1px solid var(--border-color); padding: 0.4rem; border-radius: 4px; outline: none; cursor: pointer;';
        }

        if (estaLibre) {
            const optLibre = document.createElement('option');
            optLibre.value = 'LIBRE';
            optLibre.innerText = 'Libre';
            optLibre.selected = true;
            select.appendChild(optLibre);
        } else {
            [['CMC', 'Presencial (CMC)'], ['CMI', 'Semipresencial (CMI)']].forEach(([val, label]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = label;
                if (materia.modalidad && materia.modalidad.toUpperCase() === val) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        }

        if (!estaLibre) {
            select.addEventListener('change', (e) => cambiarModalidadSelect(index, e.target.value));
        }
        
        tdModalidad.appendChild(select);

        const tdFaltas = document.createElement('td');
        tdFaltas.style.cssText = 'padding: 1rem; text-align: center;';
        tdFaltas.setAttribute('data-faltas-id', materia.id);

        const faltas = materia.faltas || 0;
        const maxFaltas = materia.max_faltas || 3;
        const porcentaje = Math.min((faltas / maxFaltas) * 100, 100);

        let colorBarra, colorTexto;
        if (faltas >= maxFaltas) {
            colorBarra = 'var(--accent-danger)';
            colorTexto = 'var(--accent-danger)';
        } else if (faltas >= maxFaltas - 1) {
            colorBarra = '#f59e0b';
            colorTexto = '#f59e0b';
        } else {
            colorBarra = 'var(--accent-blue)';
            colorTexto = 'var(--text-secondary)';
        }

        tdFaltas.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:0.3rem; min-width:80px;">
                <span style="font-weight:bold; color:${colorTexto}; font-size:0.95rem;">${faltas} / ${maxFaltas}</span>
                <div style="width:100%; background:rgba(255,255,255,0.08); border-radius:99px; height:6px; overflow:hidden;">
                    <div style="width:${porcentaje}%; height:100%; background:${colorBarra}; border-radius:99px; transition:width 0.4s ease;"></div>
                </div>
            </div>
        `;

        const tdBaja = document.createElement('td');
        tdBaja.style.cssText = 'padding: 1rem; text-align: center;';

        const btnBaja = document.createElement('button');
        btnBaja.className = 'btn btn-inscripciones';
        btnBaja.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.8rem; border-color: var(--accent-danger); color: var(--accent-danger);';
        btnBaja.innerText = 'Baja';
        btnBaja.addEventListener('click', () => darDeBaja(index));
        
        tdBaja.appendChild(btnBaja);
        tr.appendChild(tdNombre);
        tr.appendChild(tdModalidad);
        tr.appendChild(tdFaltas);
        tr.appendChild(tdBaja);
        tbody.appendChild(tr);
    });
}

// cambiar modalidad de cursado

async function cambiarModalidadSelect(index, modalidad) {
    const materia = estudianteActual.materias[index];
    const labelUI = modalidad === 'CMC' ? 'Presencial (CMC)' : 'Semipresencial (CMI)';

    const confirmado = await pedirConfirmacion(
        `¿Querés cambiar la modalidad de ${materia.nombre} a ${labelUI}?`,
        'var(--accent-blue)',
        'Sí, cambiar'
    );

    if (!confirmado) {
        renderizarTabla();
        return;
    }

    try {
        const res = await apiFetch('/api/inscripciones/modalidad', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                dni: estudianteActual.dni,
                materia_id: materia.id,
                modalidad: modalidad,
                condicion: modalidad
            })
        });

        const data = await res.json();

        if (data.success) {
            estudianteActual.materias[index].modalidad = modalidad;
            guardarCambios();
            mostrarAlerta(`Cambiado a ${labelUI} con éxito.`, 'success');
        } else {
            mostrarAlerta("Error del servidor: " + data.message, 'error');
            renderizarTabla();
        }
    } catch (err) {
        mostrarAlerta("Error al conectar con el servidor.", 'error');
        renderizarTabla();
    }
}

// dar de baja materia
async function darDeBaja(index) {
    const materia = estudianteActual.materias[index];

    const confirmado = await pedirConfirmacion(
        `ATENCIÓN: ¿Estás seguro que querés DAR DE BAJA la materia ${materia.nombre}? Esta acción es permanente.`,
        'var(--accent-danger)',
        'Dar de Baja'
    );

    if (!confirmado) return;

    try {
        const res = await apiFetch(`/api/inscripciones/${estudianteActual.dni}/${materia.id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            estudianteActual.materias.splice(index, 1);
            renderizarTabla();
            setTimeout(() => mostrarAlerta(`Te diste de baja de ${materia.nombre} correctamente.`, 'success'), 50);
        } else {
            mostrarAlerta("No se pudo dar de baja la materia.", 'error');
        }
    } catch (err) {
        estudianteActual.materias.splice(index, 1);
        guardarCambios();
        renderizarTabla();
        mostrarAlerta(`Te diste de baja (Modo Local)`, 'success');
    }
}

function guardarCambios() {
    if (!estudianteActual) return;
}

let pollingInterval = null;

function iniciarPollingFaltas() {
    detenerPollingFaltas();
    pollingInterval = setInterval(actualizarFaltas, 30000);
}

function detenerPollingFaltas() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

async function actualizarFaltas() {
    if (!estudianteActual) return;
    try {
        const res = await apiFetch('/api/alumno/faltas', {
            headers: {}
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;
        console.log('Faltas API response:', data.materias);

        let huboCambio = false;
        let cambioModalidad = false;
        data.materias.forEach(m => {
            const idx = estudianteActual.materias.findIndex(mat => mat.id === m.materia_id);
            if (idx !== -1) {
                if (estudianteActual.materias[idx].faltas !== m.faltas) {
                    estudianteActual.materias[idx].faltas = m.faltas;
                    estudianteActual.materias[idx].max_faltas = m.maxFaltas || m.max_faltas || 3;
                    huboCambio = true;
                }
                if (m.modalidad !== undefined && estudianteActual.materias[idx].modalidad !== m.modalidad) {
                    estudianteActual.materias[idx].modalidad = m.modalidad;
                    cambioModalidad = true;
                    huboCambio = true;
                }
            }
        });

        if (cambioModalidad) {
            renderizarTabla();
            return;
        }

        if (huboCambio) {
            estudianteActual.materias.forEach(materia => {
                const celda = document.querySelector(`[data-faltas-id="${materia.id}"]`);
                if (!celda) return;

                const faltas = materia.faltas || 0;
                const maxFaltas = materia.max_faltas || 3;
                const porcentaje = Math.min((faltas / maxFaltas) * 100, 100);

                let colorBarra, colorTexto;
                if (faltas >= maxFaltas) {
                    colorBarra = 'var(--accent-danger)';
                    colorTexto = 'var(--accent-danger)';
                } else if (faltas >= maxFaltas - 1) {
                    colorBarra = '#f59e0b';
                    colorTexto = '#f59e0b';
                } else {
                    colorBarra = 'var(--accent-blue)';
                    colorTexto = 'var(--text-secondary)';
                }

                celda.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.3rem; min-width:80px;">
                        <span style="font-weight:bold; color:${colorTexto}; font-size:0.95rem;">${faltas} / ${maxFaltas}</span>
                        <div style="width:100%; background:rgba(255,255,255,0.08); border-radius:99px; height:6px; overflow:hidden;">
                            <div style="width:${porcentaje}%; height:100%; background:${colorBarra}; border-radius:99px; transition:width 0.4s ease;"></div>
                        </div>
                    </div>
                `;
            });
        }
    } catch (err) {
    }
}

// logout

async function cerrarSesion() {
    await apiFetch('/api/logout', { method: 'POST' });
    detenerPollingFaltas();
    estudianteActual = null;
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
}

// modales genericos

function mostrarAlerta(mensaje, tipo = 'error') {
    const icono = document.getElementById('iconoAlerta');
    const titulo = document.getElementById('tituloAlerta');
    document.getElementById('mensajeAlerta').innerText = mensaje;

    if (tipo === 'error') {
        icono.innerText = '⛔';
        titulo.innerText = 'Error';
        titulo.style.color = 'var(--accent-danger)';
    } else {
        icono.innerText = '✅';
        titulo.innerText = 'Éxito';
        titulo.style.color = 'var(--accent-success)';
    }
    const modal = document.getElementById('modalAlerta');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('active')));
}

function cerrarAlerta() {
    const modal = document.getElementById('modalAlerta');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function pedirConfirmacion(mensaje, colorBoton = 'var(--accent-blue)', textoConfirmar = 'Confirmar') {
    return new Promise((resolve) => {
        document.getElementById('mensajeConfirm').innerText = mensaje;
        const btnAceptar = document.getElementById('btnAceptarConfirm');
        const btnCancelar = document.getElementById('btnCancelarConfirm');
        const modal = document.getElementById('modalConfirmacion');

        btnAceptar.style.backgroundColor = colorBoton;
        btnAceptar.innerText = textoConfirmar;

        modal.classList.remove('hidden');
        requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('active')));

        const limpiarYResolver = (resultado) => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 300);
            btnAceptar.onclick = null;
            btnCancelar.onclick = null;
            resolve(resultado);
        };

        btnAceptar.onclick = () => limpiarYResolver(true);
        btnCancelar.onclick = () => limpiarYResolver(false);
    });
}