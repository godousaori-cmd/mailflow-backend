const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAILFLOW_API_KEY = process.env.MAILFLOW_API_KEY;

const FROM_EMAIL =
    process.env.FROM_EMAIL ||
    'MailFlow <info@mailflow-jp.com>';

const resend = RESEND_API_KEY
    ? new Resend(RESEND_API_KEY)
    : null;

/* =========================================================
   HELPERS
========================================================= */

function validEmail(email) {
    return (
        typeof email === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );
}

function safeEqual(a, b) {
    if (!a || !b) return false;

    const aBuffer = Buffer.from(String(a));
    const bBuffer = Buffer.from(String(b));

    if (aBuffer.length !== bBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        aBuffer,
        bBuffer
    );
}

function requireInternalKey(req, res, next) {

    if (!MAILFLOW_API_KEY) {
        return res.status(503).json({
            success: false,
            error: 'MAILFLOW_API_KEY não configurada'
        });
    }

    const received =
        req.headers['x-mailflow-key'];

    if (
        !received ||
        !safeEqual(received, MAILFLOW_API_KEY)
    ) {
        return res.status(401).json({
            success: false,
            error: 'Não autorizado'
        });
    }

    next();
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/', (req, res) => {

    res.status(200).json({
        online: true,
        service: 'mailflow-backend',

        resend:
            RESEND_API_KEY
                ? 'configured'
                : 'missing',

        internal_api_key:
            MAILFLOW_API_KEY
                ? 'configured'
                : 'missing',

        sender:
            FROM_EMAIL
    });
});

/* =========================================================
   TESTE DE EMAIL

   Esta rota é SOMENTE para testar a integração inicial.
   Ainda não é o sistema de campanhas.
========================================================= */

app.post(
    '/api/test-email',
    requireInternalKey,
    async (req, res) => {

        try {

            if (!resend) {
                return res.status(503).json({
                    success: false,
                    error: 'RESEND_API_KEY não configurada'
                });
            }

            const email =
                String(req.body?.email || '')
                    .trim()
                    .toLowerCase();

            if (!validEmail(email)) {

                return res.status(400).json({
                    success: false,
                    error: 'Email inválido'
                });
            }

            /*
               Não recebemos HTML arbitrário nessa rota.

               Assim o endpoint de teste não vira um relay
               genérico de email.
            */

            const result =
                await resend.emails.send({

                    from:
                        FROM_EMAIL,

                    to:
                        [email],

                    subject:
                        'MailFlow - teste de entrega',

                    html: `
                        <!doctype html>
                        <html lang="pt-BR">
                        <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1">
                        </head>

                        <body style="
                            margin:0;
                            padding:32px;
                            background:#f6f7f9;
                            font-family:Arial,sans-serif;
                            color:#111827;
                        ">

                            <div style="
                                max-width:600px;
                                margin:0 auto;
                                background:#ffffff;
                                padding:32px;
                                border-radius:12px;
                            ">

                                <h1 style="
                                    margin-top:0;
                                    font-size:24px;
                                ">
                                    MailFlow
                                </h1>

                                <p>
                                    Este é um email de teste do
                                    sistema MailFlow.
                                </p>

                                <p>
                                    Se você recebeu esta mensagem,
                                    a integração
                                    MailFlow → Render → Resend
                                    está funcionando.
                                </p>

                                <hr style="
                                    border:none;
                                    border-top:1px solid #e5e7eb;
                                    margin:28px 0;
                                ">

                                <p style="
                                    font-size:12px;
                                    color:#6b7280;
                                ">
                                    Mensagem técnica de teste.
                                </p>

                            </div>

                        </body>
                        </html>
                    `
                });

            if (result.error) {

                console.error(
                    'RESEND ERROR:',
                    result.error
                );

                return res.status(502).json({
                    success: false,
                    error: 'Falha no envio pelo provedor',
                    details: result.error
                });
            }

            console.log(
                'TEST EMAIL SENT:',
                {
                    message_id:
                        result.data?.id || null
                }
            );

            return res.status(200).json({

                success: true,

                message:
                    'Email enviado para o provedor',

                message_id:
                    result.data?.id || null
            });

        } catch (error) {

            console.error(
                'TEST EMAIL ERROR:',
                error
            );

            return res.status(500).json({
                success: false,
                error: 'Erro interno'
            });
        }
    }
);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {

    res.status(404).json({
        success: false,
        error: 'Rota não encontrada'
    });
});

/* =========================================================
   START
========================================================= */

app.listen(PORT, () => {

    console.log(
        `MailFlow backend rodando na porta ${PORT}`
    );

    console.log(
        `Resend: ${
            RESEND_API_KEY
                ? 'CONFIGURADO'
                : 'AUSENTE'
        }`
    );

    console.log(
        `MailFlow internal key: ${
            MAILFLOW_API_KEY
                ? 'CONFIGURADA'
                : 'AUSENTE'
        }`
    );

    console.log(
        `Sender: ${FROM_EMAIL}`
    );

    console.log(
        'POST /api/test-email'
    );
});
