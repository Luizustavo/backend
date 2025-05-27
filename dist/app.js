"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Arquivo: src/app.ts
const express_1 = __importDefault(require("express"));
const promise_1 = require("mysql2/promise");
const bcrypt_1 = __importDefault(require("bcrypt"));
const express_validator_1 = require("express-validator");
const cors_1 = __importDefault(require("cors"));
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
const pool = (0, promise_1.createPool)(dbConfig);
// Configuração do Express
const app = (0, express_1.default)();
const port = process.env.PORT || 3005;
// Middlewares
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// Validação dos dados de entrada
const validateAlunoData = [
    (0, express_validator_1.body)("nome_completo")
        .isLength({ min: 5, max: 100 })
        .withMessage("Nome completo deve ter entre 5 e 100 caracteres"),
    (0, express_validator_1.body)("usuario_acesso")
        .isLength({ min: 3, max: 50 })
        .withMessage("Usuário deve ter entre 3 e 50 caracteres"),
    (0, express_validator_1.body)("senha")
        .isStrongPassword({
        minLength: 6,
    })
        .withMessage("Senha deve conter pelo menos 6 caracteres"),
    (0, express_validator_1.body)("email_aluno")
        .isEmail()
        .withMessage("E-mail inválido")
        .isLength({ max: 255 }),
    (0, express_validator_1.body)("observacao").optional().isLength({ max: 255 }),
];
// Middleware de tratamento de erros de validação
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    next();
};
// Endpoint para cadastro de alunos
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
app.post("/api/alunos", validateAlunoData, validateRequest, asyncHandler(async (req, res) => {
    const alunoData = req.body;
    // Verifica se usuário ou e-mail já existem
    const connection = await pool.getConnection();
    const [existingUser] = await connection.query("SELECT usuario_acesso, email_aluno FROM alunos WHERE usuario_acesso = ? OR email_aluno = ?", [alunoData.usuario_acesso, alunoData.email_aluno]);
    if (Array.isArray(existingUser) && existingUser.length > 0) {
        connection.release();
        res.status(409).json({
            error: "Usuário ou e-mail já cadastrados",
        });
        return;
    }
    // Hash da senha
    const saltRounds = 10;
    const senhaHash = await bcrypt_1.default.hash(alunoData.senha, saltRounds);
    // Inserção no banco de dados
    const [result] = await connection.query(`INSERT INTO alunos 
    (nome_completo, usuario_acesso, senha_hash, email_aluno, observacao) 
    VALUES (?, ?, ?, ?, ?)`, [
        alunoData.nome_completo,
        alunoData.usuario_acesso,
        senhaHash,
        alunoData.email_aluno,
        alunoData.observacao || null,
    ]);
    connection.release();
    res.status(201).json({
        success: true,
        message: "Aluno cadastrado com sucesso",
        alunoId: result.insertId,
    });
}));
// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Erro interno no servidor" });
});
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
