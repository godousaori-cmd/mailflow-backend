const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-mailflow-key'];
    if (apiKey && apiKey === process.env.MAILFLOW_API_KEY) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Não autorizado' });
    }
};

app.post('/send-email', authenticate, async (req, res) => {
    const { to, subject, name } = req.body;

    if (!to || !subject || !name) {
        return res.status(400).json({ success: false, error: 'Faltam dados no corpo da requisição' });
    }

    try {
        const data = await resend.emails.send({
            from: process.env.FROM_EMAIL,
            to: [to],
            subject: subject,
            html: `<strong>Olá ${name},</strong><br><p>Sua solicitação foi processada com sucesso.</p>`,
        });

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
