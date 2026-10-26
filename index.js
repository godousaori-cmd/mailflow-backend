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

/*
 * Para produção, prefira mover essas URLs para variáveis
 * de ambiente permanentes no Render.
 */
const GOLDEN_X_LOGO_URL =
    process.env.GOLDEN_X_LOGO_URL || '';

const GOLDEN_X_SYMBOL_URL =
    process.env.GOLDEN_X_SYMBOL_URL || '';

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

    return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function requireInternalKey(req, res, next) {
    if (!MAILFLOW_API_KEY) {
        return res.status(503).json({
            success: false,
            error: 'MAILFLOW_API_KEY não configurada'
        });
    }

    const received = req.headers['x-mailflow-key'];

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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeUrl(value = '') {
    try {
        const url = new URL(String(value));

        if (
            url.protocol !== 'https:' &&
            url.protocol !== 'http:'
        ) {
            return '';
        }

        return url.toString();
    } catch {
        return '';
    }
}

function textToHtml(value = '') {
    return escapeHtml(value)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n/g, '<br>');
}

/* =========================================================
   GOLDEN X EMAIL TEMPLATE
========================================================= */

function buildGoldenXEmail(data) {
    const name =
        escapeHtml(data.name || 'お客様');

    const deadline =
        escapeHtml(data.deadline || '');

    const preheader =
        escapeHtml(
            data.preheader ||
            'Golden Xからのお知らせです。'
        );

    const heading =
        escapeHtml(
            data.heading ||
            'アカウントに関するご確認のお願い'
        );

    const body =
        data.body
            ? textToHtml(data.body)
            : `
                いつもGolden Xをご利用いただき、
                誠にありがとうございます。<br>
                Golden X コンプライアンス担当チームです。
                <br><br>
                お客様のアカウントに関する
                確認事項がございます。
            `;

    const verificationUrl =
        safeUrl(data.verification_url);

    const googlePlayUrl =
        safeUrl(data.google_play_url);

    const appStoreUrl =
        safeUrl(data.app_store_url);

    const snsUrl =
        safeUrl(data.sns_url);

    const unsubscribeUrl =
        safeUrl(data.unsubscribe_url);

    const supportEmail =
        escapeHtml(
            data.support_email ||
            'info@mailflow-jp.com'
        );

    const disclaimer =
        data.disclaimer
            ? textToHtml(data.disclaimer)
            : `
                本メールはGolden Xからのお知らせです。
                セキュリティ保護のため、
                パスワードや認証コードなどの
                機密情報をメールで送信しないでください。
            `;

    const ctaText =
        escapeHtml(
            data.cta_text ||
            '確認手続きを行う'
        );

    const logo = GOLDEN_X_LOGO_URL
        ? `
            <img
                src="${escapeHtml(GOLDEN_X_LOGO_URL)}"
                alt="Golden X"
                width="280"
                style="
                    display:block;
                    width:100%;
                    max-width:280px;
                    height:auto;
                    margin:0 auto;
                    border:0;
                "
            >
        `
        : `
            <div style="
                font-size:44px;
                line-height:1;
                font-weight:800;
                color:#ffffff;
                letter-spacing:-2px;
            ">
                Golden X
            </div>
        `;

    const deadlineBlock = deadline
        ? `
            <div style="
                margin:30px 0;
                text-align:center;
                font-size:19px;
                line-height:1.6;
                font-weight:700;
                color:#a5362a;
            ">
                【ご対応期限：${deadline}】
            </div>
        `
        : '';

    const ctaBlock = verificationUrl
        ? `
            <div style="
                text-align:center;
                margin:32px 0;
            ">
                <a
                    href="${escapeHtml(verificationUrl)}"
                    style="
                        display:inline-block;
                        background:#0b2447;
                        color:#ffffff;
                        text-decoration:none;
                        font-weight:700;
                        font-size:16px;
                        line-height:1;
                        padding:16px 30px;
                        border-radius:6px;
                    "
                >
                    ${ctaText}
                </a>
            </div>
        `
        : '';

    const googlePlayBlock = googlePlayUrl
        ? `
            <a
                href="${escapeHtml(googlePlayUrl)}"
                style="
                    display:inline-block;
                    margin:6px;
                    padding:13px 20px;
                    background:#000000;
                    color:#ffffff;
                    text-decoration:none;
                    border-radius:7px;
                    font-size:14px;
                    font-weight:700;
                "
            >
                Google Play
            </a>
        `
        : '';

    const appStoreBlock = appStoreUrl
        ? `
            <a
                href="${escapeHtml(appStoreUrl)}"
                style="
                    display:inline-block;
                    margin:6px;
                    padding:13px 20px;
                    background:#000000;
                    color:#ffffff;
                    text-decoration:none;
                    border-radius:7px;
                    font-size:14px;
                    font-weight:700;
                "
            >
                App Store
            </a>
        `
        : '';

    const socialBlock = snsUrl
        ? `
            <div style="
                text-align:center;
                margin-top:28px;
            ">
                <div style="
                    font-size:20px;
                    font-weight:700;
                    margin-bottom:12px;
                ">
                    最新情報をお見逃しなく！
                </div>

                <a
                    href="${escapeHtml(snsUrl)}"
                    style="
                        color:#111827;
                        text-decoration:underline;
                    "
                >
                    Golden X
                </a>
            </div>
        `
        : '';

    const unsubscribeBlock = unsubscribeUrl
        ? `
            <div style="
                margin-top:20px;
                text-align:center;
            ">
                <a
                    href="${escapeHtml(unsubscribeUrl)}"
                    style="
                        color:#6b7280;
                        text-decoration:underline;
                    "
                >
                    配信停止
                </a>
            </div>
        `
        : '';

    return `
<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <title>Golden X</title>
</head>

<body style="
    margin:0;
    padding:0;
    background:#f3f4f6;
    font-family:
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        'Noto Sans JP',
        'Hiragino Kaku Gothic ProN',
        'Yu Gothic',
        Meiryo,
        Arial,
        sans-serif;
    color:#111111;
">

    <div style="
        display:none;
        max-height:0;
        overflow:hidden;
        opacity:0;
    ">
        ${preheader}
    </div>

    <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
            width:100%;
            background:#f3f4f6;
        "
    >
        <tr>
            <td align="center">

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                        width:100%;
                        max-width:640px;
                        background:#ffffff;
                    "
                >

                    <!-- HEADER -->
                    <tr>
                        <td
                            align="center"
                            style="
                                background:#0b2447;
                                padding:36px 24px;
                            "
                        >
                            ${logo}
                        </td>
                    </tr>

                    <!-- GOLD ACCENT -->
                    <tr>
                        <td
                            style="
                                height:7px;
                                background:#e6b84b;
                                font-size:0;
                                line-height:0;
                            "
                        >
                            &nbsp;
                        </td>
                    </tr>

                    <!-- CONTENT -->
                    <tr>
                        <td
                            style="
                                padding:34px 32px 20px;
                                font-size:16px;
                                line-height:1.8;
                            "
                        >

                            <p style="
                                margin:0 0 24px;
                                font-size:17px;
                            ">
                                ${name} 様
                            </p>

                            <h1 style="
                                margin:0 0 24px;
                                font-size:22px;
                                line-height:1.5;
                                font-weight:700;
                            ">
                                ${heading}
                            </h1>

                            <div style="
                                margin-bottom:26px;
                            ">
                                ${body}
                            </div>

                            <div style="
                                margin:28px 0;
                                padding:22px;
                                background:#f8f9fb;
                                border-left:4px solid #e6b84b;
                            ">
                                <div style="
                                    font-weight:700;
                                    margin-bottom:10px;
                                ">
                                    確認事項
                                </div>

                                <div>
                                    アカウントに必要な確認事項の詳細は、
                                    公式ページにログインしてご確認ください。
                                    <br><br>
                                    第三者にパスワード、
                                    認証コード、
                                    ウォレット情報などを共有しないよう
                                    お願いいたします。
                                </div>
                            </div>

                            ${deadlineBlock}

                            <p style="
                                margin:24px 0;
                            ">
                                期限までにお手続きいただけない場合、
                                一部サービスのご利用に制限がかかる場合がございます。
                            </p>

                            ${ctaBlock}

                            <p style="
                                margin:26px 0 8px;
                            ">
                                引き続きGolden Xを
                                よろしくお願いいたします。
                            </p>

                            <p style="
                                margin:0;
                            ">
                                Golden X チーム
                            </p>

                        </td>
                    </tr>

                    <!-- DIVIDER -->
                    <tr>
                        <td style="padding:10px 32px 0;">
                            <div style="
                                height:1px;
                                background:#b7bcc5;
                            "></div>
                        </td>
                    </tr>

                    <!-- DOWNLOAD -->
                    <tr>
                        <td
                            align="center"
                            style="
                                padding:28px 24px 10px;
                            "
                        >

                            <div style="
                                font-size:23px;
                                line-height:1.5;
                                font-weight:700;
                                margin-bottom:14px;
                            ">
                                今すぐダウンロード
                            </div>

                            <div>
                                ${googlePlayBlock}
                                ${appStoreBlock}
                            </div>

                            ${socialBlock}

                        </td>
                    </tr>

                    <!-- SIGNATURE -->
                    <tr>
                        <td
                            align="center"
                            style="
                                padding:25px 28px 15px;
                                font-size:14px;
                                line-height:1.7;
                            "
                        >

                            ${
                                GOLDEN_X_SYMBOL_URL
                                    ? `
                                        <img
                                            src="${escapeHtml(GOLDEN_X_SYMBOL_URL)}"
                                            alt=""
                                            width="50"
                                            style="
                                                width:50px;
                                                height:auto;
                                                display:block;
                                                margin:0 auto 14px;
                                            "
                                        >
                                    `
                                    : ''
                            }

                            <strong>Golden X</strong>
                            <br>
                            コンプライアンス担当チーム
                            <br>
                            ${supportEmail}

                        </td>
                    </tr>

                    <!-- LEGAL -->
                    <tr>
                        <td
                            style="
                                padding:18px 30px 32px;
                                font-size:11px;
                                line-height:1.7;
                                color:#6b7280;
                                text-align:center;
                            "
                        >
                            ${disclaimer}

                            ${unsubscribeBlock}
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>
    `;
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

        golden_x_logo:
            GOLDEN_X_LOGO_URL
                ? 'configured'
                : 'missing',

        golden_x_symbol:
            GOLDEN_X_SYMBOL_URL
                ? 'configured'
                : 'missing',

        sender:
            FROM_EMAIL
    });
});

