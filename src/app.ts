import express, { Request, Response, NextFunction } from "express";
import { createPool, Pool } from "mysql2/promise";
import bcrypt from "bcrypt";
import { body, validationResult, ValidationChain } from "express-validator";
import cors from "cors";

interface Aluno {
  nome_completo: string;
  usuario_acesso: string;
  senha: string;
  email_aluno: string;
  observacao?: string;
}

const dbConfig = {
  host: "serverdbp2.mysql.database.azure.com",
  user: "useradmin",
  password: "admin@123",
  database: "db_luiz_gustavo",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool: Pool = createPool(dbConfig);

const app = express();
const port = process.env.PORT || 3005;

app.use(express.json());
app.use(cors());

const validateAlunoData: ValidationChain[] = [
  body("nome_completo")
    .isLength({ min: 5, max: 100 })
    .withMessage("Nome completo deve ter entre 5 e 100 caracteres"),
  body("usuario_acesso")
    .isLength({ min: 3, max: 50 })
    .withMessage("Usuário deve ter entre 3 e 50 caracteres"),
  body("senha")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage(
      "Senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e símbolos"
    ),
  body("email_aluno")
    .isEmail()
    .withMessage("E-mail inválido")
    .isLength({ max: 255 }),
  body("observacao").optional().isLength({ max: 255 }),
];

const validateRequest: express.RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

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

    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(alunoData.senha, saltRounds);

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

app.get('/api/alunos', async (req: Request, res: Response) => {
  try {
    const connection = await pool.getConnection();
    
    const [alunos] = await connection.query(
      'SELECT id_aluno, nome_completo, usuario_acesso, email_aluno, observacao, data_cadastro FROM alunos'
    );

    connection.release();

    res.status(200).json({
      success: true,
      data: alunos
    });

  } catch (error) {
    console.error('Erro na listagem:', error);
    res.status(500).json({
      error: 'Erro interno no servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno no servidor" });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
