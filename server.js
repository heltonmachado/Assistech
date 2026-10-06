require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { pool, initializeDatabase } = require('./database');

const app = express();
const port = Number(process.env.PORT) || 3000;
const authSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const technicianInviteCode = process.env.TECHNICIAN_INVITE_CODE || '';
if (!process.env.AUTH_SECRET) {
  console.warn('AUTH_SECRET não configurada; as sessões serão invalidadas ao reiniciar o servidor.');
}
const uploadsDirectory = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDirectory, { recursive: true });
const destinationEmail = process.env.DESTINATION_EMAIL;
const smtpConfigured = Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_USER
  && process.env.SMTP_PASS
  && destinationEmail,
);

if (!smtpConfigured) {
  console.warn('Configure o arquivo .env antes de enviar mensagens.');
}

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadsDirectory));

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    callback(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
  },
});

const createToken = (userId, role) => {
  const payload = Buffer.from(JSON.stringify({ userId, role, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const authenticate = async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const [payload, signature] = token.split('.');

  if (!payload || !signature) {
    return res.status(401).json({ error: 'Faça login para continuar.' });
  }

  const expectedSignature = crypto.createHmac('sha256', authSecret).update(payload).digest('base64url');
  const signaturesMatch = signature.length === expectedSignature.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!signaturesMatch) {
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.userId || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Sua sessão expirou. Faça login novamente.' });
    }
    const userResult = await pool.query('SELECT perfil FROM usuarios WHERE id = $1 LIMIT 1', [session.userId]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado. Faça login novamente.' });
    }

    req.userId = session.userId;
    req.userRole = user.perfil;
    return next();
  } catch (error) {
    console.error('Falha ao validar sessão:', error.message);
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }
};

const requireTechnician = (req, res, next) => {
  if (req.userRole !== 'tecnico') {
    return res.status(403).json({ error: 'Acesso exclusivo para usuários técnicos.' });
  }
  return next();
};

const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso exclusivo para administradores.' });
  }
  return next();
};

app.post('/api/auth/register', async (req, res) => {
  const name = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.senha === 'string' ? req.body.senha : '';
  const profile = typeof req.body.perfil === 'string' ? req.body.perfil : 'cliente';
  const inviteCode = typeof req.body.codigo_tecnico === 'string' ? req.body.codigo_tecnico : '';

	if (!name || !email || !password || !['cliente', 'tecnico'].includes(profile)) {
		return res.status(400).json({ error: 'Preencha os dados e escolha um perfil válido.' });
  }

  if (profile === 'tecnico' && (!technicianInviteCode || inviteCode !== technicianInviteCode)) {
    return res.status(403).json({ error: 'Código de convite técnico inválido.' });
  }

  if (name.length > 120 || email.length > 254 || password.length < 8) {
    return res.status(400).json({ error: 'Use um nome e e-mail válidos e uma senha com pelo menos 8 caracteres.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }

  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}/.test(password)) {
    return res.status(400).json({ error: 'A senha deve ter 8 caracteres, maiúscula, minúscula, número e símbolo.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4)',
      [name, email, passwordHash, profile],
    );
    return res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }
    console.error('Falha ao cadastrar usuário:', error.message);
    return res.status(500).json({ error: 'Não foi possível cadastrar o usuário agora.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const username = typeof req.body.usuario === 'string' ? req.body.usuario.trim().toLowerCase() : '';
  const password = typeof req.body.senha === 'string' ? req.body.senha : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, nome, email, senha_hash, perfil FROM usuarios WHERE LOWER(email) = $1 OR LOWER(nome) = $1 LIMIT 1',
      [username],
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.senha_hash)) || !['cliente', 'tecnico', 'admin'].includes(req.body.perfil) || user.perfil !== req.body.perfil) {
      return res.status(401).json({ error: 'Usuário, senha ou perfil de acesso inválidos.' });
    }

    return res.status(200).json({
      message: `Bem-vindo, ${user.nome}!`,
      user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil },
      token: createToken(user.id, user.perfil),
    });
  } catch (error) {
    console.error('Falha ao realizar login:', error.message);
    return res.status(500).json({ error: 'Não foi possível realizar o login agora.' });
  }
});

