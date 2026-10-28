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
   GOLDEN X EMAIL TEMPLATE V2
========================================================= */

function buildGoldenXEmail(data) {
    const colors = {
        gold: '#f8cc28',
        paper: '#ffffff',
        background: '#f2f2f2',
        ink: '#191919',
        muted: '#666666',
        line: '#dedede',
        alert: '#a31d29'
    };

    function httpsUrl(value = '') {
        try {
            const url = new URL(String(value || ''));

            if (
                url.protocol !== 'https:' ||
                url.username ||
                url.password
            ) {
                return '';
            }

            return url.toString();
        } catch {
            return '';
        }
    }

    function renderText(value = '') {
        return escapeHtml(String(value || ''))
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n/g, '<br>');
    }

    function replaceVars(value = '', vars = {}) {
        let result = String(value || '');

        for (const [key, val] of Object.entries(vars)) {
            result = result
                .split(`{{${key}}}`)
                .join(String(val ?? ''));
        }

        return result;
    }

    const name =
        String(data.name || 'お客様').trim();

    const deadline =
        String(data.deadline || '').trim();

    const vars = {
        name,
        deadline,
        verification_url:
            String(data.verification_url || ''),
        support_email:
            String(data.support_email || ''),
        google_play_url:
            String(data.google_play_url || ''),
        app_store_url:
            String(data.app_store_url || ''),
        privacy_url:
            String(data.privacy_url || '')
    };

    const preheader =
        escapeHtml(
            data.preheader ||
            '安全のため、Golden X公式ページから確認手続きをお願いいたします。'
        );

    const salutation =
        renderText(
            replaceVars(
                data.salutation ||
                '{{name}} 様',
                vars
            )
        );

    const heading =
        data.heading
            ? `
                <h1 style="
                    font-size:22px;
                    line-height:1.5;
                    margin:0 0 24px;
                ">
                    ${escapeHtml(data.heading)}
                </h1>
            `
            : '';

    const body =
        renderText(
            replaceVars(
                data.body ||
                `いつもGolden Xをご利用いただき、誠にありがとうございます。
Golden X コンプライアンス担当チームです。

この度、お客様のアカウントに関する確認事項がございます。

マネーロンダリング防止（AML）およびセキュリティ上の確認のため、以下の項目についてご確認をお願いいたします。`,
                vars
            )
        );

    const confirmationBody =
        renderText(
            replaceVars(
                data.confirmation_body ||
                `Q1. ご入金いただいた暗号資産の具体的な入手元

Q2. ご入金元の取引所名またはウォレット名

Q3. 今回のご入金の主な目的、および今後の運用予定

Q4. 現在のご職業と、ご入金資金との関連性について

Q5. 第三者からの依頼や代理によるご入金ではないことの確認`,
                vars
            )
        );

    const closingBody =
        renderText(
            replaceVars(
                data.closing_body ||
                `期限までにお手続きいただけない場合、一部サービスのご利用に制限がかかる場合がございます。

セキュリティ保護のため、パスワード、認証コード、口座情報などの機密情報をメールでお送りいただく必要はございません。
上記の確認事項への回答を含む必要な確認手続きは、Golden X公式ページからお願いいたします。`,
                vars
            )
        );

    const disclaimer =
        renderText(
            replaceVars(
                data.disclaimer ||
                `本メールはGolden Xからの重要なお知らせです。
Golden Xがメールでパスワードや認証コードなどの機密情報をお伺いすることはありません。
不審なメールやリンクには十分ご注意ください。`,
                vars
            )
        );

    const signature =
        renderText(
            replaceVars(
                data.signature ||
                `Golden X
コンプライアンス担当チーム`,
                vars
            )
        );

    const ctaText =
        escapeHtml(
            data.cta_text ||
            '確認手続きを行う'
        );

    const verificationUrl =
        httpsUrl(data.verification_url);

    const googlePlayUrl =
        httpsUrl(data.google_play_url);

    const appStoreUrl =
        httpsUrl(data.app_store_url);

    const privacyUrl =
        httpsUrl(data.privacy_url);

    const unsubscribeUrl =
        httpsUrl(data.unsubscribe_url);

    const logoUrl =
        httpsUrl(data.logo_url) ||
        httpsUrl(GOLDEN_X_LOGO_URL);

    const symbolUrl =
        httpsUrl(data.symbol_url) ||
        httpsUrl(GOLDEN_X_SYMBOL_URL);

    /*
     * Imagens oficiais dos badges usadas pelo
     * preview Golden X v2.
     */
    const googlePlayBadge =
        httpsUrl(
            process.env.GOLDEN_X_GOOGLE_PLAY_BADGE_URL ||
            'https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/20727a23-53f6-460c-9a20-8114852f3d26/google-play-ja.png'
        );

    const appStoreBadge =
        httpsUrl(
            process.env.GOLDEN_X_APP_STORE_BADGE_URL ||
            'https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/890eb7f3-d040-42e2-a2cc-05b7ad9a5a5d/app-store-ja.png'
        );

    const supportEmail =
        String(
            data.support_email ||
            'goldenxsupport@gmail.com'
        ).trim();

    const supportHtml =
        validEmail(supportEmail)
            ? `
                <a
                    href="mailto:${escapeHtml(supportEmail)}"
                    style="
                        color:${colors.ink};
                        text-decoration:none;
                    "
                >
                    ${escapeHtml(supportEmail)}
                </a>
            `
            : escapeHtml(supportEmail);

    const img = (
        url,
        alt,
        width
    ) => {
        if (!url) {
            return '';
        }

        return `
            <img
                src="${escapeHtml(url)}"
                alt="${escapeHtml(alt)}"
                width="${width}"
                style="
                    display:block;
                    width:${width}px;
                    max-width:100%;
                    height:auto;
                    border:0;
                    margin:0 auto;
                "
            >
        `;
    };

    const linkOrSpan = (
        url,
        inner,
        style
    ) => {
        if (url) {
            return `
                <a
                    href="${escapeHtml(url)}"
                    style="${style}"
                >
                    ${inner}
                </a>
            `;
        }

        return `
            <span style="${style}">
                ${inner}
            </span>
        `;
    };

    const headerLogo =
        logoUrl
            ? img(
                logoUrl,
                'Golden X',
                280
            )
            : `
                <strong style="
                    font-size:32px;
                    color:#191919;
                ">
                    Golden X
                </strong>
            `;

    const deadlineBlock =
        deadline
            ? `
                <p
                    class="gx-deadline"
                    style="
                        margin:34px 0 24px;
                        text-align:center;
                        font-size:20px;
                        font-weight:bold;
                        color:${colors.alert};
                    "
                >
                    【ご対応期限：${escapeHtml(deadline)}】
                </p>
            `
            : '';

    const ctaBlock =
        linkOrSpan(
            verificationUrl,
            ctaText,
            `
                display:inline-block;
                padding:16px 30px;
                max-width:100%;
                box-sizing:border-box;
                font-weight:bold;
                color:${colors.ink};
                text-decoration:none;
            `
        );

    const googleBadge =
        googlePlayBadge
            ? linkOrSpan(
                googlePlayUrl,
                img(
                    googlePlayBadge,
                    'Google Play で手に入れよう',
                    184
                ),
                `
                    display:inline-block;
                    text-decoration:none;
                    max-width:100%;
                `
            )
            : '';

    const appleBadge =
        appStoreBadge
            ? linkOrSpan(
                appStoreUrl,
                img(
                    appStoreBadge,
                    'App Store からダウンロード',
                    148
                ),
                `
                    display:inline-block;
                    text-decoration:none;
                    max-width:100%;
                `
            )
            : '';

    const privacy =
        linkOrSpan(
            privacyUrl,
            'プライバシーポリシー',
            `
                color:${colors.muted};
                text-decoration:${
                    privacyUrl
                        ? 'underline'
                        : 'none'
                };
            `
        );

    const unsubscribe =
        linkOrSpan(
            unsubscribeUrl,
            '配信停止',
            `
                color:${colors.muted};
                text-decoration:${
                    unsubscribeUrl
                        ? 'underline'
                        : 'none'
                };
            `
        );

    return `
<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">

    <meta
        name="viewport"
        content="width=device-width,initial-scale=1"
    >

    <style>
        @media(max-width:480px){
            .gx-content{
                padding:28px 20px!important;
            }

            .gx-header{
                padding:38px 24px!important;
            }

            .gx-deadline{
                font-size:18px!important;
            }
        }
    </style>
</head>

<body style="
    margin:0;
    padding:0;
    background:${colors.background};
    color:${colors.ink};
    font-family:
        Arial,
        'Hiragino Kaku Gothic ProN',
        'Yu Gothic',
        Meiryo,
        sans-serif;
">

    <!-- PREHEADER -->
    <div style="
        display:none;
        max-height:0;
        overflow:hidden;
        mso-hide:all;
    ">
        ${preheader}
    </div>

    <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
    >
        <tr>
            <td align="center">

                <!--[if mso]>
                <table
                    role="presentation"
                    width="640"
                    cellspacing="0"
                    cellpadding="0"
                >
                <tr>
                <td>
                <![endif]-->

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    style="
                        max-width:640px;
                        table-layout:fixed;
                        background:${colors.paper};
                    "
                >

                    <!-- HEADER -->
                    <tr>
                        <td
                            class="gx-header"
                            align="center"
                            style="
                                background:${colors.gold};
                                padding:52px 32px;
                            "
                        >
                            ${headerLogo}
                        </td>
                    </tr>

                    <!-- CONTENT -->
                    <tr>
                        <td
                            class="gx-content"
                            style="
                                padding:42px 44px;
                                font-size:15px;
                                line-height:1.95;
                                overflow-wrap:anywhere;
                                word-wrap:break-word;
                            "
                        >

                            <!-- SALUTATION -->
                            <p style="
                                margin:0 0 26px;
                            ">
                                ${salutation}
                            </p>

                            ${heading}

                            <!-- INTRODUCTION -->
                            <div>
                                ${body}
                            </div>

                            <!-- CONFIRMATION -->
                            <h2 style="
                                font-size:17px;
                                margin:30px 0 20px;
                            ">
                                【確認事項】
                            </h2>

                            <div>
                                ${confirmationBody}
                            </div>

                            <!-- DEADLINE -->
                            ${deadlineBlock}

                            <!-- CLOSING -->
                            <div>
                                ${closingBody}
                            </div>

                            <!-- CTA -->
                            <table
                                role="presentation"
                                align="center"
                                cellspacing="0"
                                cellpadding="0"
                                style="
                                    margin:30px auto 38px;
                                    max-width:100%;
                                "
                            >
                                <tr>
                                    <td
                                        align="center"
                                        style="
                                            background:${colors.gold};
                                            border-radius:4px;
                                            mso-padding-alt:16px 30px;
                                        "
                                    >
                                        ${ctaBlock}
                                    </td>
                                </tr>
                            </table>

                            <hr style="
                                border:0;
                                border-top:1px solid ${colors.line};
                                margin:0 0 30px;
                            ">

                            <!-- DOWNLOAD -->
                            <h2 style="
                                font-size:20px;
                                text-align:center;
                                margin:0 0 18px;
                            ">
                                今すぐダウンロード
                            </h2>

                            <table
                                role="presentation"
                                width="100%"
                                cellspacing="0"
                                cellpadding="0"
                                style="
                                    max-width:370px;
                                    margin:0 auto;
                                    table-layout:fixed;
                                "
                            >
                                <tr>

                                    <td
                                        align="center"
                                        width="50%"
                                        style="
                                            padding:6px 4px;
                                            vertical-align:middle;
                                        "
                                    >
                                        ${googleBadge}
                                    </td>

                                    <td
                                        align="center"
                                        width="50%"
                                        style="
                                            padding:6px 4px;
                                            vertical-align:middle;
                                        "
                                    >
                                        ${appleBadge}
                                    </td>

                                </tr>
                            </table>

                            <!-- ABOUT -->
                            <h2 style="
                                font-size:14px;
                                text-align:center;
                                margin:36px 0 20px;
                            ">
                                Golden Xについて
                            </h2>

                            ${
                                symbolUrl
                                    ? img(
                                        symbolUrl,
                                        'Golden X シンボル',
                                        76
                                    )
                                    : ''
                            }

                            <table
                                role="presentation"
                                align="center"
                                cellspacing="0"
                                cellpadding="0"
                                style="
                                    margin:24px auto 18px;
                                "
                            >
                                <tr>
                                    <td style="
                                        background:${colors.gold};
                                        padding:14px 22px;
                                    ">

                                        ${
                                            logoUrl
                                                ? img(
                                                    logoUrl,
                                                    'Golden X',
                                                    170
                                                )
                                                : `
                                                    <strong
                                                        style="
                                                            font-size:24px;
                                                        "
                                                    >
                                                        Golden X
                                                    </strong>
                                                `
                                        }

                                    </td>
                                </tr>
                            </table>

                            <!-- SIGNATURE -->
                            <p style="
                                text-align:center;
                                margin:0 0 34px;
                            ">
                                ${signature}
                                <br>
                                ${supportHtml}
                            </p>

                            <!-- FOOTER -->
                            <div style="
                                border-top:1px solid ${colors.line};
                                padding-top:22px;
                                font-size:11px;
                                color:${colors.muted};
                                line-height:1.9;
                            ">

                                ${disclaimer}

                                <br>

                                Golden X

                                <p style="
                                    text-align:center;
                                    margin:18px 0 0;
                                ">
                                    ${privacy}
                                    <br>
                                    ${unsubscribe}
                                </p>

                            </div>

                        </td>
                    </tr>

                </table>

                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->

            </td>
        </tr>
    </table>

</body>
</html>
    `;
}


