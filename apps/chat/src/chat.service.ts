import {
  ConversationsRepositoryInterface,
  MessagesRepositoryInterface,
} from '@app/shared';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NewMessageDto } from './dtos/new_messages.dto';

@Injectable()
export class ChatService {
  constructor(
    @Inject('ConversationsRepositoryInterface')
    private readonly conversationsRepository: ConversationsRepositoryInterface,
    @Inject('MessagesRepositoryInterface')
    private readonly messagesRepository: MessagesRepositoryInterface,
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

  private async getUser(id: number) {
    const ob$ = this.authService.send({ cmd: 'get-user' }, { id });

    const user = await firstValueFrom(ob$).catch((err) => console.error(err));

    return user;
  }

  async getConversations(userId: number) {
    const allConversations =
      await this.conversationsRepository.findWithRelations({
        relations: ['users'],
      });

    const userConversations = allConversations.filter((conversation) => {
      const userIds = conversation.users.map((user) => user.id);

      return userIds.includes(userId);
    });

    return userConversations.map((conversation) => ({
      id: conversation.id,
      userIds: conversation?.users?.map((user) => user.id),
    }));
  }

  async createConversation(userId: number, friendId: number) {
    const user = await this.getUser(userId);
    const friend = await this.getUser(friendId);

    if (!user || !friend) return;

    const conversation = await this.conversationsRepository.findConversation(
      userId,
      friendId,
    );

    if (!conversation) {
      await this.conversationsRepository.save({
        users: [user, friend],
      });
    }

    return conversation;
  }

  async createMessage(userId: number, newMessageDto: NewMessageDto) {
    const user = await this.getUser(userId);

    if (!user) return;

    const conversation = await this.conversationsRepository.findConversation(
      userId,
      newMessageDto.friendId,
    );

    if (!conversation) return;

    return await this.messagesRepository.save({
      content: newMessageDto.content,
      user,
      conversation,
    });
  }

  async getMessages(conversationId: number) {
    const allMessages = await this.messagesRepository.findWithRelations({
      where: { conversation: { id: conversationId } },
      relations: ['user', 'conversation'],
      order: { createdAt: 'ASC' },
    });

    return allMessages.map((message) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      creatorId: message.user.id,
      conversationId: message.conversation.id,
    }));
  }
}
