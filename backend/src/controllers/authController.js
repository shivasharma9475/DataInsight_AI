import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config/env.js";
import User from "../models/User.js";

function signToken(payload, expiresIn = config.jwtExpiresIn) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
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

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || "").toLowerCase() });
  if (!user || user.authProvider !== "local" || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ detail: "Invalid email or password" });
  }
  const token = signToken({ sub: user._id.toString() });
  res.json({ access_token: token, token_type: "bearer", user: publicUser(user) });
}

export async function googleLogin(req, res) {
  if (!config.googleClientId) {
    return res.status(501).json({ detail: "Google login is not configured on this server" });
  }
  const { id_token: idToken } = req.body;
  const client = new OAuth2Client(config.googleClientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ detail: "Invalid Google token" });
  }

  let user = await User.findOne({ email: payload.email.toLowerCase() });
  if (!user) {
    user = await User.create({
      name: payload.name || payload.email.split("@")[0],
      email: payload.email.toLowerCase(),
      passwordHash: null,
      authProvider: "google",
    });
  }
  const token = signToken({ sub: user._id.toString() });
  res.json({ access_token: token, token_type: "bearer", user: publicUser(user) });
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || "").toLowerCase() });
  if (user) {
    const resetToken = signToken({ sub: user._id.toString(), purpose: "reset" }, "30m");
    // DEV NOTE: wire this up to a real email provider (SendGrid, SES, etc.) in
    // production. Logging keeps the demo runnable without email credentials.
    console.log(`[DEV] Password reset link for ${email}: /reset-password?token=${resetToken}`);
  }
  res.json({ message: "If that email exists, a reset link has been sent." });
}

export async function resetPassword(req, res) {
  const { token, new_password: newPassword } = req.body;
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(400).json({ detail: "Invalid or expired reset token" });
  }
  if (payload.purpose !== "reset") return res.status(400).json({ detail: "Invalid reset token" });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ detail: "Password must be at least 6 characters" });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(payload.sub, { passwordHash });
  res.json({ message: "Password updated successfully" });
}

export async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ detail: "User not found" });
  res.json(publicUser(user));
}