/* =========================================================
   BINANCE JAPAN MAINTENANCE — INTERNAL PREVIEW V1
========================================================= */
function buildBinanceJapanMaintenancePreview(data = {}) {
    const intro = textToHtml(data.body || `Binance Japanをご利用の皆様へ

いつもBinance Japanをご利用いただきありがとうございます。

ドコモSMTBネット銀行において、以下のとおりメンテナンスが予定されています。
メンテナンス期間中にドコモSMTBネット銀行を利用して当社への入金または当社からの出金を行う場合、入出金が正常に実行されない、または通常よりお時間をいただく可能性があります。メンテナンス期間中のご利用の際はご注意ください。

なお、ドコモSMTBネット銀行のメンテナンス期間中も、以下の方法による入出金はご利用いただけます。

お急ぎの場合は、他の入出金方法のご利用もご検討ください。`);

    const maintenance = textToHtml(data.maintenance || '10月9日(金)15:00 ～ 10月13日(火) 8:00');
    const methods = textToHtml(data.methods || 'PayPayマネー\nGMOあおぞらネット銀行');
    const antiPhishingCode = escapeHtml(data.anti_phishing_code || 'INTERNAL PREVIEW');

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#eeeeee;color:#181a20;font-family:Arial,'Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">INTERNAL PREVIEW — Binance-style visual reference</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;background:#ffffff;border-collapse:collapse;">

<tr><td align="center" style="background:#f0b90b;padding:42px 20px 40px;">
<div style="font-size:29px;line-height:1;font-weight:700;letter-spacing:1px;color:#181a20;">◈ BINANCE</div>
</td></tr>

<tr><td align="center" style="background:#fff7d6;padding:6px 15px;font-size:9px;line-height:1.3;color:#6b5900;">
INTERNAL DESIGN PREVIEW
</td></tr>

<tr><td style="padding:21px 29px 0;font-size:14px;line-height:1.45;color:#181a20;">
<div>${intro}</div>

<div style="text-align:center;font-weight:700;font-size:15px;margin:22px 0 12px;">【メンテナンス予定】</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 0 31px;font-size:14px;line-height:1.55;">
<tr><td style="vertical-align:top;padding-right:10px;">•</td><td>${maintenance}</td></tr>
</table>

<div style="text-align:center;font-weight:700;font-size:15px;margin:25px 0 13px;">【上記メンテナンス期間中もご利用可能な入出金方法】</div>
<div style="margin-left:31px;font-size:14px;line-height:1.55;">• ${methods.replace(/<br>/g, '<br>• ')}</div>

<p style="margin:30px 0 0;">引き続きBinance Japanをよろしくお願いいたします。</p>
<p style="margin:17px 0 0;">Binance Japan チーム</p>
</td></tr>

<tr><td style="padding:43px 29px 0;"><div style="border-top:1px solid #181a20;font-size:0;line-height:0;">&nbsp;</div></td></tr>

<tr><td align="center" style="padding:16px 20px 10px;font-size:21px;line-height:1.2;font-weight:700;">今すぐダウンロード</td></tr>

<tr><td style="padding:0 31px 22px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;">
<tr>
<td width="50%" align="center" style="padding:5px 6px;vertical-align:middle;">
<img
    src="https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/20727a23-53f6-460c-9a20-8114852f3d26/google-play-ja.png"
    alt="Google Play で手に入れよう"
    width="184"
    style="display:block;width:184px;max-width:100%;height:auto;border:0;margin:0 auto;"
>
</td>
<td width="50%" align="center" style="padding:5px 6px;vertical-align:middle;">
<img
    src="https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/890eb7f3-d040-42e2-a2cc-05b7ad9a5a5d/app-store-ja.png"
    alt="App Store からダウンロード"
    width="148"
    style="display:block;width:148px;max-width:100%;height:auto;border:0;margin:0 auto;"
>
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:0 29px;"><div style="border-top:1px solid #181a20;font-size:0;line-height:0;">&nbsp;</div></td></tr>

<tr><td align="center" style="padding:14px 20px 20px;font-size:20px;line-height:1.25;font-weight:700;">最新情報をお見逃しなく！</td></tr>

<tr><td style="padding:0 29px 12px;font-size:9px;line-height:1.55;color:#181a20;">
高い安全性を保つため、フィッシング対策コードをご確認してください。
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;"><tr><td align="right">
<span style="display:inline-block;background:#f0b90b;padding:3px 10px;font-size:8px;">Anti-phishing</span>
<span style="display:inline-block;background:#eeeeee;padding:3px 10px;font-size:8px;">${antiPhishingCode}</span>
</td></tr></table>
</td></tr>

<tr><td style="padding:7px 29px 27px;font-size:8px;line-height:1.5;color:#181a20;">
<strong>リスク警告:</strong> 暗号資産の取引は、高い市場リスクを伴います。暗号資産に関する取引を行う場合は、十分な注意が必要です。
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}