app.post('/api/equipamentos', authenticate, (req, res) => {
  upload.single('foto')(req, res, async (uploadError) => {
    if (uploadError) {
      const message = uploadError.code === 'LIMIT_FILE_SIZE'
        ? 'A foto deve ter no máximo 5 MB.'
        : 'Envie uma foto JPG, PNG ou WebP válida.';
      return res.status(400).json({ error: message });
    }

    const name = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
    const clientName = typeof req.body.cliente === 'string' ? req.body.cliente.trim() : '';
    const model = typeof req.body.modelo === 'string' ? req.body.modelo.trim() : '';
    const defect = typeof req.body.defeito === 'string' ? req.body.defeito.trim() : '';
    const parts = typeof req.body.pecas === 'string' ? req.body.pecas.trim() : '';
    const serviceValue = req.userRole === 'tecnico'
      ? Number(String(req.body.valor || '0').replace(',', '.'))
      : 0;
    const savedParts = req.userRole === 'tecnico' ? parts : '';

    if (!clientName || !name || !model || !defect) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(400).json({ error: 'Preencha nome, modelo e defeito apresentado.' });
    }

    if (clientName.length > 120 || name.length > 120 || model.length > 120 || defect.length > 5000 || savedParts.length > 5000 || !Number.isFinite(serviceValue) || serviceValue < 0 || serviceValue > 99999999.99) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(400).json({ error: 'Um ou mais campos ultrapassaram o limite permitido.' });
    }

    try {
      const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const inserted = await pool.query(
        'INSERT INTO equipamentos (usuario_id, cliente_nome, nome, modelo, defeito, foto_url, valor_servico, pecas_utilizadas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, numero_os, cliente_nome, nome, modelo, defeito, foto_url, status, valor_servico, pecas_utilizadas, criado_em',
        [req.userId, clientName, name, model, defect, photoUrl, serviceValue, savedParts || null],
      );
      const result = await pool.query(
        `UPDATE equipamentos
         SET numero_os = 'OS-' || lpad(id::text, 6, '0')
         WHERE id = $1
         RETURNING id, numero_os, cliente_nome, nome, modelo, defeito, foto_url, status, valor_servico, pecas_utilizadas, criado_em`,
        [inserted.rows[0].id],
      );
      return res.status(201).json({ message: `Equipamento cadastrado. Número da OS: ${result.rows[0].numero_os}`, equipamento: result.rows[0] });
    } catch (error) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      console.error('Falha ao cadastrar equipamento:', error.message);
      return res.status(500).json({ error: 'Não foi possível salvar o equipamento agora.' });
    }
  });
});

app.get('/api/equipamentos', authenticate, async (req, res) => {
  const clientName = typeof req.query.cliente === 'string' ? req.query.cliente.trim() : '';
  const equipmentName = typeof req.query.equipamento === 'string' ? req.query.equipamento.trim() : '';

  try {
    const technicianQuery = `SELECT e.id, e.cliente_nome, e.nome, e.modelo, e.defeito, e.foto_url, e.status,
              e.valor_servico, e.pecas_utilizadas, e.criado_em, u.email AS cliente_email
       FROM equipamentos e JOIN usuarios u ON u.id = e.usuario_id
       WHERE ($1 = '' OR e.cliente_nome ILIKE '%' || $1 || '%')
         AND ($2 = '' OR e.nome ILIKE '%' || $2 || '%' OR e.modelo ILIKE '%' || $2 || '%')
       ORDER BY e.criado_em DESC`;
    const clientQuery = `SELECT id, numero_os, cliente_nome, nome, modelo, criado_em
       FROM equipamentos WHERE usuario_id = $1 ORDER BY criado_em DESC`;
    const result = req.userRole === 'tecnico'
      ? await pool.query(technicianQuery, [clientName, equipmentName])
      : await pool.query(clientQuery, [req.userId]);
    return res.status(200).json({ equipamentos: result.rows });
  } catch (error) {
    console.error('Falha ao listar equipamentos:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar os equipamentos.' });
  }
});

app.get('/api/equipamentos/os/:numeroOs', authenticate, async (req, res) => {
  const orderNumber = String(req.params.numeroOs || '').trim().toUpperCase();

  try {
    const result = await pool.query(
      `SELECT e.id, e.numero_os, e.cliente_nome, e.nome, e.modelo, e.defeito, e.foto_url,
              e.status, e.valor_servico, e.pecas_utilizadas, e.concluido_em, e.criado_em
       FROM equipamentos e
       WHERE e.numero_os = $1 OR 'OS-' || lpad(e.id::text, 6, '0') = $1
       LIMIT 1`,
      [orderNumber],
    );

    if (!result.rowCount) return res.status(404).json({ error: 'OS não encontrada para este usuário.' });
    return res.status(200).json({ equipamento: result.rows[0] });
  } catch (error) {
    console.error('Falha ao consultar OS:', error.message);
    return res.status(500).json({ error: 'Não foi possível consultar a OS.' });
  }
});

app.get('/api/admin/usuarios', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nome, email, perfil, criado_em FROM usuarios ORDER BY criado_em DESC');
    return res.json({ usuarios: result.rows });
  } catch (error) {
    console.error('Falha ao listar usuários:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar os usuários.' });
  }
});

app.patch('/api/admin/usuarios/:id/perfil', authenticate, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const perfil = typeof req.body.perfil === 'string' ? req.body.perfil : '';

  if (!Number.isInteger(userId) || !['cliente', 'tecnico', 'admin'].includes(perfil)) {
    return res.status(400).json({ error: 'Perfil inválido.' });
  }

  try {
    const result = await pool.query(
      'UPDATE usuarios SET perfil = $1 WHERE id = $2 RETURNING id, nome, email, perfil',
      [perfil, userId],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json({ message: 'Perfil atualizado com sucesso.', usuario: result.rows[0] });
  } catch (error) {
    console.error('Falha ao atualizar perfil:', error.message);
    return res.status(500).json({ error: 'Não foi possível atualizar o perfil.' });
  }
});

