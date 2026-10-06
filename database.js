const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'assistech-db',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

const initializeDatabase = async () => {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS ordens_servico_seq;

    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(120) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil VARCHAR(20) NOT NULL DEFAULT 'cliente',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS solicitacoes_contato (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(120) NOT NULL,
      email VARCHAR(254) NOT NULL,
      mensagem TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS equipamentos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      numero_os VARCHAR(30) UNIQUE NOT NULL DEFAULT ('OS-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('ordens_servico_seq')::text, 6, '0')),
      cliente_nome VARCHAR(120) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      modelo VARCHAR(120) NOT NULL,
      defeito TEXT NOT NULL,
      foto_url TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'Recebido',
      valor_servico NUMERIC(10, 2) NOT NULL DEFAULT 0,
      pecas_utilizadas TEXT,
      concluido_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'Recebido';
    ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(120);
    UPDATE equipamentos SET cliente_nome = usuarios.nome FROM usuarios WHERE equipamentos.usuario_id = usuarios.id AND equipamentos.cliente_nome IS NULL;
    ALTER TABLE equipamentos ALTER COLUMN cliente_nome SET NOT NULL;
    ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS valor_servico NUMERIC(10, 2) NOT NULL DEFAULT 0;
    ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS pecas_utilizadas TEXT;
    ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;
  `);
  await pool.query("ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS numero_os VARCHAR(30)");
  await pool.query("UPDATE equipamentos SET numero_os = 'OS-' || lpad(id::text, 6, '0')");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS equipamentos_numero_os_idx ON equipamentos(numero_os)");
  await pool.query("ALTER TABLE equipamentos ALTER COLUMN numero_os SET DEFAULT ('OS-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('ordens_servico_seq')::text, 6, '0'))");
  await pool.query("ALTER TABLE equipamentos ALTER COLUMN numero_os SET NOT NULL");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil VARCHAR(20) NOT NULL DEFAULT 'cliente'");
  await pool.query('ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check');
  await pool.query("ALTER TABLE usuarios ADD CONSTRAINT usuarios_perfil_check CHECK (perfil IN ('cliente', 'tecnico', 'admin'))");
  console.log('Banco assistech-db conectado e tabelas verificadas.');
};

module.exports = { initializeDatabase, pool };