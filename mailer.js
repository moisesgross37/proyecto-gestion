const nodemailer = require('nodemailer');

// Esta función crea una cuenta de prueba en Ethereal CADA VEZ que se inicia el servidor.
// Esto es perfecto para desarrollo, pero para producción usaríamos credenciales fijas (ej. Gmail, SendGrid).
async function setupTestAccount() {
    return await nodemailer.createTestAccount();
}

// Esta función principal se encargará de enviar el correo de invitación.
async function sendInvitationEmail(emailDestino, rolDestino, urlInvitacion) {
    try {
        // 1. Configurar la cuenta de prueba de Ethereal
        const testAccount = await setupTestAccount();

        // 2. Configurar el "transporter" - el servicio que realmente envía el correo
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user, // Usuario generado por Ethereal
                pass: testAccount.pass, // Contraseña generada por Ethereal
            },
        });

        // 3. Definir el contenido del correo
        const mailOptions = {
            from: '"Be Eventos SRL - Sistema de Gestión" <no-reply@beeventos.com>',
            to: emailDestino,
            subject: '¡Has sido invitado a unirte al equipo!',
            html: `
                <h1>¡Bienvenido/a!</h1>
                <p>Has sido invitado a unirte al sistema de gestión con el rol de <strong>${rolDestino}</strong>.</p>
                <p>Para completar tu registro y crear tu contraseña, por favor haz clic en el siguiente enlace:</p>
                <a href="${urlInvitacion}" style="background-color: #007bff; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px;">Crear mi Cuenta</a>
                <p>Si no puedes hacer clic en el botón, copia y pega esta URL en tu navegador:</p>
                <p>${urlInvitacion}</p>
                <p>Este enlace expirará en 24 horas.</p>
            `
        };

        // 4. Enviar el correo
        const info = await transporter.sendMail(mailOptions);

        console.log('Correo de invitación enviado: %s', info.messageId);

        // 5. ¡IMPORTANTE! Ethereal nos da una URL para VER el correo que acabamos de enviar.
        // Copia esta URL de la terminal y pégala en tu navegador para ver la bandeja de entrada falsa.
        console.log('URL para previsualizar el correo: %s', nodemailer.getTestMessageUrl(info));

        return { success: true, previewUrl: nodemailer.getTestMessageUrl(info) };

    } catch (error) {
        console.error("Error al enviar el correo de invitación:", error);
        return { success: false, error: error };
    }
}

// Exportamos la función para poder usarla en otros archivos (como server.js)
module.exports = { sendInvitationEmail };