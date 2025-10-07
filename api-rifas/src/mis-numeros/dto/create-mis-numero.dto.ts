import { IsEmail } from 'class-validator';
export class MisNumerosLinkDto { @IsEmail() email!: string; }
