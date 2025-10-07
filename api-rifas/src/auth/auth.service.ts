import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { PrismaService } from 'src/prisma/prisma.service';
import { Rol } from '@prisma/client';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {

  constructor(
    private prismaService: PrismaService,
    private readonly jwt: JwtService,
  ){}
  
  async getUsers() {
    return await this.prismaService.usuario.findMany();
  }

  async signUp(dto: UserDto) {
    // Ya viene con trim desde el DTO; solo checamos que no esté vacío
    if (!dto.email || !dto.nombreUnido) {
      throw new BadRequestException('Datos incompletos');
    }

    const passHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    try {
      const user = await this.prismaService.usuario.create({
        data: {
          email: dto.email,
          passHash,
          nombreUnido: dto.nombreUnido,
          rol: dto.rol ?? Rol.admin, // por defecto admin
        },
        select: { id: true, email: true, rol: true, nombreUnido: true, createdAt: true },
      });

      return user;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('El correo ya está registrado');
      }
      throw e;
    }
  }


  private async validateUser(email: string, password: string) {
    const user = await this.prismaService.usuario.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.isActive) throw new UnauthorizedException('Usuario inactivo');

    const ok = await argon2.verify(user.passHash, password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    return user;
  }

  async logIn(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    const payload = { sub: user.id, email: user.email, rol: user.rol };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'dev-secret',
      expiresIn: '1h', // ajusta a tu política
    });

    // opcional: actualizar lastLogin
    await this.prismaService.usuario.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    }).catch(() => null);

    // devuelve token + perfil visible (sin passHash)
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        nombreUnido: user.nombreUnido,
        isActive: user.isActive,
      },
    };
  }


  async me(userId: string) {
    return this.prismaService.usuario.findUnique({
      where: { id: userId },
      select: { id: true, email: true, rol: true, nombreUnido: true, isActive: true, lastLogin: true, createdAt: true },
    });
  }

  // logout stateless: el cliente borra su token. Aquí solo respondemos OK.
  async logOut() {
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prismaService.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await argon2.verify(user.passHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Contraseña actual incorrecta');

    const newHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prismaService.usuario.update({
      where: { id: userId },
      data: { passHash: newHash },
    });
    return { success: true };
  }

  // ======= OPCIONAL: Reset por email usando tu tabla PasswordReset =======
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prismaService.usuario.findUnique({ where: { email: dto.email } })
      .catch(() => null);
    // Si no existe, no reveles. Devuelve 202 igualmente.
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 min

    if (user) {
      await this.prismaService.passwordReset.create({
        data: { usuarioId: user.id, token, expiresAt: expires },
      });
      // TODO: enviar email con link: https://tu-frontend/reset?token=...
    }
    return { accepted: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const pr = await this.prismaService.passwordReset.findUnique({ where: { token: dto.token } });
    if (!pr || pr.used || pr.expiresAt < new Date()) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    const newHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    await this.prismaService.$transaction([
      this.prismaService.usuario.update({ where: { id: pr.usuarioId }, data: { passHash: newHash } }),
      this.prismaService.passwordReset.update({ where: { token: dto.token }, data: { used: true } }),
    ]);
    return { success: true };
  }

  
  create(createAuthDto: UserDto) {
    return 'This action adds a new auth';
  }


  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  // update(id: number, updateAuthDto: UpdateAuthDto) {
  //   return `This action updates a #${id} auth`;
  // }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
