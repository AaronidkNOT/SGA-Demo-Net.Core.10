-- ============================================================
-- SGA - Seed de datos DEMO (100% ficticios)
-- Carga: admin, profesores, alumnos, materias, correlativas,
--        inscripciones, notas y asistencias de ejemplo.
--
-- Uso: mysql -u root -p gestion_academica < seed_demo.sql
-- Las contraseñas hasheadas corresponden a "Demo1234" (bcrypt, costo 10).
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Limpieza (solo datos demo, no toca la estructura)
DELETE FROM asistencias;
DELETE FROM notas;
DELETE FROM auditoria_notas;
DELETE FROM homologaciones;
DELETE FROM inscripciones;
DELETE FROM correlativas;
DELETE FROM horarios;
DELETE FROM profesor_asignaciones;
DELETE FROM materias;
DELETE FROM alumnos;
DELETE FROM profesores;
DELETE FROM usuarios_admin;
DELETE FROM configuracion;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. ADMIN
-- ============================================================
INSERT INTO usuarios_admin (usuario, clave) VALUES
('admin@demo.com', '$2b$10$Q9EgG9iQb09A.2iRoDL1DOm8jNw..bB4mwC5n7gS9B9lWmAhvbQuq');

-- ============================================================
-- 2. CONFIGURACION
-- ============================================================
INSERT INTO configuracion (clave, valor) VALUES
('inscripciones_abiertas', 'true');

-- ============================================================
-- 3. MATERIAS
-- Carreras demo: Sistemas (sis, 3 años) y Seguridad e Higiene (seg, 3 años)
-- id = {prefijo}_{año}_{numero}
-- ============================================================
INSERT INTO materias (id, nombre, duracion, max_faltas) VALUES
('sis_1_1', 'Programación I', 'anual', 3),
('sis_1_2', 'Matemática Discreta', 'anual', 3),
('sis_2_1', 'Programación II', 'anual', 3),
('sis_2_2', 'Base de Datos I', 'primer_cuatrimestre', 3),
('sis_3_1', 'Programación III', 'anual', 3),
('sis_3_2', 'Redes y Comunicaciones', 'segundo_cuatrimestre', 3),

('seg_1_1', 'Higiene y Seguridad I', 'anual', 3),
('seg_1_2', 'Legislación Laboral', 'primer_cuatrimestre', 3),
('seg_2_1', 'Higiene y Seguridad II', 'anual', 3),
('seg_2_2', 'Ergonomía', 'segundo_cuatrimestre', 3),
('seg_3_1', 'Gestión de Riesgos', 'anual', 3),
('seg_3_2', 'Práctica Profesional', 'segundo_cuatrimestre', 3);

-- ============================================================
-- 4. CORRELATIVAS (para mostrar la lógica CMC/CMI/Libre)
-- ============================================================
INSERT INTO correlativas (materia_id, requiere_materia_id) VALUES
('sis_2_1', 'sis_1_1'),
('sis_3_1', 'sis_2_1'),
('seg_2_1', 'seg_1_1'),
('seg_3_1', 'seg_2_1');

-- ============================================================
-- 5. PROFESORES
-- Incluye el profesor demo fijo (DNI 11111111 / Demo1234)
-- ============================================================
INSERT INTO profesores (dni, nombre, email, clave, promediar_recuperatorio) VALUES
(11111111, 'Profesor Demo', 'profesor.demo@sga.local', '$2b$10$HIaWBIEmQxvyE2SPY0NZcOQNcug9D/ab.FU1zyjeYMdSRx5.JbJYa', 1),
(30111222, 'Marcos Fernández', 'mfernandez@sga.local', '$2b$10$HIaWBIEmQxvyE2SPY0NZcOQNcug9D/ab.FU1zyjeYMdSRx5.JbJYa', 1),
(30222333, 'Lucía Gómez', 'lgomez@sga.local', '$2b$10$HIaWBIEmQxvyE2SPY0NZcOQNcug9D/ab.FU1zyjeYMdSRx5.JbJYa', 0),
(30333444, 'Walter Sosa', 'wsosa@sga.local', '$2b$10$HIaWBIEmQxvyE2SPY0NZcOQNcug9D/ab.FU1zyjeYMdSRx5.JbJYa', 1),
(30444555, 'Romina Paz', 'rpaz@sga.local', '$2b$10$HIaWBIEmQxvyE2SPY0NZcOQNcug9D/ab.FU1zyjeYMdSRx5.JbJYa', 0);

