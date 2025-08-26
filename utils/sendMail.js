import nodemailer from "nodemailer";

const sendMail = async (options) => {
  // console.log(options);
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMPT_MAIL,
      pass: process.env.SMPT_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: `"Oyela App" <${process.env.SMPT_MAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

export default sendMail;
