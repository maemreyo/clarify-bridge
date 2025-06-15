//  JWT guard for WebSocket connections

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token;

      if (!token) {
        throw new WsException('No token provided');
      }

      const payload = this.jwtService.verify(token);

      // Token is valid
      return true;
    } catch (err) {
      throw new WsException('Invalid token');
    }
  }
}

// ============================================