INSERT INTO profesor_asignaciones (profesor_dni, carrera_id, ano, materia_id) VALUES
(11111111, 'sistemas', 1, 'sis_1_1'),
(30111222, 'sistemas', 1, 'sis_1_1'),
(30111222, 'sistemas', 2, 'sis_2_1'),
(30222333, 'sistemas', 1, 'sis_1_2'),
(30222333, 'sistemas', 3, 'sis_3_2'),
(30333444, 'seguridad', 1, 'seg_1_1'),
(30333444, 'seguridad', 2, 'seg_2_1'),
(30444555, 'seguridad', 1, 'seg_1_2'),
(30444555, 'seguridad', 3, 'seg_3_1');

-- ============================================================
-- 6. ALUMNOS
-- Incluye el alumno demo fijo (DNI 22222222 / Demo1234)
-- ============================================================
INSERT INTO alumnos (dni, nombre, email, telefono, carrera, clave, ano_cursado) VALUES
(22222222, 'Alumno Demo', 'alumno.demo@sga.local', '3511234567', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 1),

(40100001, 'Martina Acosta',    'macosta@demo.local',   '3511000001', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 1),
(40100002, 'Federico Luna',     'fluna@demo.local',     '3511000002', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 1),
(40100003, 'Sofía Ibarra',      'sibarra@demo.local',   '3511000003', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 2),
(40100004, 'Bruno Medina',      'bmedina@demo.local',   '3511000004', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 2),
(40100005, 'Camila Rojas',      'crojas@demo.local',    '3511000005', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 3),
(40100006, 'Ezequiel Torres',   'etorres@demo.local',   '3511000006', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 3),

(40200001, 'Valentina Ríos',    'vrios@demo.local',     '3511000007', 'seguridad', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 1),
(40200002, 'Tomás Herrera',     'therrera@demo.local',  '3511000008', 'seguridad', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 1),
(40200003, 'Agustina Molina',   'amolina@demo.local',   '3511000009', 'seguridad', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 2),
(40200004, 'Nicolás Vega',      'nvega@demo.local',     '3511000010', 'seguridad', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 2),
(40200005, 'Julieta Campos',    'jcampos@demo.local',   '3511000011', 'seguridad', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 3),
(40200006, 'Matías Núñez',      'mnunez@demo.local',    '3511000012', 'seguridad', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 3),
(40100007, 'Florencia Aguirre', 'faguirre@demo.local',  '3511000013', 'sistemas', '$2b$10$rRd3qvYVVPtwmj215EbpjO5vgj6Xs4Hs3bR1FVgDh9143IR.BBzUO', 1);

-- ============================================================
-- 7. INSCRIPCIONES
-- ============================================================
INSERT INTO inscripciones (alumno_dni, materia_id, modalidad) VALUES
-- Alumno demo
(22222222, 'sis_1_1', 'CMC'),
(22222222, 'sis_1_2', 'CMC'),

-- Año 1 sistemas
(40100001, 'sis_1_1', 'CMC'),
(40100001, 'sis_1_2', 'CMI'),
(40100002, 'sis_1_1', 'CMC'),
(40100002, 'sis_1_2', 'CMC'),
(40100007, 'sis_1_1', 'CMI'),
(40100007, 'sis_1_2', 'CMC'),

-- Año 2 sistemas
(40100003, 'sis_2_1', 'CMC'),
(40100003, 'sis_2_2', 'CMC'),
(40100004, 'sis_2_1', 'Libre'),
(40100004, 'sis_2_2', 'CMC'),

-- Año 3 sistemas
(40100005, 'sis_3_1', 'CMC'),
(40100005, 'sis_3_2', 'CMC'),
(40100006, 'sis_3_1', 'CMI'),
(40100006, 'sis_3_2', 'CMC'),

-- Año 1 seguridad
(40200001, 'seg_1_1', 'CMC'),
(40200001, 'seg_1_2', 'CMC'),
(40200002, 'seg_1_1', 'CMI'),
(40200002, 'seg_1_2', 'CMC'),

