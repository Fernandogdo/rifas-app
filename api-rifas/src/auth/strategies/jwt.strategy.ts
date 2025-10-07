import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // en prod usa JWKS o secreto fuerte + expiración corta
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    // payload = { sub: userId, email, rol }
    return payload; // se inyecta en req.user
  }
}
