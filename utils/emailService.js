import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // Use Gmail service directly
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendOTP(to, otp, firstName = 'User') {
    // Check if email is configured
    if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
      console.log('Email credentials not configured. OTP for testing:', otp);
      // For development, we'll just log the OTP and return success
      return { success: true, messageId: 'test-mode', otp };
    }

    const mailOptions = {
      from: `"HealthcarePlus Support" <${process.env.EMAIL_USERNAME}>`,
      to: to,
      subject: 'Password Reset OTP - HealthcarePlus',
      html: this.getOTPEmailTemplate(otp, firstName)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('OTP email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending OTP email:', error);
      throw new Error('Failed to send OTP email');
    }
  }

  async sendEmailVerificationOTP(to, otp, firstName = 'User') {
    // Check if email is configured
    if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
      console.log('Email credentials not configured. Email verification OTP for testing:', otp);
      // For development, we'll just log the OTP and return success
      return { success: true, messageId: 'test-mode', otp };
    }

    const mailOptions = {
      from: `"HealthcarePlus Support" <${process.env.EMAIL_USERNAME}>`,
      to: to,
      subject: 'Email Verification Code - HealthcarePlus',
      html: this.getEmailVerificationOTPTemplate(otp, firstName)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email verification OTP sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email verification OTP:', error);
      throw new Error('Failed to send email verification OTP');
    }
  }

  getOTPEmailTemplate(otp, firstName) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            margin-top: 50px;
            margin-bottom: 50px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
            text-align: center;
          }
          .otp-container {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 10px 25px rgba(240, 147, 251, 0.3);
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: white;
            letter-spacing: 8px;
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          .otp-label {
            color: white;
            font-size: 14px;
            margin-bottom: 10px;
            opacity: 0.9;
          }
          .message {
            color: #333;
            line-height: 1.6;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eee;
          }
          .brand {
            color: #667eea;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 HealthcarePlus</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p class="message">
              Hello <strong>${firstName}</strong>,<br><br>
              We received a request to reset your password. Please use the following OTP code to proceed with your password reset:
            </p>
            
            <div class="otp-container">
              <div class="otp-label">Your OTP Code</div>
              <div class="otp-code">${otp}</div>
            </div>
            
            <div class="warning">
              ⚠️ <strong>Important:</strong> This OTP will expire in 10 minutes. If you didn't request this password reset, please ignore this email and your password will remain unchanged.
            </div>
            
            <p class="message">
              Enter this code on the password reset page to continue. For your security, never share this code with anyone.
            </p>
          </div>
          <div class="footer">
            <p>© 2025 <span class="brand">HealthcarePlus</span>. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getEmailVerificationOTPTemplate(otp, firstName) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - HealthcarePlus</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 24px;
          }
          .message {
            margin-bottom: 30px;
            line-height: 1.6;
            color: #555;
          }
          .otp-container {
            background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            border: 2px solid #e1bee7;
          }
          .otp-label {
            font-size: 16px;
            color: #666;
            margin-bottom: 15px;
            font-weight: 500;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            background: white;
            padding: 15px 25px;
            border-radius: 8px;
            border: 2px dashed #667eea;
            display: inline-block;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            color: #856404;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eee;
          }
          .brand {
            color: #667eea;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 HealthcarePlus</h1>
          </div>
          <div class="content">
            <h2>Welcome! Please Verify Your Email</h2>
            <p class="message">
              Hello <strong>${firstName}</strong>,<br><br>
              Thank you for signing up with HealthcarePlus! To complete your registration and secure your account, please verify your email address using the verification code below:
            </p>
            
            <div class="otp-container">
              <div class="otp-label">Your Verification Code</div>
              <div class="otp-code">${otp}</div>
            </div>
            
            <div class="warning">
              ⚠️ <strong>Important:</strong> This verification code will expire in 10 minutes. If you didn't create an account with us, please ignore this email.
            </div>
            
            <p class="message">
              Enter this code on the verification page to activate your account and gain access to all HealthcarePlus features. For your security, never share this code with anyone.
            </p>
          </div>
          <div class="footer">
            <p>© 2025 <span class="brand">HealthcarePlus</span>. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default new EmailService();
