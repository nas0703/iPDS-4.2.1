import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const connectionString = process.env.SUPABASE_POOLED_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_POOLED_URL is not set");
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL successfully.");

  // 1. Ensure basic organizational tables exist if missing
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.org_estates (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      total_area_ha NUMERIC(10,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.org_divisions (
      id VARCHAR(50) PRIMARY KEY,
      estate_id VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Seed basic estates
    INSERT INTO public.org_estates (id, name, total_area_ha) VALUES
      ('FPM_TUNGGAL', 'Ladang Tunggal', 1250.0),
      ('FPM_ADELA', 'Ladang Adela', 1050.0),
      ('FPM_KLEDANG', 'Ladang Kledang', 980.0),
      ('FPM_SENING', 'Ladang Sening', 890.0),
      ('WILAYAH_JB', 'Pejabat Wilayah Johor Bahru', 0.0)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- Seed basic divisions
    INSERT INTO public.org_divisions (id, estate_id, name) VALUES
      ('DIV_TGL_P1', 'FPM_TUNGGAL', 'Peringkat 1 (Blok 1 - 9)'),
      ('DIV_TGL_P2', 'FPM_TUNGGAL', 'Peringkat 2 (Blok 10 - 18)'),
      ('DIV_ADL_P1', 'FPM_ADELA', 'Peringkat 1 (Blok 1 - 11)'),
      ('DIV_ADL_P2', 'FPM_ADELA', 'Peringkat 2 (Blok 12 - 17)'),
      ('DIV_KLD_P1', 'FPM_KLEDANG', 'Peringkat 1'),
      ('DIV_KLD_P2', 'FPM_KLEDANG', 'Peringkat 2'),
      ('DIV_SNG_P1', 'FPM_SENING', 'Peringkat 1'),
      ('DIV_SNG_P2', 'FPM_SENING', 'Peringkat 2')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  `);
  console.log("Step 1: org_estates and org_divisions ensured.");

  // 2. Create tenants, companies, positions, blocks, employees, assignments
  await client.query(`
    -- Tenants
    CREATE TABLE IF NOT EXISTS public.tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      subscription_tier VARCHAR(50) DEFAULT 'ENTERPRISE',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO public.tenants (id, code, name) VALUES
      ('00000000-0000-0000-0000-000000000001', 'FELDA_GROUP', 'Lembaga Kemajuan Tanah Persekutuan (FELDA)')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- Companies
    CREATE TABLE IF NOT EXISTS public.companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      registration_no VARCHAR(100),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_companies_tenant_code UNIQUE (tenant_id, code)
    );

    INSERT INTO public.companies (id, tenant_id, code, name, registration_no) VALUES
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'FPMSB', 'Felda Palm Industries & Management Sdn Bhd', '197501002233')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- Org Positions
    CREATE TABLE IF NOT EXISTS public.org_positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
      code VARCHAR(50) NOT NULL,
      title VARCHAR(150) NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'OPERATIONS',
      department VARCHAR(100) DEFAULT 'LADANG',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_org_positions_tenant_code UNIQUE (tenant_id, code)
    );

    INSERT INTO public.org_positions (id, tenant_id, code, title, category, department) VALUES
      ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'EM', 'Estate Manager (Pengurus Ladang)', 'MANAGEMENT', 'PENTADBIRAN'),
      ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AM', 'Assistant Manager (Penolong Pengurus)', 'MANAGEMENT', 'OPERASI'),
      ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'FS', 'Field Supervisor (Penyelia Lapangan)', 'SUPERVISORY', 'OPERASI'),
      ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'MDR', 'Mandore / Mandur Penuaian', 'SUPERVISORY', 'PENUAIAN'),
      ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'CLK', 'Estate Clerk (Kerani Operasi & Timbang)', 'FIELD_STAFF', 'PENTADBIRAN'),
      ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'GW', 'General Worker (Pekerja Am / Penuai)', 'GENERAL_WORKER', 'OPERASI')
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

    -- Org Blocks
    CREATE TABLE IF NOT EXISTS public.org_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
      estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
      division_id VARCHAR(50) REFERENCES public.org_divisions(id) ON DELETE RESTRICT,
      block_code VARCHAR(50) NOT NULL,
      crop_type VARCHAR(50) DEFAULT 'OIL_PALM',
      hectarage NUMERIC(10,2) DEFAULT 0,
      planting_year INTEGER,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_org_blocks_estate_code UNIQUE (estate_id, block_code)
    );

    -- Employees Master Table
    CREATE TABLE IF NOT EXISTS public.employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
      staff_no VARCHAR(50) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      position_id UUID NOT NULL REFERENCES public.org_positions(id) ON DELETE RESTRICT,
      employment_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      id_card_passport VARCHAR(50),
      contact_number VARCHAR(50),
      email VARCHAR(255),
      hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
      end_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by VARCHAR(255),
      updated_by VARCHAR(255),
      CONSTRAINT uq_employees_tenant_staff_no UNIQUE (tenant_id, staff_no)
    );

    -- Employee Assignments
    CREATE TABLE IF NOT EXISTS public.employee_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
      employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
      company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
      estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
      division_id VARCHAR(50) REFERENCES public.org_divisions(id) ON DELETE RESTRICT,
      assignment_role VARCHAR(50) NOT NULL DEFAULT 'PRIMARY',
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      effective_from DATE NOT NULL,
      effective_to DATE,
      transfer_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by VARCHAR(255),
      updated_by VARCHAR(255)
    );

    -- Assignment Blocks
    CREATE TABLE IF NOT EXISTS public.employee_assignment_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
      assignment_id UUID NOT NULL REFERENCES public.employee_assignments(id) ON DELETE CASCADE,
      block_id UUID NOT NULL REFERENCES public.org_blocks(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by VARCHAR(255),
      CONSTRAINT uq_assignment_block_pair UNIQUE (assignment_id, block_id)
    );
  `);
  console.log("Step 2: Core tables created.");

  // 3. Create view v_current_employee_assignments
  await client.query(`
    CREATE OR REPLACE VIEW public.v_current_employee_assignments AS
    SELECT 
      e.id AS employee_id,
      e.tenant_id,
      e.staff_no,
      e.full_name,
      e.employment_status,
      pos.code AS position_code,
      pos.title AS position_title,
      ea.id AS assignment_id,
      ea.company_id,
      c.name AS company_name,
      ea.estate_id,
      est.name AS estate_name,
      ea.division_id,
      div.name AS division_name,
      ea.assignment_role,
      ea.effective_from,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'block_id', b.id,
            'block_code', b.block_code,
            'hectarage', b.hectarage
          )
        ) FILTER (WHERE b.id IS NOT NULL), 
        '[]'::jsonb
      ) AS assigned_blocks
    FROM public.employees e
    JOIN public.org_positions pos ON e.position_id = pos.id
    LEFT JOIN public.employee_assignments ea ON e.id = ea.employee_id 
        AND ea.status = 'ACTIVE' 
        AND (ea.effective_to IS NULL OR ea.effective_to >= CURRENT_DATE)
    LEFT JOIN public.companies c ON ea.company_id = c.id
    LEFT JOIN public.org_estates est ON ea.estate_id = est.id
    LEFT JOIN public.org_divisions div ON ea.division_id = div.id
    LEFT JOIN public.employee_assignment_blocks eab ON ea.id = eab.assignment_id
    LEFT JOIN public.org_blocks b ON eab.block_id = b.id
    GROUP BY 
      e.id, e.tenant_id, e.staff_no, e.full_name, e.employment_status, 
      pos.code, pos.title, ea.id, ea.company_id, c.name, ea.estate_id, 
      est.name, ea.division_id, div.name, ea.assignment_role, ea.effective_from;
  `);
  console.log("Step 3: View v_current_employee_assignments created.");

  // 4. Grant permissions to anon, authenticated, service_role
  await client.query(`
    GRANT ALL ON TABLE public.tenants TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.companies TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.org_positions TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.org_blocks TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.employee_assignments TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.employee_assignment_blocks TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.org_estates TO anon, authenticated, service_role;
    GRANT ALL ON TABLE public.org_divisions TO anon, authenticated, service_role;
    GRANT SELECT ON public.v_current_employee_assignments TO anon, authenticated, service_role;
  `);
  console.log("Step 4: Permissions granted.");

  // 5. Seed baseline staff if empty
  const countRes = await client.query('SELECT COUNT(*) FROM public.employees;');
  const currentCount = parseInt(countRes.rows[0].count, 10);
  console.log("Current employee count in Supabase:", currentCount);

  if (currentCount === 0) {
    console.log("Seeding baseline staff records...");
    await client.query(`
      INSERT INTO public.employees (id, tenant_id, staff_no, full_name, position_id, employment_status, id_card_passport, contact_number, email, hire_date) VALUES
        ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'STF-0104', 'Zulkifli bin Ismail', '20000000-0000-0000-0000-000000000003', 'ACTIVE', '820412-01-5431', '019-7234891', 'zulkifli.ismail@fpm.felda.my', '2015-03-01'),
        ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'STF-0219', 'Razali bin Othman', '20000000-0000-0000-0000-000000000004', 'ACTIVE', '851120-01-6109', '013-8901234', 'razali.othman@fpm.felda.my', '2018-06-15')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.employee_assignments (id, tenant_id, employee_id, company_id, estate_id, division_id, assignment_role, status, effective_from) VALUES
        ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'FPM_TUNGGAL', 'DIV_TGL_P1', 'PRIMARY', 'ACTIVE', '2015-03-01'),
        ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'FPM_TUNGGAL', 'DIV_TGL_P2', 'PRIMARY', 'ACTIVE', '2018-06-15')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("Seeded baseline staff.");
  }

  await client.end();
  console.log("Migration finished successfully!");
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