/* =========================================================
   TECHNICAL TEST
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

            const result =
                await resend.emails.send({
                    from: FROM_EMAIL,
                    to: [email],
                    subject:
                        '【テスト】MailFlow 配信テスト',
                    html: `
                        <!doctype html>
                        <html lang="ja">
                        <head>
                            <meta charset="utf-8">
                        </head>
                        <body style="
                            font-family:Arial,sans-serif;
                            padding:32px;
                        ">
                            <h1>MailFlow</h1>

                            <p>
                                これはMailFlowの
                                テストメールです。
                            </p>

                            <p>
                                このメールを受信できた場合、
                                メール配信システムは
                                正常に動作しています。
                            </p>
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
                    'Email de teste enviado',
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
   GOLDEN X CAMPAIGN TEST

   SOMENTE 1 DESTINATÁRIO POR REQUISIÇÃO.
   NÃO É ENDPOINT DE DISPARO EM MASSA.
========================================================= */

app.post(
    '/api/campaigns/test',
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

            const subject =
                String(
                    req.body?.subject ||
                    '【Golden X】アカウントに関するご確認のお願い'
                )
                    .trim()
                    .slice(0, 200);

            const templateData = {
                name:
                    req.body?.name,

                preheader:
                    req.body?.preheader,

                heading:
                    req.body?.heading,

                body:
                    req.body?.body,

                deadline:
                    req.body?.deadline,

                cta_text:
                    req.body?.cta_text,

                verification_url:
                    req.body?.verification_url,

                google_play_url:
                    req.body?.google_play_url,

                app_store_url:
                    req.body?.app_store_url,

                sns_url:
                    req.body?.sns_url,

                support_email:
                    req.body?.support_email,

                disclaimer:
                    req.body?.disclaimer,

                unsubscribe_url:
                    req.body?.unsubscribe_url
            };

            const html =
                buildGoldenXEmail(templateData);

            const result =
                await resend.emails.send({
                    from: FROM_EMAIL,
                    to: [email],
                    subject,
                    html
                });

            if (result.error) {
                console.error(
                    'CAMPAIGN TEST RESEND ERROR:',
                    result.error
                );

                return res.status(502).json({
                    success: false,
                    error:
                        'Falha no envio pelo provedor',
                    details:
                        result.error
                });
            }

            console.log(
                'CAMPAIGN TEST SENT:',
                {
                    message_id:
                        result.data?.id || null,
                    recipient:
                        email
                }
            );

            return res.status(200).json({
                success: true,
                message:
                    'Golden X test email sent',
                message_id:
                    result.data?.id || null
            });

        } catch (error) {
            console.error(
                'CAMPAIGN TEST ERROR:',
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
        `Golden X logo: ${
            GOLDEN_X_LOGO_URL
                ? 'CONFIGURADO'
                : 'AUSENTE'
        }`
    );

    console.log(
        `Golden X symbol: ${
            GOLDEN_X_SYMBOL_URL
                ? 'CONFIGURADO'
                : 'AUSENTE'
        }`
    );

    console.log(
        `Sender: ${FROM_EMAIL}`
    );

    console.log(
        'POST /api/test-email'
    );

    console.log(
        'POST /api/campaigns/test'
    );
});
