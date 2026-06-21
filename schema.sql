-- ============================================================
-- SGA - Esquema de base de datos (MySQL 8)
-- Reconstruido a partir de las queries de Dapper en los Controllers.
-- Uso: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestion_academica
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gestion_academica;

-- ============================================================
-- Administradores
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios_admin (
  usuario VARCHAR(100) NOT NULL,
  clave   VARCHAR(255) NOT NULL,
  PRIMARY KEY (usuario)
) ENGINE=InnoDB;

-- ============================================================
-- Configuración general (clave/valor)
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(100) NOT NULL,
  valor VARCHAR(255) NOT NULL,
  PRIMARY KEY (clave)
) ENGINE=InnoDB;

-- ============================================================
-- Materias
-- id con formato {prefijo_carrera}_{año}_{numero}, ej: sis_1_1
-- ============================================================
CREATE TABLE IF NOT EXISTS materias (
  id         VARCHAR(20)  NOT NULL,
  nombre     VARCHAR(150) NOT NULL,
  duracion   VARCHAR(30)  NOT NULL DEFAULT 'anual',
  max_faltas INT          NOT NULL DEFAULT 3,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ============================================================
-- Correlativas (qué materia exige a cuál como requisito)
-- ============================================================
CREATE TABLE IF NOT EXISTS correlativas (
  id                  INT AUTO_INCREMENT NOT NULL,
  materia_id          VARCHAR(20) NOT NULL,
  requiere_materia_id VARCHAR(20) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_correlativas_materia (materia_id),
  CONSTRAINT fk_correlativas_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
  CONSTRAINT fk_correlativas_requiere
    FOREIGN KEY (requiere_materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Horarios de cursada
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios (
  id           INT AUTO_INCREMENT NOT NULL,
  materia_id   VARCHAR(20) NOT NULL,
  carrera_id   VARCHAR(50) NOT NULL,
  ano          INT NOT NULL,
  dia_semana   TINYINT NOT NULL,
  hora_inicio  TIME NOT NULL,
  hora_fin     TIME NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_horarios_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Feriados (usados para no contar ausencias en esos días)
-- ============================================================
CREATE TABLE IF NOT EXISTS feriados (
  id     INT AUTO_INCREMENT NOT NULL,
  fecha  DATE NOT NULL,
  motivo VARCHAR(150) NOT NULL,
  tipo   VARCHAR(50)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feriados_fecha (fecha)
) ENGINE=InnoDB;

-- ============================================================
-- Profesores
-- ============================================================
CREATE TABLE IF NOT EXISTS profesores (
  dni                     INT NOT NULL,
  nombre                  VARCHAR(150) NOT NULL,
  email                   VARCHAR(150) NULL,
  clave                   VARCHAR(255) NOT NULL,
  promediar_recuperatorio TINYINT(1) NOT NULL DEFAULT 0,
  fecha_cambio_clave      DATETIME NULL,
  PRIMARY KEY (dni)
) ENGINE=InnoDB;

-- ============================================================
-- Asignaciones de materias a profesores
-- ============================================================
CREATE TABLE IF NOT EXISTS profesor_asignaciones (
  id            INT AUTO_INCREMENT NOT NULL,
  profesor_dni  INT NOT NULL,
  carrera_id    VARCHAR(50) NOT NULL,
  ano           INT NOT NULL,
  materia_id    VARCHAR(20) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_asignaciones_profesor (profesor_dni),
  CONSTRAINT fk_asignaciones_profesor
    FOREIGN KEY (profesor_dni) REFERENCES profesores(dni) ON DELETE CASCADE,
  CONSTRAINT fk_asignaciones_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Alumnos
-- ============================================================
CREATE TABLE IF NOT EXISTS alumnos (
  dni                INT NOT NULL,
  nombre             VARCHAR(150) NOT NULL,
  email              VARCHAR(150) NOT NULL,
  telefono           VARCHAR(30)  NULL,
  carrera            VARCHAR(50)  NOT NULL,
  clave              VARCHAR(255) NOT NULL,
  ano_cursado        INT NOT NULL DEFAULT 1,
  fecha_cambio_clave DATETIME NULL,
  PRIMARY KEY (dni)
) ENGINE=InnoDB;

-- ============================================================
-- Inscripciones (alumno cursando una materia)
-- ============================================================
CREATE TABLE IF NOT EXISTS inscripciones (
  alumno_dni INT NOT NULL,
  materia_id VARCHAR(20) NOT NULL,
  modalidad  VARCHAR(20) NOT NULL DEFAULT 'CMC',
  PRIMARY KEY (alumno_dni, materia_id),
  CONSTRAINT fk_inscripciones_alumno
    FOREIGN KEY (alumno_dni) REFERENCES alumnos(dni) ON DELETE CASCADE,
  CONSTRAINT fk_inscripciones_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Notas / estado académico por alumno y materia
-- ============================================================
CREATE TABLE IF NOT EXISTS notas (
  alumno_dni        INT NOT NULL,
  materia_id        VARCHAR(20) NOT NULL,
  nota_p1           DECIMAL(4,2) NULL,
  nota_p2           DECIMAL(4,2) NULL,
  recup2            DECIMAL(4,2) NULL,
  nota_coloquio     DECIMAL(4,2) NULL,
  nota_final        DECIMAL(4,2) NULL,
  recup_final       DECIMAL(4,2) NULL,
  estado_academico  VARCHAR(40) NOT NULL DEFAULT 'Pendiente',
  ultimo_editor_dni INT NULL,
  ultima_edicion    DATETIME NULL,
  PRIMARY KEY (alumno_dni, materia_id),
  CONSTRAINT fk_notas_alumno
    FOREIGN KEY (alumno_dni) REFERENCES alumnos(dni) ON DELETE CASCADE,
  CONSTRAINT fk_notas_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Asistencias (una fila por alumno/materia/fecha)
-- ============================================================
CREATE TABLE IF NOT EXISTS asistencias (
  id         INT AUTO_INCREMENT NOT NULL,
  alumno_dni INT NOT NULL,
  materia_id VARCHAR(20) NOT NULL,
  fecha      DATE NOT NULL,
  estado     VARCHAR(20) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_asistencia (alumno_dni, materia_id, fecha),
  CONSTRAINT fk_asistencias_alumno
    FOREIGN KEY (alumno_dni) REFERENCES alumnos(dni) ON DELETE CASCADE,
  CONSTRAINT fk_asistencias_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Auditoría de cambios de notas (quién cambió qué y cuándo)
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria_notas (
  id              INT AUTO_INCREMENT NOT NULL,
  admin_usuario   VARCHAR(100) NOT NULL,
  alumno_dni      INT NOT NULL,
  materia_id      VARCHAR(20) NOT NULL,
  accion          VARCHAR(50) NOT NULL,
  nota_anterior   DECIMAL(4,2) NULL,
  nota_nueva      DECIMAL(4,2) NULL,
  estado_anterior VARCHAR(40) NULL,
  estado_nuevo    VARCHAR(40) NULL,
  fecha           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auditoria_alumno (alumno_dni)
) ENGINE=InnoDB;

-- ============================================================
-- Homologaciones (materias reconocidas de otro instituto)
-- ============================================================
CREATE TABLE IF NOT EXISTS homologaciones (
  id               INT AUTO_INCREMENT NOT NULL,
  alumno_dni       INT NOT NULL,
  materia_id       VARCHAR(20) NOT NULL,
  nota             DECIMAL(4,2) NULL,
  instituto_origen VARCHAR(150) NULL,
  observaciones    TEXT NULL,
  admin_usuario    VARCHAR(100) NULL,
  fecha            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_homologaciones_alumno
    FOREIGN KEY (alumno_dni) REFERENCES alumnos(dni) ON DELETE CASCADE,
  CONSTRAINT fk_homologaciones_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Materias aprobadas (VIEW): se usa para validar correlativas.
-- Una materia cuenta como aprobada si tiene nota "Aprobado..."
-- o si fue homologada de otro instituto.
-- ============================================================
CREATE OR REPLACE VIEW materias_aprobadas AS
SELECT alumno_dni, materia_id FROM notas
  WHERE estado_academico IN ('Aprobado (Cursada)', 'Aprobado (Final)')
UNION
SELECT alumno_dni, materia_id FROM homologaciones;