app.get('/api/admin/equipamentos', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.numero_os, e.cliente_nome, e.nome, e.modelo, e.status,
             e.valor_servico, e.criado_em, u.email AS tecnico_email
      FROM equipamentos e
      JOIN usuarios u ON u.id = e.usuario_id
      ORDER BY e.criado_em DESC
    `);
    return res.json({ equipamentos: result.rows });
  } catch (error) {
    console.error('Falha ao listar equipamentos administrativos:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar as OS.' });
  }
});

app.patch('/api/equipamentos/:id/status', authenticate, requireTechnician, async (req, res) => {
  const equipmentId = Number(req.params.id);
  const allowedStatuses = ['Recebido', 'Em manutenção', 'Concluído'];
  const status = typeof req.body.status === 'string' ? req.body.status : '';

  if (!Number.isInteger(equipmentId) || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Informe um status válido para o equipamento.' });
  }

  try {
    const result = await pool.query(
      "UPDATE equipamentos SET status = $1, concluido_em = CASE WHEN $1 = 'Concluído' THEN COALESCE(concluido_em, NOW()) ELSE NULL END WHERE id = $2 AND usuario_id = $3 RETURNING id, status, concluido_em",
      [status, equipmentId, req.userId],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }

    return res.status(200).json({ message: 'Status atualizado com sucesso.', equipamento: result.rows[0] });
  } catch (error) {
    console.error('Falha ao atualizar status:', error.message);
    return res.status(500).json({ error: 'Não foi possível atualizar o status.' });
  }
});

app.post('/api/auth/recover', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const genericMessage = 'Se o e-mail estiver cadastrado, uma nova senha será enviada.';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }

  if (!smtpConfigured || !transporter) {
    return res.status(503).json({
      error: 'A recuperação por e-mail ainda não está configurada no servidor.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT id, nome, email FROM usuarios WHERE LOWER(email) = $1 LIMIT 1',
      [email],
    );
    const user = result.rows[0];

    if (!user) {
      await client.query('COMMIT');
      return res.status(200).json({ message: genericMessage });
    }

    const temporaryPassword = `Aa1!${crypto.randomBytes(9).toString('base64url')}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await client.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE id = $2',
      [passwordHash, user.id],
    );

    await transporter.sendMail({
      from: `Assistech - Site <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Sua nova senha temporária - Assistech',
      text: [
        `Olá, ${user.nome}!`,
        '',
        'Recebemos uma solicitação de recuperação de senha.',
        `Sua nova senha temporária é: ${temporaryPassword}`,
        '',
        'Use essa senha para entrar no site e mantenha-a em local seguro.',
        '',
        'Assistech | Tecnologia e som sempre em boas mãos.',
      ].join('\n'),
    });

    await client.query('COMMIT');
    return res.status(200).json({ message: genericMessage });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Falha ao recuperar senha:', error.message);
    return res.status(500).json({ error: 'Não foi possível enviar a nova senha agora.' });
  } finally {
    client.release();
  }
});

app.post('/api/contato', async (req, res) => {
  const name = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const message = typeof req.body.mensagem === 'string' ? req.body.mensagem.trim() : '';
  const safeName = name.replace(/[\r\n]+/g, ' ');

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Preencha nome, e-mail e mensagem.' });
  }

  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    return res.status(400).json({ error: 'Um ou mais campos ultrapassaram o limite permitido.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }

  if (!smtpConfigured || !transporter) {
    return res.status(503).json({
      error: 'Configure as credenciais SMTP no arquivo .env antes de enviar mensagens.',
    });
  }

  try {
    const receivedAt = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());

    await transporter.sendMail({
      from: `Assistech - Site <${process.env.SMTP_USER}>`,
      to: destinationEmail,
      replyTo: email,
      subject: `Novo atendimento para a Assistech - ${safeName}`,
      text: [
        'Olá, equipe Assistech!',
        '',
        'Você recebeu uma nova solicitação de atendimento pelo site.',
        '',
        `Cliente: ${name}`,
        `E-mail para resposta: ${email}`,
        `Recebido em: ${receivedAt}`,
        '',
        'Mensagem do cliente:',
        message,
        '',
        'Para responder, basta utilizar o botão Responder deste e-mail.',
        '',
        'Assistech | Tecnologia e som sempre em boas mãos.',
      ].join('\n'),
    });

    return res.status(200).json({ message: 'Mensagem enviada com sucesso!' });
  } catch (error) {
    console.error('Falha ao enviar mensagem:', error.message);
    return res.status(500).json({ error: 'Não foi possível enviar a mensagem agora.' });
  }
});

const server = app.listen(port, () => {
  console.log(`Assistech disponível em http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${port} já está em uso. O servidor provavelmente já está rodando em http://localhost:${port}.`);
    process.exitCode = 1;
    return;
  }

  console.error('Falha ao iniciar o servidor:', error.message);
  process.exitCode = 1;
});

initializeDatabase().catch((error) => {
  console.error('Falha ao inicializar o banco de dados:', error.message);
});