-- Año 2 seguridad
(40200003, 'seg_2_1', 'CMC'),
(40200003, 'seg_2_2', 'CMC'),
(40200004, 'seg_2_1', 'CMC'),
(40200004, 'seg_2_2', 'Libre'),

-- Año 3 seguridad
(40200005, 'seg_3_1', 'CMC'),
(40200005, 'seg_3_2', 'CMC'),
(40200006, 'seg_3_1', 'CMC'),
(40200006, 'seg_3_2', 'CMI');

-- ============================================================
-- 8. NOTAS (mezcla de estados: Cursando, Aprobado, Libre)
-- ============================================================
INSERT INTO notas (alumno_dni, materia_id, nota_p1, nota_p2, nota_coloquio, nota_final, estado_academico, ultimo_editor_dni, ultima_edicion) VALUES
(22222222, 'sis_1_1', 7.5, 8.0, NULL, NULL, 'Cursando', 11111111, NOW()),
(22222222, 'sis_1_2', 6.0, NULL, NULL, NULL, 'Cursando', 30222333, NOW()),

(40100001, 'sis_1_1', 8.0, 9.0, 8.5, 8.5, 'Aprobado (Cursada)', 11111111, NOW()),
(40100002, 'sis_1_1', 5.0, 4.0, NULL, NULL, 'Cursando', 11111111, NOW()),
(40100007, 'sis_1_2', 6.5, 7.0, NULL, NULL, 'Cursando', 30222333, NOW()),

(40100003, 'sis_2_1', 7.0, 8.0, 9.0, 9.0, 'Aprobado (Final)', 30111222, NOW()),
(40100004, 'sis_2_1', NULL, NULL, NULL, NULL, 'Libre', 30111222, NOW()),

(40100005, 'sis_3_1', 9.0, 9.0, 10.0, 10.0, 'Aprobado (Final)', 30222333, NOW()),
(40100006, 'sis_3_2', 6.0, 6.5, NULL, NULL, 'Cursando', 30222333, NOW()),

(40200001, 'seg_1_1', 7.0, 7.5, NULL, NULL, 'Cursando', 30333444, NOW()),
(40200002, 'seg_1_1', 8.5, 9.0, 9.0, 9.0, 'Aprobado (Final)', 30333444, NOW()),

(40200003, 'seg_2_1', 6.0, 5.5, NULL, NULL, 'Cursando', 30333444, NOW()),
(40200004, 'seg_2_2', NULL, NULL, NULL, NULL, 'Libre', 30444555, NOW()),

(40200005, 'seg_3_1', 8.0, 8.0, 8.0, 8.0, 'Aprobado (Final)', 30444555, NOW()),
(40200006, 'seg_3_1', 7.0, 6.0, NULL, NULL, 'Cursando', 30444555, NOW());

-- ============================================================
-- 9. ASISTENCIAS (algunas presentes, algunas ausentes)
-- ============================================================
INSERT INTO asistencias (alumno_dni, materia_id, fecha, estado) VALUES
(22222222, 'sis_1_1', '2026-04-06', 'Presente'),
(22222222, 'sis_1_1', '2026-04-13', 'Presente'),
(22222222, 'sis_1_1', '2026-04-20', 'Ausente'),
(22222222, 'sis_1_2', '2026-04-07', 'Presente'),

(40100001, 'sis_1_1', '2026-04-06', 'Presente'),
(40100001, 'sis_1_1', '2026-04-13', 'Ausente'),
(40100001, 'sis_1_1', '2026-04-20', 'Ausente'),
(40100001, 'sis_1_1', '2026-04-27', 'Ausente'),

(40100002, 'sis_1_1', '2026-04-06', 'Ausente'),
(40100002, 'sis_1_1', '2026-04-13', 'Presente'),

(40200001, 'seg_1_1', '2026-04-08', 'Presente'),
(40200001, 'seg_1_1', '2026-04-15', 'Presente'),
(40200002, 'seg_1_1', '2026-04-08', 'Ausente');

-- ============================================================
-- Listo. Credenciales demo:
--   Admin:     admin@demo.com   / Demo1234
--   Profesor:  DNI 11111111     / Demo1234
--   Alumno:    DNI 22222222     / Demo1234
-- ============================================================
