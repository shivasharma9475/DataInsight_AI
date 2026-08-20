import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config/env.js";
import User from "../models/User.js";
import nodemailer from "nodemailer";

function signToken(payload, expiresIn = config.jwtExpiresIn) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function signup(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ detail: "Name, email, and a password (min 6 chars) are required" });
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(400).json({ detail: "An account with this email already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash, authProvider: "local" });

  const token = signToken({ sub: user._id.toString() });
  res.json({ access_token: token, token_type: "bearer", user: publicUser(user) });
}

export async function sendSignupOtp(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({
        detail: "Name, email, and a password (min 6 chars) are required",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({
        detail: "An account with this email already exists",
      });
    }

    const otp = generateOtp();

    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    if (existingUser) {
      existingUser.name = name;
      existingUser.passwordHash = await bcrypt.hash(password, 10);
      existingUser.emailOtp = otp;
      existingUser.emailOtpExpires = otpExpires;
      existingUser.isEmailVerified = false;

      await existingUser.save();
    } else {
      const passwordHash = await bcrypt.hash(password, 10);

      await User.create({
        name,
        email: normalizedEmail,
        passwordHash,
        authProvider: "local",
        isEmailVerified: false,
        emailOtp: otp,
        emailOtpExpires: otpExpires,
      });
    }

    await emailTransporter.sendMail({
      from: `"DataInsight AI" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Your DataInsight AI verification code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2>Verify your DataInsight AI account</h2>

          <p>Hello ${name},</p>

          <p>
            Use the following OTP to verify your email address:
          </p>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            padding: 20px;
            background: #f4f4f4;
            text-align: center;
            margin: 20px 0;
          ">
            ${otp}
          </div>

          <p>This OTP is valid for <strong>10 minutes</strong>.</p>

          <p>
            If you did not request this verification, you can safely ignore
            this email.
          </p>

          <p>— DataInsight AI Team</p>
        </div>
      `,
    });

    return res.json({
      message: "OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("SEND SIGNUP OTP ERROR:", error);

    return res.status(500).json({
      detail: "Unable to send OTP. Please try again later.",
    });
  }
}

export async function verifySignupOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        detail: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        detail: "Signup session not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        detail: "Email is already verified",
      });
    }

    if (!user.emailOtp || !user.emailOtpExpires) {
      return res.status(400).json({
        detail: "OTP not found. Please request a new OTP.",
      });
    }

    if (user.emailOtpExpires < new Date()) {
      return res.status(400).json({
        detail: "OTP has expired. Please request a new OTP.",
      });
    }

    if (user.emailOtp !== otp.toString()) {
      return res.status(400).json({
        detail: "Invalid OTP",
      });
    }

    user.isEmailVerified = true;
    user.emailOtp = null;
    user.emailOtpExpires = null;

    await user.save();

    const token = signToken({
      sub: user._id.toString(),
    });

    return res.json({
      message: "Email verified successfully",
      access_token: token,
      token_type: "bearer",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("VERIFY SIGNUP OTP ERROR:", error);

    return res.status(500).json({
      detail: "Unable to verify OTP. Please try again.",
    });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({
    email: (email || "").toLowerCase(),
  });

  if (
    !user ||
    user.authProvider !== "local" ||
    !user.passwordHash ||
    !(await bcrypt.compare(password || "", user.passwordHash))
  ) {
    return res.status(401).json({
      detail: "Invalid email or password",
    });
  }

  // OTP/email verification check
  if (!user.isEmailVerified) {
    return res.status(403).json({
      detail: "Please verify your email before logging in",
    });
  }

  const token = signToken({
    sub: user._id.toString(),
  });

  res.json({
    access_token: token,
    token_type: "bearer",
    user: publicUser(user),
  });
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    const normalizedEmail = (email || "").trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      authProvider: "local",
    });

    if (user) {
      const resetToken = signToken(
        {
          sub: user._id.toString(),
          purpose: "reset",
        },
        "30m"
      );

      const resetLink =
        `http://localhost:5173/reset-password?token=${resetToken}`;

      await emailTransporter.sendMail({
        from: `"DataInsight AI" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Reset your DataInsight AI password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2>Reset your password</h2>

            <p>Hi ${user.name || "there"},</p>

            <p>
              We received a request to reset your DataInsight AI password.
            </p>

            <p>
              Click the button below to create a new password:
            </p>

            <a
              href="${resetLink}"
              style="
                display: inline-block;
                padding: 12px 20px;
                background: #10b981;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
              "
            >
              Reset Password
            </a>

            <p style="margin-top: 20px;">
              This link will expire in 30 minutes.
            </p>

            <p>
              If you didn't request this password reset, you can safely
              ignore this email.
            </p>
          </div>
        `,
      });

      console.log(`[DEV] Password reset email sent to ${user.email}`);
    }

    // Don't reveal whether the email exists
    return res.json({
      message: "If that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return res.status(500).json({
      detail: "Unable to send reset email. Please try again later.",
    });
  }
}

export async function resetPassword(req, res) {
  const { token, new_password: newPassword } = req.body;

  let payload;

  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(400).json({
      detail: "Invalid or expired reset token",
    });
  }

  if (payload.purpose !== "reset") {
    return res.status(400).json({
      detail: "Invalid reset token",
    });
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      detail: "Password must be at least 8 characters",
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const user = await User.findByIdAndUpdate(
    payload.sub,
    { passwordHash },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({
      detail: "User not found",
    });
  }

  return res.json({
    message: "Password updated successfully",
  });
}

export async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ detail: "User not found" });
  res.json(publicUser(user));
}
