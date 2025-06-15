//  WebSocket gateway for real-time events

import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@core/database';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@WSGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'realtime',
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(WebSocketGateway.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new WsException('User not found');
      }

      // Store user info in socket
      client.data.userId = user.id;
      client.data.email = user.email;

      // Join user's personal room
      client.join(`user:${user.id}`);

      // Join team rooms
      const memberships = await this.prisma.teamMember.findMany({
        where: { userId: user.id },
        include: { team: true },
      });

      memberships.forEach(membership => {
        client.join(`team:${membership.teamId}`);
      });

      this.logger.log(`Client connected: ${client.id} - User: ${user.email}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Specification events

  @SubscribeMessage('specification:join')
  @UseGuards(WsJwtGuard)
  async joinSpecification(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { specificationId: string },
  ) {
    const { specificationId } = data;
    const userId = client.data.userId;

    // Verify access
    const hasAccess = await this.verifySpecificationAccess(userId, specificationId);
    if (!hasAccess) {
      throw new WsException('Access denied');
    }

    // Join specification room
    client.join(`specification:${specificationId}`);

    // Notify others
    client.to(`specification:${specificationId}`).emit('user:joined', {
      userId,
      email: client.data.email,
      specificationId,
    });

    return { success: true };
  }

  @SubscribeMessage('specification:leave')
  @UseGuards(WsJwtGuard)
  async leaveSpecification(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { specificationId: string },
  ) {
    const { specificationId } = data;

    client.leave(`specification:${specificationId}`);

    // Notify others
    client.to(`specification:${specificationId}`).emit('user:left', {
      userId: client.data.userId,
      specificationId,
    });

    return { success: true };
  }

  // Comment events

  @SubscribeMessage('comment:typing')
  @UseGuards(WsJwtGuard)
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { specificationId: string; section?: string },
  ) {
    const { specificationId, section } = data;

    // Broadcast to others in the room
    client.to(`specification:${specificationId}`).emit('comment:typing', {
      userId: client.data.userId,
      email: client.data.email,
      section,
    });
  }

  // Notification methods (called by services)

  async notifySpecificationUpdate(specificationId: string, update: any) {
    this.server.to(`specification:${specificationId}`).emit('specification:updated', update);
  }

  async notifyCommentAdded(specificationId: string, comment: any) {
    this.server.to(`specification:${specificationId}`).emit('comment:added', comment);
  }

  async notifyCommentUpdated(specificationId: string, comment: any) {
    this.server.to(`specification:${specificationId}`).emit('comment:updated', comment);
  }

  async notifyReviewRequested(userId: string, review: any) {
    this.server.to(`user:${userId}`).emit('review:requested', review);
  }

  async notifyReviewCompleted(specificationId: string, review: any) {
    this.server.to(`specification:${specificationId}`).emit('review:completed', review);
  }

  async notifyTeamUpdate(teamId: string, update: any) {
    this.server.to(`team:${teamId}`).emit('team:updated', update);
  }

  // Helper methods

  private async verifySpecificationAccess(
    userId: string,
    specificationId: string,
  ): Promise<boolean> {
    const specification = await this.prisma.specification.findFirst({
      where: {
        id: specificationId,
        OR: [
          { authorId: userId },
          {
            team: {
              members: {
                some: { userId },
              },
            },
          },
        ],
      },
    });

    return !!specification;
  }
}

// ============================================
