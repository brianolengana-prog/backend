const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const userRepository = require('../repositories/user.repository');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
    this.oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/auth/callback`
    );
  }

  generateToken(user) {
    return jwt.sign({ userId: user.id, email: user.email, provider: user.provider }, this.jwtSecret, { expiresIn: this.jwtExpiry });
  }

  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  async register({ name, email, password }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new Error('User already exists');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.create({ name, email, passwordHash, provider: 'email', emailVerified: false });
    const token = this.generateToken(user);
    return { user: this.sanitize(user), token };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) throw new Error('Invalid credentials');
    const token = this.generateToken(user);
    return { user: this.sanitize(user), token };
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
    const token = this.generateToken(user);
    return { user: this.sanitize(user), token };
  }

  sanitize(user) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

module.exports = new AuthService();


