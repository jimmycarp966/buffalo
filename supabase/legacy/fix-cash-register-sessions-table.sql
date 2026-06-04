-- Script para corregir la tabla cash_register_sessions
-- Este script crea la tabla completa si no existe o agrega columnas faltantes

-- ==============================================
-- 1. VERIFICAR ESTRUCTURA ACTUAL
-- ==============================================
SELECT '=== ESTRUCTURA ACTUAL DE CASH_REGISTER_SESSIONS ===' as info;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cash_register_sessions'
ORDER BY ordinal_position;

-- ==============================================
-- 2. CREAR TABLA COMPLETA SI NO EXISTE
-- ==============================================
DO $$
BEGIN
  -- Verificar si la tabla existe
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions'
  ) THEN
    -- Crear tabla completa
    CREATE TABLE public.cash_register_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cash_register_id UUID NOT NULL,
      user_id UUID NOT NULL, -- Usuario que opera la caja
      area TEXT NOT NULL CHECK (area IN ('shop', 'bar')),
      shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
      opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      closing_amount DECIMAL(10,2),
      expected_amount DECIMAL(10,2),
      difference DECIMAL(10,2),
      opened_by UUID NOT NULL,
      closed_by UUID,
      opened_at TIMESTAMPTZ DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      opening_notes TEXT,
      closing_notes TEXT,
      employees TEXT[], -- Array de IDs de empleados del turno
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Crear índices para optimizar consultas
    CREATE INDEX idx_cash_register_sessions_cash_register_id ON public.cash_register_sessions(cash_register_id);
    CREATE INDEX idx_cash_register_sessions_user_id ON public.cash_register_sessions(user_id);
    CREATE INDEX idx_cash_register_sessions_area ON public.cash_register_sessions(area);
    CREATE INDEX idx_cash_register_sessions_status ON public.cash_register_sessions(status);
    CREATE INDEX idx_cash_register_sessions_opened_at ON public.cash_register_sessions(opened_at);

    RAISE NOTICE '✅ Tabla cash_register_sessions creada exitosamente';
  ELSE
    RAISE NOTICE 'La tabla cash_register_sessions ya existe, verificando columnas...';
  END IF;
END $$;

-- ==============================================
-- 3. AGREGAR COLUMNAS FALTANTES SI LA TABLA YA EXISTE
-- ==============================================
DO $$
BEGIN
  -- Verificar y agregar columna opening_amount
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'opening_amount'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
    RAISE NOTICE '✅ Columna opening_amount agregada';
  END IF;

  -- Verificar y agregar columna closing_amount
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'closing_amount'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN closing_amount DECIMAL(10,2);
    RAISE NOTICE '✅ Columna closing_amount agregada';
  END IF;

  -- Verificar y agregar columna expected_amount
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'expected_amount'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN expected_amount DECIMAL(10,2);
    RAISE NOTICE '✅ Columna expected_amount agregada';
  END IF;

  -- Verificar y agregar columna difference
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'difference'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN difference DECIMAL(10,2);
    RAISE NOTICE '✅ Columna difference agregada';
  END IF;

  -- Verificar y agregar columna opened_by
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'opened_by'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN opened_by UUID NOT NULL;
    RAISE NOTICE '✅ Columna opened_by agregada';
  END IF;

  -- Verificar y agregar columna closed_by
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN closed_by UUID;
    RAISE NOTICE '✅ Columna closed_by agregada';
  END IF;

  -- Verificar y agregar columna opened_at
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'opened_at'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN opened_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Columna opened_at agregada';
  END IF;

  -- Verificar y agregar columna closed_at
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN closed_at TIMESTAMPTZ;
    RAISE NOTICE '✅ Columna closed_at agregada';
  END IF;

  -- Verificar y agregar columna status
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
    RAISE NOTICE '✅ Columna status agregada';
  END IF;

  -- Verificar y agregar columna opening_notes
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'opening_notes'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN opening_notes TEXT;
    RAISE NOTICE '✅ Columna opening_notes agregada';
  END IF;

  -- Verificar y agregar columna closing_notes
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'closing_notes'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN closing_notes TEXT;
    RAISE NOTICE '✅ Columna closing_notes agregada';
  END IF;

  -- Verificar y agregar columna employees
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'employees'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN employees TEXT[];
    RAISE NOTICE '✅ Columna employees agregada';
  END IF;

  -- Verificar y agregar columna area
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'area'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN area TEXT;
    RAISE NOTICE '✅ Columna area agregada';
  END IF;

  -- Verificar y agregar columna shift
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'shift'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN shift TEXT;
    RAISE NOTICE '✅ Columna shift agregada';
  END IF;

  -- Verificar y agregar columna created_at
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Columna created_at agregada';
  END IF;

  -- Verificar y agregar columna updated_at
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Columna updated_at agregada';
  END IF;

  -- Verificar y agregar columna user_id (referencia al usuario que opera la caja)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_register_sessions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.cash_register_sessions ADD COLUMN user_id UUID NOT NULL;
    RAISE NOTICE '✅ Columna user_id agregada';
  END IF;
END $$;

-- ==============================================
-- 4. CREAR TABLA CASH_REGISTERS SI NO EXISTE
-- ==============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cash_registers'
  ) THEN
    CREATE TABLE public.cash_registers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('shop', 'bar')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Insertar las cajas por defecto
    INSERT INTO public.cash_registers (id, name, type, is_active) VALUES
      ('550e8400-e29b-41d4-a716-446655440001', 'CAJA SHOP', 'shop', true),
      ('550e8400-e29b-41d4-a716-446655440002', 'CAJA BAR', 'bar', true)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ Tabla cash_registers creada con cajas por defecto';
  END IF;
END $$;

-- ==============================================
-- 5. CREAR FOREIGN KEYS Y RELACIONES
-- ==============================================
DO $$
BEGIN
  -- Agregar foreign key para cash_register_id si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_register_sessions_cash_register_id_fkey'
  ) THEN
    ALTER TABLE public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_cash_register_id_fkey
    FOREIGN KEY (cash_register_id) REFERENCES public.cash_registers(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key cash_register_id agregada';
  END IF;

  -- Agregar foreign key para user_id si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_register_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key user_id agregada';
  END IF;

  -- Agregar foreign key para opened_by si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_register_sessions_opened_by_fkey'
  ) THEN
    ALTER TABLE public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_opened_by_fkey
    FOREIGN KEY (opened_by) REFERENCES public.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key opened_by agregada';
  END IF;

  -- Agregar foreign key para closed_by si no existe
  IF NOT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_register_sessions_closed_by_fkey'
  ) THEN
    ALTER TABLE public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_closed_by_fkey
    FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key closed_by agregada';
  END IF;
END $$;

-- ==============================================
-- 6. VERIFICACIÓN FINAL
-- ==============================================
SELECT '=== ESTRUCTURA FINAL DE CASH_REGISTER_SESSIONS ===' as info;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cash_register_sessions'
ORDER BY ordinal_position;

SELECT '=== CASH_REGISTERS DISPONIBLES ===' as info;
SELECT id, name, type, is_active FROM public.cash_registers;

SELECT '=== ✅ TABLA CORREGIDA EXITOSAMENTE ===' as info;
