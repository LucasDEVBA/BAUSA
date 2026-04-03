const functions = require('@google-cloud/functions-framework');
const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error('ERRO: variável de ambiente RESEND_API_KEY não configurada');
}

const sendEmail = (to, subject, html) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      from: 'Bolsa Atleta USA <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
};

const getHtmlTemplate = (name, type) => {
  const colors = { primary: '#1A365D', secondary: '#9B2C2C' };
  const title = type === 'athlete' ? `Parabéns, ${name}!` : `Inscrição Recebida: ${name}`;
  const message = type === 'athlete' 
    ? `Sua jornada rumo aos EUA começou. Recebemos sua inscrição e nossa equipe de especialistas já está analisando seu perfil esportivo e acadêmico.`
    : `Recebemos a inscrição de <strong>${name}</strong> para o programa da Bolsa Atleta USA. Nosso compromisso é transformar sonhos em carreiras sólidas através do esporte e educação.`;

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:20px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:${colors.primary};margin:0;">BOLSA ATLETA USA</h2>
        <p style="color:${colors.secondary};font-size:12px;margin:5px 0 0 0;">ELITE PORTAL</p>
      </div>
      <div style="color:#333;line-height:1.6;">
        <h3 style="color:${colors.primary};">${title}</h3>
        <p>${message}</p>
        <p>Fique atento ao seu WhatsApp e e-mail, entraremos em contato em breve para os próximos passos.</p>
        <div style="text-align:center;margin-top:30px;">
          <a href="https://bolsaatletausa.com" style="background:${colors.primary};color:white;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;">Acessar Portal</a>
        </div>
        <hr style="border:0;border-top:1px solid #eee;margin:30px 0 20px 0;">
        <p style="font-size:12px;color:#666;text-align:center;">© 2026 Bolsa Atleta USA. Todos os direitos reservados.</p>
      </div>
    </div>`;
};

functions.http('sendMessages', async (req, res) => {
  try {
    const data = req.body.record || req.body;
    if (!data || !data.email) return res.status(200).send({ message: 'No email to notify' });

    console.log(`Iniciando envio de e-mails para: ${data.email}`);

    // 1. E-mail para o Atleta
    await sendEmail(data.email, `Bem-vindo à Elite, ${data.athlete_name}!`, getHtmlTemplate(data.athlete_name, 'athlete'));

    // 2. E-mail para o Responsável (se existir)
    if (data.guardian_email) {
      await sendEmail(data.guardian_email, `Inscrição Recebida: ${data.athlete_name}`, getHtmlTemplate(data.athlete_name, 'guardian'));
    }

    // 3. E-mail de Notificação Interna
    await sendEmail('contato@bolsaatletausa.com', `Novo Lead: ${data.athlete_name}`, `
      <h3>Novo atleta inscrito no portal!</h3>
      <p><strong>Nome:</strong> ${data.athlete_name}</p>
      <p><strong>E-mail:</strong> ${data.email}</p>
      <p><strong>WhatsApp:</strong> ${data.guardian_whatsapp}</p>
      <p><strong>Posição:</strong> ${data.position}</p>
    `);

    res.status(200).send({ success: true, message: 'All emails sent' });
  } catch (error) {
    console.error('ERRO MESSENGER:', error);
    res.status(500).send({ error: error.message });
  }
});
