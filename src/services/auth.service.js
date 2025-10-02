const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const userRepository = require('../repositories/user.repository');
const sessionRepository = require('../repositories/session.repository');
const crypto = require('crypto');
const emailVerificationRepository = require('../repositories/emailVerification.repository');
const passwordResetRepository = require('../repositories/passwordReset.repository');
const emailService = require('./email.service');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
    this.oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/auth/google-callback`
    );
  }

  getGoogleAuthUrl() {
    const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
    return this.oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  generateAccessToken(user) {
    return jwt.sign({ userId: user.id, email: user.email, provider: user.provider }, this.jwtSecret, { expiresIn: this.jwtExpiry });
  }

  generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  async register({ name, email, password }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new Error('User already exists');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.create({ name, email, passwordHash, provider: 'email', emailVerified: false });
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sessionRepository.create({ userId: user.id, accessToken, refreshToken, expiresAt, isActive: true });
    // email verification
    const verifyToken = crypto.randomBytes(24).toString('hex');
    await emailVerificationRepository.create({ userId: user.id, token: verifyToken, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) });
    await emailService.sendVerificationEmail(email, verifyToken);
    return { user: this.sanitize(user), token: accessToken, refreshToken };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) throw new Error('Invalid credentials');
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sessionRepository.create({ userId: user.id, accessToken, refreshToken, expiresAt, isActive: true });
    return { user: this.sanitize(user), token: accessToken, refreshToken };
  }

  async handleGoogle(code) {
    const { tokens } = await this.oauth2.getToken(code);
    this.oauth2.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2 });
    const { data: info } = await oauth2.userinfo.get();
    if (!info.email) throw new Error('Google profile missing email');
    let user = await userRepository.findByProvider('google', info.id);
    if (!user) {
      user = await userRepository.create({
        name: info.name || info.email,
        email: info.email,
        provider: 'google',
        providerId: info.id,
        emailVerified: !!info.verified_email
      });
    }
    const token = this.generateAccessToken(user);
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sessionRepository.create({ userId: user.id, accessToken, refreshToken, expiresAt, isActive: true });
    return { user: this.sanitize(user), token: accessToken, refreshToken };
  }

  async refresh(refreshToken) {
    const session = await sessionRepository.findByRefreshToken(refreshToken);
    if (!session || !session.isActive) throw new Error('Invalid refresh token');
    // rotate
    const newAccess = this.generateAccessToken({ id: session.userId, email: '', provider: '' });
    const newRefresh = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sessionRepository.rotate(session.id, { accessToken: newAccess, refreshToken: newRefresh, expiresAt });
    return { token: newAccess, refreshToken: newRefresh };
  }

  async logout(userId) {
    await sessionRepository.deactivateByUserId(userId);
  }

  async verifyEmail(token) {
    const rec = await emailVerificationRepository.findByToken(token);
    if (!rec || rec.used || rec.expiresAt < new Date()) throw new Error('Invalid or expired token');
    await emailVerificationRepository.markUsed(rec.id);
    await userRepository.update(rec.userId, { emailVerified: true });
    return { success: true };
  }

  async resendVerification(email) {
    const user = await userRepository.findByEmail(email);
    if (!user || user.emailVerified) return { success: true };
    const verifyToken = crypto.randomBytes(24).toString('hex');
    await emailVerificationRepository.create({ userId: user.id, token: verifyToken, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) });
    await emailService.sendVerificationEmail(email, verifyToken);
    return { success: true };
  }

  async forgotPassword(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) return { success: true };
    const resetToken = crypto.randomBytes(24).toString('hex');
    await passwordResetRepository.create({ userId: user.id, token: resetToken, expiresAt: new Date(Date.now() + 1000 * 60 * 30) });
    await emailService.sendPasswordResetEmail(email, resetToken);
    return { success: true };
  }

  async resetPassword(token, newPassword) {
    const rec = await passwordResetRepository.findByToken(token);
    if (!rec || rec.used || rec.expiresAt < new Date()) throw new Error('Invalid or expired token');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.update(rec.userId, { passwordHash });
    await passwordResetRepository.markUsed(rec.id);
    return { success: true };
  }

  sanitize(user) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

module.exports = new AuthService();


