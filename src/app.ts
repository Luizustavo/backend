// Arquivo: src/app.ts
import express, { Request, Response, NextFunction } from "express";
import { createPool, Pool } from "mysql2/promise";
import bcrypt from "bcrypt";
import { body, validationResult, ValidationChain } from "express-validator";
import cors from "cors";

// Interface para tipagem dos dados do aluno
interface Aluno {
  nome_completo: string;
  usuario_acesso: string;
  senha: string;
  email_aluno: string;
  observacao?: string;
}

// Configuração do banco de dados
const dbConfig = {
  host: "serverdbp2.mysql.database.azure.com",
  user: "useradmin",
  password: "admin@123",
  database: "db_luiz_gustavo",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Criação do pool de conexões
const pool: Pool = createPool(dbConfig);

// Configuração do Express
const app = express();
const port = process.env.PORT || 3005;

// Middlewares
app.use(express.json());
app.use(cors());

// Validação dos dados de entrada
const validateAlunoData: ValidationChain[] = [
  body("nome_completo")
    .isLength({ min: 5, max: 100 })
    .withMessage("Nome completo deve ter entre 5 e 100 caracteres"),
  body("usuario_acesso")
    .isLength({ min: 3, max: 50 })
    .withMessage("Usuário deve ter entre 3 e 50 caracteres"),
  body("senha")
    .isStrongPassword({
      minLength: 6,
    })
    .withMessage("Senha deve conter pelo menos 6 caracteres"),
  body("email_aluno")
    .isEmail()
    .withMessage("E-mail inválido")
    .isLength({ max: 255 }),
  body("observacao").optional().isLength({ max: 255 }),
];

// Middleware de tratamento de erros de validação
const validateRequest: express.RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// Endpoint para cadastro de alunos
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.post(
  "/api/alunos",
  validateAlunoData,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const alunoData: Aluno = req.body;

    // Verifica se usuário ou e-mail já existem
    const connection = await pool.getConnection();

    const [existingUser] = await connection.query(
      "SELECT usuario_acesso, email_aluno FROM alunos WHERE usuario_acesso = ? OR email_aluno = ?",
      [alunoData.usuario_acesso, alunoData.email_aluno]
    );

    if (Array.isArray(existingUser) && existingUser.length > 0) {
      connection.release();
      res.status(409).json({
        error: "Usuário ou e-mail já cadastrados",
      });
      return;
    }

    // Hash da senha
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(alunoData.senha, saltRounds);

    // Inserção no banco de dados
    const [result] = await connection.query(
      `INSERT INTO alunos 
    (nome_completo, usuario_acesso, senha_hash, email_aluno, observacao) 
    VALUES (?, ?, ?, ?, ?)`,
      [
        alunoData.nome_completo,
        alunoData.usuario_acesso,
        senhaHash,
        alunoData.email_aluno,
        alunoData.observacao || null,
      ]
    );

    connection.release();

    res.status(201).json({
      success: true,
      message: "Aluno cadastrado com sucesso",
      alunoId: (result as any).insertId,
    });
  })
);

// Middleware de tratamento de erros global
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno no servidor" });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