function buildBinanceJapanFullPreview(data = {}) {
    const body = textToHtml(data.body || 'Binance Japanをご利用の皆様へ\n\nいつもBinance Japanをご利用いただきありがとうございます。');
    const maintenance = textToHtml(data.maintenance || '10月9日(金)15:00 ～ 10月13日(火) 8:00');
    const methods = textToHtml(data.methods || 'PayPayマネー\nGMOあおぞらネット銀行');
    const code = escapeHtml(data.anti_phishing_code || 'INTERNAL PREVIEW');
    const security = textToHtml(data.security_notice || 'フィッシング対策コードをご確認ください。');
    const risk = textToHtml(data.risk_notes || '暗号資産の取引には価格変動リスクがあります。\nご利用前にサービス内容をご確認ください。');
    const legal = textToHtml(data.legal_footer || '注意事項をご確認のうえ、サービスをご利用ください。');
    const company = textToHtml(data.company_information || 'INTERNAL DESIGN PREVIEW\n社内デザイン確認用テンプレート');
    const privacy = textToHtml(data.privacy_notice || 'プライバシーに関するご案内');
    const privacyUrl = safeUrl(data.privacy_url || '');
    const privacyLink = privacyUrl
        ? `<div style="margin-top:6px;"><a href="${escapeHtml(privacyUrl)}" style="color:#181a20;text-decoration:underline;">プライバシーポリシー</a></div>`
        : '';

    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eee;color:#181a20;font-family:Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic',YuGothic,Meiryo,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:505px;background:#fff;">
<tr><td align="center" style="background:#F8C30A;padding:42px 20px 40px;"><img
src="https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/1bdab81e-8620-4e5b-9c35-237a604609cf/binance-logo-black.png"
alt="Binance"
width="200"
style="display:block;width:200px;max-width:100%;height:auto;border:0;margin:0 auto;"
></td></tr>
<tr><td align="center" style="background:#fff7d6;padding:7px 15px;font-size:10px;font-weight:700;color:#6b5900;">INTERNAL DESIGN PREVIEW</td></tr>
<tr><td style="padding:24px 29px 0;font-size:14px;line-height:1.45;">${body}
<div style="text-align:center;font-weight:700;font-size:15px;margin:24px 0 12px;">【メンテナンス予定】</div><div style="margin-left:31px;">• ${maintenance}</div>
<div style="text-align:center;font-weight:700;font-size:15px;margin:25px 0 13px;">【上記メンテナンス期間中もご利用可能な入出金方法】</div><div style="margin-left:31px;line-height:1.55;">• ${methods.replace(/<br>/g,'<br>• ')}</div>
<p style="margin:30px 0 0;">引き続きBinance Japanをよろしくお願いいたします。</p><p style="margin:17px 0 0;">Binance Japan チーム</p></td></tr>

<tr><td style="padding:42px 29px 0;"><div style="border-top:1px solid #181a20;">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:12px;font-size:21px;font-weight:700;">今すぐダウンロード</td></tr>
<tr><td style="padding:0 31px 22px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td width="50%" align="center" style="padding-right:5px;"><img src="https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/20727a23-53f6-460c-9a20-8114852f3d26/google-play-ja.png" alt="Google Play" width="184" style="display:block;max-width:100%;height:auto;border:0;"></td>
<td width="50%" align="center" style="padding-left:5px;"><img src="https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/890eb7f3-d040-42e2-a2cc-05b7ad9a5a5d/app-store-ja.png" alt="App Store" width="148" style="display:block;max-width:100%;height:auto;border:0;"></td>
</tr></table></td></tr>

<tr><td style="padding:0 29px;"><div style="border-top:1px solid #181a20;">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:12px 20px 18px;font-size:20px;font-weight:700;">最新情報をお見逃しなく！</td></tr>

<tr><td style="padding:0 29px 18px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td style="font-size:9px;line-height:1.55;vertical-align:top;padding-right:10px;">${security}</td>
<td align="right" style="white-space:nowrap;vertical-align:top;font-size:8px;">
<span style="background:#f0b90b;padding:4px 8px;">Anti-phishing</span><span style="background:#eee;padding:4px 8px;">${code}</span>
</td>
</tr></table>
</td></tr>

${risk ? `<tr><td style="padding:0 29px 14px;font-size:9px;line-height:1.55;color:#222;">${risk}</td></tr>` : ''}
${legal ? `<tr><td style="padding:0 29px 14px;font-size:9px;line-height:1.55;color:#222;text-align:left;">${legal}</td></tr>` : ''}
${company ? `<tr><td style="padding:0 29px 14px;font-size:10px;line-height:1.65;color:#222;text-align:left;">${company}</td></tr>` : ''}
${privacy ? `<tr><td style="padding:0 29px 22px;font-size:9px;line-height:1.6;color:#222;text-align:left;">${privacy}${privacyLink}</td></tr>` : privacyLink ? `<tr><td style="padding:0 29px 22px;font-size:9px;line-height:1.6;color:#222;text-align:left;">${privacyLink}</td></tr>` : ''}

<tr><td align="center" style="background:#0b0e11;color:#fff;padding:26px 24px;font-size:8px;line-height:1.7;">
<strong>INTERNAL DESIGN PREVIEW</strong><br>
社内デザイン確認用テンプレート
</td></tr>
</table></td></tr></table></body></html>`;
}


function buildBitbankHardforkPreview(data = {}) {
 const logo=escapeHtml(data.logo_url||'https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/078b209c-f95f-402b-9d33-c5310c9f60fb/bitbank-hardfork-logo.png');
 const banner=escapeHtml(data.banner_url||'https://pixel-perfect-replay-6838.lovable.app/__l5e/assets-v1/6b2ab295-9ef7-47b9-8ef3-b0e9d733bda2/bitbank-hardfork-banner.png');
 const body=textToHtml(data.body||'いつもビットバンクをご利用いただきありがとうございます。');
 const network=escapeHtml(data.network_name||'Bitcoin');
 const asset=escapeHtml(data.asset_name||'ビットコイン（BTC）');
 const stop=textToHtml(data.suspension_start||'2026年10月30日（金）17:00頃');
 const resume=textToHtml(data.resumption_time||'2026年11月2日（月）19:00頃');
 const stopNote=textToHtml(data.suspension_note||'上記暗号資産の入出金以外の全てのサービスは通常どおりご利用いただけます。');
 const resumeNote=textToHtml(data.resumption_note||'ハードフォーク完了後、システムの安定稼働を確認次第、入出金を再開いたします。');
 const closing=textToHtml(data.closing_text||'今後ともビットバンクをよろしくお願いいたします。');
 const footer=textToHtml(data.footer_notice||'当メールは大切なお知らせの為、ユーザ全員に送付しています。予めご了承ください。');
 const companyInformation=textToHtml(data.company_information||'');
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff;color:#4a4a4a;font-family:Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic',YuGothic,Meiryo,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:505px;background:#fff;">
<tr><td align="center" style="padding:14px 0 15px;"><img src="${logo}" alt="bitbank" width="163" style="display:block;width:163px;max-width:100%;height:auto;border:0;margin:0 auto;"></td></tr>
<tr><td align="center" style="background:#fff7d6;padding:5px;font-size:9px;font-weight:700;color:#6b5900;">INTERNAL DESIGN PREVIEW</td></tr>
<tr><td><img src="${banner}" alt="" width="504" style="display:block;width:100%;max-width:504px;height:auto;border:0;margin:0 auto;"></td></tr>
<tr><td style="padding-top:17px;font-size:13px;line-height:1.75;color:#555;">${body}</td></tr>
<tr><td style="padding-top:12px;"><table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:12px;color:#444;"><tr><td style="border:1px solid #555;padding:3px 5px;font-weight:700;">対象ネットワーク名</td><td style="border:1px solid #555;padding:3px 5px;font-weight:700;">暗号資産名（ティッカー名）</td></tr><tr><td style="border:1px solid #555;padding:3px 5px;">${network}</td><td style="border:1px solid #555;padding:3px 5px;">${asset}</td></tr></table></td></tr>
<tr><td style="padding-top:12px;font-size:17px;font-weight:700;">入出金の停止期間について</td></tr>
<tr><td style="padding:7px 0 0 30px;font-size:13px;line-height:1.75;"><ul style="margin:0;padding-left:18px;"><li>入出金の停止予定日時<ul><li>${stop}</li></ul></li><li>入出金の再開予定日時<ul><li>${resume}</li></ul></li></ul></td></tr>
<tr><td style="padding-top:12px;font-size:13px;line-height:1.75;">${stopNote}</td></tr>
<tr><td style="padding-top:11px;font-size:17px;font-weight:700;">入出金の再開について</td></tr>
<tr><td style="padding-top:7px;font-size:13px;line-height:1.75;">${resumeNote}</td></tr>
<tr><td style="padding-top:9px;font-size:13px;line-height:1.75;">${closing}</td></tr>
<tr><td style="padding-top:17px;"><div style="border-top:1px solid #777;">&nbsp;</div></td></tr>
<tr><td style="padding:12px 0 22px;font-size:11px;line-height:1.75;color:#666;">${footer}</td></tr>
${companyInformation ? `<tr><td style="padding:0 15px 34px;text-align:center;font-size:10px;line-height:1.85;color:#555555;font-weight:400;white-space:pre-line;">${companyInformation}</td></tr>` : ''}
</table></td></tr></table></body></html>`;
}

function selectCampaignTemplate(templateData) {
 const key=String(templateData?.template_key||'').trim();
 if(key==='binance_japan_maintenance_preview_v1') return buildBinanceJapanMaintenancePreview(templateData);
 if(key==='binance_japan_full_preview_v1') return buildBinanceJapanFullPreview(templateData);
 if(key==='bitbank_hardfork_preview_v1') return buildBitbankHardforkPreview(templateData);
 return buildGoldenXEmail(templateData);
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
                    error:
                        'Falha no envio pelo provedor',
                    details:
                        result.error
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
   GOLDEN X CAMPAIGN TEST V2

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
                    error:
                        'RESEND_API_KEY não configurada'
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

            /*
             * Structured data only.
             * Browser does NOT send arbitrary email HTML.
             */
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
                    req.body?.unsubscribe_url,

                /*
                 * Golden X v2
                 */
                template_key:
                    req.body?.template_key,

                salutation:
                    req.body?.salutation,

                confirmation_body:
                    req.body?.confirmation_body,

                closing_body:
                    req.body?.closing_body,

                logo_url:
                    req.body?.logo_url,

                symbol_url:
                    req.body?.symbol_url,

                signature:
                    req.body?.signature,

                privacy_url:
                    req.body?.privacy_url,

                maintenance:
                    req.body?.maintenance,

                methods:
                    req.body?.methods,

                anti_phishing_code:
                    req.body?.anti_phishing_code,

                risk_notes:
                    req.body?.risk_notes,

                company_information:
                    req.body?.company_information,

                security_notice:
                    req.body?.security_notice,

                privacy_notice:
                    req.body?.privacy_notice,

                legal_footer:
                    req.body?.legal_footer,

                network_name: req.body?.network_name,
                asset_name: req.body?.asset_name,
                suspension_start: req.body?.suspension_start,
                resumption_time: req.body?.resumption_time,
                suspension_note: req.body?.suspension_note,
                resumption_note: req.body?.resumption_note,
                closing_text: req.body?.closing_text,
                footer_notice: req.body?.footer_notice,
                informational_link_text: req.body?.informational_link_text,
                banner_url: req.body?.banner_url
            };

            const html =
                selectCampaignTemplate(
                    templateData
                );

            const result =
                await resend.emails.send({
                    from:
                        FROM_EMAIL,

                    to:
                        [email],

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
                        email,

                    template:
                        templateData.template_key ||
                        'legacy'
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
